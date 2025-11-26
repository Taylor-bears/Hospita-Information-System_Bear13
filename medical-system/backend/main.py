from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from database import engine, get_db, Base
import models
import sys
import os

# 添加模块路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# 导入各模块的路由
from login.backend.routes import router as login_router
from administrator.backend.routes import router as admin_router

# 创建数据库表
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="医疗管理系统API", version="1.0.0")

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境请修改为前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册模块路由
app.include_router(login_router)
app.include_router(admin_router)

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

# 初始化默认管理员
@app.on_event("startup")
def create_default_admin():
    db = next(get_db())
    admin = db.query(models.User).filter(models.User.role == models.UserRole.admin).first()
    if not admin:
        # 默认管理员账号: 13800138000, 密码: admin
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

@app.get("/")
def read_root():
    return {
        "message": "Medical System API is running",
        "version": "1.0.0",
        "modules": ["login", "administrator"]
    }
