
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.database import get_db
from backend import models, schemas

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])

# 医生列表接口
@router.get("/")
def list_doctors(db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.role == models.UserRole.doctor).all()
    result = []
    for u in users:
        p = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == u.id).first()
        result.append({
            "id": u.id,
            "name": getattr(p, "name", None),
            "department": getattr(p, "department", None),
            "title": getattr(p, "title", None),
            "license_number": getattr(p, "license_number", None),
            "hospital": getattr(p, "hospital", None),
            "is_approved": u.status == models.UserStatus.active,
            "user_id": u.id,
        })
    return result

# 病历管理接口
@router.get("/records/", response_model=List[schemas.MedicalRecordResponse])
def list_medical_records(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    records = db.query(models.MedicalRecord).offset(skip).limit(limit).all()
    return records

@router.get("/records/{record_id}", response_model=schemas.MedicalRecordResponse)
def get_medical_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="病例不存在")
    return record

@router.post("/records/", response_model=schemas.MedicalRecordResponse)
def create_medical_record(record: schemas.MedicalRecordCreate, db: Session = Depends(get_db)):
    db_record = models.MedicalRecord(**record.dict())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.put("/records/{record_id}", response_model=schemas.MedicalRecordResponse)
def update_medical_record(record_id: int, record: schemas.MedicalRecordUpdate, db: Session = Depends(get_db)):
    db_record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="病例不存在")
    for k, v in record.dict(exclude_unset=True).items():
        setattr(db_record, k, v)
    db.commit()
    db.refresh(db_record)
    return db_record

@router.delete("/records/{record_id}")
def delete_medical_record(record_id: int, db: Session = Depends(get_db)):
    db_record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not db_record:
        raise HTTPException(status_code=404, detail="病例不存在")
    db.delete(db_record)
    db.commit()
    return {"message": "删除成功"}

