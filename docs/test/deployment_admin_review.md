# 部署说明（管理员审核系统）

## 环境
- 数据库：PostgreSQL 14+（建议）或 MySQL 8+
- 语言框架：Node.js(Express/NestJS)/Python(FastAPI/Django)
- 运行环境：Linux/Windows；启用 HTTPS 与反向代理（Nginx）

## 配置
- 环境变量：
  - `DB_URL`、`JWT_SECRET`、`LOG_LEVEL`、`PORT`
  - `RATE_LIMIT`、`TLS_CERT`、`TLS_KEY`
- 连接池：`max=20`，`idleTimeout=30s`
- 索引：`reviews(status, role, submitted_at)`；`audit_logs(actor_id, created_at)`

## 安全
- 强制 HTTPS；Nginx `return 301 https://$host$request_uri;`
- 输入校验与参数化查询；启用 WAF 与速率限制
- 管理员二次验证：批量拒绝与敏感操作需 OTP

## 迁移
- 表设计：
  - `users(id, phone, name, role, approved, created_at, updated_at)`
  - `reviews(id, user_id, role, status, payload_json, submitted_at, updated_at)`
  - `audit_logs(id, actor_id, actor_name, action, entity, details_json, created_at)`
- 迁移脚本：从演示数据导入至真实库，填充缺失字段，校验唯一约束

## 监控与日志
- 接入 APM 与结构化日志（JSON）；按天滚动
- 指标：请求数、错误率、P95、队列长度、DB 延时

## 回滚策略
- 灰度发布；启用只读模式与流量切换
- 回滚保留审计日志与数据快照
