"""
RBAC 权限控制模块
- 基于角色的访问控制依赖函数
- 权限矩阵定义
"""
from typing import Callable, List, Optional
from functools import wraps

from fastapi import Depends, HTTPException, status

from .security import TokenPayload, get_current_user


# ==================== 权限矩阵定义 ====================
# 角色层级: admin > doctor/pharmacist > user

ROLE_HIERARCHY = {
    "admin": 100,      # 最高权限
    "doctor": 50,      # 医生
    "pharmacist": 50,  # 药剂师（与医生同级）
    "user": 10,        # 普通患者
}


# ==================== 角色校验依赖 ====================

def require_roles(*allowed_roles: str) -> Callable:
    """
    创建角色校验依赖函数
    
    用法:
        @router.get("/admin-only", dependencies=[Depends(require_roles("admin"))])
        def admin_endpoint(): ...
        
        # 或在函数参数中使用
        @router.get("/doctors")
        def doctor_endpoint(user: TokenPayload = Depends(require_roles("admin", "doctor"))):
            ...
    
    Args:
        allowed_roles: 允许访问的角色列表
    
    Returns:
        FastAPI 依赖函数
    """
    async def role_checker(current_user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足，需要角色: {', '.join(allowed_roles)}",
            )
        return current_user
    
    return role_checker


# ==================== 预置角色依赖 ====================

# 仅管理员
require_admin = require_roles("admin")

# 管理员或医生
require_doctor = require_roles("admin", "doctor")

# 管理员或药剂师
require_pharmacist = require_roles("admin", "pharmacist")

# 管理员或患者（用于患者自身操作的接口）
require_patient = require_roles("admin", "user")

# 任意已登录用户
require_authenticated = require_roles("admin", "doctor", "pharmacist", "user")


# ==================== 资源所有权验证 ====================

def require_owner_or_admin(
    resource_user_id: int,
    current_user: TokenPayload,
    error_message: str = "无权访问此资源"
) -> None:
    """
    验证当前用户是资源所有者或管理员
    
    用法:
        @router.get("/profile/{user_id}")
        def get_profile(user_id: int, current_user: TokenPayload = Depends(get_current_user)):
            require_owner_or_admin(user_id, current_user)
            ...
    
    Args:
        resource_user_id: 资源所属用户ID
        current_user: 当前登录用户信息
        error_message: 自定义错误消息
    
    Raises:
        HTTPException: 如果不是所有者且非管理员
    """
    if current_user.role != "admin" and current_user.user_id != resource_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_message,
        )


def require_self_or_admin(
    target_user_id: int,
    current_user: TokenPayload,
) -> None:
    """
    验证操作目标是自己或当前用户是管理员
    用于个人资料查看/修改等接口
    """
    require_owner_or_admin(target_user_id, current_user, "只能操作自己的数据")
