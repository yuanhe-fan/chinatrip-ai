# ChinaTrip AI 五期产品计划：动态行程澄清流

## 1. 概述

五期不新增独立的首页入口，也不先建设固定表单式的 Plan Builder。

五期目标是在现有聊天体验中加入 **动态行程澄清流**：

```text
用户自然提问或点击行程快捷问题
→ 进入现有 Chat 页面
→ 系统判断是否属于行程规划意图
→ AI 判断信息是否足够
→ 若不足，动态生成澄清问题
→ 用户在前端临时卡片中逐题选择或输入
→ 用户完成最后一道题
→ AI 结合原始问题、澄清答案和知识库生成行程
```

这个能力的核心不是“填表”，而是让 AI 在真正生成行程前，像一个旅行顾问一样先问必要问题。
澄清问题本身只是临时上下文采集 UI，不作为产品内容资产保存。

## 2. 背景

前四期已经建立了以下基础：

- 首页、聊天、分享、登录和响应式 UI。
- Quick questions 与二级问题菜单。
- `itinerary_planning` PromptProfile。
- 流式 AI 回答、回答 metadata、视觉答案和来源展示。
- RAG 知识库、pgvector 检索和回答 sources。
- Prompt version、回答契约和 AI Harness。

当前行程规划仍主要依赖用户一次性描述需求。典型问题是：

- 用户只说“帮我制定北京五日游”，缺少同行人、节奏、预算、兴趣、饮食限制、抵达离开时间。
- 如果 AI 直接生成，答案容易变成泛化路线，而不是贴合用户的计划。
- 如果让用户手动写完整需求，输入成本高，很多用户不知道该补充什么。
- 如果做固定表单，又会削弱 AI 助手的自然交互感。

五期通过动态澄清流解决这些问题。

## 3. 五期目标

五期完成后，项目应具备以下能力：

- 用户无需离开现有首页和聊天路径即可触发行程规划。
- 系统能识别行程规划类问题。
- AI 能根据用户原始问题动态判断是否需要追问。
- AI 能生成结构化澄清问题，而不是自由生成不可控 UI。
- 用户可以用单选、多选、文本输入等方式逐题补充上下文。
- 用户可以前进、后退和修改已选答案。
- 用户可以在问题阶段返回修改或取消。
- 用户完成最后一道题后，AI 使用原始问题、澄清答案、RAG 知识库和 PromptProfile 生成最终行程。
- Harness 能验证澄清流是否在关键输入下正确触发、跳过或生成答案。

## 4. 非目标

五期第一阶段不建设：

- 首页新增 `Plan a Trip` 按钮。
- 独立的固定表单式 Plan Builder 页面。
- 地图路线编辑器。
- 拖拽式复杂行程编辑器。
- 实时票价、开放时间、天气、政策的自动核验平台。
- 旅行计划收藏夹、付费订阅或商业化权益。
- 大规模知识库 CMS。
- 完全由大模型自由决定前端组件和交互形态。

## 5. 用户体验

### 5.1 触发入口

首页保持现状，不新增任何 Plan a Trip 按钮。

触发来源包括：

- 用户在首页输入行程类问题，例如：
  - `帮我制定中国5日游`
  - `北京五日游怎么安排`
  - `上海5日游计划`
  - `Plan a 5-day China trip`
- 用户点击首页 `Itinerary Planning` 快捷问题进入聊天页。
- 用户在聊天页点击 `Itinerary Planning` 的二级问题，例如北京一日游、上海一日游或自定义计划。

所有触发都进入现有 Chat 页面，不跳转到新页面。

### 5.2 澄清前置

当用户问题属于行程规划，并且关键信息不足时，机器人不立即输出完整行程。

机器人先展示一个澄清流消息：

```text
I can build this itinerary, but I need a few details first.
```

然后展示第一张问题卡片：

```text
Step 1 of 5

Which city do you want to focus on?

[Beijing] [Shanghai] [Chengdu] [Other]
```

