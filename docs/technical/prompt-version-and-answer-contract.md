# ChinaTrip AI Prompt 版本与回答契约

## 1. 目标

本规范将 Prompt 从代码实现细节提升为可追溯的产品行为契约。

它解决三个问题：

- 当前线上回答由哪个 Prompt version 产生。
- 某次 Prompt 改动预期改变了什么。
- 如何通过 Harness 判断改动是否可以进入主分支。

## 2. 当前 Prompt 组成

当前旅行回答 Prompt 由以下模块组成：

```text
Core Prompt
+ Pain Point Rules
+ Intent Classifier
+ Prompt Profile
+ Stable Output Template
+ Knowledge Context（可选）
+ Final Answer Contract
```

Prompt 构建入口为 `lib/ai/prompts/travel-answer.ts`。普通生成和流式生成必须使用同一套 Prompt 组合和版本号。

## 3. 版本规范

版本格式：

```text
travel-answer-v{number}-{short-purpose}
```

示例：

```text
travel-answer-v11-unified-list-items
```

规则：

- `{number}` 单调递增，不复用旧编号。
- `{short-purpose}` 使用小写英文和连字符，描述本次主要行为变化。
- 一个正式 version 对应一份 `ai/prompts/versions/` 档案。
- AI usage log 和 Harness report 必须记录完整 version。
- 回滚时恢复旧 version，不覆盖或删除历史档案。

## 4. 何时升级版本

以下改动必须升级：

- 默认回答结构改变。
- PromptProfile 的行为重点改变。
- 新增或删除必须项、禁止项。
- RAG knowledge context 的使用规则改变。
- 回答语言、安全或实时信息规则改变。
- 可能系统性影响模型输出的核心 Prompt 调整。

以下改动不要求升级：

- 纯注释、排版或文档修正。
- 不进入模型上下文的代码重构。
- 不改变 Prompt 内容和顺序的类型调整。

无法确定是否影响输出时，默认升级版本。

## 5. 版本档案

每份版本档案必须包含：

- Version ID。
- 状态：`active`、`superseded`、`rolled_back`。
- 改动目标。
- Prompt 模块变化。
- 影响的 PromptProfile。
- 已知风险。
- 必须通过的 Harness case 或 profile。
- 发布或回滚结论。

当前版本档案见：

- [travel-answer-v12-payment-failure-safety](../../ai/prompts/versions/travel-answer-v12-payment-failure-safety.md)

## 6. 全局回答契约

所有回答必须：

- 使用用户选择的语言。
- 面向没有中国身份证、手机号、银行卡或中文能力的外国游客。
- 先解决当前阻塞，再补充背景。
- 给出可执行步骤、失败备选和必要的可展示中文。
- 保持简洁、可扫描，不写泛化旅游宣传文案。
- 默认控制在 250 至 450 个英文单词的量级；用户明确要求详细方案时可以扩展。
- 不编造实时票量、实时价格、精确开放时间、最新政策和官方链接。
- 对时效性信息明确提示通过官方渠道核验。

## 7. 默认结构契约

除只需一句话的简单问题外，默认使用以下顶级标题：

```markdown
## Direct Answer
## Do This
## Watch Out
```

要求：

- 顶级标题不超过三个。
- `Direct Answer` 用 1 至 2 句给出结论或下一步。
- `Do This` 使用 3 至 5 个编号步骤。
- 步骤优先使用 `Short title: clear action`。
- `Watch Out` 使用 2 至 4 个简短风险项。
- 不输出裸 `---`、`***`、`___` 分隔线。
- 不产生破碎 Markdown、未结束列表或混合标题结构。
- 表格仅用于短比较或中文短语卡，保持 2 至 5 行。

## 8. PromptProfile 场景契约

### `payment_survival`

必须优先覆盖：

- 用户是否能支付。
- 需要提前完成的设置。
- 外卡或移动支付可能失败的环节。
- 至少一种备份支付方式。
- 支付失败时先检查手机信号、mobile data、App 状态、卡限额和扫码方式。
- 不建议游客留下护照、手机或贵重物品作为抵押。
- 不把现金接受、政策或商户行为描述为绝对保证。
- 除非用户明确询问，不给出精确 ATM 取款额度、手续费、汇率或现金金额。

### `internet_apps`

必须优先覆盖：

- 移动网络选择。
- 核心 App 和账号准备。
- 短信验证、网络限制或登录风险。
- 离线或第二连接方案。

### `transport_workflow`

必须优先覆盖：

