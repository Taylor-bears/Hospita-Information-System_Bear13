from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models

router = APIRouter(prefix="/api/profile", tags=["Profile"])


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=20)
    gender: str | None = None
    birthdate: str | None = None


@router.get("/me")
def get_me(user_id: int, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.role == models.UserRole.user:
        p = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user_id).first()
        return {"role": "patient", "name": getattr(p, "name", None)}
    elif u.role == models.UserRole.doctor:
        p = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == user_id).first()
        return {"role": "doctor", "name": getattr(p, "name", None), "department": getattr(p, "department", None), "title": getattr(p, "title", None)}
    elif u.role == models.UserRole.pharmacist:
        return {"role": "pharmacist"}
    else:
        return {"role": "admin"}


@router.put("/me")
def update_me(user_id: int, body: ProfileUpdate, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.role == models.UserRole.user:
        p = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user_id).first()
        if not p:
            p = models.PatientProfile(user_id=user_id)
            db.add(p)
        p.name = body.name
        db.commit()
        return {"message": "ok"}
    elif u.role == models.UserRole.doctor:
        p = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == user_id).first()
        if not p:
            p = models.DoctorProfile(user_id=user_id)
            db.add(p)
        p.name = body.name
        db.commit()
        return {"message": "ok"}
    else:
        return {"message": "ok"}


@router.get("/my-records")
def get_my_records(user_id: int, db: Session = Depends(get_db)):
    """获取我的病历"""
    records = db.query(models.MedicalRecord).filter(models.MedicalRecord.patient_id == user_id).order_by(models.MedicalRecord.created_at.desc()).all()
    return records


@router.get("/my-prescriptions")
def get_my_prescriptions(user_id: int, db: Session = Depends(get_db)):
    """获取我的处方"""
    prescriptions = db.query(models.Prescription).filter(models.Prescription.patient_id == user_id).order_by(models.Prescription.created_at.desc()).all()
    
    # 填充详情
    results = []
    for p in prescriptions:
        items = db.query(models.PrescriptionItem).filter(models.PrescriptionItem.prescription_id == p.id).all()
        p_items = []
        for i in items:
            med = db.query(models.Medication).filter(models.Medication.id == i.medication_id).first()
            item_dict = i.__dict__
            item_dict["medication_name"] = med.name if med else "未知药品"
            p_items.append(item_dict)
        p.items = p_items
        results.append(p)
    return results


@router.post("/pay/{prescription_id}")
def pay_prescription(prescription_id: int, user_id: int, db: Session = Depends(get_db)):
    """患者支付处方"""
    p = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="处方不存在")
    
    if p.patient_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作此处方")

    if p.status != models.PrescriptionStatus.pending:
        raise HTTPException(status_code=400, detail="当前状态无法支付")
        
    p.status = models.PrescriptionStatus.paid
    db.commit()
    return {"message": "支付成功"}
    return {"message": "支付成功", "prescription_id": p.id}

