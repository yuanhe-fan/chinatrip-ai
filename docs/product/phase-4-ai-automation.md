# ChinaTrip AI 四期产品计划：AI 自动化工程沉淀

## 1. 概述

四期不以新增业务页面为主要目标，而是把前三期已经形成的 AI 能力沉淀为可验证、可追溯、可复用的工程体系。

四期聚焦三个方向：

1. AI 评测 Harness。
2. Prompt 版本与回答契约。
3. AI 开发规范与 Skills。

三者的依赖顺序为：

```text
Harness 质量基线
→ Prompt 版本与回答契约
→ Skills 开发规范
→ 三者闭环运行
```

Harness 提供质量尺度，Prompt 契约定义预期行为，Skills 约束研发过程。任何一项单独存在都不足以形成稳定的 AI 工程能力。

## 2. 背景

前三期已经完成或建立了以下基础：

- 核心聊天、分享和身份链路。
- Prompt profile 与结构化回答模板。
- AI Provider Service 和流式回答。
- AI usage log、回答 metadata 与完成状态。
- RAG 知识种子、embedding、pgvector 检索与来源展示。
- `ai/prompts`、`ai/fixtures`、`ai/harness`、`ai/skills` 目录。

当前主要问题不再是“能否生成回答”，而是：

- Prompt、模型或知识库调整后缺少稳定的自动回归。
- 回答要求分散在代码、文档和经验中，缺少统一契约。
- Prompt version 只有代码常量，缺少变更背景和验收记录。
- Skills 仍以基础说明为主，尚未形成研发准入机制。
- AI 质量主要依赖人工抽查，无法持续比较和复盘。

## 3. 四期目标

四期完成后，项目应具备以下能力：

- 使用固定评测集验证核心入境游场景。
- 按 `smoke`、`full`、`profile`、`case` 运行 AI 回归。
- 将回答语言、结构、场景重点和安全要求定义为契约。
- 通过 `promptVersion` 追踪每次核心 Prompt 行为变更。
- 将稳定规则沉淀到项目 Skills，并用于开发前检查。
- 在开发、合并前和定期巡检三个周期执行质量检查。
- 将评测失败反哺到 Prompt、知识库、fixtures、文档和 Skills。

## 4. 非目标

四期第一阶段不建设：

- 实时政策、价格、开放时间的自动事实核验平台。
- 大规模人工标注系统。
- 多模型在线 A/B 实验平台。
- 独立的知识库 CMS。
- 自动抓取和发布外部旅游内容的爬虫系统。
- 以 LLM Judge 结果直接阻塞所有 CI 的机制。

## 5. 总体闭环

```text
产品需求或线上问题
→ 定义/更新回答契约
→ 补充 Harness case
→ 修改 Prompt、RAG、模型或代码
→ 运行自动评测
→ 生成 JSON / Markdown 报告
→ 修复失败或记录 warning
→ 更新 Prompt version 与 Skills
```

质量资产分工：

| 资产 | 作用 | 主要目录 |
| --- | --- | --- |
| Harness | 自动验证 AI 行为 | `ai/harness` |
| Prompt contract | 定义回答预期 | `docs/technical`、`ai/prompts` |
| Prompt version | 记录行为变更 | `ai/prompts/versions` |
| Fixtures | 保存典型输入和样例 | `ai/fixtures` |
| Skills | 约束研发方式 | `ai/skills` |
| Reports | 保存评测结果 | `ai/harness/reports` |

## 6. 建设内容

### 6.1 AI 评测 Harness

首批覆盖以下场景：

- `payment_survival`
- `internet_apps`
- `transport_workflow`
- `tickets_booking`
- `emergency_help`
- `itinerary_planning`
- `language_cards`

评测至少覆盖：

- 回答语言。
- 回答结构。
- 可执行步骤。
- 中国旅行上下文。
- 场景必需信息。
- 禁止或高风险表达。
- 回答长度。
- RAG sources 与 metadata。
- 回答截断和生成失败。

详细规范见 [AI 评测 Harness 技术规范](../technical/ai-evaluation-harness.md)。

### 6.2 Prompt 版本与回答契约

沉淀内容包括：

- Prompt 版本命名和升级规则。
- 当前版本档案和后续 changelog。
- 全局回答契约。
- 各 PromptProfile 场景契约。
- Markdown 渲染契约。
- Prompt metadata 契约。
- Prompt 变更准入和回滚流程。

详细规范见 [Prompt 版本与回答契约](../technical/prompt-version-and-answer-contract.md)。

### 6.3 AI 开发规范与 Skills

Skills 必须从参考文档升级为开发工作流的一部分：

```text
检查产品文档
→ 检查技术契约
→ 阅读对应 Skill
→ 先补 Harness case
→ 实现最小功能
→ 执行评测
→ 反哺 Prompt、文档和 Skill
```

详细规范见 [AI 开发规范与 Skills](../vibcoding/ai-development-skills.md)。

## 7. 实施阶段

### 阶段一：文档基线

交付：

- 四期产品总纲。
- Harness 技术规范。
- Prompt 版本与回答契约。
- AI 开发规范与 Skills。
- 当前 Prompt 版本档案。
- README 与目录索引更新。

完成标准：

- 三项建设内容职责清晰且无冲突。
- 当前 PromptProfile 全部有契约定义。
- 当前 Prompt version 可以追溯。

### 阶段二：Harness MVP

交付：

- Harness case schema。
- runner、checks、report 模块。
- 10 至 15 条 smoke case。
- 32 条 full case，覆盖全部 9 个 PromptProfile。
- JSON 与 Markdown 报告。
- profile 和单 case 过滤能力。

完成标准：

