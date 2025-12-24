from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP, Date, Time, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
try:
    from .database import Base
except ImportError:
    from database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    doctor = "doctor"
    user = "user"
    pharmacist = "pharmacist"


class UserStatus(str, enum.Enum):
    active = "active"
    pending = "pending"

# ==================== 病例管理 ====================
class MedicalRecordStatus(str, enum.Enum):
    active = "active"
    archived = "archived"

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(phone) = 11", name="ck_users_phone_len"),
        CheckConstraint("phone GLOB '[0-9]*'", name="ck_users_phone_digits"),
    )

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(11), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.active)
    created_at = Column(TIMESTAMP, server_default=func.now())

# ==================== 预约与排班 ====================

class ScheduleStatus(str, enum.Enum):
    open = "open"
    closed = "closed"

class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    pending = "pending"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"

class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    capacity = Column(Integer, nullable=False, default=1)
    booked_count = Column(Integer, nullable=False, default=0)
    status = Column(Enum(ScheduleStatus), nullable=False, default=ScheduleStatus.open)
    created_at = Column(TIMESTAMP, server_default=func.now())

# 按天聚合的排班容量（上午/下午）
class DoctorDaySchedule(Base):
    __tablename__ = "doctor_day_schedules"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    am_capacity = Column(Integer, nullable=False, default=0)
    am_booked_count = Column(Integer, nullable=False, default=0)
    pm_capacity = Column(Integer, nullable=False, default=0)
    pm_booked_count = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("doctor_schedules.id"), nullable=False)
    status = Column(Enum(AppointmentStatus), nullable=False, default=AppointmentStatus.pending)
    created_at = Column(TIMESTAMP, server_default=func.now())

# ==================== 药品管理 ====================

class MedicationStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"

class Medication(Base):
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    category = Column(String(50), nullable=False)
    specification = Column(String(50), nullable=True) # 规格
    unit = Column(String(20), nullable=True)          # 单位
    manufacturer = Column(String(100), nullable=True) # 生产厂家
    stock = Column(Integer, nullable=False, default=0)
    min_stock = Column(Integer, default=10)
    max_stock = Column(Integer, default=1000)
    price = Column(Integer, nullable=False, default=0)
    status = Column(Enum(MedicationStatus), nullable=False, default=MedicationStatus.active)
    description = Column(String(500), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now())

# ==================== 医生资料 ====================

class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(50))
    department = Column(String(50))
    title = Column(String(50))
    license_number = Column(String(50))
    hospital = Column(String(100))
    email = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now())

# ==================== 管理员操作审计 ====================

class AdminAudit(Base):
    __tablename__ = "admin_audit"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(50), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(Integer, nullable=True)
    info = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.now())

# ==================== 患者资料 ====================

class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    name = Column(String(50))
    id_card = Column(String(20))
    email = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=func.now())

    # ==================== 病例管理 ====================


class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    diagnosis = Column(String(1024), nullable=False)
    treatment = Column(String(1024), nullable=True)
    status = Column(Enum(MedicalRecordStatus), default=MedicalRecordStatus.active)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())


# ==================== 处方管理 ====================

class PrescriptionStatus(str, enum.Enum):
    pending = "pending"      # 待支付/待发药
    paid = "paid"            # 已支付，待发药
    dispensed = "dispensed"  # 已发药
    cancelled = "cancelled"  # 已取消

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    medical_record_id = Column(Integer, ForeignKey("medical_records.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(PrescriptionStatus), default=PrescriptionStatus.pending)
    total_price = Column(Integer, default=0)  # 总价（分）
    notes = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price_at_time = Column(Integer, nullable=False)  # 开药时的单价
    usage_instruction = Column(String(255), nullable=True) # 用法用量

from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, UniqueConstraint, func
from datetime import datetime
class DoctorReview(Base):
    __tablename__ = "doctor_reviews"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, unique=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)  # 1~5
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)