from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta, date
from backend.database import get_db
from backend import models, schemas

router = APIRouter(prefix="/api/stats", tags=["Statistics"])

@router.get("/doctor")
def get_doctor_stats(doctor_id: int, db: Session = Depends(get_db)):
    """获取医生工作台统计数据"""
    today = datetime.now().date()
    # Change "Week" to "Next 7 Days" (Rolling Week) to better reflect upcoming workload
    # Old logic (Calendar Week): week_start = today - timedelta(days=today.weekday())
    week_start = today
    week_end = today + timedelta(days=6)

    # 1. 今日预约
    # Explicit join condition: Appointment.schedule_id == DoctorSchedule.id
    today_appointments = db.query(models.Appointment).join(
        models.DoctorSchedule, models.Appointment.schedule_id == models.DoctorSchedule.id
    ).filter(
        models.Appointment.doctor_id == doctor_id,
        models.DoctorSchedule.date == today,
        models.Appointment.status != models.AppointmentStatus.cancelled
    ).count()

    # 2. 本周预约 (Rolling 7 days)
    week_appointments = db.query(models.Appointment).join(
        models.DoctorSchedule, models.Appointment.schedule_id == models.DoctorSchedule.id
    ).filter(
        models.Appointment.doctor_id == doctor_id,
        models.DoctorSchedule.date >= week_start,
        models.DoctorSchedule.date <= week_end,
        models.Appointment.status != models.AppointmentStatus.cancelled
    ).count()

    # 3. 待处理处方 (status=pending)
    pending_prescriptions = db.query(models.Prescription).filter(
        models.Prescription.doctor_id == doctor_id,
        models.Prescription.status == models.PrescriptionStatus.pending
    ).count()

    # 4. 总患者数 (去重)
    total_patients = db.query(models.Appointment.patient_id).filter(
        models.Appointment.doctor_id == doctor_id
    ).distinct().count()

    return {
        "todayAppointments": today_appointments,
        "weekAppointments": week_appointments,
        "pendingPrescriptions": pending_prescriptions,
        "totalPatients": total_patients
    }

@router.get("/pharmacy")
def get_pharmacy_stats(db: Session = Depends(get_db)):
    """获取药房工作台统计数据"""
    today = datetime.now().date()

    # 1. 药品总数
    total_medicines = db.query(models.Medication).count()

    # 2. 库存预警 (stock <= min_stock)
    low_stock_medicines = db.query(models.Medication).filter(
        models.Medication.stock <= models.Medication.min_stock
    ).count()

    # 3. 待配药处方 (status=paid)
    pending_prescriptions = db.query(models.Prescription).filter(
        models.Prescription.status == models.PrescriptionStatus.paid
    ).count()

    # 4. 今日已完成处方
    completed_prescriptions = db.query(models.Prescription).filter(
        models.Prescription.status == models.PrescriptionStatus.dispensed,
        func.date(models.Prescription.updated_at) == today
    ).count()

    # 5. 营收统计 (单位：分 -> 元)
    # 今日营收
    today_revenue_cents = db.query(func.sum(models.Prescription.total_price)).filter(
        models.Prescription.status.in_([models.PrescriptionStatus.paid, models.PrescriptionStatus.dispensed]),
        func.date(models.Prescription.created_at) == today
    ).scalar() or 0

    # 总营收
    total_revenue_cents = db.query(func.sum(models.Prescription.total_price)).filter(
        models.Prescription.status.in_([models.PrescriptionStatus.paid, models.PrescriptionStatus.dispensed])
    ).scalar() or 0

    return {
        "totalMedicines": total_medicines,
        "lowStockMedicines": low_stock_medicines,
        "pendingPrescriptions": pending_prescriptions,
        "completedPrescriptions": completed_prescriptions,
        "todayRevenue": today_revenue_cents, # 单位：分
        "totalRevenue": total_revenue_cents  # 单位：分
    }

@router.get("/patient")
def get_patient_stats(patient_id: int, db: Session = Depends(get_db)):
    """获取患者首页统计数据"""
    today = datetime.now().date()
    month_start = today.replace(day=1)

    # 1. 今日预约
    today_appointments = db.query(models.Appointment).join(models.DoctorSchedule).filter(
        models.Appointment.patient_id == patient_id,
        models.DoctorSchedule.date == today,
        models.Appointment.status != models.AppointmentStatus.cancelled
    ).count()

    # 2. 本月预约
    month_appointments = db.query(models.Appointment).join(models.DoctorSchedule).filter(
        models.Appointment.patient_id == patient_id,
        models.DoctorSchedule.date >= month_start,
        models.Appointment.status != models.AppointmentStatus.cancelled
    ).count()

    # 3. 待支付药单
    pending_payment = db.query(models.Prescription).filter(
        models.Prescription.patient_id == patient_id,
        models.Prescription.status == models.PrescriptionStatus.pending
    ).count()

    # 4. 历史药单 (已完成/已发药)
    history_prescriptions = db.query(models.Prescription).filter(
        models.Prescription.patient_id == patient_id,
        models.Prescription.status.in_([models.PrescriptionStatus.paid, models.PrescriptionStatus.dispensed])
    ).count()

    return {
        "todayAppointments": today_appointments,
        "monthAppointments": month_appointments,
        "pendingPaymentPrescriptions": pending_payment,
        "historyPrescriptions": history_prescriptions
    }