```bash
pnpm ai:harness:smoke
pnpm ai:harness:full
pnpm ai:harness --profile payment_survival
pnpm ai:harness --case <case-id>
```

### 阶段三：Prompt 契约接入

交付：

- 契约规则映射到 Harness 检查项。
- `promptVersion`、`promptProfile` metadata 检查。
- Prompt 版本升级和回滚清单。
- 核心 profile 回归基线。

### 阶段四：Skills 升级

交付：

- 五个项目 Skill 的职责和规则更新。
- AI 相关变更的开发前、合并前检查清单。
- 评测失败到 Skill 更新的反哺机制。

## 8. 执行机制

### 8.1 开发中

- 小型 AI 相关改动运行 smoke。
- 修改某个 profile 时运行对应 profile。
- 修改公共 Prompt 结构或 RAG 注入时运行 full。
- 新增 AI 能力时先补 case，再实现。

### 8.2 合并前

基础检查：

```bash
pnpm lint
pnpm build
pnpm knowledge:ingest:dry-run
pnpm ai:harness:smoke
```

涉及 Prompt、RAG、知识库或模型路由时追加：

```bash
pnpm ai:harness:full
```

### 8.3 定期巡检

建议每周运行 full harness，并记录：

- 按 profile 的通过率。
- Prompt version 变化。
- RAG 启用率和失败原因。
- 生成失败、截断和延迟异常。
- 新出现的高风险回答模式。

## 9. 评测命令使用指南

### 9.1 命令速查

| 命令 | 执行范围 | 适用场景 |
| --- | --- | --- |
| `pnpm ai:harness` | 默认执行 12 条 smoke 用例，等价于 `pnpm ai:harness:smoke` | 日常 AI 改动后的快速回归 |
| `pnpm ai:harness:smoke` | 执行 12 条高价值核心用例 | 开发完成、提交前 |
| `pnpm ai:harness:full` | 执行全部 32 条用例，覆盖 9 个 PromptProfile | 公共 Prompt、RAG、模型路由变更或定期巡检 |
| `pnpm ai:harness --profile payment_survival` | 执行指定 PromptProfile 的全部用例 | 修改单一业务场景 Prompt 后 |
| `pnpm ai:harness --case <case-id>` | 只执行一条指定用例 | 定位失败、调试 Prompt、验证修复 |
| `pnpm ai:harness:test` | 测试 Harness 自身的 schema、规则、CLI 和报告逻辑 | 修改 runner、checks 或 report 后 |

`pnpm ai:harness:test` 不调用外部模型或数据库。其余 Harness 评测命令默认调用 `.env.local` 中 `AI_PROVIDER` 指定的真实模型。

### 9.2 开发周期选择

开发中优先缩小执行范围：

```text
定位一个问题
→ --case

修改一个业务场景
→ --profile

完成普通 AI 改动
→ smoke

修改公共 Prompt、RAG 或模型路由
→ full

修改 Harness 自身
→ ai:harness:test
```

提交前至少运行 smoke。公共 Prompt、RAG、知识库批量更新或模型路由变更还必须运行 full。

### 9.3 常用选项

| 选项 | 作用 | 使用限制 |
| --- | --- | --- |
| `--fail-on-warning` | warning 也返回非零退出码 | 用于严格验收，不改变报告中的状态 |
| `--concurrency 2` | 同时执行两个 case | 默认串行，允许范围为 1 至 8；提高并发会增加限流风险 |
| `--allow-mock` | 允许使用 mock Provider | 仅验证 Harness 流程，不能作为回答质量基线 |
| `AI_PROVIDER=mock` | 临时将 Provider 覆盖为 mock | 必须与 `--allow-mock` 一起使用 |

示例：

```bash
pnpm ai:harness --profile itinerary_planning --fail-on-warning
pnpm ai:harness:full --concurrency 2
AI_PROVIDER=mock pnpm ai:harness --case payment-foreign-card-setup --allow-mock
```

### 9.4 模型调用、成本与数据边界

- smoke、full、profile 和 case 模式默认调用真实 Provider。
- 评测会向 Provider 发送 case 问题、项目 Prompt、必要的历史消息以及检索到的知识上下文。
- 运行前必须确认目标 Provider 获准接收这些内容，环境中不得包含生产密钥以外的敏感用户数据。
- smoke 产生 12 次模型调用；full 产生 32 次模型调用，失败重试或 Provider 行为可能增加实际请求数。
- full 有明显的时间和模型成本，不默认接入普通 CI，仅在公共行为变更和定期巡检时执行。
- RAG 数据库或 embedding 服务不可用时，生成链路继续运行，并将 `retrieval_degraded` 记录为 warning。

### 9.5 结果、退出码与报告

- 存在 `fail`：命令返回非零退出码。
- 只有 `warning`：默认返回成功退出码，报告保留 warning。
- 使用 `--fail-on-warning`：存在 warning 也返回非零退出码。
- 全部 `pass`：返回成功退出码。

每次执行会覆盖本地最新报告：

```text
ai/harness/reports/latest.json
ai/harness/reports/latest.md
```

JSON 用于自动处理，Markdown 用于人工复盘。两份 `latest` 报告已被 Git 忽略，不应提交到仓库。

## 10. 验收标准

四期整体完成需满足：

- 32 条可执行的 AI case，其中 30 条覆盖七类核心场景，2 条补齐现有 PromptProfile 契约。
- 支持四种 Harness 运行模式。
- 当前 Prompt version 有版本档案。
- 所有 PromptProfile 有场景契约。
- AI 相关变更有统一开发和合并准入流程。
- Harness 可输出机器可读和人工可读报告。
- 支付、交通、订票、紧急、行程规划五类高价值场景通过基线评测。
- README、technical docs、workflow、Harness 和 Skills 索引一致。
