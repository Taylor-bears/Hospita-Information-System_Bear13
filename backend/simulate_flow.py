import sys
import os
import random
from datetime import date, time, datetime, timedelta

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine
import models
from passlib.context import CryptContext

# Setup
models.Base.metadata.create_all(bind=engine)
db = SessionLocal()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def log(msg):
    print(f"[SIMULATION] {msg}")

def run_simulation():
    log("Starting Hospital Flow Simulation...")

    # 1. Create Actors
    # Doctor
    doctor_phone = f"139{random.randint(10000000, 99999999)}"
    doctor = models.User(
        phone=doctor_phone,
        password=get_password_hash("123456"),
        role=models.UserRole.doctor,
        status=models.UserStatus.active
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    
    doc_profile = models.DoctorProfile(
        user_id=doctor.id,
        name=f"Dr. {random.randint(1, 100)}",
        department="General",
        title="Chief",
        hospital="Central Hospital"
    )
    db.add(doc_profile)
    log(f"Created Doctor: {doctor.phone} (ID: {doctor.id})")

    # Patient
    patient_phone = f"138{random.randint(10000000, 99999999)}"
    patient = models.User(
        phone=patient_phone,
        password=get_password_hash("123456"),
        role=models.UserRole.user,
        status=models.UserStatus.active
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    
    pat_profile = models.PatientProfile(
        user_id=patient.id,
        name=f"Patient {random.randint(1, 100)}",
        id_card=f"11010119900101{random.randint(1000, 9999)}"
    )
    db.add(pat_profile)
    log(f"Created Patient: {patient.phone} (ID: {patient.id})")

    # Medication
    med_name = f"Drug-{random.randint(1000, 9999)}"
    med = models.Medication(
        name=med_name,
        category="Antibiotics",
        stock=100,
        price=5000, # 50.00 CNY
        status=models.MedicationStatus.active
    )
    db.add(med)
    db.commit()
    db.refresh(med)
    log(f"Created Medication: {med.name} (Stock: {med.stock}, Price: {med.price/100})")

    # 2. Doctor sets Schedule
    schedule = models.DoctorSchedule(
        doctor_id=doctor.id,
        date=date.today(),
        start_time=time(9, 0),
        end_time=time(12, 0),
        capacity=5,
        booked_count=0,
        status=models.ScheduleStatus.open
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    log(f"Doctor set schedule for today (ID: {schedule.id})")

    # 3. Patient Books Appointment
    appointment = models.Appointment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        schedule_id=schedule.id,
        status=models.AppointmentStatus.confirmed
    )
    schedule.booked_count += 1
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    log(f"Patient booked appointment (ID: {appointment.id})")

    # 4. Doctor Diagnoses (Create Medical Record)
    record = models.MedicalRecord(
        patient_id=patient.id,
        doctor_id=doctor.id,
        diagnosis="Common Cold",
        treatment="Rest and drink water",
        status=models.MedicalRecordStatus.active
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    log(f"Doctor created Medical Record (ID: {record.id})")

    # 5. Doctor Prescribes
    prescription = models.Prescription(
        medical_record_id=record.id,
        doctor_id=doctor.id,
        patient_id=patient.id,
        status=models.PrescriptionStatus.pending,
        total_price=med.price * 2,
        notes="Take twice a day"
    )
    db.add(prescription)
    db.commit()
    db.refresh(prescription)

    p_item = models.PrescriptionItem(
        prescription_id=prescription.id,
        medication_id=med.id,
        quantity=2,
        price_at_time=med.price,
        usage_instruction="Oral"
    )
    db.add(p_item)
    db.commit()
    log(f"Doctor prescribed {med.name} x2. Total: {prescription.total_price/100}")

    # 6. Patient Pays
    # Simulate API call logic
    if prescription.status == models.PrescriptionStatus.pending:
        prescription.status = models.PrescriptionStatus.paid
        db.commit()
        log(f"Patient paid for prescription (ID: {prescription.id})")
    
    # 7. Pharmacy Dispenses
    # Check stock
    current_med = db.query(models.Medication).filter(models.Medication.id == med.id).first()
    log(f"Stock before dispensing: {current_med.stock}")
    
    if prescription.status == models.PrescriptionStatus.paid:
        # Deduct stock
        current_med.stock -= 2
        prescription.status = models.PrescriptionStatus.dispensed
        db.commit()
        log(f"Pharmacy dispensed prescription (ID: {prescription.id})")
    
    final_med = db.query(models.Medication).filter(models.Medication.id == med.id).first()
    log(f"Stock after dispensing: {final_med.stock}")

    log("Simulation Completed Successfully!")
    db.close()

if __name__ == "__main__":
    run_simulation()