- 应去哪里或选择哪个入口。
- 如何上车、进站或找到接客点。
- 如何付款。
- 需要向司机或工作人员展示的中文信息。
- 操作失败时的替代方案。

### `tickets_booking`

必须优先覆盖：

- 是否需要预约。
- 护照和实名要求。
- 闭馆、售罄或容量风险。
- 至少一个替代方案。

### `language_cards`

必须：

- 聚焦用户当前沟通场景。
- 提供简短、可复制、可直接展示的中文。
- 避免生成大段语言教学内容。

### `emergency_help`

必须：

- 第一部分先给立即安全行动。
- 说明应联系的人或机构。
- 提供必要的中文求助文本。
- 对官方号码、政策和流程提示核验。

### `itinerary_planning`

必须考虑：

- 路线顺序和距离。
- 时间分配和节奏。
- 交通方式。
- 预约或闭馆风险。
- 至少一个备选方案。

一日行程：

- `Do This` 使用扁平编号列表。
- 不在 Morning、Afternoon、Evening 下嵌套子列表。

两日及以上：

- 使用 `### Day N: Short Theme`。
- 每天内部最多使用 Morning、Afternoon、Evening。
- 每天重新从 1 编号。
- Day 不得作为普通编号列表项。

### `food_ordering`

必须优先覆盖：

- 实际点餐方式。
- 辣度、过敏、素食或宗教饮食限制。
- 扫码点餐失败时的沟通方式。
- 必要的中文展示文本。

### `general_travel`

必须：

- 直接回答用户问题。
- 保留实操步骤、风险和本地备选。
- 当意图清晰时遵循最接近的专业 profile 规则。

## 9. RAG 契约

当 knowledge context 可用时：

- 相关事实应优先使用已检索内容。
- 不得把无关 chunk 强行写入回答。
- 不得展示 raw chunk、embedding 或 similarity score。
- sources 最多展示 3 个。
- 回答 metadata 应记录 retrieval 状态和来源。

当 RAG 不可用时：

- 正常生成回答，不把检索失败暴露为用户错误。
- 不展示空 sources 模块。
- 在 metadata 和 Harness report 中记录降级原因。

## 10. Metadata 契约

每次完整 AI 生成结果应包含或可推导：

```ts
type AnswerGenerationMetadata = {
  promptVersion: string;
  promptProfile: PromptProfile;
  retrieval?: {
    enabled: boolean;
    matchedChunkCount: number;
    failedReason?: string;
  };
  sources?: AnswerSource[];
  finishReason?: string | null;
  truncated?: boolean;
  maybeTruncated?: boolean;
};
```

`promptVersion` 用于质量对比和回滚，`promptProfile` 用于场景聚合。不得只记录 model 而遗漏 Prompt version。

## 11. 契约与 Harness 映射

首批规则 ID：

```text
language.correct
structure.max_top_level_headings
structure.required_default_headings
structure.no_horizontal_rules
structure.no_broken_markdown
structure.no_repeated_numbering
content.actionable_steps
content.china_specific
content.no_live_fact_fabrication
profile.payment_required_points
profile.transport_required_points
profile.ticket_required_points
profile.emergency_required_points
profile.itinerary_one_day_flat
profile.itinerary_multi_day_sections
metadata.prompt_version_present
metadata.profile_present
metadata.sources_valid_when_rag_enabled
```

可静态判断的规则由 Harness 直接检查；需要语义判断的规则先输出 warning，后续可接入 LLM Judge。

## 12. 变更准入流程

以下文件发生行为变更时必须执行本流程：

```text
lib/ai/prompts/*
lib/quick-questions/profiles.ts
lib/ai/rag.ts
ai/prompts/*
```

流程：

```text
1. 说明改动目标和影响 profile。
2. 判断并更新 Prompt version。
3. 创建或更新版本档案。
4. 更新回答契约（若行为规则变化）。
5. 新增或调整 Harness case。
6. 运行 smoke 和受影响 profile。
7. 公共结构改动运行 full。
8. 在 PR 中记录结果和已知 warning。
```

不得只修改 `TRAVEL_ANSWER_PROMPT_VERSION` 而不创建版本档案，也不得只更新文档而不补对应评测。

## 13. 回滚机制

出现核心场景明显回归时：

1. 恢复上一稳定 Prompt 内容和 version。
2. 将失败 version 标记为 `rolled_back`。
3. 在版本档案记录失败 case 和原因。
4. 将该问题固化为新的 Harness case。
5. 修复后使用新的递增 version，不复用失败 version。
