# 统一 API 调用规范

## 客户端
- 基础实例：`src/lib/api.ts` 使用 Axios，统一 `baseURL`、`timeout`、`Authorization` 注入
- 请求头：自动注入 `Bearer token`，调用方无需手动设置
- 错误处理：调用方捕获异常并以 `message.error` 反馈；网络错误不抛出到全局

## 身份注册
- 路由：
  - 患者 `POST /api/auth/register/patient/`
  - 医生 `POST /api/auth/register/doctor/`
  - 药房工作人员 `POST /api/auth/register/pharmacist/`
  - 管理员：由系统初始化，不开放注册
- 字段：`phone`、`password`、`name`、`role`

## 预约系统
- 我的预约：`GET /appointments/my?patient_id={id}`
- 取消预约：`POST /appointments/{id}/cancel?patient_id={id}`
- 预约创建/修改：沿用现有接口，前端通过状态刷新 `refetch`

## 管理员面板
- 用户列表：`GET /api/admin/users`
- 药品列表：`GET /api/admin/medications`
- 药品更新：`PUT /api/admin/medications/{id}`

## 库存管理（Supabase）
- 读取库存：`from('inventory').select('quantity').eq('id', inventoryId).single()`
- 更新库存：读取后计算新值再 `update({ quantity, updated_at })`
- 变更记录：`stock_movements` 插入一条记录（含 `movement_type`、`quantity`、`balance`）

## React Query v5 约定
- 变更状态：`mutation.isPending`
- 失效查询：`queryClient.invalidateQueries({ queryKey: [...] })`
