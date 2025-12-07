from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.database import get_db
from backend import models

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])


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

