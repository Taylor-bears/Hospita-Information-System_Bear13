from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, time

import sys
import os
sys.path.append(os.path.dirname(__file__))

import models


def run():
    engine = create_engine("sqlite:///:memory:")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # 创建用户
    doctor = models.User(phone="15000000001", password="hash", role=models.UserRole.doctor, status=models.UserStatus.active)
    patient = models.User(phone="15000000002", password="hash", role=models.UserRole.user, status=models.UserStatus.active)
    db.add_all([doctor, patient])
    db.commit()
    db.refresh(doctor)
    db.refresh(patient)

    # 创建排班
    schedule = models.DoctorSchedule(
        doctor_id=doctor.id,
        date=date.today(),
        start_time=time(9, 0),
        end_time=time(9, 30),
        capacity=2,
        status=models.ScheduleStatus.open,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    # 创建预约
    appt1 = models.Appointment(patient_id=patient.id, doctor_id=doctor.id, schedule_id=schedule.id, status=models.AppointmentStatus.confirmed)
    schedule.booked_count += 1
    db.add(appt1)
    db.commit()

    # 重复预约（应检测到存在，不重复增加）
    exists = db.query(models.Appointment).filter(models.Appointment.patient_id == patient.id, models.Appointment.schedule_id == schedule.id).count()
    print("appointments_count_for_patient_schedule=", exists)
    print("booked_count=", db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == schedule.id).first().booked_count)

    # 取消预约
    appt1.status = models.AppointmentStatus.cancelled
    schedule.booked_count -= 1
    db.commit()
    print("after_cancel_booked_count=", db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == schedule.id).first().booked_count)


if __name__ == "__main__":
    run()

