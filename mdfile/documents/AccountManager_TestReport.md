# AccountManager 测试报告

## 通过用例
- 新增并认证账号：添加患者账号并校验密码与角色。
- 持久化加载：确保本地存储加载后账号仍可读取。
- 状态通知：调用 `setStatus` 后触发订阅回调。

## 环境
- Vitest jsdom，已启用必要 polyfill。

## 结论
- AccountManager 核心功能正常，满足统一认证与账号管理的最小可行实现。

