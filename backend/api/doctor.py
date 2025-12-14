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

# ==================== 病历管理 ====================

@router.get("/records", response_model=List[schemas.MedicalRecordResponse])
def list_medical_records(
    patient_id: int = None, 
    doctor_id: int = None, 
    skip: int = 0, 
    limit: int = 20, 
    db: Session = Depends(get_db)
):
    q = db.query(models.MedicalRecord)
    if patient_id:
        q = q.filter(models.MedicalRecord.patient_id == patient_id)
    if doctor_id:
        q = q.filter(models.MedicalRecord.doctor_id == doctor_id)
    records = q.order_by(models.MedicalRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records

@router.get("/records/{record_id}", response_model=schemas.MedicalRecordResponse)
def get_medical_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="病例不存在")
    return record

@router.post("/records", response_model=schemas.MedicalRecordResponse)
def create_medical_record(record: schemas.MedicalRecordCreate, db: Session = Depends(get_db)):
    # 验证医生和患者是否存在
    doctor = db.query(models.User).filter(models.User.id == record.doctor_id, models.User.role == models.UserRole.doctor).first()
    if not doctor:
        raise HTTPException(status_code=400, detail="医生不存在")
    patient = db.query(models.User).filter(models.User.id == record.patient_id).first()
    if not patient:
        raise HTTPException(status_code=400, detail="患者不存在")

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

# ==================== 处方管理 ====================

@router.post("/prescriptions", response_model=schemas.PrescriptionResponse)
def create_prescription(prescription: schemas.PrescriptionCreate, db: Session = Depends(get_db)):
    # 1. 检查病历是否存在
    record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == prescription.medical_record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="关联病历不存在")
    
    # 2. 计算总价并检查库存
    total_price = 0
    items_to_add = []
    
    for item in prescription.items:
        med = db.query(models.Medication).filter(models.Medication.id == item.medication_id).first()
        if not med:
            raise HTTPException(status_code=400, detail=f"药品ID {item.medication_id} 不存在")
        if med.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"药品 {med.name} 库存不足 (剩余: {med.stock})")
        
        total_price += med.price * item.quantity
        items_to_add.append({
            "medication_id": item.medication_id,
            "quantity": item.quantity,
            "price_at_time": med.price,
            "usage_instruction": item.usage_instruction
        })

    # 3. 创建处方
    new_prescription = models.Prescription(
        medical_record_id=record.id,
        doctor_id=record.doctor_id,
        patient_id=record.patient_id,
        status=models.PrescriptionStatus.pending,
        total_price=total_price,
        notes=prescription.notes
    )
    db.add(new_prescription)
    db.commit()
    db.refresh(new_prescription)

    # 4. 创建处方明细
    for item_data in items_to_add:
        db_item = models.PrescriptionItem(
            prescription_id=new_prescription.id,
            **item_data
        )
        db.add(db_item)
    
    db.commit()
    
    # 重新查询以包含 items
    return new_prescription

@router.get("/prescriptions", response_model=List[schemas.PrescriptionResponse])
def list_doctor_prescriptions(doctor_id: int, db: Session = Depends(get_db)):
    prescriptions = db.query(models.Prescription).filter(models.Prescription.doctor_id == doctor_id).order_by(models.Prescription.created_at.desc()).all()
    
    result = []
    for p in prescriptions:
        # Get patient info
        patient = db.query(models.User).filter(models.User.id == p.patient_id).first()
        profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == p.patient_id).first()
        
        # Get medical record for diagnosis
        record = db.query(models.MedicalRecord).filter(models.MedicalRecord.id == p.medical_record_id).first()
        
        # Get items with names
        items = db.query(models.PrescriptionItem).filter(models.PrescriptionItem.prescription_id == p.id).all()
        p_items = []
        for i in items:
            med = db.query(models.Medication).filter(models.Medication.id == i.medication_id).first()
            item_dict = schemas.PrescriptionItemResponse.from_orm(i)
            if med:
                item_dict.medication_name = med.name
                item_dict.specification = med.specification
                item_dict.unit = med.unit
            else:
                item_dict.medication_name = "未知药品"
            p_items.append(item_dict)
            
        p_resp = schemas.PrescriptionResponse.from_orm(p)
        p_resp.items = p_items
        if patient:
            p_resp.patient_name = (getattr(profile, "name", None) or "").strip() or patient.phone
            p_resp.patient_phone = patient.phone
        else:
            p_resp.patient_name = "未知患者"
            p_resp.patient_phone = ""
            
        p_resp.diagnosis = record.diagnosis if record else "未知诊断"
        
        result.append(p_resp)
        
    return result

@router.get("/prescriptions/{prescription_id}", response_model=schemas.PrescriptionResponse)
def get_prescription(prescription_id: int, db: Session = Depends(get_db)):
    p = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="处方不存在")
    
    # 手动填充 items 的 medication_name
    items = db.query(models.PrescriptionItem).filter(models.PrescriptionItem.prescription_id == p.id).all()
    p_items = []
    for i in items:
        med = db.query(models.Medication).filter(models.Medication.id == i.medication_id).first()
        item_dict = i.__dict__
        item_dict["medication_name"] = med.name if med else "未知药品"
        p_items.append(item_dict)
    
    p.items = p_items
    return p
