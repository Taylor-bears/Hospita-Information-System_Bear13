from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
import sys
import os
from datetime import datetime, timedelta, date

# 添加backend目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from database import get_db
import models, schemas

router = APIRouter(prefix="", tags=["预约管理"])


def _ensure_within_next_week(target_date: date):
    """校验为今日至未来7日内"""
    today = datetime.today().date()
    last = today + timedelta(days=7)
    if target_date < today or target_date > last:
        raise HTTPException(status_code=400, detail="仅支持今日至未来7日内的排班/预约")


# ========== 公共/患者端 ==========

@router.get("/appointments/doctors")
def list_available_doctors(db: Session = Depends(get_db)):
    """列出可预约医生及其可用排班数量（仅未来7天）"""
    doctors = db.query(models.User).filter(
        models.User.role == models.UserRole.doctor,
        models.User.status == models.UserStatus.active
    ).all()

    today = datetime.today().date()
    last = today + timedelta(days=7)
    result = []
    for d in doctors:
        profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == d.id).first()
        available_query = db.query(models.DoctorSchedule).filter(
            models.DoctorSchedule.doctor_id == d.id,
            models.DoctorSchedule.status == models.ScheduleStatus.open,
            models.DoctorSchedule.date >= today,
            models.DoctorSchedule.date <= last,
            models.DoctorSchedule.capacity > models.DoctorSchedule.booked_count
        )
        available_count = available_query.count()
        result.append({
            "id": d.id,
            "name": getattr(profile, "name", None),
            "department": getattr(profile, "department", None),
            "title": getattr(profile, "title", None),
            "phone": d.phone,
            "available_schedules": available_count,
            "fully_booked": available_count == 0
        })
    return result


@router.get("/appointments/doctor/{doctor_id}/schedules", response_model=List[schemas.ScheduleResponse])
def list_doctor_schedules(doctor_id: int, date: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """获取医生的可用排班（可按日期过滤），仅未来7日"""
    today = datetime.today().date()
    last = today + timedelta(days=7)
    q = db.query(models.DoctorSchedule).filter(
        models.DoctorSchedule.doctor_id == doctor_id,
        models.DoctorSchedule.status == models.ScheduleStatus.open,
        models.DoctorSchedule.date >= today,
        models.DoctorSchedule.date <= last
    )
    if date:
        try:
            dt = datetime.strptime(date, "%Y-%m-%d").date()
            _ensure_within_next_week(dt)
            q = q.filter(models.DoctorSchedule.date == dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，应为YYYY-MM-DD")
    schedules = q.all()
    for s in schedules:
        s.fully_booked = s.booked_count >= s.capacity  # type: ignore
    return schedules


@router.post("/appointments", response_model=schemas.AppointmentResponse)
def create_appointment(payload: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    """创建预约（最简版本：若患者不存在则自动创建激活患者）"""
    patient = db.query(models.User).filter(models.User.id == payload.patient_id).first()
    if not patient:
        try:
            pid = int(payload.patient_id)
        except Exception:
            raise HTTPException(status_code=400, detail="非法患者ID")
        patient = models.User(
            id=pid,
            phone="15000000000",
            password="placeholder",
            role=models.UserRole.user,
            status=models.UserStatus.active,
        )
        db.add(patient)
        db.commit()
    # 确保患者档案存在，便于医生端显示实名
    profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == patient.id).first()
    if not profile:
        profile = models.PatientProfile(user_id=patient.id, name=patient.phone)
        db.add(profile)
        db.commit()

    doctor = db.query(models.User).filter(models.User.id == payload.doctor_id).first()
    if not doctor or doctor.role != models.UserRole.doctor or doctor.status != models.UserStatus.active:
        raise HTTPException(status_code=400, detail="医生不存在或未激活")

    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == payload.schedule_id).first()
    if not schedule or schedule.doctor_id != doctor.id:
        raise HTTPException(status_code=400, detail="排班不存在或不属于该医生")
    if schedule.status != models.ScheduleStatus.open:
        raise HTTPException(status_code=400, detail="排班未开放")
    # 限制未来7天
    _ensure_within_next_week(schedule.date)

    # 重复预约检查
    exists = db.query(models.Appointment).filter(
        and_(
            models.Appointment.patient_id == patient.id,
            models.Appointment.schedule_id == schedule.id,
            models.Appointment.status != models.AppointmentStatus.cancelled,
        )
    ).first()
    if exists:
        return exists  # 幂等返回

    # 容量检查
    if schedule.booked_count >= schedule.capacity:
        raise HTTPException(status_code=400, detail="排班容量不足")

    # 创建预约（简单事务）
    appt = models.Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        schedule_id=schedule.id,
        status=models.AppointmentStatus.scheduled,
    )
    schedule.booked_count += 1
    # 同步日聚合表计数
    day = db.query(models.DoctorDaySchedule).filter(
        models.DoctorDaySchedule.doctor_id == doctor.id,
        models.DoctorDaySchedule.date == schedule.date
    ).first()
    if not day:
        day = models.DoctorDaySchedule(doctor_id=doctor.id, date=schedule.date)
        db.add(day)
    sh = int(str(schedule.start_time).split(":")[0])
    if sh < 12:
        day.am_booked_count = (day.am_booked_count or 0) + 1
        if day.am_capacity and day.am_booked_count > day.am_capacity:
            raise HTTPException(status_code=400, detail="上午容量已满")
    else:
        day.pm_booked_count = (day.pm_booked_count or 0) + 1
        if day.pm_capacity and day.pm_booked_count > day.pm_capacity:
            raise HTTPException(status_code=400, detail="下午容量已满")
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


