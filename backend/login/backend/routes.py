"""
登录模块 - 后端路由
处理用户注册和登录逻辑
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import sys
import os

# 添加backend目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from database import get_db
import models, schemas
from core.security import create_access_token

router = APIRouter(prefix="", tags=["登录注册"])

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """用户注册"""
    # 检查手机号是否已存在
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if db_user:
        raise HTTPException(status_code=400, detail="该手机号已被注册")

    # 设置状态：普通用户直接active，医生和药师需要pending
    user_status = models.UserStatus.active
    if user.role in [models.UserRole.doctor, models.UserRole.pharmacist]:
        user_status = models.UserStatus.pending
    
    # 管理员账号不能通过注册接口创建
    if user.role == models.UserRole.admin:
        raise HTTPException(status_code=400, detail="无法注册管理员账号")

    hashed_password = get_password_hash(user.password)
    new_user = models.User(
        phone=user.phone,
        password=hashed_password,
        role=user.role,
        status=user_status
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    """用户登录"""
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="手机号或密码错误")
    
    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="手机号或密码错误")

    if db_user.status == models.UserStatus.pending:
        raise HTTPException(status_code=403, detail="账号审核中，请等待管理员审核")

    # 生成真实 JWT token
    role_value = db_user.role.value if hasattr(db_user.role, 'value') else str(db_user.role)
    token = create_access_token(user_id=db_user.id, role=role_value)
    return {
        "access_token": token, 
        "token_type": "bearer",
        "role": db_user.role,
        "status": db_user.status
    }
