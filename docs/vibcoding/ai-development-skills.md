# ChinaTrip AI AI 开发规范与 Skills

## 1. 定位

本规范定义 AI 相关功能的研发流程，以及 `ai/skills` 在流程中的作用。

Skills 不是装饰性文档。它们用于帮助开发者和 AI 编程助手在开始修改前了解项目约束，并在稳定规则形成后保存工程经验。

## 2. 固定开发流程

所有会改变 AI 行为的任务执行：

```text
检查产品文档
→ 检查技术契约
→ 阅读对应 Skill
→ 先补 Harness case
→ 实现最小功能
→ 执行评测
→ 反哺 Prompt、文档和 Skill
```

AI 行为变化包括：

- Prompt 内容或拼装顺序。
- PromptProfile 分类和规则。
- 模型、Provider、fallback 或重试。
- RAG 检索、知识上下文或 sources。
- 回答 metadata。
- Markdown、图片、卡片或来源渲染。
- AI usage log 和质量报告。

## 3. 开发前置阅读

按任务类型阅读：

| 任务 | 必读内容 |
| --- | --- |
| Prompt、模型、RAG | 四期总纲、Prompt 契约、`china-trip-ai.md` |
| Harness、fixtures、回归 | Harness 规范、`china-trip-qa.md` |
| API、stream、错误码 | API Design、`china-trip-api.md` |
| Prisma、metadata、日志 | Database Design、`china-trip-data.md` |
| 回答结构、sources、visuals | Prompt 契约、`china-trip-ui.md` |

涉及多个领域时读取所有相关 Skill，不由单一 Skill 覆盖跨层改动。

## 4. 五个 Skill 的职责

### `china-trip-ai.md`

负责：

- Prompt composition。
- Prompt version。
- PromptProfile。
- Provider 和 model routing。
- fallback、重试和超时。
- RAG context 使用。
- AI usage logging。

### `china-trip-qa.md`

负责：

- Harness case。
- smoke/full/profile/case 执行。
- fixtures。
- pass/warning/fail 判定。
- Prompt 和 RAG 回归要求。
- 人工验收边界。

### `china-trip-api.md`

负责：

- AI API request/response。
- stream event。
- 错误码。
- 客户端不可见的降级行为。
- API metadata 的公开边界。

### `china-trip-data.md`

负责：

- Prisma schema。
- AI usage log。
- Message metadata。
- retrieval 和 source 存储。
- 数据迁移、索引和兼容性。

### `china-trip-ui.md`

负责：

- AI 回答 Markdown 渲染。
- sources 和 visuals。
- loading、streaming、failed、truncated 状态。
- 移动端和桌面端一致性。
- copy/share 行为。

## 5. 何时更新 Skill

满足任一条件应更新：

- 新规则会影响之后的同类任务。
- 同一问题已经出现两次。
- 代码中形成了新的稳定契约。
- Harness 新增了长期保留的阻塞规则。
- 文档和实现之间出现过偏差。
- 某项约束仅靠代码阅读不容易发现。

不应写入 Skill：

- 一次性调试记录。
- 未验证的个人偏好。
- 仅适用于一个临时 case 的细节。
- 已由类型系统完整表达且没有额外约束的内容。

## 6. Prompt、Harness 与 Skill 同步

```text
Prompt 定义模型行为
Harness 验证模型行为
Skill 约束如何修改和验证行为
```

同步规则：

- 新增 PromptProfile：更新类型、Prompt 契约、case 和 AI/QA Skills。
- 修改回答结构：更新 Prompt version、契约、结构 case 和 UI Skill。
- 修改 RAG metadata：更新数据/API 契约、Harness 检查和 Data/API Skills。
- 修改 sources 展示：更新 UI 契约、分享链路 case 和 UI Skill。
- 修复线上 AI 问题：先增加复现 case，再修复，最后判断是否沉淀为 Skill。

## 7. AI 生成代码检查清单

提交前确认：

- 没有在 client component 暴露 API key。
- 所有模型调用仍经过统一 Provider Service。
- 普通生成和流式生成使用同一 Prompt version。
- RAG 失败不会阻断正常回答。
- AI 失败会形成明确的 failed 状态和日志。
- metadata 没有存储不必要的敏感内容。
- 新增错误码遵循 API error shape。
- 回答结构能被现有 renderer 正确解析。
- copy/share 没有意外暴露 raw chunk 或内部 score。
- 已执行相应 Harness。
- 行为变化已更新文档或版本档案。

## 8. 禁止事项

- 绕过统一 AI Provider Service 直接调用模型。
- 在多个路由复制 Prompt 文本。
- 修改 Prompt 行为但不更新 version 或 case。
- 为让测试通过而删除高价值 case。
- 把 LLM Judge 当作唯一质量依据。
- 将 RAG 检索失败直接返回为用户错误。
- 向用户展示 raw knowledge chunk、embedding 或 similarity score。
- 在没有可靠来源时声称实时政策、价格或开放时间准确。
- 将生产密钥、完整用户对话或敏感身份信息写入 fixtures。

## 9. 例外处理

确需偏离规范时，PR 或变更记录必须说明：

- 偏离哪条规则。
- 为什么当前无法遵循。
- 风险和影响范围。
- 使用了什么替代验证。
- 何时消除例外。

临时例外不得静默转化为长期实现。若例外持续存在，应更新正式契约或创建技术债任务。

## 10. 评审机制

AI 相关变更至少从以下角度评审：

- 产品：是否解决目标旅行场景。
- Prompt：是否改变版本或回答契约。
- QA：是否有对应 case 和报告。
- 数据/API：metadata、日志和错误边界是否稳定。
- UI：stream、Markdown、sources、visuals 是否正确。

评审结论应明确：

- 可合并。
- 带 warning 合并。
- 因核心 fail 阻塞。
- 回滚到上一 Prompt version。

## 11. 验收机制

开发中：

```bash
pnpm ai:harness:smoke
pnpm ai:harness --profile <profile>
```

合并前：

```bash
pnpm lint
pnpm build
pnpm knowledge:ingest:dry-run
pnpm ai:harness:smoke
```

公共 Prompt、RAG 或模型路由改动：

```bash
pnpm ai:harness:full
```

在 Harness runner 尚未实现的阶段，必须记录人工验收问题、回答和结论；runner 落地后，人工基线应逐步转成 case。
