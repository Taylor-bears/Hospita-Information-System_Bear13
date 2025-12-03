# AccountManager 迁移指南

## 目标
- 所有账号相关操作通过 AccountManager 执行。

## 步骤
1. 引入 `src/lib/AccountManager.ts` 并在应用启动或首次使用前调用 `init()`。
2. 登录逻辑：优先走后端接口；失败时使用 `accountManager.authenticate` 或 `addAccount` 回退。
3. 账号读取：用 `getByPhone`、`getAll` 替换直接读取本地存储。
4. 状态流转：审核通过/拒绝改为调用 `setStatus`，并同步后端接口。
5. 权限判断：在需要处调用 `hasPermission(role, resource, action)`。

## 变更点
- `src/stores/authStore.ts` 已接入 AccountManager。
- `src/lib/mvpMock.ts` 的数据源已统一为 AccountManager。

## 验证
- 管理员、医生、患者可正常登录；医生列表与预约正常显示；状态通知正常触发。