@router.get("/appointments/my")
def my_appointments(patient_id: int, db: Session = Depends(get_db)):
    """患者查看自己的预约（含医生和时间信息）"""
    rows = (
        db.query(models.Appointment, models.DoctorSchedule, models.User, models.DoctorProfile)
        .join(models.DoctorSchedule, models.Appointment.schedule_id == models.DoctorSchedule.id)
        .join(models.User, models.Appointment.doctor_id == models.User.id)
        .outerjoin(models.DoctorProfile, models.DoctorProfile.user_id == models.User.id)
        .filter(models.Appointment.patient_id == patient_id)
        .order_by(models.Appointment.created_at.desc())
        .all()
    )
    result = []
    for appt, sched, doctor_user, doctor_profile in rows:
        appt_time = f"{str(sched.start_time)[:5]}-{str(sched.end_time)[:5]}"
        result.append({
            "id": appt.id,
            "patient_id": appt.patient_id,
            "doctor_id": appt.doctor_id,
            "schedule_id": appt.schedule_id,
            "status": appt.status.value if hasattr(appt.status, 'value') else appt.status,
            "created_at": appt.created_at,
            "appointment_date": sched.date.isoformat(),
            "appointment_time": appt_time,
            "doctor_name": getattr(doctor_profile, "name", doctor_user.phone),
            "doctor_department": getattr(doctor_profile, "department", None),
        })
    return result


@router.post("/appointments/{appointment_id}/cancel")
def cancel_appointment(appointment_id: int, patient_id: int, db: Session = Depends(get_db)):
    """患者取消自己的预约"""
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt or appt.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="预约不存在或无权限")
    if appt.status == models.AppointmentStatus.cancelled:
        return {"message": "已取消"}
    appt.status = models.AppointmentStatus.cancelled
    # 回滚容量
    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == appt.schedule_id).first()
    if schedule and schedule.booked_count > 0:
        schedule.booked_count -= 1
        # 同步日聚合表计数回滚
        day = db.query(models.DoctorDaySchedule).filter(
            models.DoctorDaySchedule.doctor_id == appt.doctor_id,
            models.DoctorDaySchedule.date == schedule.date
        ).first()
        if day:
            sh = int(str(schedule.start_time).split(":")[0])
            if sh < 12 and day.am_booked_count > 0:
                day.am_booked_count -= 1
            elif sh >= 12 and day.pm_booked_count > 0:
                day.pm_booked_count -= 1
    db.commit()
    return {"message": "已取消"}


