# 项目功能概览

## 后端（FastAPI）
- `backend/main.py`：应用启动、CORS、路由注册（登录、预约、AI、api/*）、健康检查/metrics、默认管理员与示例医生排班初始化、自动种子加载、请求日志。
- `backend/login/backend/routes.py`：手机号注册（患者/医生/药师设置状态）、bcrypt 登录校验、假 JWT 返回。
- `backend/appointments/backend/routes.py`：医生可用排班查询、按日过滤；创建预约（7 日内校验、容量与日汇总同步）；患者查看/取消我的预约；医生查看预约列表（含患者信息）、明细版；医生排班增删改（上午/下午固定时段、容量同步）；预约状态更新。
- `backend/api/auth.py`：患者/医生/药师注册（手机号清洗、档案创建、医生/药师待审核）、角色一致性登录。
- `backend/api/admin.py`：管理员添加用户、患者/医生/管理员查询；待审核医生计数；仪表盘统计（用户、预约、处方、收入）；医生/药师审核（单个/批量通过或拒绝并清理档案）；删除用户级联数据；药品 CRUD（库存/价格/阈值）；全量用户检索与详情（含预约、处方）。
- `backend/api/doctor.py`：医生列表；病历 CRUD（按患者/医生筛选）；开具处方（库存校验、金额计算、明细生成）；处方列表/单条查询（含药品名、患者信息、诊断）。
- `backend/api/pharmacy.py`：处方列表（附患者/医生名、药品明细）；发药流程（库存校验、扣减、状态更新）。
- `backend/api/profile.py`：按角色获取/更新个人资料；患者查询我的病历/处方；处方支付接口。
- `backend/api/orders.py`：基于处方生成患者订单视图（药品项、金额、配送信息、状态映射）。
- `backend/api/stats.py`：医生/药房/患者首页统计（预约数、待处理处方、患者总数、库存预警、营收等）。
- `backend/api/ai_consult.py`：AI 问诊（附患者上下文、科室列表，返回答案或兜底提示）、祝福语生成、v1 兼容端点。
- `backend/ai/routes.py` 与 `backend/ai/service.py`：AI 建议接口，调用 OpenRouter/DeepSeek，健康检查。
- 数据与脚本：`backend/models.py`（用户、档案、排班/日汇总、预约、药品、病历、处方/明细、审计等模型）、`backend/schemas.py`（Pydantic 模型）、`backend/database.py`（引擎/Session）、`backend/init_db.sql`、`backend/seed_data.py`、`backend/initial_data.json`、演示与测试脚本（`simulate_flow.py`、`e2e_appointments_concurrency_demo.py`、`tests_appointments_sqlite.py`）。

## 前端（React + Ant Design）
- `frontend/src/router/index.tsx`：路由与角色守卫，入口包含患者/医生/管理员/药房工作台、登录注册、AI 问诊、预约、处方、订单、用户管理等。
- `frontend/src/pages/LoginPage.tsx`、`RegisterPage.tsx`：角色化登录/注册，调用 `/api/auth` 与 `/login`。
- 患者端：`frontend/src/pages/patient/PatientDashboard.tsx`（首页统计、近期预约/处方、快捷导航）、`AppointmentBooking.tsx`（医生列表与排班预约）、`AIConsult.tsx`（AI 问诊对话）、`PatientPrescriptions.tsx`/`MyOrders.tsx`（处方与订单查看/支付）、`ProfilePage.tsx`（资料编辑）。
- 医生端：`frontend/src/pages/doctor/DoctorDashboard.tsx`（今日/未来预约、处方统计、日历）、`AppointmentManagement.tsx`（预约管理）、`PrescriptionManagement.tsx`（处方列表与开方流程）、`MedicalRecordPage.tsx`（病历列表/创建）。
- 管理员端：`frontend/src/pages/admin/AdminDashboard.tsx`（总览卡片）、`UserReview.tsx`（医生/药师审核与批量操作）、`UserManagement.tsx`（全量用户查询与详情）。
- 药房端：`frontend/src/pages/pharmacy/PharmacyDashboard.tsx`（库存/待配药统计）、`DrugInventory.tsx` 与 `PriceAdjustment.tsx`（药品库存、价格调整界面）、`PrescriptionProcessing.tsx`（处方列表与发药）。
- 通用：`frontend/src/components/Layout/AppLayout.tsx`（导航布局）、`frontend/src/components/Auth/ProtectedRoute.tsx`（角色路由保护）、`frontend/src/lib/api.ts`（axios 实例与 token 注入）；`frontend/src/stores/*`（认证/UI 状态），`frontend/src/hooks/*`、`frontend/src/utils/*`（表单、表格、格式化等工具）。

## 运行与配置
- `Readme.md`：启动后端（FastAPI）与前端（Vite）步骤，数据库与环境变量说明。
- `backend/.env.example`、`backend/.env`：后端配置示例；前端格式化/构建配置（如 `frontend/.prettierrc` 等）。
