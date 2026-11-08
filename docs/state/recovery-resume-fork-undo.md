# Restore、Resume、Fork 与 Undo 设计提案

> 状态：待审核草案  
> 日期：2026-09-03  
> 范围：讨论未来 State 设施与既有 Event 轨迹设施的关系；本文不修改或承诺修改 Event v0。

## 1. 摘要

本提案不选择“完全基于 Event”或“完全基于 State Checkpoint”中的任何一边。
它把两个容易混淆的问题拆开：

1. **目标定位**：用户希望回到哪一个历史位置；
2. **执行恢复**：系统凭什么重建该位置并安全地继续执行。

推荐原则是：

> **Event-addressable, checkpoint-executable.**
>
> Event 提供细粒度历史坐标；Execution Checkpoint 提供可验证的执行恢复边界。

因此：

- Event 与 State 是并列的数据设施，不要求一方由另一方生成；
- Checkpoint 是某个版本化 State 的持久化表示，并锚定到一个 Event 位置；
- Event 可以作为 Restore、Resume、Fork、Undo 的用户目标，但任意 Event 不必然是
  可执行恢复点；
- 如果目标 Event 没有对应 Checkpoint，只有在运行时能证明确定性重放时，系统才可
  重建并继续执行；
- 从历史位置继续执行默认产生新分支，不改写原始轨迹；
- 外部副作用不能靠删除 Event 或加载旧 State 自动撤销，必须使用补偿操作。

## 2. 本文术语

| 术语 | 含义 |
| --- | --- |
| Event | 已发生事实的不可变轨迹记录，用于审计、调试、UI 与上下文重建 |
| Event position | 由 session/branch 与 Event seq/id 标识的历史位置 |
| State | 某一时刻 Agent 或应用的逻辑数据，不天然包含历史身份 |
| Execution Checkpoint | 某个历史位置上可持久化、可校验的 State 与执行恢复数据 |
| Stable boundary | 前缀语义完整的位置，例如完整消息、工具结果、Turn 或工作流步骤结束 |
| Resumable boundary | 有 Checkpoint，或能够被确定性重放为可执行状态的稳定位置 |
| Restore | 重建一个历史位置的数据；本身不继续运行 |
| Resume | Restore 之后继续执行并产生新的 Event |
| Fork | 从历史位置创建具有独立后续历史的新分支 |
| Undo | 面向用户的总称；具体可能是会话回退、State 恢复、文件回退或副作用补偿 |

本文暂用 **Execution Checkpoint**，避免与既有 Trajectory UI 中的 compaction
checkpoint 混淆。最终公共名称尚未决定。

## 3. 调研结论

### 3.1 Agent 框架

| 系统 | 定位方式 | 实际恢复机制 | 粒度和限制 |
| --- | --- | --- | --- |
| Claude Code / Agent SDK | 消息、用户 Prompt、Session | Transcript fork；文件使用独立 checkpoint | 会话可从消息分叉；文件回退不等于会话或运行时回退 |
| Google ADK | Event 中的 invocation id | 恢复 session state/artifacts，并记录 rewind 请求 | invocation 级；保留被回退 Event；不恢复外部副作用 |
| LangGraph | checkpoint id | 加载完整 State checkpoint，重新执行后续节点 | checkpoint/superstep 级；不是任意 Event 级 |
| OpenAI Agents SDK | Session item/user turn 或 RunState | 历史编辑/分支与 RunState 恢复是两套机制 | 会话可以细粒度修改；精确 Resume 依赖运行时快照 |
| Microsoft Agent Framework | workflow checkpoint id | 恢复 executor、消息、共享状态和待处理请求 | superstep 级；要求相同拓扑与 executor 身份 |

Claude 的 UI 最清楚地证明了两条状态轴需要分开：用户可以只 Fork conversation、
只 Rewind code，或者同时 Fork conversation 并 Rewind code。Google 则采用混合方式：
用 Event/Invocation 定位，但以 State 和 artifact 恢复完成 Rewind。LangGraph、OpenAI
RunState 和 Microsoft Agent Framework 更明确地把精确 Resume 放在 Checkpoint 上。

