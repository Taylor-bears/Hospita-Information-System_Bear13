from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, time

import sys
import os
sys.path.append(os.path.dirname(__file__))

import models

def setup_db():
    engine = create_engine("sqlite:///./medical_demo_e2e.db", connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return SessionLocal

def seed(SessionLocal):
    db = SessionLocal()
    doctor = models.User(phone="15000000011", password="hash", role=models.UserRole.doctor, status=models.UserStatus.active)
    patient_ids = []
    for i in range(20):
        p = models.User(phone=f"15000000{i:03}", password="hash", role=models.UserRole.user, status=models.UserStatus.active)
        db.add(p)
        db.flush()
        patient_ids.append(p.id)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    schedule_am = models.DoctorSchedule(doctor_id=doctor.id, date=date.today(), start_time=time(9,0), end_time=time(12,0), capacity=8, booked_count=0, status=models.ScheduleStatus.open)
    db.add(schedule_am)
    db.commit()
    db.refresh(schedule_am)
    return doctor.id, patient_ids, schedule_am.id

def try_book(SessionLocal, patient_id, doctor_id, schedule_id):
    db = SessionLocal()
    # 幂等检查
    exists = db.query(models.Appointment).filter(
        models.Appointment.patient_id == patient_id,
        models.Appointment.schedule_id == schedule_id,
        models.Appointment.status != models.AppointmentStatus.cancelled,
    ).first()
    if exists:
        return False
    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == schedule_id).first()
    if schedule.booked_count >= schedule.capacity:
        return False
    appt = models.Appointment(patient_id=patient_id, doctor_id=doctor_id, schedule_id=schedule_id, status=models.AppointmentStatus.confirmed)
    schedule.booked_count += 1
    db.add(appt)
    db.commit()
    return True

def run():
    SessionLocal = setup_db()
    doctor_id, patient_ids, schedule_id = seed(SessionLocal)
    success = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        futures = [ex.submit(try_book, SessionLocal, pid, doctor_id, schedule_id) for pid in patient_ids]
        for f in as_completed(futures):
            if f.result(): success += 1
    db = SessionLocal()
    schedule = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.id == schedule_id).first()
    print({"success": success, "booked": schedule.booked_count, "capacity": schedule.capacity})

if __name__ == "__main__":
    run()

