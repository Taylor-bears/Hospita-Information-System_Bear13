from pydantic import BaseModel
from typing import Optional
from models import UserRole, UserStatus

class UserBase(BaseModel):
    phone: str

class UserCreate(UserBase):
    password: str
    role: UserRole

class UserLogin(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    role: UserRole
    status: UserStatus

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    status: str