### 3.2 Durable execution 系统

| 系统 | 恢复模型 | 可选择的边界 |
| --- | --- | --- |
| Temporal | 以完整 Event History 确定性重放工作流状态 | Reset 可指定 Event id，但只接受 Workflow Task 安全边界 |
| Azure Durable Functions | 重放 orchestration history，恢复到持久化执行位置 | durable `await`/`yield` 边界，而不是任意日志项 |
| AWS Step Functions | 保存状态机执行结果并 Redrive | 只从失败、终止或超时的状态重新执行，粒度更粗 |

Temporal 和 Azure 证明 Event-based Resume 可以成立，但前提非常强：历史必须记录重建
执行所需的全部决定，工作流代码必须满足确定性约束，外部调用必须被隔离为受运行时
管理的活动。普通 Agent trajectory Event 通常不满足这些条件。

因此不能因为轨迹中存在更细的 Event，就假定每个 Event 都能恢复调用栈、未完成工具
请求、审批状态或外部资源状态。

## 4. 操作矩阵

### 4.1 Restore

| 目标 | 行为 | 保证 |
| --- | --- | --- |
| Event position | 恢复该位置的轨迹前缀和会话上下文；必要时寻找相邻 Checkpoint | 总能恢复可读取的轨迹；不总能恢复可执行状态 |
| Execution Checkpoint | 校验后加载 portable State 与运行时恢复数据 | 可以恢复被该 Checkpoint 明确覆盖的状态 |

Restore 应当是无执行副作用的读取/物化操作。它不调用模型、不重新执行工具，也不自动
追加新的业务 Event。

### 4.2 Resume

| 目标 | 行为 | 保证 |
| --- | --- | --- |
| 最新 resumable position | 在当前分支继续追加 | 保持当前 lineage |
| 历史 Execution Checkpoint | 加载后继续执行 | 默认创建新分支，保留旧后续历史 |
| 历史 Event position | 先解析为可执行恢复点 | 只有存在对应 Checkpoint 或确定性 replay 能力时允许 |
| 非稳定或部分 Event | 拒绝 exact resume | 可以浏览，但不能宣称精确续跑 |

“从历史恢复后继续”在语义上已经产生分叉。LangGraph 的 time travel 与 Temporal
Reset 都保留原历史或创建新的执行，因此 Runfold 不应在旧历史中间原地追加。

### 4.3 Fork

Fork 至少有三个不同层次：

1. **Trajectory fork**：复制或引用某个稳定 Event 前缀，创建新 Session/Branch；
2. **State fork**：让新分支继承某个版本化 State；
3. **Execution fork**：同时继承足够的运行时恢复数据，可以真正 Resume。

Event fork 的粒度可以小于 Checkpoint fork，但更细的粒度首先意味着“更细的轨迹或
上下文分支”，不自动意味着“更细的可执行分支”。

当前 Event v0 的 fork 只接受没有开放 Turn 的稳定前缀。该约束符合主流系统对安全
边界的处理，应保持不变；未来 State 不应反向改变这项既有语义。

### 4.4 Undo

`Undo` 不应成为一个含义不明的底层原语。UI 可以使用这个总称，但执行前必须明确
作用域：

| Undo 类型 | 推荐行为 | 是否保留历史 |
| --- | --- | --- |
| Conversation undo | 屏蔽后续上下文或从旧消息建立分支 | 是 |
| Trajectory undo | 追加 rewind/undo 记录，改变活动位置 | 是 |
| State undo | 从旧 Checkpoint 创建新活动分支 | 是 |
| File/artifact undo | 使用该资源自己的版本或 checkpoint 恢复 | 是，记录操作 |
| External-effect undo | 执行业务补偿，例如退款、撤回或释放资源 | 是，追加补偿结果 |

