# 架构变更说明

## 核心模块保留
- 身份注册：患者、医生、药房工作人员、管理员
- 预约系统：创建/修改/取消、时间选择与资源分配、状态管理
- 管理员面板：用户管理、权限控制、系统监控、数据统计、配置管理

## 主要变更
- 前端代码统一使用根目录 `src`，标记 `medical-system/frontend` 为弃用并在部署中忽略
- API 调用统一通过 `src/lib/api.ts` 的 Axios 实例，约定请求/响应格式与错误处理
- Supabase 辅助模块保持不变，库存更新逻辑改为读取当前库存后计算新值再写入
- TanStack Query 统一使用 v5 API：`isPending`、`invalidateQueries({ queryKey })`
- 管理员仪表盘重复文件合并：保留 `src/pages/admin/AdminDashboard.tsx`，其余同名文件标记弃用；通用显示逻辑抽取到 `src/utils/admin.ts`

## 模块边界
- `src/pages`：页面级功能模块
- `src/components`：跨页面复用组件
- `src/lib`：后端 API 客户端与集成
- `src/stores`：全局状态（Zustand）
- `src/router`：路由配置

## 数据与迁移
- 保留 `supabase/migrations` 与 `medical-system/backend` 的迁移与数据库文件

## 兼容性
- 保持现有 API 接口不变；新增调用规范不破坏现有调用

## 测试与质量
- 类型检查通过（`npm run check`）
- 保持核心功能逻辑与性能指标不变
