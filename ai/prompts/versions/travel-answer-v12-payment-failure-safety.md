# travel-answer-v12-payment-failure-safety

## 状态

```text
active
```

## 目标

收敛支付失败场景的回答质量：先检查网络和支付链路，再给现金、实体卡或人工协助等备选方案；同时避免押护照、绝对政策和过长回答。

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

- 继承 `travel-answer-v11-unified-list-items` 的 `Direct Answer / Do This / Watch Out` 结构。
- `payment_survival` 中支付失败恢复必须优先检查手机信号、mobile data、App 状态、卡限额和扫码方式。
- 支付失败回答必须包含至少一个备份支付路径。
- 支付失败回答默认控制在 450 英文单词以内。
- 支付回答避免给出精确现金、ATM 取款额度、手续费或汇率金额，除非用户明确询问。
- 支付回答不引用现金法、法定货币规则或商户必须接受现金的绝对义务。
- 不建议游客留下护照、手机或贵重物品作为抵押。
- 不把现金接受、政策或商户行为描述成绝对保证。
- `language_cards` 回答必须保持短卡片，不输出大段 pinyin。
- 闭馆日相关订票回答应包含明确的 backup action：改期、附近替代或切换到其他博物馆。

## 影响范围

主要影响：

- `payment_survival`

间接影响：

- `general_travel` 中被分类为支付失败的相近问题。
- `internet_apps` 中 eSIM、roaming 和 SIM 对比会更明确提示 home SIM 或 phone number 的 SMS 验证风险。

## 已知风险

- 更强的安全边界可能减少少数极端场景下的谈判建议。
- 模型仍可能输出具体金额或绝对表达，需通过 Harness warning 继续观察。
- RAG 不可用时，支付失败回答仍依赖 Prompt 基线和模型常识。

## 评测要求

必须通过：

- `payment-mobile-payment-failure`
- `payment-foreign-card-setup`
- `pnpm ai:harness:smoke`

公共结构未变化，因此本次版本升级优先运行 smoke 和 `payment_survival` profile；若后续扩展到其他 profile，再运行 full。

## 发布结论

由 smoke 基线发现 `payment-mobile-payment-failure` 出现核心 fail 后创建。目标是在不改 UI、API 或数据库的前提下，修复支付失败恢复场景的必需步骤、长度和安全边界。
