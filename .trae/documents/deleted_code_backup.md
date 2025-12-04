# 被删除/弃用代码备份清单

> 说明：以下模块标记为弃用并在部署构建中忽略，源代码仍保留于仓库中以备查阅与回滚。

## 标记为弃用的重复前端模块
- 路径：`medical-system/frontend/**`
- 理由：与根目录 `src/**` 重复，实现相同的页面与 API 逻辑；统一前端栈后保留 `src/**`
- 处理：加入 `.vercelignore` 忽略构建；推荐后续人工归档或移除

## 主要包含内容
- `src/pages/**`：Admin/Doctor/Patient/Pharmacy 等页面的重复实现
- `src/api/**`：axios 与 API 调用的重复实现
- `src/components/**`：AiConsult/PaymentModal/ErrorBoundary 等组件重复实现
- `router/index.tsx`、`stores/**`、`utils/**`：重复的路由、状态与工具

## 回滚指引
- 如需回滚，请从上述路径直接检出对应文件；当前生产/预览构建不会包含这些目录
