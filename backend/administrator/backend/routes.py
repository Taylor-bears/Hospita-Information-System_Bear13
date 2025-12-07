"""
管理员模块 - 后端路由
处理管理员相关的所有业务逻辑
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from typing import List
import sys
import os

# 添加backend目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'backend'))

from database import get_db
import models, schemas

router = APIRouter(prefix="/admin", tags=["管理员"])

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

# ==================== 用户管理 ====================

@router.get("/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(get_db)):
    """获取所有普通用户"""
    users = db.query(models.User).filter(models.User.role == models.UserRole.user).all()
    return users

@router.get("/doctors", response_model=List[schemas.UserResponse])
def get_doctors(db: Session = Depends(get_db)):
    """获取所有已审核通过的医生"""
    doctors = db.query(models.User).filter(
        models.User.role == models.UserRole.doctor,
        models.User.status == models.UserStatus.active
    ).all()
    return doctors

@router.get("/admins", response_model=List[schemas.UserResponse])
def get_admins(db: Session = Depends(get_db)):
    """获取所有管理员"""
    admins = db.query(models.User).filter(models.User.role == models.UserRole.admin).all()
    return admins

@router.get("/pending-doctors", response_model=List[schemas.UserResponse])
def get_pending_doctors(db: Session = Depends(get_db)):
    """获取所有待审核的医生"""
    doctors = db.query(models.User).filter(
        models.User.role == models.UserRole.doctor,
        models.User.status == models.UserStatus.pending
    ).all()
    return doctors

@router.get("/pending-doctors-count")
def get_pending_doctors_count(db: Session = Depends(get_db)):
    """获取待审核医生数量"""
    count = db.query(models.User).filter(
        models.User.role == models.UserRole.doctor,
        models.User.status == models.UserStatus.pending
    ).count()
    return {"count": count}

@router.post("/add-user", response_model=schemas.UserResponse)
def add_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """管理员添加用户（包括管理员、医生、普通用户）"""
    # 检查手机号是否已存在
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
    return new_user

@router.delete("/user/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """删除用户（包括管理员）"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 检查是否是最后一个管理员
    if user.role == models.UserRole.admin:
        admin_count = db.query(models.User).filter(models.User.role == models.UserRole.admin).count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="不能删除最后一个管理员账号")
    
    db.delete(user)
    db.commit()
    return {"message": "删除成功"}

@router.post("/approve-doctor/{user_id}")
def approve_doctor(user_id: int, db: Session = Depends(get_db)):
    """审核通过医生"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    if user.role != models.UserRole.doctor:
        raise HTTPException(status_code=400, detail="该用户不是医生")
    
    user.status = models.UserStatus.active
    db.commit()
    return {"message": "审核通过"}

@router.post("/reject-doctor/{user_id}")
def reject_doctor(user_id: int, db: Session = Depends(get_db)):
    """拒绝医生注册"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    if user.role != models.UserRole.doctor:
        raise HTTPException(status_code=400, detail="该用户不是医生")
    
    db.delete(user)
    db.commit()
    return {"message": "已拒绝"}

# ==================== 预约管理 ====================
# TODO: 实现预约管理功能

# ==================== 病历管理 ====================
# TODO: 实现病历管理功能

# ==================== 药房管理 ====================
# TODO: 实现药房管理功能

# ==================== 医生评价 ====================
# TODO: 实现医生评价功能
