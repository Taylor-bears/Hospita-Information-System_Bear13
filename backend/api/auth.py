from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import re

from backend.database import get_db
from backend import models
from passlib.context import CryptContext

router = APIRouter(prefix="/api/auth", tags=["Auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PatientRegister(BaseModel):
    phone: str
    password: str
    name: str | None = None
    id_card: str | None = None


class DoctorRegister(BaseModel):
    phone: str
    password: str
    name: str | None = None
    license_number: str | None = None
    department: str | None = None
    title: str | None = None
    hospital: str | None = None


class LoginBody(BaseModel):
    username: str
    password: str
    role: str


class PharmacistRegister(BaseModel):
    phone: str
    password: str
    name: str | None = None
    department: str | None = None


def _hash(p: str) -> str:
    return pwd_context.hash(p)

def _sanitize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    digits = re.sub(r"^(?:\+?86|0086|86)", "", digits)
    if len(digits) > 11:
        digits = digits[-11:]
    return digits

def _validate_phone_or_raise(raw: str):
    p = _sanitize_phone(raw)
    if not (len(p) == 11 and p.isdigit()):
        raise HTTPException(status_code=422, detail="手机号必须为11位数字")
    return p

 


@router.post("/register/patient/")
@router.post("/register/patient")
def register_patient(body: PatientRegister, db: Session = Depends(get_db)):
    phone = _validate_phone_or_raise(body.phone)
    exists = db.query(models.User).filter(models.User.phone == phone).first()
    if exists:
        raise HTTPException(status_code=400, detail="该手机号已被注册")
    user = models.User(
        phone=phone,
        password=_hash(body.password),
        role=models.UserRole.user,
        status=models.UserStatus.active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # 保存患者资料
    profile = models.PatientProfile(
        user_id=user.id,
        name=body.name,
        id_card=body.id_card,
    )
    db.add(profile)
    db.commit()
    return {"id": user.id, "phone": user.phone, "role": user.role, "status": user.status}


@router.post("/register/doctor/")
@router.post("/register/doctor")
def register_doctor(body: DoctorRegister, db: Session = Depends(get_db)):
    phone = _validate_phone_or_raise(body.phone)
    exists = db.query(models.User).filter(models.User.phone == phone).first()
    if exists:
        raise HTTPException(status_code=400, detail="该手机号已被注册")
    user = models.User(
        phone=phone,
        password=_hash(body.password),
        role=models.UserRole.doctor,
        status=models.UserStatus.pending,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # 保存医生资料
    profile = models.DoctorProfile(
        user_id=user.id,
        name=body.name,
        license_number=body.license_number,
        department=body.department,
        title=body.title,
        hospital=body.hospital,
    )
    db.add(profile)
    db.commit()
    return {"id": user.id, "phone": user.phone, "role": user.role, "status": user.status}

@router.post("/register/pharmacist/")
@router.post("/register/pharmacist")
def register_pharmacist(body: PharmacistRegister, db: Session = Depends(get_db)):
    phone = _validate_phone_or_raise(body.phone)
    exists = db.query(models.User).filter(models.User.phone == phone).first()
    if exists:
        # 已注册的药师账号直接返回当前状态，避免重复注册报错
        if exists.role == models.UserRole.pharmacist:
            return {"id": exists.id, "phone": exists.phone, "role": exists.role, "status": exists.status}
        raise HTTPException(status_code=400, detail="该手机号已被注册")
    user = models.User(
        phone=phone,
        password=_hash(body.password),
        role=models.UserRole.pharmacist,
        status=models.UserStatus.pending,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    profile = models.PharmacistProfile(
        user_id=user.id,
        name=body.name,
        department=body.department,
    )
    db.add(profile)
    db.commit()
    return {"id": user.id, "phone": user.phone, "role": user.role, "status": user.status}


@router.post("/login/")
@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    try:
        username = _validate_phone_or_raise(body.username)
        u = db.query(models.User).filter(models.User.phone == username).first()
    except Exception:
        raise HTTPException(status_code=500, detail="系统异常，请稍后重试")
    if not u:
        raise HTTPException(status_code=404, detail="账号不存在")
    if not pwd_context.verify(body.password, u.password):
        raise HTTPException(status_code=401, detail="密码错误")
    # 角色一致性校验（兼容 patient 别名）
    # 前端选择的角色必须与账号实际角色一致
    requested = body.role
    if requested == "patient":
        requested = "user"
    actual = u.role.value if hasattr(u.role, 'value') else str(u.role)
    if requested and requested != actual:
        raise HTTPException(status_code=403, detail="角色与账号不匹配，请选择正确身份")
    if u.status == models.UserStatus.pending:
        raise HTTPException(status_code=403, detail="账号审核中，请等待管理员审核")
    return {"token": "fake-jwt-token", "user_id": u.id, "role": u.role}
