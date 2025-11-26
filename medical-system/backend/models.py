from sqlalchemy import Column, Integer, String, Enum, TIMESTAMP
from sqlalchemy.sql import func
from database import Base
import enum

class UserRole(str, enum.Enum):
    admin = "admin"
    doctor = "doctor"
    user = "user"

class UserStatus(str, enum.Enum):
    active = "active"
    pending = "pending"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.active)
    created_at = Column(TIMESTAMP, server_default=func.now())
