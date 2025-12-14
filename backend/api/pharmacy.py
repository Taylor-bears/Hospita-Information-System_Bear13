from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.database import get_db
from backend import models, schemas

router = APIRouter(prefix="/api/pharmacy", tags=["Pharmacy"])

@router.get("/prescriptions", response_model=List[schemas.PrescriptionResponse])
def list_prescriptions(
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.Prescription)
    if status:
        q = q.filter(models.Prescription.status == status)
    if patient_id:
        q = q.filter(models.Prescription.patient_id == patient_id)
    
    prescriptions = q.order_by(models.Prescription.created_at.desc()).all()
    
    # 填充详情
    results = []
    for p in prescriptions:
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
        
        # 填充患者信息
        patient_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == p.patient_id).first()
        if patient_profile:
            p_resp.patient_name = patient_profile.name
            
        # 填充医生信息
        doctor_profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == p.doctor_id).first()
        if doctor_profile:
            p_resp.doctor_name = doctor_profile.name
        else:
            doctor_user = db.query(models.User).filter(models.User.id == p.doctor_id).first()
            if doctor_user:
                p_resp.doctor_name = doctor_user.phone

        results.append(p_resp)
        
    return results

@router.post("/prescriptions/{prescription_id}/dispense")
def dispense_prescription(prescription_id: int, db: Session = Depends(get_db)):
    """发药操作：扣减库存，更新状态"""
    p = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="处方不存在")
    
    if p.status == models.PrescriptionStatus.dispensed:
        raise HTTPException(status_code=400, detail="该处方已发药")
    
    if p.status == models.PrescriptionStatus.cancelled:
        raise HTTPException(status_code=400, detail="该处方已取消")

    # 检查库存是否足够
    items = db.query(models.PrescriptionItem).filter(models.PrescriptionItem.prescription_id == p.id).all()
    for item in items:
        med = db.query(models.Medication).filter(models.Medication.id == item.medication_id).first()
        if not med:
            raise HTTPException(status_code=400, detail=f"药品ID {item.medication_id} 不存在")
        if med.stock < item.quantity:
            raise HTTPException(status_code=400, detail=f"药品 {med.name} 库存不足 (需: {item.quantity}, 剩: {med.stock})")

    # 扣减库存
    for item in items:
        med = db.query(models.Medication).filter(models.Medication.id == item.medication_id).first()
        med.stock -= item.quantity
    
    p.status = models.PrescriptionStatus.dispensed
    db.commit()
    
    return {"message": "发药成功", "prescription_id": p.id}