@router.post("/appointments/{appointment_id}/status")
def update_appointment_status(
    appointment_id: int,
    status: str = Body(..., embed=True, description="新状态"),
    db: Session = Depends(get_db)
):
    """更新预约状态（医生端使用）：scheduled/confirmed/completed/cancelled"""
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="预约不存在")
    if status not in [
        models.AppointmentStatus.scheduled.value,
        models.AppointmentStatus.pending.value,
        models.AppointmentStatus.confirmed.value,
        models.AppointmentStatus.completed.value,
        models.AppointmentStatus.cancelled.value,
    ]:
        raise HTTPException(status_code=400, detail="非法状态")
    appt.status = models.AppointmentStatus(status)
    # 如取消则回滚容量
    if appt.status == models.AppointmentStatus.cancelled:
        schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == appt.schedule_id).first()
        if schedule and schedule.booked_count > 0:
            schedule.booked_count -= 1
            day = db.query(models.DoctorDaySchedule).filter(
                models.DoctorDaySchedule.doctor_id == appt.doctor_id,
                models.DoctorDaySchedule.date == schedule.date
            ).first()
            if day:
                sh = int(str(schedule.start_time).split(":")[0])
                if sh < 12 and day.am_booked_count > 0:
                    day.am_booked_count -= 1
                elif sh >= 12 and day.pm_booked_count > 0:
                    day.pm_booked_count -= 1
    db.commit()
    return {"message": "状态已更新"}


# ========== 医生端 ==========

@router.get("/doctor/schedules/my", response_model=List[schemas.ScheduleResponse])
def doctor_my_schedules(doctor_id: int, db: Session = Depends(get_db)):
    return db.query(models.DoctorSchedule).filter(models.DoctorSchedule.doctor_id == doctor_id).all()


