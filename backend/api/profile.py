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