用户回答后自动进入下一题。

### 5.3 问题卡片

问题卡片采用类似轮播或审批操作的交互：

```text
Step 2 of 5

How many days do you have?

[1 day] [2 days] [3 days] [5 days] [Custom]

Back        Next
```

要求：

- 一次只展示一个问题。
- 支持单选、多选、文本输入和 `Other` 输入。
- 时间题使用 DayPicker 日期选择弹层，弹层内部提供 `Cancel` / `Confirm` 或 `取消` / `确定`；只选择日期，不选择小时和分钟；点击确认后才提交，如果是最后一题则直接生成。
- 支持 `Back` 返回上一题并修改。
- 支持 `Next` 前进。
- 必填题未完成时不能进入下一步。
- 选项文案必须短、清晰、可扫描。

### 5.4 动态问题

澄清问题不写死为固定表单。AI 应根据用户原始问题动态生成问题。

示例一：

```text
用户：帮我制定北京五日游
```

可能需要问：

- 同行人。
- 行程节奏。
- 兴趣偏好。
- 酒店或出发位置。
- 饮食限制。

示例二：

```text
用户：Can you help me plan a simple five-day China itinerary?
```

`China` / `中国` 只代表国家范围，不等同于一个可执行的具体城市。系统不能只问一个城市问题后就进入生成，应先补齐更能决定路线质量的基础上下文，例如：

- 北京、上海、成都、西安或其他城市。
- 更偏历史、美食、熊猫、现代城市、自然风景还是购物。
- 同行人或节奏。

在城市或旅行主题明确之前，不应优先询问抵达和离开时间。

示例三：

```text
用户：帮我制定上海5日游，带老人，不要太累，住人民广场附近
```

可能不再询问城市、天数、同行人、节奏和住宿区域，只询问：

- 是否需要安排更多室内景点。
- 是否有饮食限制。
- 是否需要避开大量步行或楼梯。

示例四：

```text
用户：北京5日游，两个人，住王府井，喜欢历史和美食，不吃辣，第一天下午到，最后一天上午走
```

如果信息已经足够，系统可以跳过澄清流，直接生成行程。

### 5.5 执行

所有问题完成后不再展示 `Trip setup` 确认摘要页。

用户完成最后一道题后，系统直接合成前端当前会话中的临时答案，并调用最终行程生成。

最后一步的触发方式按题型处理：

- 单选题：点击最后一个答案后直接生成。
- 多选题：点击最后一步的 `Generate itinerary` 后生成。
- 文本题：按 Enter 或点击最后一步按钮后生成。
- 时间题：在弹层中选择日期并点击内部 `Confirm` / `确定` 后生成。

用户点击 `Cancel` 后，澄清流结束，聊天页回到普通输入状态。

## 6. 功能要求

### 6.1 行程意图识别

系统需要判断用户是否属于行程规划意图。

应识别的表达包括：

- 中文：`制定行程`、`旅游计划`、`几日游`、`攻略`、`路线安排`。
- 英文：`plan a trip`、`itinerary`、`5-day trip`、`travel plan`。
- Quick question 的 `itinerary_planning` profile。

非行程类问题不进入澄清流。

### 6.2 信息完整度判断

系统需要判断是否需要澄清。

行程规划的常见上下文字段包括：

| 字段 | 说明 | 是否必须 |
| --- | --- | --- |
| `destination` | 具体城市或城市组合；`China` / `中国` 仅作为国家范围，不算具体目的地 | 高优先级 |
| `days` | 行程天数 | 高优先级 |
| `arrivalTime` | 抵达时间 | 可选 |
| `departureTime` | 离开时间 | 可选 |
| `travelers` | 同行人类型 | 可选 |
| `pace` | 行程节奏 | 可选 |
| `budget` | 预算偏好 | 可选 |
| `interests` | 兴趣偏好 | 可选 |
| `dietaryNeeds` | 饮食限制 | 可选 |
| `startArea` | 酒店、区域或出发点 | 可选 |
| `avoidances` | 不想去的地方或限制 | 可选 |
| `specialNeeds` | 老人、儿童、无障碍、少步行等 | 可选 |

