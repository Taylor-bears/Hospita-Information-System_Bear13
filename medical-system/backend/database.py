from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 数据库连接配置
# 请确保你已经安装了 MySQL，并且创建了名为 medical_db 的数据库
# 格式: mysql+pymysql://用户名:密码@地址:端口/数据库名
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:Syh200412@localhost:3306/medical_db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
