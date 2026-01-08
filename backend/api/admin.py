from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional
from passlib.context import CryptContext

from backend.database import get_db
from backend import models, schemas
from backend.core.permissions import require_admin

# 所有 admin 接口都需要管理员权限
router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(require_admin)])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)


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


@router.post("/users", response_model=schemas.UserResponse)
def add_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """管理员添加用户（包括管理员、医生、普通用户）"""
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if db_user:
        raise HTTPException(status_code=400, detail="该手机号已被注册")

    hashed_password = get_password_hash(user.password)
    new_user = models.User(
        phone=user.phone,
        password=hashed_password,
        role=user.role,
        status=models.UserStatus.active  # 管理员添加的用户直接激活
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # 审计日志
    db.add(models.AdminAudit(action="add_user", target_type="user", target_id=new_user.id, info=f"role={user.role}"))
    db.commit()
    
    return new_user


@router.get("/doctors")
def get_doctors(db: Session = Depends(get_db)):
    """获取所有已审核通过的医生"""
    doctors = db.query(models.User).filter(
        models.User.role == models.UserRole.doctor,
        models.User.status == models.UserStatus.active
    ).all()
    # 简单返回，如果需要详细信息可以关联 DoctorProfile
    result = []
    for d in doctors:
        profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == d.id).first()
        result.append({
            "id": d.id,
            "phone": d.phone,
            "name": getattr(profile, "name", "未完善信息"),
            "department": getattr(profile, "department", ""),
            "title": getattr(profile, "title", "")
        })
    return result


@router.get("/admins")
def get_admins(db: Session = Depends(get_db)):
    """获取所有管理员"""
    admins = db.query(models.User).filter(models.User.role == models.UserRole.admin).all()
    return [{"id": u.id, "phone": u.phone, "created_at": str(u.created_at)} for u in admins]


@router.get("/pending-doctors-count")
def get_pending_doctors_count(db: Session = Depends(get_db)):
    """获取待审核医生数量"""
    count = db.query(models.User).filter(
        models.User.role == models.UserRole.doctor,
        models.User.status == models.UserStatus.pending
    ).count()
    return {"count": count}


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    pending_reviews = db.query(models.User).filter(models.User.status == models.UserStatus.pending).count()
    
    total_appointments = db.query(models.Appointment).count()
    pending_appointments = db.query(models.Appointment).filter(models.Appointment.status == models.AppointmentStatus.pending).count()
    
    total_prescriptions = db.query(models.Prescription).count()
    
    # Calculate total revenue from paid/dispensed prescriptions
    # Assuming total_price is in cents
    revenue_query = db.query(func.sum(models.Prescription.total_price)).filter(
        models.Prescription.status.in_([models.PrescriptionStatus.paid, models.PrescriptionStatus.dispensed])
    ).scalar()
    total_revenue = (revenue_query or 0) # Removed / 100.0 as per user request

    # Role counts
    total_patients = db.query(models.User).filter(models.User.role == models.UserRole.user).count()
    total_doctors = db.query(models.User).filter(models.User.role == models.UserRole.doctor).count()
    total_pharmacists = db.query(models.User).filter(models.User.role == models.UserRole.pharmacist).count()
    total_admins = db.query(models.User).filter(models.User.role == models.UserRole.admin).count()

    return {
        "total_users": total_users,
        "pending_reviews": pending_reviews,
        "total_appointments": total_appointments,
        "pending_appointments": pending_appointments,
        "total_prescriptions": total_prescriptions,
        "total_revenue": total_revenue,
        "total_patients": total_patients,
        "total_doctors": total_doctors,
        "total_pharmacists": total_pharmacists,
        "total_admins": total_admins
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
        profile = None
        payload = {}
        if u.role == models.UserRole.doctor:
            profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == u.id).first()
            payload = {
                "department": getattr(profile, "department", None),
                "license_number": getattr(profile, "license_number", None),
            }
        elif u.role == models.UserRole.pharmacist:
            profile = db.query(models.PharmacistProfile).filter(models.PharmacistProfile.user_id == u.id).first()
            payload = {
                "department": getattr(profile, "department", None),
                "license_number": getattr(profile, "license_number", None),
            }
        mapped_status = "approved" if u.status == models.UserStatus.active else "pending"
        result.append({
            "id": u.id,
            "name": getattr(profile, "name", None) or u.phone,
            "phone": u.phone,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "status": mapped_status,
            "submittedAt": str(getattr(u, "created_at", "")),
            "updatedAt": str(getattr(u, "created_at", "")),
            "payload": payload,
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
    if u.role == models.UserRole.pharmacist:
        prof = db.query(models.PharmacistProfile).filter(models.PharmacistProfile.user_id == user_id).first()
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
            elif u.role == models.UserRole.pharmacist:
                prof = db.query(models.PharmacistProfile).filter(models.PharmacistProfile.user_id == uid).first()
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
    elif u.role == models.UserRole.pharmacist:
        p = db.query(models.PharmacistProfile).filter(models.PharmacistProfile.user_id == user_id).first()
        if p:
            db.delete(p)
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
    specification: Optional[str] = None
    unit: Optional[str] = None
    manufacturer: Optional[str] = None
    stock: int
    min_stock: int = 10
    max_stock: int = 1000
    price: int
    status: models.MedicationStatus = models.MedicationStatus.active
    description: Optional[str] = None


@router.get("/medications")
def meds(db: Session = Depends(get_db)):
    return db.query(models.Medication).all()


@router.get("/medications/{med_id}")
def get_med(med_id: int, db: Session = Depends(get_db)):
    m = db.query(models.Medication).filter(models.Medication.id == med_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="药品不存在")
    return m


@router.post("/medications")
def add_med(body: MedicationBody, db: Session = Depends(get_db)):
    exists = db.query(models.Medication).filter(models.Medication.name == body.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="药品已存在")
    m = models.Medication(
        name=body.name, 
        category=body.category, 
        specification=body.specification,
        unit=body.unit,
        manufacturer=body.manufacturer,
        stock=body.stock, 
        min_stock=body.min_stock,
        max_stock=body.max_stock,
        price=body.price, 
        status=body.status,
        description=body.description
    )
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
    m.specification = body.specification
    m.unit = body.unit
    m.manufacturer = body.manufacturer
    m.stock = body.stock
    m.min_stock = body.min_stock
    m.max_stock = body.max_stock
    m.price = body.price
    m.status = body.status
    m.description = body.description
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


# ========== 用户管理（全量） ==========

@router.get("/all-users")
def get_all_users(
    role: Optional[str] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.User)
    if role and role != "all":
        query = query.filter(models.User.role == role)
    
    if keyword:
        # 简单模糊搜索：手机号
        query = query.filter(models.User.phone.contains(keyword))
    
    users = query.order_by(models.User.created_at.desc()).all()
    
    result = []
    for u in users:
        name = "未命名"
        if u.role == models.UserRole.user:
            p = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == u.id).first()
            if p and p.name: name = p.name
        elif u.role == models.UserRole.doctor:
            p = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == u.id).first()
            if p and p.name: name = p.name
        
        result.append({
            "id": u.id,
            "phone": u.phone,
            "role": u.role,
            "name": name,
            "status": u.status,
            "created_at": u.created_at
        })
    return result