默认不得截断或重写审计日志。Event Sourcing 中对已发生事实的撤销应表现为新的补偿
Event。加载旧 State 也不能证明外部世界已恢复；补偿可能失败，必须拥有自己的进度、
重试、幂等键和人工介入状态。

## 5. 推荐的目标解析规则

当调用者选择 Event 或 Checkpoint 后，系统按以下顺序解析：

1. 校验 session、branch、目标存在性和访问权限；
2. 判断目标是否为稳定边界；
3. 如果目标直接关联 Execution Checkpoint，校验并加载；
4. 否则查找目标之前最近的 Checkpoint；
5. 如果当前运行时声明并通过测试证明能确定性 replay，则从该 Checkpoint 重放到目标；
6. 否则只允许轨迹 Restore/Fork，拒绝 exact Resume/Execution Fork；
7. 从非最新位置继续时创建新 lineage，并在新分支记录来源位置。

是否可浏览、可分叉轨迹、可恢复 State、可继续执行，应当是目标位置的不同能力，而
不是一个 `restorable: true/false` 同时代替所有含义。

## 6. Checkpoint 概念模型

下面只是供审核的数据需求，不是已批准 schema：

```text
ExecutionCheckpoint
├── id
├── session_id / branch_id
├── at_event_seq / at_event_id
├── parent_checkpoint_id
├── created_at
├── state_schema / state_schema_version
├── portable_state
├── runtime_kind / runtime_version
├── runtime_payload
├── pending_operations
└── integrity / metadata
```

- `portable_state` 使用语言中立格式，并进入 Python/TypeScript conformance；
- `runtime_payload` 是特定运行时的不透明恢复数据，不进入通用 State reducer；
- `parent_checkpoint_id` 表示 State lineage；
- `at_event_*` 把 Checkpoint 锚定到轨迹位置；
- `pending_operations` 只描述已持久化、可安全恢复的工作，不应包含活跃线程、连接或
  进程内对象；
- `integrity` 用于检测不完整写入、错误版本或不匹配运行时。

Event 与 Checkpoint 如何保证一致性尚未决定。可选方式包括同事务存储、带提交标记的
两阶段写入、或可修复的 sidecar 索引；在确定存储模型前不应修改 Event v0 wire schema。

## 7. 跨语言保证

跨语言能力必须分级，避免无法兑现的承诺：

### 7.1 必须跨语言等价

- Checkpoint envelope 的字段和校验；
- portable State 的编码、解码和规范化；
- lineage、目标解析和能力判定；
- trajectory restore/fork；
- 对不兼容 runtime payload 的一致拒绝行为。

### 7.2 只在兼容运行时内保证

- Python Agent 运行时内部调用栈由 TypeScript 原样继续；
- provider 私有 continuation token；
- 未公开或版本相关的 SDK `RunState`；
- 任意语言对象、函数、连接、线程或文件句柄。

跨语言可以保证“恢复同一个 portable State 并采取等价下一步”，但除非上游运行时提供
稳定的跨语言格式，不能保证“换一种语言继续同一个内部调用栈”。

## 8. UI 行为建议

Trajectory UI 可以允许选中任意 Event，但按钮根据能力显示或禁用：

| 位置能力 | 可用动作 |
| --- | --- |
| 仅可查看 | Inspect、复制、导出 |
| 稳定 Event 前缀 | Fork trajectory、Restore context |
| 有 portable State | Restore state、Fork state |
| 有兼容 Execution Checkpoint | Resume、Fork execution |
| 有可补偿外部操作 | 发起 Compensation，并显示风险与进度 |

界面不应把“Fork conversation”和“Fork execution”伪装成同一保证。对于 Undo，应像
Claude 一样明确显示要回退的是 conversation、State、files/artifacts，还是它们的组合。

## 9. 与当前 Event v0 的兼容关系

本提案不要求修改现有 Event v0：

