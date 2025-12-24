from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
import sys
import os
import logging

# 兼容直接脚本运行（python main.py/uvicorn main:app）与包导入（backend.main）
try:
    from .database import engine, get_db, Base
    from . import models
except ImportError:
    sys.path.append(os.path.dirname(__file__))
    from database import engine, get_db, Base  # type: ignore
    import models  # type: ignore

# 添加模块路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# 导入各模块的路由
from login.backend.routes import router as login_router
# from administrator.backend.routes import router as admin_router  # Deprecated: Merged into api.admin
from appointments.backend.routes import router as appointments_router
from ai.routes import router as ai_router
from api.auth import router as api_auth_router
from api.admin import router as api_admin_router
from api.doctor import router as api_doctor_router
from api.pharmacy import router as api_pharmacy_router
from api.ai_consult import router as api_ai_consult_router
from api.profile import router as api_profile_router
from api.orders import router as api_orders_router
from api.stats import router as api_stats_router
from api.reviews import router as reviews_router
models.Base.metadata.create_all(bind=engine)

# 启动时尝试加载初始数据
try:
    from backend.seed_data import seed_from_json
    db = next(get_db())
    seed_from_json(db)
except Exception as e:
    print(f"自动加载初始数据失败: {e}")

app = FastAPI(title="医疗管理系统API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境请修改为前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login_router)
# app.include_router(admin_router)
app.include_router(appointments_router)
app.include_router(ai_router)
app.include_router(api_auth_router)
app.include_router(api_admin_router)
app.include_router(api_doctor_router)
app.include_router(api_pharmacy_router)
app.include_router(api_ai_consult_router)
app.include_router(api_profile_router)
app.include_router(api_orders_router)
app.include_router(api_stats_router)
app.include_router(reviews_router)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

@app.on_event("startup")
def create_default_admin():
    db = next(get_db())
    admin = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
    if not admin:
        hashed_pwd = get_password_hash("admin")
        new_admin = models.User(
            phone="13800138000",
            password=hashed_pwd,
            role=models.UserRole.admin,
            status=models.UserStatus.active
        )
        db.add(new_admin)
        db.commit()
        print("Default admin created: 13800138000 / admin")

@app.on_event("startup")
def create_default_doctor_and_schedules():
    db = next(get_db())
    doctor = db.query(models.User).filter(models.User.role == models.UserRole.doctor).first()
    if not doctor:
        hashed_pwd = get_password_hash("doctor")
        doctor = models.User(
            phone="13900000000",
            password=hashed_pwd,
            role=models.UserRole.doctor,
            status=models.UserStatus.active
        )
        db.add(doctor)
        db.commit()
        db.refresh(doctor)
        profile = models.DoctorProfile(
            user_id=doctor.id,
            name="示例医生",
            department="内科",
            title="主治医师",
            hospital="示例医院"
        )
        db.add(profile)
        db.commit()
        print("Default doctor created: 13900000000 / doctor")

    from datetime import date, timedelta, time
    today = date.today()
    for i in range(0, 7):
        d = today + timedelta(days=i)
        am_exists = db.query(models.DoctorSchedule).filter(
            models.DoctorSchedule.doctor_id == doctor.id,
            models.DoctorSchedule.date == d,
            models.DoctorSchedule.start_time == time(9, 0)
        ).first()
        if not am_exists:
            am = models.DoctorSchedule(
                doctor_id=doctor.id,
                date=d,
                start_time=time(9, 0),
                end_time=time(12, 0),
                capacity=0,
                booked_count=0,
                status=models.ScheduleStatus.open
            )
            db.add(am)
        pm_exists = db.query(models.DoctorSchedule).filter(
            models.DoctorSchedule.doctor_id == doctor.id,
            models.DoctorSchedule.date == d,
            models.DoctorSchedule.start_time == time(13, 0)
        ).first()
        if not pm_exists:
            pm = models.DoctorSchedule(
                doctor_id=doctor.id,
                date=d,
                start_time=time(13, 0),
                end_time=time(17, 0),
                capacity=0,
                booked_count=0,
                status=models.ScheduleStatus.open
            )
            db.add(pm)
    db.commit()

    # 建立未来一个月的日期表（按天聚合容量）
    for i in range(0, 30):
        d = today + timedelta(days=i)
        exists_day = db.query(models.DoctorDaySchedule).filter(
            models.DoctorDaySchedule.doctor_id == doctor.id,
            models.DoctorDaySchedule.date == d
        ).first()
        if not exists_day:
            dayrow = models.DoctorDaySchedule(
                doctor_id=doctor.id,
                date=d,
                am_capacity=0,
                am_booked_count=0,
                pm_capacity=0,
                pm_booked_count=0,
            )
            db.add(dayrow)
    db.commit()

@app.get("/")
def read_root():
    return {
        "message": "Medical System API is running",
        "version": "1.0.0",
        "modules": ["login", "administrator", "appointments", "ai", "api.auth", "api.admin", "api.doctor", "api.ai_consult", "api.profile"]
    }

@app.get("/health")
def health():
    try:
        db = next(get_db())
        db.execute("SELECT 1")
        return {"status": "ok"}
    except Exception as e:
        logger.exception("Health check failed")
        return JSONResponse(status_code=500, content={"status": "fail", "error": str(e)})

@app.get("/metrics")
def metrics():
    db = next(get_db())
    users = db.query(models.User).count()
    doctors = db.query(models.User).filter(models.User.role == models.UserRole.doctor).count()
    schedules_open = db.query(models.DoctorSchedule).filter(models.DoctorSchedule.status == models.ScheduleStatus.open).count()
    all_schedules = db.query(models.DoctorSchedule).all()
    total_capacity = sum([s.capacity for s in all_schedules])
    total_booked = sum([s.booked_count for s in all_schedules])
    ap_total = db.query(models.Appointment).count()
    ap_confirmed = db.query(models.Appointment).filter(models.Appointment.status == models.AppointmentStatus.confirmed).count()
    ap_cancelled = db.query(models.Appointment).filter(models.Appointment.status == models.AppointmentStatus.cancelled).count()
    return {
        "users": users,
        "doctors": doctors,
        "schedules_open": schedules_open,
        "capacity_total": total_capacity,
        "booked_total": total_booked,
        "appointments": {
            "total": ap_total,
            "confirmed": ap_confirmed,
            "cancelled": ap_cancelled,
        }
    }
# 基础日志配置与请求日志中间件
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s %(name)s: %(message)s')
logger = logging.getLogger("medical-system")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"{request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"{request.method} {request.url.path} -> {response.status_code}")
        return response
    except Exception as e:
        logger.exception(f"Unhandled error on {request.method} {request.url.path}: {e}")
        return JSONResponse(status_code=500, content={"detail": "服务器内部错误"})
