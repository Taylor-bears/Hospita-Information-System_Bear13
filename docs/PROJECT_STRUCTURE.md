# 医疗管理系统 - 项目结构（2025-12 重整版）

## 目录总览
```
frontend/                # React + Vite 前端（实际在用）
├─ src/                  # 前端源码
├─ public/               # 静态资源
├─ package.json          # 前端依赖/脚本
├─ vite.config.ts        # Vite 配置
└─ 其他前端配置（tsconfig、tailwind、eslint 等）

backend/                 # FastAPI 后端
├─ main.py               # 入口，挂载 login/administrator/appointments/api 路由
├─ database.py           # SQLAlchemy 连接（SQLite）
├─ models.py             # 核心模型/枚举
├─ schemas.py            # Pydantic 模型
├─ medical.db            # 唯一保留的数据库文件
├─ api/ ai/ doctor/      # 其他后端模块
├─ appointments/         # 预约子模块（路由）
├─ administrator/        # 管理员子模块（路由）
├─ login/                # 登录注册子模块（路由）
├─ .env / .env.example   # 环境变量
└─ requirements.txt      # 后端依赖

docs/                    # 文档
├─ product/              # PRD/需求
├─ tech/                 # 技术架构/方案
├─ test/                 # 测试/计划
└─ archive/              # 历史记录/修复说明
```

> 已清理：空目录与旧 supabase 迁移目录、重复的 `medical.db`（仅保留 `backend/medical.db`），删除了临时 md（deleted_code_backup.md / uncertain_code_list.md）。

## 启动方式
后端
```powershell
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
前端
```powershell
cd frontend
npm install
npm run dev
```
默认：前端 http://localhost:5173 ，后端 http://127.0.0.1:8000。

## 模块速览
- `backend/main.py`：挂载 login / administrator / appointments / api 等路由。
- `backend/database.py`：`SQLALCHEMY_DATABASE_URL="sqlite:///./medical.db"`，`engine`、`SessionLocal`、`get_db()`。
- `backend/models.py`：用户/预约/排班模型与枚举；预约状态含 scheduled/confirmed/completed/cancelled/pending。
- `backend/appointments/backend/routes.py`：患者医生预约、排班、容量同步等接口。
- 前端入口 `frontend/src/main.tsx`，路由 `frontend/src/App.tsx`，页面在 `frontend/src/pages`，API 封装 `frontend/src/lib/api.ts`。

## 配置与数据
- 数据库：`backend/medical.db`（SQLite），重建可参考 `backend/init_db.sql`。
- 环境变量：参考 `backend/.env.example`，复制为 `backend/.env`。
