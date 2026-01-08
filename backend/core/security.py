"""
JWT 认证核心模块
- Token 生成与验证
- 当前用户获取依赖
"""
from datetime import datetime, timedelta
from typing import Optional
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# JWT 配置
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

# OAuth2 scheme - 从 Authorization: Bearer <token> 提取 token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


class TokenPayload(BaseModel):
    """JWT Token 载荷"""
    user_id: int
    role: str
    exp: Optional[datetime] = None


class TokenResponse(BaseModel):
    """登录响应模型"""
    access_token: str
    token_type: str = "bearer"
    user_id: int
    role: str


def create_access_token(user_id: int, role: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    生成 JWT access token
    
    Args:
        user_id: 用户ID
        role: 用户角色 (admin/doctor/user/pharmacist)
        expires_delta: 自定义过期时间，默认使用配置值
    
    Returns:
        JWT token 字符串
    """
    if expires_delta is None:
        expires_delta = timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    
    expire = datetime.utcnow() + expires_delta
    
    to_encode = {
        "user_id": user_id,
        "role": role,
        "exp": expire,
    }
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> TokenPayload:
    """
    验证并解析 JWT token
    
    Args:
        token: JWT token 字符串
    
    Returns:
        TokenPayload 对象
    
    Raises:
        HTTPException: token 无效或过期
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        role: str = payload.get("role")
        
        if user_id is None or role is None:
            raise credentials_exception
        
        return TokenPayload(user_id=user_id, role=role)
    
    except JWTError:
        raise credentials_exception


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> TokenPayload:
    """
    FastAPI 依赖：获取当前登录用户
    
    用法:
        @router.get("/protected")
        def protected_route(current_user: TokenPayload = Depends(get_current_user)):
            ...
    """
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return verify_token(token)


async def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[TokenPayload]:
    """
    FastAPI 依赖：可选的用户认证（公开接口也可获取用户信息）
    """
    if token is None:
        return None
    
    try:
        return verify_token(token)
    except HTTPException:
        return None
