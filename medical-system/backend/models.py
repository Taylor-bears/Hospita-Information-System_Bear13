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
    pending = "pending"
    confirmed = "confirmed"
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
    stock = Column(Integer, nullable=False, default=0)
    price = Column(Integer, nullable=False, default=0)
    status = Column(Enum(MedicationStatus), nullable=False, default=MedicationStatus.active)
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
