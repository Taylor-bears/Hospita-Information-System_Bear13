from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time, datetime
from models import UserRole, UserStatus, ScheduleStatus, AppointmentStatus

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

# ==================== 排班 ====================

class ScheduleBase(BaseModel):
    doctor_id: int
    date: date
    start_time: time
    end_time: time
    capacity: int = 1

class ScheduleCreate(ScheduleBase):
    pass

class ScheduleResponse(BaseModel):
    id: int
    doctor_id: int
    date: date
    start_time: time
    end_time: time
    capacity: int
    booked_count: int
    status: ScheduleStatus

    class Config:
        from_attributes = True

# ==================== 预约 ====================

class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    schedule_id: int

class AppointmentResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    schedule_id: int
    status: AppointmentStatus

    class Config:
        from_attributes = True
