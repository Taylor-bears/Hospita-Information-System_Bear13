from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from backend.database import get_db
from backend import models

router = APIRouter(prefix="/api/admin", tags=["Admin"])


@router.get("/users")
def users(db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.role == models.UserRole.user).all()
    result = []
    for u in users:
        p = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == u.id).first()
        result.append({
            "id": u.id,
            "name": getattr(p, "name", None),
            "phone": u.phone,
            "role": "patient",
            "status": u.status.value if hasattr(u.status, 'value') else str(u.status),
            "created_at": str(u.created_at)
        })
    return result


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_doctors = db.query(models.User).filter(models.User.role == models.UserRole.doctor).count()
    total_appointments = db.query(models.Appointment).count()
    pending_doctors = db.query(models.User).filter(models.User.role == models.UserRole.doctor, models.User.status == models.UserStatus.pending).count()
    active_appointments = db.query(models.Appointment).filter(models.Appointment.status == models.AppointmentStatus.confirmed).count()
    completed_appointments = db.query(models.Appointment).filter(models.Appointment.status == models.AppointmentStatus.cancelled).count()
    return {
        "total_users": total_users,
        "total_doctors": total_doctors,
        "total_appointments": total_appointments,
        "pending_doctors": pending_doctors,
        "active_appointments": active_appointments,
        "completed_appointments": completed_appointments,
    }


class ApproveBody(BaseModel):
    approved: bool


# ========== 审核（医生/药房工作人员） ==========

class ReviewApproveBody(BaseModel):
    notes: Optional[str] = None


class ReviewRejectBody(BaseModel):
    reason: Optional[str] = None


@router.get("/reviews/items")
def review_items(
    page: int = 1,
    pageSize: int = 20,
    status: Optional[str] = None,  # pending/approved/rejected/all
    role: Optional[str] = None,    # doctor/pharmacist/all
    db: Session = Depends(get_db)
):
    allowed_roles = [models.UserRole.doctor, models.UserRole.pharmacist]
    q = db.query(models.User).filter(models.User.role.in_(allowed_roles))
    if role and role != "all":
        try:
            q = q.filter(models.User.role == models.UserRole(role))
        except Exception:
            pass
    if status and status != "all":
        if status == "approved":
            q = q.filter(models.User.status == models.UserStatus.active)
        elif status == "pending":
            q = q.filter(models.User.status == models.UserStatus.pending)
        elif status == "rejected":
            # 未存储 rejected 状态，这里返回空
            q = q.filter(models.User.id == -1)
    total = q.count()
    items = q.order_by(models.User.created_at.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
    result = []
    for u in items:
        profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == u.id).first()
        mapped_status = "approved" if u.status == models.UserStatus.active else "pending"
        result.append({
            "id": u.id,
            "name": getattr(profile, "name", None) or u.phone,
            "phone": u.phone,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "status": mapped_status,
            "submittedAt": str(getattr(u, "created_at", "")),
            "updatedAt": str(getattr(u, "created_at", "")),
            "payload": {
                "department": getattr(profile, "department", None),
                "license_number": getattr(profile, "license_number", None),
            }
        })
    return {"items": result, "total": total, "page": page, "pageSize": pageSize}


