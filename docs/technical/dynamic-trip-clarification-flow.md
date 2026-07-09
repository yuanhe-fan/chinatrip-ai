# ChinaTrip AI 动态行程澄清流技术方案

## 1. 目标

动态行程澄清流用于在正式生成 `itinerary_planning` 答案前，临时补齐用户的旅行上下文。

核心原则：

```text
AI 生成澄清问题
→ 前端临时展示与收集答案
→ 用户完成最后一道题
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
→ 最后一道题完成后直接执行
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
type ClarificationQuestionType =
  | "single_choice"
  | "multi_choice"
  | "text"
  | "date_time";

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
- `text` 和 `date_time` 不需要 options。
- 无法通过 schema 校验时使用兜底问题。
- `China` / `中国` 只表示国家范围，不写入具体 `destination`；当只有国家范围和天数时，兜底问题必须优先补齐城市或城市组合、兴趣主题、同行人和节奏，不应只问城市，也不应先问抵达/离开时间。

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

- Provider 失败、JSON 解析失败或 schema 失败时，返回上下文感知兜底问题。
- 兜底问题基于已抽取的 `ClarifiedTripContext` 生成，不重复询问已知城市、天数、同行、节奏、住宿区域、兴趣或饮食限制。

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

最后一道澄清题完成时，前端调用现有：

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
- `date_time`：主题化输入区打开 DayPicker 日期选择弹层，弹层内部完成确认/取消，提交值为 `YYYY-MM-DD`。
- `allowOther`：展开自定义输入。
- `Back`：返回上一题。
- `Next`：进入下一题。
- `Cancel`：清空本地 state。
- `Generate itinerary`：仅在最后一道多选或文本题按钮中出现，合成 `ClarifiedTripContext` 并调用正式生成。

UI 要求：

- 一次只展示一个问题。
- 移动端不横向溢出。
- 必填题未完成时禁用 `Next` 或最后一步的 `Generate itinerary`。
- `date_time` 空态 placeholder 跟随问题语言：中文显示“选择日期”，英文显示“Select date”。
- `date_time` 点击整个输入区域打开 DayPicker 日期选择弹层，不依赖浏览器原生 picker。
- `date_time` 弹层内部提供 `Cancel` / `Confirm` 或 `取消` / `确定`；取消只关闭弹层不提交，确认后写入 `YYYY-MM-DD`，非最后一题进入下一题，最后一题直接生成。
- 第一题完成有效回答后自动进入第二题：`single_choice`、第一题 `multi_choice`、`date_time` 点击确认后推进；`text` 通过 Enter 或 Next 推进。
- 非第一题 `multi_choice` 仍保留 Next，避免多选时误跳。
- 最后一题完成后不进入摘要页，直接调用正式生成链路。
- 澄清流存在时不阻塞普通聊天历史渲染。

## 9. 异常与降级

| 场景 | 处理 |
| --- | --- |
| 数据库不可用或缺少 `DATABASE_URL` | Chat、message、clarification 准备阶段返回 `DATABASE_UNAVAILABLE` / HTTP 503 |
| Clarification API 失败 | 前端直接走普通 AI 生成 |
| Provider 返回非 JSON | 使用兜底问题 |
| Schema 校验失败 | 使用兜底问题 |
| 用户取消 | 清空本地 state，不写数据库 |
| 页面刷新 | 澄清流消失，不恢复 |
| 最终生成失败 | 使用现有 assistant failed 状态 |

发布收口阶段应避免把可诊断的基础设施错误包装成泛化 `INTERNAL_ERROR`。数据库不可用、Provider 失败、RAG 降级、澄清 schema 失败应分别保留清晰语义，便于本地开发和线上排查。

## 10. 测试与验收

单元测试：

- schema 接受合法 flow。
- schema 拒绝非法题型、空选项、超出 6 个问题。
- service 能从 markdown code fence 中提取 JSON。
- service 在非法输出时返回兜底问题。
- service 能抽取城市、天数、同行、节奏、住宿区域、兴趣、饮食限制和少步行需求等已知上下文。
- service 会过滤 AI 对已知字段的重复追问。
- metadata 能传递 `clarificationUsed` 和 `clarifiedTripContext`。

UI 验收：

- `帮我制定北京五日游` 触发澄清流。
- `Can you help me plan a simple five-day China itinerary?` 不把 China 当具体城市，并且不只询问日期。
- 用户可以选择、返回修改、取消，并在最后一步直接生成。
- 完成全部问题后直接生成，不展示 `Trip setup` 摘要页。
- 信息足够的问题可以跳过澄清直接生成。
- 移动端问题卡片不溢出，日期选择内联展开后页面可以自然滚动到 `Confirm` / `Cancel`。

Harness：

```bash
pnpm ai:harness:test
pnpm ai:harness --profile itinerary_planning
pnpm ai:harness:smoke
```

五期不大规模扩充 case，优先新增少量覆盖行程澄清行为的高价值 case。