如果高优先级字段缺失，通常需要澄清。

如果高优先级字段齐全，AI 可以只问 0 至 3 个真正影响计划质量的问题。

### 6.3 动态问题生成

AI 负责判断要问什么，但前端只接受受控结构。

澄清问题结构建议：

```ts
type ClarificationQuestion = {
  id: string;
  title: string;
  description?: string;
  type: "single_choice" | "multi_choice" | "text" | "date_time";
  required: boolean;
  options?: Array<{
    label: string;
    value: string;
  }>;
  allowOther?: boolean;
};
```

澄清流结构建议：

```ts
type ClarificationFlow = {
  intent: "itinerary_planning";
  needsClarification: boolean;
  reason: string;
  questions: ClarificationQuestion[];
  extractedContext: Record<string, unknown>;
};
```

约束：

- 每轮最多生成 3 至 6 个问题。
- 问题必须与用户原始请求直接相关。
- 不重复询问用户已经明确给出的信息。
- 不询问与行程生成无关的个人隐私。
- 不生成前端不支持的题型。
- `Other` 必须允许用户手动输入。
- 如果信息足够，返回 `needsClarification: false`。

### 6.4 前端临时交互状态

聊天页新增一种前端临时交互状态：

```text
activeClarificationFlow
```

它不是长期消息类型，也不写入 `messages` 表。

本地状态至少包含：

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

生命周期：

- 进入聊天页后触发。
- 用户选择和输入过程只保存在当前页面 state。
- 用户刷新页面后不恢复澄清流。
- 用户取消后清空本地 state。
- 用户完成最后一道澄清题后一次性提交最终上下文。

不保存：

- AI 生成过哪些澄清问题。
- 用户每一步怎么选。
- 用户当前选到第几题。
- 用户取消过的澄清流。

### 6.5 最终生成上下文

执行时应合成以下上下文：

```text
Original request:
帮我制定北京五日游

Clarified trip context:
- City: Beijing
- Days: 5
- Travelers: Couple
- Pace: Balanced
- Interests: History, food, local life
- Dietary needs: No spicy
```

最终生成仍走现有能力：

- `itinerary_planning` PromptProfile。
- Prompt version。
- RAG knowledge context。
- 视觉答案匹配。
- sources 展示。
- AI usage log。
- Harness report。

数据库只保存最终生成相关内容：

- 原始 user message。
- 最终 assistant answer。
- AI usage log。
- assistant metadata 中的轻量摘要。

metadata 示例：

```json
{
  "promptProfile": "itinerary_planning",
  "clarificationUsed": true,
  "clarifiedTripContext": {
    "destination": "Beijing",
    "days": 5,
    "travelers": "couple",
    "pace": "balanced",
    "interests": ["history", "food"],
    "dietaryNeeds": ["no_spicy"]
  }
}
```

## 7. AI 与平台边界

五期必须坚持以下边界：

```text
AI 负责理解意图、抽取上下文、判断缺口、生成问题
平台负责校验结构、渲染题型、控制前端临时流程、合成最终上下文
```

不得让 AI 直接决定任意前端布局。

AI 输出必须经过 schema 校验。校验失败时降级为普通行程回答，或展示上下文感知兜底问题。
兜底问题不得重复询问已知字段：如果城市和天数已知，应优先询问抵达/离开时间、同行人、节奏或兴趣；只有城市和天数都缺失时，才询问城市和天数。

## 8. 实施阶段

### 阶段一：文档与契约

交付：

- 五期产品计划。
- 动态澄清流技术规范。
- Prompt version 升级档案。
- Clarification schema。
- Harness case 设计。

完成标准：