@router.post("/reviews/{user_id}/approve")
def review_approve(user_id: int, body: ReviewApproveBody, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.role not in [models.UserRole.doctor, models.UserRole.pharmacist]:
        raise HTTPException(status_code=400, detail="仅医生/药房账号可审核")
    u.status = models.UserStatus.active
    db.commit()
    db.add(models.AdminAudit(action="approve_user", target_type="user", target_id=user_id, info=f"role={u.role}"))
    db.commit()
    return {"message": "ok"}


@router.post("/reviews/{user_id}/reject")
def review_reject(user_id: int, body: ReviewRejectBody, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.role not in [models.UserRole.doctor, models.UserRole.pharmacist]:
        raise HTTPException(status_code=400, detail="仅医生/药房账号可审核")
    # 删除相关档案
    if u.role == models.UserRole.doctor:
        prof = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == user_id).first()
        if prof:
            db.delete(prof)
    db.delete(u)
    db.commit()
    db.add(models.AdminAudit(action="reject_user", target_type="user", target_id=user_id, info=body.reason or ""))
    db.commit()
    return {"message": "rejected"}


class BatchBody(BaseModel):
    action: str
    ids: List[int]
    reason: Optional[str] = None


@router.post("/reviews/batch")
def review_batch(body: BatchBody, db: Session = Depends(get_db)):
    if body.action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="非法操作")
    success = []
    for uid in body.ids:
        u = db.query(models.User).filter(models.User.id == uid).first()
        if not u or u.role not in [models.UserRole.doctor, models.UserRole.pharmacist]:
            continue
        if body.action == "approve":
            u.status = models.UserStatus.active
        else:
            # reject: 删除档案和用户
            if u.role == models.UserRole.doctor:
                prof = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == uid).first()
                if prof:
                    db.delete(prof)
            db.delete(u)
        success.append(uid)
    db.commit()
    db.add(models.AdminAudit(action=f"batch_{body.action}", target_type="user", info=str(success)))
    db.commit()
    return {"success": success, "failed": []}


@router.put("/doctor/{user_id}/approve")
def approve(user_id: int, body: ApproveBody, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.role != models.UserRole.doctor:
        raise HTTPException(status_code=400, detail="该用户不是医生")
    u.status = models.UserStatus.active if body.approved else models.UserStatus.pending
    db.commit()
    # 审计日志
    audit = models.AdminAudit(action="approve_doctor", target_type="user", target_id=user_id, info=f"approved={body.approved}")
    db.add(audit)
    db.commit()
    return {"message": "ok"}


@router.delete("/user/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.role == models.UserRole.admin:
        raise HTTPException(status_code=400, detail="不允许删除管理员账户")
    # 根据角色级联删除相关数据
    if u.role == models.UserRole.user:
        p = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user_id).first()
        if p:
            db.delete(p)
        db.query(models.Appointment).filter(models.Appointment.patient_id == user_id).delete()
    elif u.role == models.UserRole.doctor:
        d = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == user_id).first()
        if d:
            db.delete(d)
        # 删除医生排班与相关预约
        schedules = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.doctor_id == user_id).all()
        for s in schedules:
            db.query(models.Appointment).filter(models.Appointment.schedule_id == s.id).delete()
            db.delete(s)
    # 删除用户本身
    db.delete(u)
    db.commit()
    # 审计日志
    db.add(models.AdminAudit(action="delete_user", target_type="user", target_id=user_id, info=f"role={u.role}"))
    db.commit()
    return {"message": "已删除"}


class MedicationBody(BaseModel):
    name: str
    category: str
    stock: int
    price: int
    status: models.MedicationStatus = models.MedicationStatus.active


@router.get("/medications")
def meds(db: Session = Depends(get_db)):
    return db.query(models.Medication).all()


@router.post("/medications")
def add_med(body: MedicationBody, db: Session = Depends(get_db)):
    exists = db.query(models.Medication).filter(models.Medication.name == body.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="药品已存在")
    m = models.Medication(name=body.name, category=body.category, stock=body.stock, price=body.price, status=body.status)
    db.add(m)
    db.commit()
    db.refresh(m)
    db.add(models.AdminAudit(action="add_medication", target_type="medication", target_id=m.id, info=m.name))
    db.commit()
    return m


@router.put("/medications/{med_id}")
def update_med(med_id: int, body: MedicationBody, db: Session = Depends(get_db)):
    m = db.query(models.Medication).filter(models.Medication.id == med_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="药品不存在")
    m.name = body.name
    m.category = body.category
    m.stock = body.stock
    m.price = body.price
    m.status = body.status
    db.commit()
    db.refresh(m)
    db.add(models.AdminAudit(action="update_medication", target_type="medication", target_id=m.id, info=m.name))
    db.commit()
    return m


@router.delete("/medications/{med_id}")
def delete_med(med_id: int, db: Session = Depends(get_db)):
    m = db.query(models.Medication).filter(models.Medication.id == med_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="药品不存在")
    db.delete(m)
    db.commit()
    db.add(models.AdminAudit(action="delete_medication", target_type="medication", target_id=med_id, info=m.name))
    db.commit()
    return {"message": "已删除"}

