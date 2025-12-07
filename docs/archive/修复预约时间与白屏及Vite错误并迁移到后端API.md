## 问题确认
- 患者预约时间无法设置：预约页使用后端排班，但若无排班或字段不匹配，时间下拉为空；列表列渲染仍使用旧字段导致异常。
- 多处 `vite-error-overlay`：AI问诊与管理员界面均从 `../../utils/supabase` 导入，项目中缺少该文件，导致导入失败并出现覆盖层。
- 药单页白屏与被弹出到登录：患者模块的多个页面仍依赖 Supabase（网络不稳定或导入错误）导致崩溃；崩溃后路由守卫将用户重定向至登录。

## 解决方案
### 1. 先止血：添加 Supabase 适配层
- 新增 `src/utils/supabase.ts`，从 `src/lib/supabase.ts` 进行重导出，立刻消除所有 `../../utils/supabase` 导入错误导致的 vite overlay。
- 在控制台确认前端可以进入页面，不再被覆盖层阻塞。

### 2. 完整迁移到后端 API，去除不稳定依赖
- AI问诊：删除 Supabase 读写，改为调用后端 `api.ai_consult` 路由（若暂缺，先用本地存储模拟历史与消息持久化），保留现有 UI 与分析逻辑。
- 管理员界面：改用 `GET /api/admin/stats`、`GET /api/admin/users` 等后端接口绘制统计与列表；去除 Supabase 引用。
- 患者药单（MyOrders）：改为后端订单/处方接口（若暂缺，先用后端药品/订单模拟接口或本地数据），确保不再依赖 Supabase；统一路由只保留一个“我的药单”页面，移除重复入口（span/div）导致的混乱。

### 3. 修复预约时间与列表渲染
- 预约页：
  - 选择医生后，按日期调用 `GET /appointments/doctor/{doctorId}/schedules?date=YYYY-MM-DD`。
  - 将下拉项绑定到具体 `schedule_id`，显示 `start_time-end_time`；若没有排班，提示“该日期暂无可预约时段”。
  - 创建预约：`POST /appointments` 使用 `{ patient_id, doctor_id, schedule_id }`。
- 我的预约列表：
  - 数据源改为 `GET /appointments/my?patient_id=...`。
  - 列渲染改为使用 `created_at` 与 `status`，医生名通过前面医生列表内存映射或追加一次 `GET /api/doctor/`。
  - 去除旧字段（如 `appointment_date`/`appointment_time`），避免渲染异常导致白屏。

### 4. 路由与鉴权稳定化
- 确保 `authStore` 登录后 `isAuthenticated` 为真，`role` 映射（patient→user）一致；页面崩溃不再触发守卫误判。
- 为关键页面添加错误边界，避免渲染异常直接重定向登录。

### 5. 验证与回归
- 启动后端与前端，逐页验证：
  - 患者预约：时间可选、可提交、可取消；无排班有明确提示。
  - AI问诊：无 vite overlay；消息可发送、历史可查看（后端或本地）。
  - 我的药单：页面正常渲染、可点击返回，不白屏不弹出登录。
  - 管理员登录：无 vite overlay，统计与列表正常显示。
- 控制台与网络请求无错误；必要时通过后端日志核对接口 200/400/403 正常。

## 交付内容
- 新增 `src/utils/supabase.ts` 适配文件。
- 修改患者模块的预约与我的预约页面，使用后端接口并修复列渲染。
- 迁移 AI问诊与管理员界面至后端接口，移除 Supabase 依赖。
- 路由与错误边界加固，减少崩溃导致的误重定向。

## 风险与应对
- 若后端暂缺订单/处方接口，先以本地存储或后端药品接口模拟，后续再补齐。
- 若医生无排班，时间下拉为空属正常，页面将给出明确指引由医生侧添加排班或选择其他日期。

请确认以上方案，我将开始实施，优先添加 `utils/supabase.ts` 以立即消除 vite overlay，并同步修复预约与列表渲染。