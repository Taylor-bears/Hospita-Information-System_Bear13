from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
import sys
import os
from datetime import datetime, timedelta

# 添加backend目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from database import get_db
import models, schemas

router = APIRouter(prefix="", tags=["预约管理"])


# ========== 公共/患者端 ==========

@router.get("/appointments/doctors")
def list_available_doctors(db: Session = Depends(get_db)):
    """列出可预约医生及其可用排班数量"""
    doctors = db.query(models.User).filter(
        models.User.role == models.UserRole.doctor,
        models.User.status == models.UserStatus.active
    ).all()

    result = []
    for d in doctors:
        available_count = db.query(models.DoctorSchedule).filter(
            models.DoctorSchedule.doctor_id == d.id,
            models.DoctorSchedule.status == models.ScheduleStatus.open,
            models.DoctorSchedule.capacity > models.DoctorSchedule.booked_count
        ).count()
        result.append({
            "id": d.id,
            "phone": d.phone,
            "available_schedules": available_count
        })
    return result


@router.get("/appointments/doctor/{doctor_id}/schedules", response_model=List[schemas.ScheduleResponse])
def list_doctor_schedules(doctor_id: int, date: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """获取医生的可用排班（可按日期过滤）"""
    q = db.query(models.DoctorSchedule).filter(
        models.DoctorSchedule.doctor_id == doctor_id,
        models.DoctorSchedule.status == models.ScheduleStatus.open,
        models.DoctorSchedule.capacity > models.DoctorSchedule.booked_count
    )
    if date:
        try:
            dt = datetime.strptime(date, "%Y-%m-%d").date()
            today = datetime.today().date()
            if dt < today or dt > (today + timedelta(days=30)):
                raise HTTPException(status_code=400, detail="仅支持未来30天内的预约")
            q = q.filter(models.DoctorSchedule.date == dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")
    return q.all()


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

    doctor = db.query(models.User).filter(models.User.id == payload.doctor_id).first()
    if not doctor or doctor.role != models.UserRole.doctor or doctor.status != models.UserStatus.active:
        raise HTTPException(status_code=400, detail="医生不存在或未激活")

    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == payload.schedule_id).first()
    if not schedule or schedule.doctor_id != doctor.id:
        raise HTTPException(status_code=400, detail="排班不存在或不属于该医生")
    if schedule.status != models.ScheduleStatus.open:
        raise HTTPException(status_code=400, detail="排班未开放")
    # 限制未来30天
    today = datetime.today().date()
    if schedule.date < today or schedule.date > (today + timedelta(days=30)):
        raise HTTPException(status_code=400, detail="仅支持未来30天内的预约")

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
        status=models.AppointmentStatus.confirmed,
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


@router.get("/appointments/my", response_model=List[schemas.AppointmentResponse])
def my_appointments(patient_id: int, db: Session = Depends(get_db)):
    """患者查看自己的预约"""
    return db.query(models.Appointment).filter(models.Appointment.patient_id == patient_id).all()


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
def update_appointment_status(appointment_id: int, status: str, db: Session = Depends(get_db)):
    """更新预约状态（医生端使用）：scheduled->completed/cancelled"""
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="预约不存在")
    if status not in [models.AppointmentStatus.completed.value, models.AppointmentStatus.cancelled.value, models.AppointmentStatus.confirmed.value]:
        raise HTTPException(status_code=400, detail="非法状态")
    appt.status = models.AppointmentStatus(status)
    # 如取消则回滚容量
    if appt.status == models.AppointmentStatus.cancelled:
        schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == appt.schedule_id).first()
        if schedule and schedule.booked_count > 0:
            schedule.booked_count -= 1
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


@router.get("/doctor/appointments/my_detailed")
def doctor_my_appointments_detailed(
    doctor_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """医生端查看自己的预约（含患者信息与预约时间）"""
    q = (
        db.query(models.Appointment, models.DoctorSchedule, models.User)
        .join(models.DoctorSchedule, models.Appointment.schedule_id == models.DoctorSchedule.id)
        .join(models.User, models.Appointment.patient_id == models.User.id)
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
    for appt, sched, patient in rows:
        appt_dt = datetime.combine(sched.date, sched.start_time)
        result.append({
            "id": appt.id,
            "appointment_date": appt_dt.isoformat(),
            "status": appt.status.value if hasattr(appt.status, "value") else appt.status,
            "patient": {
                "name": getattr(patient, "phone", ""),
                "phone": getattr(patient, "phone", "")
            }
        })
    return result
