# ChinaTrip AI 动态行程澄清流技术方案

## 1. 目标

动态行程澄清流用于在正式生成 `itinerary_planning` 答案前，临时补齐用户的旅行上下文。

核心原则：

```text
AI 生成澄清问题
→ 前端临时展示与收集答案
→ 用户确认执行
→ 一次性提交最终上下文
→ 正式 AI 回答链路生成行程
```

澄清问题不是业务内容资产，不落库。数据库只保存原始用户消息、最终 AI 回答、AI usage log，以及最终回答 metadata 中的轻量上下文摘要。

## 2. 总体架构

```text
POST /api/chats
→ 创建 chat 和 first user message
→ ChatView 加载聊天详情
→ 前端判断 first user message 可能需要 itinerary clarification
→ POST /api/chats/:chatId/clarifications
→ 返回临时 ClarificationFlow
→ 前端本地完成选择、返回、修改、取消
→ 用户点击 Generate itinerary
→ POST /api/chats/:chatId/messages/stream
→ 写入执行用 user message 和 pending assistant message
→ streamTravelAnswer 结合 clarifiedTripContext 生成正式答案
```

新增能力分为三层：

| 层 | 职责 |
| --- | --- |
| Clarification API | 生成临时问题，不写业务数据 |
| Chat 前端 | 渲染问题卡片，维护本地步骤和答案 |
| 正式回答链路 | 使用最终上下文生成行程并保存结果 |

## 3. 数据生命周期

### 3.1 不持久化的数据

以下数据只存在于当前页面内存：

- AI 生成的澄清问题列表。
- 用户每一步选择。
- 当前 step index。
- `Other` 文本输入。
- 用户取消过的澄清流。

刷新页面后不恢复澄清流，这是五期 MVP 的预期行为。

### 3.2 持久化的数据

继续使用现有表：

- `messages` 保存原始 user message 和最终 assistant answer。
- `ai_usage_logs` 保存最终回答的 provider、model、promptVersion、latency 和 metadata。
- `messages.metadata` 保存最终回答相关 metadata。

不新增表，不新增 Prisma model。

最终 assistant metadata 增加：

```ts
type ClarificationAnswerMetadata = {
  promptProfile: "itinerary_planning";
  clarificationUsed: true;
  clarifiedTripContext: ClarifiedTripContext;
};
```

## 4. 共享类型

```ts
type ClarificationQuestionType = "single_choice" | "multi_choice" | "text";

type ClarificationOption = {
  label: string;
  value: string;
};

type ClarificationQuestion = {
  id: string;
  title: string;
  description?: string;
  type: ClarificationQuestionType;
  required: boolean;
  options?: ClarificationOption[];
  allowOther?: boolean;
};

type ClarifiedTripContext = {
  destination?: string;
  days?: number;
  arrivalTime?: string;
  departureTime?: string;
  travelers?: string;
  pace?: string;
  budget?: string;
  interests?: string[];
  dietaryNeeds?: string[];
  startArea?: string;
  avoidances?: string[];
  specialNeeds?: string[];
  notes?: string;
};

type ClarificationFlow = {
  intent: "itinerary_planning";
  needsClarification: boolean;
  reason: string;
  extractedContext: ClarifiedTripContext;
  questions: ClarificationQuestion[];
};
```

限制：

- `questions` 最多 6 个。
- `single_choice` 和 `multi_choice` 必须有 2 至 8 个选项，除非 `allowOther` 为 true。
- `text` 不需要 options。
- 无法通过 schema 校验时使用兜底问题。

## 5. Clarification API

### `POST /api/chats/:chatId/clarifications`

用途：

- 根据原始用户问题生成临时澄清问题。
- 不写 `messages`。
- 不写 `ai_usage_logs`。

Request:

```ts
type CreateClarificationRequest = {
  messageId?: string;
  message?: string;
  language?: "en" | "zh";
  promptProfile?: PromptProfile;
};
```

规则：

- 优先使用 `messageId` 读取当前 chat 中的 user message。
- 如果传入 `message`，只用于当前临时判断。
- 只有当前 owner 可以对 chat 请求 clarification。
- 非 `itinerary_planning` 意图可以返回 `needsClarification: false`。

Response:

```ts
type CreateClarificationResponse = ClarificationFlow;
```

