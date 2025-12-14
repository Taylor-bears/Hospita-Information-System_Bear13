
# ==================== 病例管理 ====================
from typing import Optional, Literal, List
from pydantic import BaseModel
from datetime import datetime

class MedicalRecordBase(BaseModel):
    patient_id: int
    doctor_id: int
    diagnosis: str
    treatment: Optional[str] = None
    status: Optional[Literal['active', 'archived']] = 'active'

class MedicalRecordCreate(MedicalRecordBase):
    pass

class MedicalRecordUpdate(BaseModel):
    diagnosis: Optional[str] = None
    treatment: Optional[str] = None
    status: Optional[Literal['active', 'archived']] = None

class MedicalRecordResponse(MedicalRecordBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ==================== 处方管理 ====================

class PrescriptionItemBase(BaseModel):
    medication_id: int
    quantity: int
    usage_instruction: Optional[str] = None

class PrescriptionItemCreate(PrescriptionItemBase):
    pass

class PrescriptionItemResponse(PrescriptionItemBase):
    id: int
    price_at_time: int
    medication_name: Optional[str] = None # 方便前端显示
    specification: Optional[str] = None
    unit: Optional[str] = None

    class Config:
        from_attributes = True

class PrescriptionCreate(BaseModel):
    medical_record_id: int
    items: List[PrescriptionItemCreate]
    notes: Optional[str] = None

class PrescriptionResponse(BaseModel):
    id: int
    medical_record_id: int
    doctor_id: int
    patient_id: int
    status: str
    total_price: int
    notes: Optional[str]
    created_at: datetime
    items: List[PrescriptionItemResponse] = []
    
    # 附加信息
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    diagnosis: Optional[str] = None
    doctor_name: Optional[str] = None

    class Config:
        from_attributes = True

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
    fully_booked: Optional[bool] = None

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

# ==================== 药品 ====================

class MedicationBase(BaseModel):
    name: str
    category: str
    specification: Optional[str] = None
    unit: Optional[str] = None
    manufacturer: Optional[str] = None
    stock: int = 0
    min_stock: int = 10
    max_stock: int = 1000
    price: int = 0
    status: str = "active"
    description: Optional[str] = None

class MedicationCreate(MedicationBase):
    pass

class MedicationUpdate(MedicationBase):
    pass

class MedicationResponse(MedicationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

