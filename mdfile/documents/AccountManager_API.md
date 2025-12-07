# AccountManager API

## 概述
统一管理账号信息与认证、权限、状态通知与持久化。

## 类型
- AccountRole: admin|doctor|patient|pharmacist
- AccountStatus: pending|approved|rejected|active
- AccountRecord: { id, phone, name, role, status, passwordEnc, created_at, updated_at }

## 方法
- init(): 初始化并加载持久化数据，内置管理员账号。
- addAccount(phone, name, password, role, status): 新增账号并持久化。
- authenticate(phone, password, role?): 校验并返回账号记录。
- getByPhone(phone): 获取账号。
- getAll(): 获取全部账号列表。
- setStatus(phone, status): 更新状态并通知。
- updateRole(phone, role): 更新角色并通知。
- on(listener): 订阅变更；listener(type, payload)。
- off(listener): 取消订阅。
- hasPermission(role, resource, action): RBAC 判定。

## 事件
- change: 账号新增或角色变更。
- status: 状态变更。