- 澄清流与普通聊天、quick question、RAG、Harness 的边界清晰。
- AI 动态问题生成有受控 schema。
- 明确哪些情况需要追问，哪些情况直接生成。
- 明确澄清问题和逐步选择不落库。

### 阶段二：澄清流 MVP

交付：

- 行程意图识别。
- 信息完整度判断。
- 动态问题生成调用。
- 聊天页澄清流消息 UI。
- 单选、多选、文本输入、Other。
- 前进、后退、取消、最后一步直接生成。

完成标准：

- 用户输入 `帮我制定北京五日游` 后先进入澄清流。
- 用户完成问题后可以生成最终行程。
- 用户可以返回修改答案。
- 用户可以取消并回到普通聊天。
- 刷新页面后澄清流不恢复。

### 阶段三：最终生成接入

交付：

- 澄清答案合成最终生成上下文。
- 接入 `itinerary_planning` PromptProfile。
- 接入 RAG sources。
- 生成结果保留现有视觉答案和分享能力。
- AI usage log 记录最终 `clarifiedTripContext` 摘要。

完成标准：

- 最终行程能体现用户选择的城市、天数、节奏、兴趣和饮食限制。
- 信息已足够的请求可以跳过澄清流直接生成。
- RAG 不可用时仍能生成行程，并记录降级原因。
- 数据库不保存澄清问题和逐步选择过程。

### 阶段四：Harness 与质量闭环

交付：

- 行程澄清流 smoke case。
- 信息足够时不追问的 case。
- 信息不足时必须追问的 case。
- 澄清答案进入最终行程的 case。
- schema 校验失败的兜底 case。
- 高频输入回归：`Plan a one-day Chengdu itinerary...`、`北京五日游`、`上海5日游，带老人，不要太累，住人民广场附近`。

完成标准：

```bash
pnpm ai:harness:test
pnpm ai:harness --profile itinerary_planning
pnpm ai:harness:smoke
```

如果修改公共 Prompt、RAG 注入或澄清 schema，需要运行：

```bash
pnpm ai:harness:full
```

## 9. 验收场景

### 9.1 需要追问

输入：

```text
帮我制定北京五日游
```

预期：

- 系统识别为 `itinerary_planning`。
- 不直接输出完整行程。
- 进入澄清流。
- 至少询问同行人、节奏、兴趣或住宿区域中的关键缺口。

### 9.2 部分信息已知

输入：

```text
上海5日游，带老人，不要太累，住人民广场附近
```

预期：

- 不重复询问城市、天数、同行人、节奏和住宿区域。
- 可以补问饮食限制、室内偏好或是否减少步行。

### 9.3 信息足够

输入：

```text
北京5日游，两个人，住王府井，喜欢历史和美食，不吃辣，第一天下午到，最后一天上午走
```

预期：

- 可以跳过澄清流。
- 直接生成行程。
- 行程体现抵达离开时间、住宿区域、兴趣和饮食限制。

### 9.4 用户取消

流程：

```text
进入澄清流
→ 回答 1 至 2 个问题
→ 点击 Cancel
```

预期：

- 前端清空澄清流本地状态。
- 不生成最终行程。
- 聊天输入恢复可用。

### 9.5 用户返回修改

流程：

```text
选择 City: Beijing
→ 下一题
→ Back
→ 改为 Shanghai
→ 继续完成
```

预期：

- 不展示 `Trip setup` 摘要页。
- 最终行程按修改后的 Shanghai 生成。

## 10. 执行机制

五期涉及 AI 行为变化，开发时必须遵循四期建立的质量流程：

```text
更新产品文档
→ 更新技术契约
→ 升级 Prompt version
→ 新增或调整 Harness case
→ 实现最小功能
→ 运行评测
→ 反哺 Prompt、文档和 Skills
```

推荐新增 Prompt version：

```text
travel-answer-v13-dynamic-trip-clarification
```

任何改变澄清问题生成策略、最终上下文合成方式或 itinerary 输出结构的改动，都应升级 Prompt version 或补充版本档案。