@router.get("/users/{user_id}/details")
def get_user_details(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    base_info = {
        "id": user.id,
        "phone": user.phone,
        "role": user.role,
        "status": user.status,
        "created_at": user.created_at
    }
    
    details = {}
    
    if user.role == models.UserRole.user:
        profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == user.id).first()
        if profile:
            details["profile"] = {
                "name": profile.name,
                "id_card": profile.id_card,
                "email": profile.email
            }
        
        # 挂号记录
        appointments = db.query(models.Appointment).filter(models.Appointment.patient_id == user.id).order_by(models.Appointment.created_at.desc()).all()
        details["appointments"] = []
        for app in appointments:
            doc_profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == app.doctor_id).first()
            doc_name = doc_profile.name if doc_profile else "未知医生"
            details["appointments"].append({
                "id": app.id,
                "date": str(app.created_at),
                "doctor_name": doc_name,
                "status": app.status
            })
            
        # 处方记录
        prescriptions = db.query(models.Prescription).filter(models.Prescription.patient_id == user.id).order_by(models.Prescription.created_at.desc()).all()
        details["prescriptions"] = []
        for pre in prescriptions:
            details["prescriptions"].append({
                "id": pre.id,
                "date": str(pre.created_at),
                "status": pre.status,
                "total_price": pre.total_price
            })

    elif user.role == models.UserRole.doctor:
        profile = db.query(models.DoctorProfile).filter(models.DoctorProfile.user_id == user.id).first()
        if profile:
            details["profile"] = {
                "name": profile.name,
                "department": profile.department,
                "title": profile.title,
                "hospital": profile.hospital,
                "license_number": profile.license_number,
                "email": profile.email
            }
        
        # 接诊记录（作为医生）
        appointments = db.query(models.Appointment).filter(models.Appointment.doctor_id == user.id).order_by(models.Appointment.created_at.desc()).all()
        details["appointments"] = []
        for app in appointments:
            pat_profile = db.query(models.PatientProfile).filter(models.PatientProfile.user_id == app.patient_id).first()
            pat_name = pat_profile.name if pat_profile else "未知患者"
            details["appointments"].append({
                "id": app.id,
                "date": str(app.created_at),
                "patient_name": pat_name,
                "status": app.status
            })

    return {
        "base": base_info,
        "details": details
    }