@router.post("/doctor/schedules", response_model=schemas.ScheduleResponse)
def create_schedule(payload: schemas.ScheduleCreate, db: Session = Depends(get_db)):
    doctor = db.query(models.User).filter(models.User.id == payload.doctor_id).first()
    if not doctor or doctor.role != models.UserRole.doctor or doctor.status != models.UserStatus.active:
        raise HTTPException(status_code=400, detail="医生不存在或未激活")
    _ensure_within_next_week(payload.date)
    # 规范为上午/下午固定时段
    start_hour = int(str(payload.start_time).split(":")[0])
    if start_hour < 12:
        payload.start_time = datetime.strptime("09:00:00", "%H:%M:%S").time()
        payload.end_time = datetime.strptime("12:00:00", "%H:%M:%S").time()
    else:
        payload.start_time = datetime.strptime("13:00:00", "%H:%M:%S").time()
        payload.end_time = datetime.strptime("17:00:00", "%H:%M:%S").time()

    # UPSERT：若同一医生同一天同一开始时间存在排班，则更新容量与状态
    exist = db.query(models.DoctorSchedule).filter(
        models.DoctorSchedule.doctor_id == payload.doctor_id,
        models.DoctorSchedule.date == payload.date,
        models.DoctorSchedule.start_time == payload.start_time
    ).first()
    if exist:
        exist.capacity = payload.capacity
        exist.end_time = payload.end_time
        exist.status = models.ScheduleStatus.open
        db.commit()
        db.refresh(exist)
        # 同步日聚合表容量
        day = db.query(models.DoctorDaySchedule).filter(
            models.DoctorDaySchedule.doctor_id == payload.doctor_id,
            models.DoctorDaySchedule.date == payload.date
        ).first()
        if not day:
            day = models.DoctorDaySchedule(doctor_id=payload.doctor_id, date=payload.date)
            db.add(day)
        if start_hour < 12:
            day.am_capacity = payload.capacity
        else:
            day.pm_capacity = payload.capacity
        db.commit()
        return exist
    else:
        schedule = models.DoctorSchedule(
            doctor_id=payload.doctor_id,
            date=payload.date,
            start_time=payload.start_time,
            end_time=payload.end_time,
            capacity=payload.capacity,
            status=models.ScheduleStatus.open,
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        # 同步日聚合表容量
        day = db.query(models.DoctorDaySchedule).filter(
            models.DoctorDaySchedule.doctor_id == payload.doctor_id,
            models.DoctorDaySchedule.date == payload.date
        ).first()
        if not day:
            day = models.DoctorDaySchedule(doctor_id=payload.doctor_id, date=payload.date)
            db.add(day)
        if start_hour < 12:
            day.am_capacity = payload.capacity
        else:
            day.pm_capacity = payload.capacity
        db.commit()
        return schedule


@router.delete("/doctor/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, doctor_id: int, db: Session = Depends(get_db)):
    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == schedule_id).first()
    if not schedule or schedule.doctor_id != doctor_id:
        raise HTTPException(status_code=404, detail="排班不存在或无权限")
    # 若已有非取消预约则禁止删除
    has_appt = db.query(models.Appointment).filter(
        models.Appointment.schedule_id == schedule.id,
        models.Appointment.status != models.AppointmentStatus.cancelled
    ).count() > 0
    if has_appt:
        raise HTTPException(status_code=400, detail="该排班已有预约，不可删除")
    db.delete(schedule)
    db.commit()
    return {"message": "已删除"}


@router.get("/doctor/appointments/my", response_model=List[schemas.AppointmentResponse])
def doctor_my_appointments(doctor_id: int, db: Session = Depends(get_db)):
    return db.query(models.Appointment).filter(models.Appointment.doctor_id == doctor_id).all()


@router.get("/appointments/doctor/{doctor_id}")
def doctor_appointments(
    doctor_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """医生端查看预约列表，附带患者姓名/电话"""
    q = (
        db.query(models.Appointment, models.DoctorSchedule, models.User, models.PatientProfile)
        .join(models.DoctorSchedule, models.Appointment.schedule_id == models.DoctorSchedule.id)
        .join(models.User, models.Appointment.patient_id == models.User.id)
        .outerjoin(models.PatientProfile, models.PatientProfile.user_id == models.User.id)
        .filter(models.Appointment.doctor_id == doctor_id)
    )

    if date_from:
        try:
            dtf = datetime.strptime(date_from, "%Y-%m-%d").date()
            q = q.filter(models.DoctorSchedule.date >= dtf)
        except ValueError:
            raise HTTPException(status_code=400, detail="date_from 格式错误，应为YYYY-MM-DD")
    if date_to:
        try:
            dtt = datetime.strptime(date_to, "%Y-%m-%d").date()
            q = q.filter(models.DoctorSchedule.date < dtt)
        except ValueError:
            raise HTTPException(status_code=400, detail="date_to 格式错误，应为YYYY-MM-DD")

    rows = q.order_by(models.DoctorSchedule.date, models.DoctorSchedule.start_time).all()
    result = []
    for appt, sched, patient_user, patient_profile in rows:
        patient_name = (getattr(patient_profile, "name", None) or "").strip() or patient_user.phone
        result.append({
            "id": appt.id,
            "appointment_date": sched.date.isoformat(),
            "appointment_time": f"{str(sched.start_time)[:5]}-{str(sched.end_time)[:5]}",
            "status": appt.status.value if hasattr(appt.status, 'value') else appt.status,
            "patient_id": patient_user.id,
            "patient_name": patient_name,
            "patient_phone": patient_user.phone,
            "created_at": appt.created_at,
        })
    return result


@router.get("/doctor/appointments/my_detailed")
def doctor_my_appointments_detailed(
    doctor_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """医生端查看自己的预约（含患者信息与预约时间）"""
    q = (
        db.query(models.Appointment, models.DoctorSchedule, models.User, models.PatientProfile)
        .join(models.DoctorSchedule, models.Appointment.schedule_id == models.DoctorSchedule.id)
        .join(models.User, models.Appointment.patient_id == models.User.id)
        .outerjoin(models.PatientProfile, models.PatientProfile.user_id == models.User.id)
        .filter(models.Appointment.doctor_id == doctor_id)
    )

    if date_from:
        try:
            dtf = datetime.strptime(date_from, "%Y-%m-%d").date()
            q = q.filter(models.DoctorSchedule.date >= dtf)
        except ValueError:
            raise HTTPException(status_code=400, detail="date_from 格式错误，应为 YYYY-MM-DD")
    if date_to:
        try:
            dtt = datetime.strptime(date_to, "%Y-%m-%d").date()
            q = q.filter(models.DoctorSchedule.date < dtt)
        except ValueError:
            raise HTTPException(status_code=400, detail="date_to 格式错误，应为 YYYY-MM-DD")

    rows = q.order_by(models.DoctorSchedule.date, models.DoctorSchedule.start_time).all()
    result = []
    for appt, sched, patient, patient_profile in rows:
        appt_dt = datetime.combine(sched.date, sched.start_time)
        patient_name = (getattr(patient_profile, "name", None) or "").strip() or getattr(patient, "phone", "")
        result.append({
            "id": appt.id,
            "appointment_date": appt_dt.isoformat(),
            "status": appt.status.value if hasattr(appt.status, "value") else appt.status,
            "patient": {
                "name": patient_name,
                "phone": getattr(patient, "phone", "")
            }
        })
    return result
