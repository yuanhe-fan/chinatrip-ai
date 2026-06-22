# ChinaTrip AI AI 评测 Harness 技术规范

## 1. 定位

AI 评测 Harness 是项目的自动化质量检查系统，用于验证 AI 回答是否符合产品规则、Prompt 契约、RAG 预期和入境游场景要求。

Harness 不替代普通单元测试。普通测试验证代码行为是否确定，Harness 验证模型输出是否在允许范围内。

## 2. 目录规划

```text
ai/harness/
  README.md
  cases/
    smoke.json
    payment-survival.json
    internet-apps.json
    transport-workflow.json
    tickets-booking.json
    emergency-help.json
    itinerary-planning.json
    language-cards.json
  runner/
    index.ts
    cases.ts
    checks.ts
    generator.ts
    preflight.ts
    report.ts
  reports/
    .gitkeep
```

`smoke.json` 保存高价值快速回归集合，其他文件组成 full 集合。当前 full 包含 32 条 case，smoke 包含 12 条。七类核心场景占 30 条，`food_ordering` 和 `general_travel` 各有一条契约 case，用于保证全部 PromptProfile 都有覆盖。

## 3. Case 契约

单条 case 的最小结构：

```json
{
  "id": "payment-foreign-card-setup",
  "profile": "payment_survival",
  "language": "en",
  "question": "Can I use Alipay in China with a foreign card?",
  "expected": {
    "mustMention": ["Alipay", "foreign card", "backup"],
    "mustNotMention": ["guaranteed everywhere"],
    "shouldIncludeChinesePhrase": false,
    "requiresSourcesWhenRagEnabled": true,
    "maxWords": 260
  },
  "riskTags": ["payment", "foreign_card", "arrival_setup"]
}
```

允许扩展字段：

```ts
type HarnessCase = {
  id: string;
  profile: PromptProfile;
  language: "en" | "zh";
  question: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  metadata?: {
    promptProfile?: PromptProfile;
    sourceQuestionId?: string;
    sourceSubQuestionId?: string;
  };
  expected: {
    mustMention?: string[];
    mustMentionAny?: string[][];
    mustNotMention?: string[];
    requiredHeadings?: string[];
    shouldIncludeChinesePhrase?: boolean;
    requiresActionSteps?: boolean;
    requiresSourcesWhenRagEnabled?: boolean;
    maxWords?: number;
  };
  riskTags: string[];
};
```

Case ID 必须稳定且全局唯一。修改已有 case 的语义时，应说明原因；不得通过放宽规则掩盖真实回归。

## 4. 覆盖范围

首批覆盖七类场景：

| Profile | 重点 |
| --- | --- |
| `payment_survival` | 支付设置、外卡限制、失败恢复、现金或其他备份 |
| `internet_apps` | SIM/eSIM、漫游、App、短信验证、离线备份 |
| `transport_workflow` | 机场、地铁、打车、高铁、上车或进站流程 |
| `tickets_booking` | 护照预约、闭馆、售罄风险、替代方案 |
| `emergency_help` | 立即安全行动、警方/医院/使领馆、可展示中文 |
| `itinerary_planning` | 路线顺序、时间、交通、预约风险、备选路线 |
| `language_cards` | 简短、可复制、可直接展示的中文文本 |

## 5. 运行模式

标准命令：

```bash
pnpm ai:harness
pnpm ai:harness:smoke
pnpm ai:harness:full
pnpm ai:harness --profile payment_survival
pnpm ai:harness --case payment-foreign-card-setup
```

模式定义：

- `smoke`：开发中频繁运行，覆盖最关键链路。
- `full`：覆盖全部 case，用于合并前和定期巡检。
- `profile`：只运行指定 PromptProfile。
- `case`：只运行一个 case，用于定位和调试。

默认 `pnpm ai:harness` 等价于 smoke，避免本地无意触发高成本 full 运行。

### 5.1 模式与过滤优先级

CLI 按以下优先级确定报告模式：

```text
--case
→ case

--profile
→ profile

--mode full
→ full

无模式参数
→ smoke
```

