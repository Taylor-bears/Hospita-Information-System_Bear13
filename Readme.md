# 医疗管理系统（前后端分离）

## 目录
- `frontend/`：React + Vite 前端（患者/医生/管理员/药房页面）。
- `backend/`：FastAPI 后端（登录、管理员、预约等路由；SQLite 数据库存放于此）。
- `docs/`：产品/技术/测试/归档文档。

## 快速启动
后端
```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
前端
```powershell
cd frontend
npm install
npm run dev
```
默认前端 http://localhost:5173 ，后端 http://127.0.0.1:8000。

## 备注
- 数据库文件：`backend/medical.db`，重建可参考 `backend/init_db.sql`。
- 环境变量：`backend/.env.example` 复制为 `backend/.env`。若需使用 AI 咨询功能，请配置 `OPEN_ROUTER_API_KEY`。
- 预约/排班等接口位于 `backend/appointments/backend/routes.py`；前端 API 封装在 `frontend/src/lib/api.ts`。
