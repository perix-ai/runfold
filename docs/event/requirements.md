# Event 轨迹设施需求说明书

> 文档类型：需求说明书（SRS）。回答"要做什么、做到什么程度算完成"。
> 怎么做见 [`architecture.md`](architecture.md)，接口与数据格式见
> [`specification.md`](specification.md)。
>
> 上游基线：DeepSeek Harness `0.1.2-alpha.3`，commit
> `dd6322d604e00eec1ba5e0c8541159906a21094a`。

## 1. 背景

DeepSeek Harness（DSH）内部有一套经过验证的基于 Event 的 agent 轨迹设施：
append-only 的 Session 事件日志、JSONL 持久化、中断修复、restore/fork 语义
和 Trajectory 可视化界面。Perix 需要同样的能力，但 Perix 的 agent 运行在
自己的运行时里，主要使用方 Nexent 是 Python 进程。

因此本项目的任务不是"参考 DSH 重新设计一套"，而是把 DSH 的 Event 设施
原样裁剪出来，去掉它对 Harness 宿主的耦合，做成可独立发布、跨语言等价的
组件。

## 2. 术语

| 术语 | 定义 |
| --- | --- |
| Event | agent 执行轨迹中的一条持久事实，带连续序号与时间 |
| Session | 有顺序的 Event 集合及其生命周期，由一个 header 和从 0 开始连续递增的 Event 序列组成 |
| Trajectory | 从 Event/Session 推导出的投影和 UI；它是派生视图，不是与 Event 平级的另一套数据设施 |
| restore | 从持久化记录读取、校验，并在需要时按 DSH 规则修复 Session |
| resume | restore 后继续追加 Event，保持序号、生命周期和持久化连续性 |
| fork | 从合法的稳定前缀产生带谱系关系的新 Session |
| surface | Session 中构成模型可见对话的 Event 子序列（当前为 `user/message`、`assistant/message`、`tool/result`） |
| repair | 对异常中断留下的未闭合 turn、step、tool 调用做确定性补齐 |

这里的 resume 不等于前端流断线重连，也不承诺恢复进程栈、正在执行的工具
调用或任意代码指令位置。中断后的闭合与修复语义以 DSH Event 实现为基准。
`fork` 是行为，不是独立顶层设施；`stream` 也不因名称存在就成为与 Event
平级的实现目录。

## 3. 目标

最终结果需要同时满足：

- R-G1 TypeScript 实现尽可能沿用 DSH 原始源码、目录关系和行为；
- R-G2 独立实现及其发布产物不依赖 DSH 的运行时、包命名空间或完整 Harness；
- R-G3 Python 拥有原生、完整的 Event 实现，而不是通过 SDK 调用 TypeScript；
- R-G4 TypeScript 与 Python 遵守同一逻辑契约并可读写彼此的轨迹数据；
- R-G5 DSH Trajectory UI 保持现有行为和水准，并能展示两种语言生成的轨迹。

## 4. 范围

### 4.1 需要保留或抽离的能力

- Session、Event、header、序号、时间和谱系等核心模型；
- append-only 追加、不可变快照、派生 surface/trajectory；
- JSONL 等现有持久化格式、读取、追加、重启与损坏修复；
- restore、resume、fork 及 DSH 中断修复行为；
- DSH Trajectory 的投影、会话组装、React UI、样式和本地化；
- TypeScript 与 Python 的 SDK、实现、测试和跨语言一致性验证。

### 4.2 明确不包含

- 通用 Event Bus、消息中间件或完整 agent runtime；
- server、Node sidecar 或为了让 Python 调用 TypeScript 而增加的进程服务；
- Harness 插件系统、模型调用、工具执行、沙箱和控制面；
- Adapter 体系设计；
- 基于 State 的另一套轨迹方案；
- Python 版本的前端 UI；
- 长期记忆、知识库、模型路由、技能与 MCP 注册、产品级控制面（属于其他
  Perix plane）。

## 5. 干系人与使用场景

### 5.1 Nexent（首个 Python 使用方）

Nexent 应能直接安装 Python Event 包，在自身进程内记录轨迹，并执行
restore、resume 和 fork，不要求部署 Node server 或管理 TypeScript 子进程。
Nexent 现有的前端流重连概念与这里的 Event resume 应保持区分。

Nexent 接入不应产生一套专属格式；它必须使用与 TypeScript 实现相同的
schema 和 conformance 契约，因此其轨迹也能由现有 Trajectory UI 读取。

### 5.2 TypeScript 使用方

通过 `@perix/event-sdk` 在进程内创建、追加、持久化、恢复和 fork Session；
通过 `@perix/event-ui` 在任意 React 页面中渲染一段 Event 历史。两者都只依赖
`@perix/*` 包与公开的第三方库。

## 6. 质量要求

- 行为：所有保留的 DSH 上游回归测试在裁剪版上继续通过；当前门禁为 626 个
  Event/持久化、182 个 UI runtime 和 94 个 Trajectory 用例。
- 互操作：一方写出的持久化轨迹可由另一方 restore、继续追加和 fork；规范化
  后的 header、Event、surface、messages 和 repair 结果逐字段相等。
- 依赖：发布产物不要求安装任何 DSH 包，公共 API 与类型不泄漏 DSH 命名空间。
- 可审计：每一处相对上游的偏离都有来源说明、理由和防回归测试。

## 7. 验收标准

只有同时满足以下条件，才可以把 Event 抽离称为生产可用：

- A1 DSH 行为基线和 Trajectory UI 水准未退化；
- A2 TypeScript/Python 均有完整原生实现和完整测试；
- A3 两种语言通过同一 conformance 套件，并经各自公开 restore API 双向操作
  持久化轨迹；
- A4 发布产物不存在 DSH 运行时或公共命名空间泄漏；
- A5 Nexent 可以仅依赖 Python 包完成记录、restore、resume 和 fork；
- A6 所有必要偏离都有来源说明、理由和防回归测试。

进度与验收状态见 [`tasks.md`](tasks.md)。