`--case` 和 `--profile` 从完整 case 集合中筛选，不受默认 smoke 集合限制。过滤后没有匹配 case 时，Harness 在调用模型前退出失败。

标准脚本：

```text
pnpm ai:harness        → 无参数启动 runner，默认 smoke
pnpm ai:harness:smoke  → 启动 runner 并传入 --mode smoke
pnpm ai:harness:full   → 启动 runner 并传入 --mode full
```

### 5.2 CLI 参数组合

```bash
# 指定业务场景，并将 warning 视为命令失败
pnpm ai:harness --profile payment_survival --fail-on-warning

# 只调试一条 case
pnpm ai:harness --case payment-foreign-card-setup

# 执行 full，并同时运行两个 case
pnpm ai:harness:full --concurrency 2

# 只验证 runner 流程，不建立质量基线
AI_PROVIDER=mock pnpm ai:harness --case payment-foreign-card-setup --allow-mock
```

参数规则：

- `--concurrency` 默认值为 1，允许范围为 1 至 8。
- 提高并发会缩短执行时间，但会增加 Provider 限流和并发成本风险。
- `--allow-mock` 只解除 mock 保护，不会把 mock 结果视为有效质量基线。
- 未配置真实 Provider 且未传入 `--allow-mock` 时，Runner 在生成前退出失败。
- 每个 case 的默认超时为 90 秒。

## 6. 生成链路

Harness 应尽量复用生产中的 `generateTravelAnswer` 或等价服务，不复制 Prompt 拼装逻辑。

每次生成需采集：

- `provider`
- `model`
- `promptVersion`
- `promptProfile`
- `inputTokens`
- `outputTokens`
- `latencyMs`
- `fallbackUsed`
- `finishReason`
- `truncated`
- `maybeTruncated`
- `retrieval.enabled`
- `retrieval.matchedChunkCount`
- `retrieval.failedReason`
- `sources`

真实 provider 通过环境变量显式开启。默认 smoke 使用 `.env.local` 的真实 provider；`AI_PROVIDER=mock` 时必须显式传入 `--allow-mock`，且 mock 结果不能作为质量基线。

### 6.1 Provider 与数据边界

真实模型模式会向当前 Provider 发送：

- case question。
- 当前项目 Prompt。
- case 中声明的 history。
- 与问题相关的 RAG knowledge context。

运行者必须确认 Provider 是获准的数据接收方。Harness case 不应包含生产用户对话、身份信息或其他敏感数据。

模型调用量通常为：

- smoke：12 条 case。
- full：32 条 case。
- profile：该 profile 的 case 数。
- case：1 条 case。

Provider 重试、超时或未来的 LLM Judge 可能增加实际请求数。full 不默认进入普通 CI。

### 6.2 RAG 降级

- RAG 正常：报告记录匹配 chunk 数和 sources。
- embedding 或数据库不可用：回答正常生成，记录 `retrieval_degraded` warning。
- RAG 已启用但违反 sources 契约：记录 fail。
- Harness 不创建 Chat、Message 或 AiUsageLog 数据。

## 7. 检查规则

### 7.1 自动阻塞规则

以下问题默认判为 `fail`：

- 生成请求失败。
- 回答为空。
- 回答语言明显错误。
- case 的 `mustMention` 未满足。
- case 的 `mustNotMention` 被命中。
- 回答超过 `maxWords` 的硬上限。
- 必需回答结构完全缺失。
- RAG 已启用且契约要求 sources，但 sources 为空。
- sources 超过产品允许数量。
- metadata 缺少 `promptVersion` 或 `promptProfile`。
- 回答被确认截断且未形成完整结构。

### 7.2 Warning 规则

以下问题默认判为 `warning`：

- 回答可能过于泛化。
- 中国旅行上下文不足。
- 应包含中文短语但没有明显中文文本。
- 出现未经知识上下文支持的实时价格、开放时间或绝对政策表述。
- RAG 不可用但生成已正常降级。
- `maybeTruncated` 为 true。
- LLM Judge 认为回答可用但存在质量风险。

### 7.3 Pass 规则

