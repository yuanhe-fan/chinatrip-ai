# travel-answer-v11-unified-list-items

## 状态

```text
superseded
```

## 目标

统一回答中的列表项格式，降低重复编号、嵌套列表和行程结构不稳定的问题，使回答能被当前前端 renderer 稳定解析。

## 组成

当前版本由以下模块组合：

- Core Prompt。
- Pain Point Rules。
- Intent Classifier。
- Prompt Profile。
- Stable Output Template。
- 可选 Knowledge Context。
- Final Answer Contract。

## 主要行为

- 默认使用 `Direct Answer / Do This / Watch Out`。
- 普通步骤使用 `Short title: clear action`。
- 一日行程使用扁平编号列表。
- 多日行程使用 `### Day N: Short Theme`，每天重新编号。
- 限制顶级标题、表格行数和无关背景。
- 禁止裸分隔线、破碎 Markdown 和混合标题结构。

## 影响范围

影响全部 PromptProfile，重点影响：

- `itinerary_planning`
- `transport_workflow`
- `payment_survival`
- `tickets_booking`

## 已知风险

- 严格结构可能使简单问题显得模板化。
- 模型可能仍在长行程中产生重复编号。
- 对“继续上一回答”类问题需避免重新输出完整开头。
- 输出接近 token 上限时可能形成未完成列表。

## 评测要求

当前 Harness 至少覆盖：

- 一日行程无嵌套列表。
- 多日行程按 Day 分段并每天重新编号。
- 支付、交通、订票回答包含场景必需项。
- 顶级标题不超过三个。
- 不输出裸分隔线。
- `promptVersion` 和 `promptProfile` metadata 存在。

## 发布结论

已被 `travel-answer-v12-payment-failure-safety` 取代。Harness runner、32 条 full case 和 12 条 smoke case 已接入；真实模型基线以本地报告为准。