错误：

```text
CHAT_NOT_FOUND
MESSAGE_NOT_FOUND
FORBIDDEN
INVALID_REQUEST
INTERNAL_ERROR
```

降级：

- Provider 失败、JSON 解析失败或 schema 失败时，返回兜底问题：

```text
To build a better itinerary, which city and how many days should I plan for?
```

## 6. AI Clarification 服务

新增独立服务：

```text
lib/ai/clarification/schema.ts
lib/ai/clarification/prompt.ts
lib/ai/clarification/service.ts
```

服务职责：

- 使用独立 prompt 判断行程意图和信息缺口。
- 要求模型只返回 JSON。
- 解析 JSON 并通过 schema 校验。
- 校验失败时返回兜底 `ClarificationFlow`。

不复用 `generateTravelAnswer`，避免污染正式回答 Prompt 契约。

建议 prompt 约束：

```text
Return JSON only.
Do not answer the itinerary.
Ask only useful missing questions.
Do not ask for information already present in the user message.
Use only supported question types.
```

## 7. 最终生成接入

`SendMessageRequest` 扩展：

```ts
type SendMessageRequest = {
  message?: string;
  promptProfile?: PromptProfile;
  sourceQuestionId?: string;
  sourceSubQuestionId?: string;
  clarificationUsed?: boolean;
  clarifiedTripContext?: ClarifiedTripContext;
};
```

点击 `Generate itinerary` 时，前端调用现有：

```text
POST /api/chats/:chatId/messages/stream
```

请求中包含：

- 执行用 message，例如 `Generate the itinerary using my trip setup.`
- `promptProfile: "itinerary_planning"`
- `clarificationUsed: true`
- `clarifiedTripContext`

后端行为：

- 将 `clarificationUsed` 和 `clarifiedTripContext` 写入执行用 user message metadata。
- `createGenerationMetadata` 将其传入 AI 生成链路。
- Prompt 构建时将上下文写入 user message 或 metadata context。
- 最终 assistant metadata 和 AI usage log metadata 保存同一摘要。

## 8. 前端状态与 UI

`ChatView` 增加本地状态：

```ts
type ActiveClarificationFlow = {
  sourceUserMessageId: string;
  sourceQuestion: string;
  flow: ClarificationFlow;
  currentStepIndex: number;
  answers: Record<string, string | string[]>;
  otherAnswers: Record<string, string>;
};
```

新增 `ClarificationFlowPanel`：

- `single_choice`：单选按钮组。
- `multi_choice`：多选按钮组。
- `text`：短文本输入。
- `allowOther`：展开自定义输入。
- `Back`：返回上一题。
- `Next`：进入下一题。
- `Cancel`：清空本地 state。
- `Generate itinerary`：合成 `ClarifiedTripContext` 并调用正式生成。

UI 要求：

- 一次只展示一个问题。
- 移动端不横向溢出。
- 必填题未完成时禁用 `Next` 或 `Generate itinerary`。
- 澄清流存在时不阻塞普通聊天历史渲染。

## 9. 异常与降级

| 场景 | 处理 |
| --- | --- |
| Clarification API 失败 | 前端直接走普通 AI 生成 |
| Provider 返回非 JSON | 使用兜底问题 |
| Schema 校验失败 | 使用兜底问题 |
| 用户取消 | 清空本地 state，不写数据库 |
| 页面刷新 | 澄清流消失，不恢复 |
| 最终生成失败 | 使用现有 assistant failed 状态 |

## 10. 测试与验收

单元测试：

- schema 接受合法 flow。
- schema 拒绝非法题型、空选项、超出 6 个问题。
- service 能从 markdown code fence 中提取 JSON。
- service 在非法输出时返回兜底问题。
- metadata 能传递 `clarificationUsed` 和 `clarifiedTripContext`。

UI 验收：

- `帮我制定北京五日游` 触发澄清流。
- 用户可以选择、返回修改、取消、最终执行。
- 信息足够的问题可以跳过澄清直接生成。
- 移动端问题卡片不溢出。

Harness：

```bash
pnpm ai:harness:test
pnpm ai:harness --profile itinerary_planning
pnpm ai:harness:smoke
```

五期不大规模扩充 case，优先新增少量覆盖行程澄清行为的高价值 case。
