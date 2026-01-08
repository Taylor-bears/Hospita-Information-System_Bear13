from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models
from backend.core.security import TokenPayload, get_current_user
from backend.core.permissions import require_self_or_admin

router = APIRouter(prefix="/api/profile", tags=["Profile"])


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=20)
    gender: str | None = None
    birthdate: str | None = None


@router.get("/me")
def get_me(
    current_user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前登录用户个人资料"""
    user_id = current_user.user_id
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.role == models.UserRole.user:
        p = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user_id).first()
        return {"role": "patient", "name": getattr(p, "name", None), "user_id": user_id}
    elif u.role == models.UserRole.doctor:
        p = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == user_id).first()
        return {"role": "doctor", "name": getattr(p, "name", None), "department": getattr(p, "department", None), "title": getattr(p, "title", None), "user_id": user_id}
    elif u.role == models.UserRole.pharmacist:
        p = db.query(models.PharmacistProfile).filter(models.PharmacistProfile.user_id == user_id).first()
        return {
            "role": "pharmacist",
            "name": getattr(p, "name", None),
            "department": getattr(p, "department", None),
            "user_id": user_id,
        }
    else:
        return {"role": "admin", "user_id": user_id}


@router.put("/me")
def update_me(
    body: ProfileUpdate,
    current_user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新当前登录用户个人资料"""
    user_id = current_user.user_id
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
    elif u.role == models.UserRole.pharmacist:
        p = db.query(models.PharmacistProfile).filter(models.PharmacistProfile.user_id == user_id).first()
        if not p:
            p = models.PharmacistProfile(user_id=user_id)
            db.add(p)
        p.name = body.name
        db.commit()
        return {"message": "ok"}
    else:
        return {"message": "ok"}


@router.get("/my-records")
def get_my_records(
    current_user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取我的病历（患者）"""
    user_id = current_user.user_id
    records = db.query(models.MedicalRecord).filter(models.MedicalRecord.patient_id == user_id).order_by(models.MedicalRecord.created_at.desc()).all()
    return records


@router.get("/my-prescriptions")
def get_my_prescriptions(
    current_user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取我的处方（患者）"""
    user_id = current_user.user_id
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
def pay_prescription(
    prescription_id: int,
    current_user: TokenPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """患者支付处方"""
    user_id = current_user.user_id
    p = db.query(models.Prescription).filter(models.Prescription.id == prescription_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="处方不存在")
    
    if p.patient_id != user_id:
        raise HTTPException(status_code=403, detail="无权操作此处方")

    if p.status != models.PrescriptionStatus.pending:
        raise HTTPException(status_code=400, detail="当前状态无法支付")
        
    p.status = models.PrescriptionStatus.paid
    db.commit()
    return {"message": "支付成功", "prescription_id": p.id}
