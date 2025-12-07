# 管理员审核 API 设计

## 总览
- 基于 REST 的审核系统端点，覆盖查询、审核操作（通过/拒绝）、批量处理、详情查看。
- 统一鉴权：JWT Bearer；仅 `admin` 或具备 `reviewer` 权限的用户可访问。
- 响应采用标准 HTTP 状态码；错误返回统一错误结构。

## 资源与端点

### 审核项集合
- `GET /api/admin/reviews/items`
  - 查询待审核或历史审核记录
  - Query：`status`(pending|approved|rejected)、`role`(doctor|pharmacist)、`from`、`to`、`page`、`pageSize`
  - 200：`{ items: ReviewItem[], page: number, pageSize: number, total: number }`

### 审核详情
- `GET /api/admin/reviews/:id`
  - 200：`ReviewItem`

### 审核通过
- `POST /api/admin/reviews/:id/approve`
  - Body：`{ notes?: string }`
  - 200：`{ id: string, status: 'approved' }`

### 审核拒绝
- `POST /api/admin/reviews/:id/reject`
  - Body：`{ reason: string, notes?: string }`
  - 200：`{ id: string, status: 'rejected' }`

### 批量处理
- `POST /api/admin/reviews/batch`
  - Body：`{ action: 'approve'|'reject', ids: string[], reason?: string, notes?: string }`
  - 200：`{ success: string[], failed: { id: string, error: string }[] }`

### 审计日志
- `POST /api/audit/logs`
  - Body：`{ action: string, entity: string, details: any, timestamp: string }`
  - 201：`{ id: string }`
- `GET /api/audit/logs`
  - Query：`actorId?`, `entity?`, `action?`, `from?`, `to?`, `page`, `pageSize`

## 数据模型

### ReviewItem
```
{
  id: string,
  userId: string,
  name: string,
  phone: string,
  role: 'doctor'|'pharmacist',
  status: 'pending'|'approved'|'rejected',
  submittedAt: string,
  updatedAt: string,
  payload: {
    specialization?: string,
    license_number?: string,
    department?: string
  }
}
```

### 审计日志
```
{
  id: string,
  actorId: string,
  actorName: string,
  action: 'approve'|'reject'|'batch_approve'|'batch_reject'|'admin_account_update',
  entity: 'user'|'review'|'system',
  details: any,
  createdAt: string
}
```

## 身份与权限
- 认证：`Authorization: Bearer <jwt>`；后端校验签名与过期时间。
- 授权：基于 RBAC；角色 `admin` 或具备 `review:write` 的 `reviewer` 可执行审核；`review:read` 可查询。
- 审计：所有写操作写入审计日志，记录操作者、时间、目标与结果。

## 事务与一致性
- 审核通过/拒绝需在事务中执行：
  - 更新审核记录状态
  - 更新目标用户状态字段（如 `users.approved=true`）
  - 写入审计日志
  - 成功后返回 200；任何一步失败回滚并返回 409/500

## 分页与性能
- 分页：`page` 从 1 开始，默认 1；`pageSize` 默认 20，最大 100
- 索引建议：`reviews(status, role, submitted_at)` 复合索引；`audit_logs(actor_id, created_at)`
- 响应时间目标：<500ms 在 P95，启用连接池与只读查询缓存

## 校验与安全
- 输入校验：所有端点的 `query` 和 `body` 字段严格校验（如 zod/class-validator）
- 防注入：使用参数化查询或 ORM；禁止字符串拼接 SQL
- 传输安全：强制 HTTPS；生产环境拒绝明文 HTTP
- 敏感操作二次验证：批量拒绝需附加一次性验证码或二次确认标记

## 错误结构
```
{
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```
- 常见错误码：`UNAUTHORIZED`(401)、`FORBIDDEN`(403)、`NOT_FOUND`(404)、`VALIDATION_FAILED`(422)、`CONFLICT`(409)、`INTERNAL_ERROR`(500)

## 示例

### 查询待审核医生
```
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/admin/reviews/items?status=pending&role=doctor&page=1&pageSize=20"
```

### 单条通过
```
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"notes":"符合资质"}' \
  "http://localhost:8000/api/admin/reviews/123/approve"
```

### 批量拒绝
```
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action":"reject","ids":["123","124"],"reason":"资料不完整"}' \
  "http://localhost:8000/api/admin/reviews/batch"
```
