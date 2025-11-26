from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from database import engine, get_db, Base
import models, schemas

# 创建数据库表
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境请修改为前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 密码哈希工具
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

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

@app.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # 检查手机号是否已存在
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if db_user:
        raise HTTPException(status_code=400, detail="该手机号已被注册")

    # 设置状态
    # 普通用户直接 active
    # 医生需要 pending
    user_status = models.UserStatus.active
    if user.role == models.UserRole.doctor:
        user_status = models.UserStatus.pending
    
    # 管理员账号不能通过注册接口创建
    if user.role == models.UserRole.admin:
        raise HTTPException(status_code=400, detail="无法注册管理员账号")

    hashed_password = get_password_hash(user.password)
    new_user = models.User(
        phone=user.phone,
        password=hashed_password,
        role=user.role,
        status=user_status
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login", response_model=schemas.Token)
def login(user: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.phone == user.phone).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="手机号或密码错误")
    
    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="手机号或密码错误")

    if db_user.status == models.UserStatus.pending:
        raise HTTPException(status_code=403, detail="账号审核中，请等待管理员审核")

    # 这里简单返回 token (实际项目中应使用 JWT)
    return {
        "access_token": "fake-jwt-token", 
        "token_type": "bearer",
        "role": db_user.role,
        "status": db_user.status
    }

@app.get("/")
def read_root():
    return {"message": "Medical System API is running"}
