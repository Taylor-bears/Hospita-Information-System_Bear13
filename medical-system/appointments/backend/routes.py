from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
import sys
import os
from datetime import datetime

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
            q = q.filter(models.DoctorSchedule.date == dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误，应为 YYYY-MM-DD")
    return q.all()


@router.post("/appointments", response_model=schemas.AppointmentResponse)
def create_appointment(payload: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    """创建预约（校验容量、重复预约、角色与状态）"""
    patient = db.query(models.User).filter(models.User.id == payload.patient_id).first()
    if not patient or patient.role != models.UserRole.user:
        raise HTTPException(status_code=400, detail="患者不存在或角色不正确")
    if patient.status != models.UserStatus.active:
        raise HTTPException(status_code=403, detail="患者账号未激活")

    doctor = db.query(models.User).filter(models.User.id == payload.doctor_id).first()
    if not doctor or doctor.role != models.UserRole.doctor or doctor.status != models.UserStatus.active:
        raise HTTPException(status_code=400, detail="医生不存在或未激活")

    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == payload.schedule_id).first()
    if not schedule or schedule.doctor_id != doctor.id:
        raise HTTPException(status_code=400, detail="排班不存在或不属于该医生")
    if schedule.status != models.ScheduleStatus.open:
        raise HTTPException(status_code=400, detail="排班未开放")

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
    db.commit()
    return {"message": "已取消"}


# ========== 医生端 ==========

@router.get("/doctor/schedules/my", response_model=List[schemas.ScheduleResponse])
def doctor_my_schedules(doctor_id: int, db: Session = Depends(get_db)):
    return db.query(models.DoctorSchedule).filter(models.DoctorSchedule.doctor_id == doctor_id).all()


@router.post("/doctor/schedules", response_model=schemas.ScheduleResponse)
def create_schedule(payload: schemas.ScheduleCreate, db: Session = Depends(get_db)):
    doctor = db.query(models.User).filter(models.User.id == payload.doctor_id).first()
    if not doctor or doctor.role != models.UserRole.doctor or doctor.status != models.UserStatus.active:
        raise HTTPException(status_code=400, detail="医生不存在或未激活")
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