所有阻塞规则通过，且没有 warning 时判为 `pass`。有 warning 但无 fail 时，case 状态为 `warning`，不能计入纯通过数。

## 8. LLM Judge 边界

LLM Judge 仅用于静态规则难以判断的语义项：

- 是否真正解决当前问题。
- 是否可执行。
- 是否明显跑题。
- 是否对外国游客友好。
- 是否存在较强幻觉风险。

第一阶段约束：

- 默认关闭或仅在 full 模式显式开启。
- 结果必须进入报告。
- Judge 失败本身不得掩盖规则检查结果。
- Judge warning 默认不阻塞 CI。
- 不使用 Judge 自动改写 baseline 或 case。

## 9. 失败分类

Harness 必须区分以下失败来源：

| 类型 | 说明 | 默认状态 |
| --- | --- | --- |
| `generation_error` | Provider 或生成链路失败 | fail |
| `contract_failure` | 回答违反明确契约 | fail |
| `retrieval_degraded` | RAG 不可用但回答已降级 | warning |
| `retrieval_contract_failure` | RAG 已启用但来源契约失败 | fail |
| `truncated` | 回答明确被截断 | fail |
| `maybe_truncated` | 存在截断风险 | warning |
| `judge_warning` | LLM Judge 语义风险 | warning |
| `harness_error` | case、runner 或报告器异常 | fail |

## 10. 报告

每次运行输出：

```text
ai/harness/reports/latest.json
ai/harness/reports/latest.md
```

JSON 用于 CI 和后续统计，Markdown 用于人工复盘。

报告至少包含：

- 运行时间、模式和环境。
- 总 case 数、pass、warning、fail 数。
- 按 profile 聚合的通过率。
- provider、model、promptVersion。
- 每个失败 case 的问题、回答摘要和失败规则。
- RAG 状态、命中 chunk 数和 sources 数。
- latency、finishReason 和截断状态。
- 与上次 baseline 的新增失败、已修复失败和状态变化。

`latest` 报告可以被覆盖；需要长期保留的报告应由 CI artifact 或带时间戳的巡检任务保存。

### 10.1 报告覆盖与退出码

Runner 启动时先读取已有 `latest.json` 用于状态对比，完成后覆盖：

```text
ai/harness/reports/latest.json
ai/harness/reports/latest.md
```

即使存在 case fail，只要 Runner 能完成汇总，也会先写报告再返回非零退出码。

退出码规则：

| 结果 | 默认退出码 | 使用 `--fail-on-warning` |
| --- | --- | --- |
| 至少一个 fail | 非零 | 非零 |
| 无 fail、至少一个 warning | 0 | 非零 |
| 全部 pass | 0 | 0 |
| CLI、schema、preflight 或 Harness 自身错误 | 非零 | 非零 |

`latest.json` 和 `latest.md` 已被 Git 忽略。长期报告由后续 CI artifact 或独立巡检任务保存。

## 11. 执行机制

开发中：

- 小改动运行 smoke。
- Profile 改动运行该 profile。
- 公共 Prompt、RAG、模型路由改动运行 full。

合并前：

```bash
pnpm lint
pnpm build
pnpm knowledge:ingest:dry-run
pnpm ai:harness:smoke
```

核心 AI 行为改动追加：

```bash
pnpm ai:harness:full
```

阻塞策略：

- smoke fail 必须修复或在 PR 中明确记录并获得批准。
- full 中核心场景 fail 必须修复。
- warning 必须进入报告，但第一阶段不默认阻塞。
- Harness 自身错误视为检查失败，不能当作通过。

定期巡检：

- 建议每周运行 full。
- 模型或 Prompt version 切换后立即运行一次 full。
- 知识库批量更新后运行相关 profile 和 full。

## 12. 验收标准

- 32 条 full case。
- 12 条 smoke case。
- 全部九个 PromptProfile 均有覆盖。
- 支持四种运行模式。
- 能校验文本、metadata、sources 和截断状态。
- 能输出 JSON 与 Markdown 报告。
- RAG 降级与生成失败可明确区分。