- 现有 `restore` 继续表示轨迹读取、校验、修复和后续追加准备；
- 现有 `resume` 仍是 Python 对 Event restore 的别名，不因此升级为进程栈恢复；
- 现有 `fork(boundary)` 继续采用 inclusive Event seq 和稳定前缀规则；
- 现有父子 Session 元数据和前缀复制行为保持不变；
- 新 State 设施如果实施，应通过独立版本化契约关联 Event，而不是悄悄改变已有 API
  的含义。

未来如果需要统一产品入口，应显式区分 trajectory operation 与 execution operation，
并由 capability 检查决定可用范围。

## 10. 非目标

- 不承诺从 token delta、工具开始但未完成等任意 Event 精确 Resume；
- 不把 DSH trajectory Event 假设成 Temporal 式完整执行历史；
- 不要求所有 State 都由 Event reducer 生成；
- 不要求所有 State 都只能存在于 Checkpoint；
- 不自动撤销模型调用、付款、消息发送等外部副作用；
- 不要求不同语言恢复彼此的私有运行时对象；
- 本文不决定目录、包名、公共 API 或最终 wire schema。

## 11. 待审核问题

请审核者重点挑战以下问题：

1. “Event-addressable, checkpoint-executable”是否遗漏了必须支持的操作；
2. 当前 Event v0 中哪些稳定边界未来可以升级为 resumable boundary；
3. 历史位置 Resume 是否应无条件创建新分支，还是允许显式覆盖当前活动分支；
4. Execution Checkpoint 是否会与现有 compaction checkpoint 产生不可接受的术语冲突；
5. Event 与 Checkpoint 的原子关联应由哪一层负责；
6. portable State 的最小类型系统应采用 JSON Schema、Protobuf，还是两者分工；
7. runtime payload 的兼容键需要包含哪些版本与配置指纹；
8. 工具副作用、幂等键和 compensation ledger 是否属于未来 State 范围；
9. Event target 到最近 Checkpoint 的解析是否允许非确定性或人工确认的 replay；
10. Trajectory fork、State fork、Execution fork 是否应公开为不同操作，还是一个带能力
    结果的统一入口。

## 12. 审核通过条件

本文只有在以下内容获得明确结论后，才能转成实现任务：

- 核心术语及与 Event v0 的边界无歧义；
- 四种操作在 Event 与 Checkpoint 目标上的行为已确定；
- 历史 Resume 的 lineage 策略已确定；
- Undo 的资源范围和外部副作用边界已确定；
- 跨语言承诺已区分 portable restore 与 exact runtime resume；
- Checkpoint 与 Event 的一致性策略已有可测试方案；
- 没有把某个具体 Agent framework 的 graph、runner 或 provider 语义写入通用契约。

## 13. 主要参考资料

- [Claude Code Checkpointing](https://code.claude.com/docs/en/checkpointing)
- [Claude Agent SDK Sessions](https://code.claude.com/docs/en/agent-sdk/sessions)
- [Claude Session Browser and message-level fork](https://platform.claude.com/cookbook/claude-agent-sdk-05-building-a-session-browser)
- [Google ADK Rewind](https://adk.dev/sessions/rewind/)
- [Google ADK Resume](https://adk.dev/runtime/resume/)
- [LangGraph Time Travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
- [OpenAI Agents SDK RunState](https://openai.github.io/openai-agents-python/ref/run_state/)
- [OpenAI AdvancedSQLiteSession branching](https://openai.github.io/openai-agents-python/sessions/advanced_sqlite_session/)
- [Microsoft Agent Framework Checkpoints](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints)
- [Temporal Event History](https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/event-history/event-history.mdx)
- [Temporal Reset semantics](https://github.com/temporalio/documentation/blob/main/docs/encyclopedia/workflow/workflow-execution/event.mdx)
- [Azure Durable Orchestrations](https://learn.microsoft.com/en-us/azure/durable-task/common/durable-task-orchestrations)
- [AWS Step Functions Redrive](https://docs.aws.amazon.com/step-functions/latest/dg/redrive-executions.html)
- [Microsoft Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Microsoft Compensating Transaction pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction)

