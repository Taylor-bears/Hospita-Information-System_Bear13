# 待确认代码清单

> 说明：保留以下代码并在此清单标注不确定性，以便后续确认。

## AI 咨询
- 文件：`src/pages/patient/AIConsult.tsx`
- 不确定点：症状分析与建议为前端模拟逻辑；是否需要后端 AI 服务的稳定协议与输出结构

## 价格调整历史
- 文件：`src/pages/pharmacy/PriceAdjustment.tsx`
- 不确定点：`priceLogs` 未实现加载与展示；历史数据来源与接口未定义

## 报表分析
- 文件：`src/pages/pharmacy/ReportsAndAnalytics.tsx`
- 不确定点：库存预警字段 `current_stock/min_stock_level` 的表结构与实际数据源需确认

## 管理员用户审核
- 文件：`src/pages/admin/UserReview.tsx`
- 不确定点：角色与状态映射为前端推导（`active`→`approved`），后端实际状态枚举需确认

## 订单与支付
- 文件：`src/pages/patient/OnlinePharmacy.tsx`
- 不确定点：订单创建后的跳转与支付流程（支付渠道、回调）需确认
