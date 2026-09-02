# Event 轨迹设施抽离说明

> 状态：当前执行依据
>
> 上游基线：DeepSeek Harness `0.1.2-alpha.3`，commit
> `dd6322d604e00eec1ba5e0c8541159906a21094a`

本文件集中记录 Event 抽离工作的背景、边界、原则和验收标准。仓库中
尚未与本文件对齐的通用架构设想，不自动成为这项工作的要求；如果以后
改变这里的决定，应先更新本文件，再修改实现。

具体实施进度见 [`tasks.md`](tasks.md)，两种语言共同遵守的 v0 接口与磁盘
格式见 [`contract.md`](contract.md)。

## 目标

从 DeepSeek Harness（DSH）中把基于 Event 的轨迹设施提取为独立设施，
保留它已经验证过的 Event 行为、持久化行为、恢复语义和 Trajectory UI。
这不是“参考 DSH 重新设计一套”，而是以 DSH 源码为基线做必要的裁剪和
解耦。

最终结果需要同时满足：

- TypeScript 实现尽可能沿用 DSH 原始源码、目录关系和行为；
- 独立实现及其发布产物不依赖 DSH 的运行时、包命名空间或完整 Harness；
- Python 拥有原生、完整的 Event 实现，而不是通过 SDK 调用 TypeScript；
- TypeScript 与 Python 遵守同一逻辑契约并可读写彼此的轨迹数据；
- DSH Trajectory UI 保持现有行为和水准，并能展示两种语言生成的轨迹。

处理冲突时的优先级是：

1. 保持 DSH 已有的可观察行为；
2. 去除 DSH 专属耦合，使 Event 可独立使用；
3. 保证 TypeScript/Python 的逻辑等价与数据互操作；
4. 最后才考虑 API 美化、重命名或目录重构。

不能仅因为“可以写得更漂亮”就改写 DSH 代码。每一处偏离都必须由独立化、
跨语言或发布要求直接驱动，并由测试证明没有改变目标行为。

## 这里的 Event 是什么

Event 是 agent 执行轨迹中的持久事实，Session 是有顺序的 Event 集合及其
生命周期。Trajectory 是从 Event/Session 推导出的投影和 UI，不是与 Event
平级的另一套数据设施。

本项目中的 `restore`、`resume` 和 `fork` 都是 Event/Session 上的行为：

- `restore`：从持久化记录读取、校验，并在需要时按 DSH 规则修复 Session；
- `resume`：restore 后继续追加 Event，保持序号、生命周期和持久化连续性；
- `fork`：从合法的稳定前缀产生带谱系关系的新 Session。

这里的 resume 不等于前端流断线重连，也不承诺恢复进程栈、正在执行的工具
调用或任意代码指令位置。中断后的闭合与修复语义以 DSH Event 实现为基准。
`fork` 是行为，不需要被提升成独立顶层设施；`stream` 也不因名称存在就成为
与 Event 平级的实现目录。

## 范围

需要保留或抽离的能力包括：

- Session、Event、header、序号、时间和谱系等核心模型；
- append-only 追加、不可变快照、派生 surface/trajectory；
- JSONL 等现有持久化格式、读取、追加、重启与损坏修复；
- restore、resume、fork 及 DSH 中断修复行为；
- DSH Trajectory 的投影、会话组装、React UI、样式和本地化；
- TypeScript 与 Python 的 SDK、实现、测试和跨语言一致性验证。

当前不包含：

- 通用 Event Bus、消息中间件或完整 agent runtime；
- server、Node sidecar 或为了让 Python 调用 TypeScript 而增加的进程服务；
- Harness 插件系统、模型调用、工具执行、沙箱和控制面；
- Adapter 体系设计；
- 基于 State 的另一套轨迹方案；
- Python 版本的前端 UI。

## 源码与目录职责

| 位置 | 职责 | 是否允许适配 |
| --- | --- | --- |
| [`third_party/deepseek-harness/upstream/`](../../third_party/deepseek-harness/upstream/) | 固定版本的 DSH 原始审计快照 | 不允许；保持上游原样 |
| [`packages/event/typescript/`](../../packages/event/typescript/) | 从 DSH 裁剪出的 TypeScript Event 实现、SDK、UI 与测试 | 只允许独立化所需改动 |
| [`packages/event/python/`](../../packages/event/python/) | 原生 Python Event 实现、SDK 与测试 | 按共享契约实现，不翻译 UI |
| [`tests/event/`](../../tests/event/) | 跨语言 Event 集成与互操作测试 | 不归属于任一单语言实现 |
| [`schemas/`](../../schemas/) | 跨语言、与实现无关的持久化数据结构 | 版本化演进 |
| [`conformance/`](../../conformance/) | 跨语言共享行为用例、有效/无效样本与预期结果 | 随契约演进 |

`third_party` 是来源证据，不参与生产构建和运行。裁剪实现保留上游相对路径
是默认做法，但 TypeScript 为了形成独立发布边界而新增 `sdk/`、统一测试目录、
构建入口或最小宿主是允许的；新增内容必须清楚标记为本地代码。Python 使用
标准 `pyproject.toml` + `src/perix_event/` 布局，不增加没有独立职责的 `sdk/`
目录。文件级来源映射和必要差异继续记录在
[TypeScript Event implementation](../../packages/event/typescript/README.md)。

当前 `upstream/` 是为这次抽离保留的范围化快照，不是 DSH 整仓镜像；纳入
快照的每个上游文件都必须与固定 commit 逐字节一致。若后续发现 Event 依赖
闭包缺少上游文件，应从同一固定版本补入，而不是在 `third_party` 中改写。

## DSH 依赖处理规则

“尽可能保持原样”不等于继续依赖整个 DSH。对每一个 `@deepseek-ai/*`、
Cordis 服务或 DSH shell 类型，都要按它在 Event 中承担的实际职责逐项处理：

| 依赖类别 | 处理方式 | 典型内容 |
| --- | --- | --- |
| Event 核心行为 | 保留源码和算法，只改独立化必需的导入与组合边界 | Session、追加、fork、repair、projection |
| Event 必需但由 DSH 定义的类型/小工具 | 裁剪最小实现，或改写成 Perix 自有的等价类型 | Message/ContentBlock、ID brand、deep-freeze、JSON snapshot、timeout 常量 |
| Harness 宿主与插件机制 | 删除；若影响 Event 生命周期，用明确的本地接口或直接组合重现该效果 | Cordis Context/Service、scope、typert、HMR、插件注册 |
| Trajectory 所需的 UI 依赖闭包 | 优先原样裁剪；只替换完整 DSH shell 才提供的宿主接口 | conversation assembler、renderer binding、slots、locale、theme |
| 与 DSH 无关且确有必要的通用第三方库 | 可以保留并锁定版本 | React、压缩或文件处理库 |

Cordis 不是 Event 的领域概念，也不应成为公共 SDK。若现有 DSH 代码借助
Cordis 注入 Session、持久化或 UI 服务，目标是把同样的可观察生命周期改成
直接组合或最小本地接口，而不是把 Cordis 整包换名后继续暴露。

决策（2026-09-01）：**不通过 vendor 或 bundle Cordis 来"隐藏"依赖。**
Cordis 是插件平台，轨迹设施依赖插件平台是反向依赖；哪怕打进内部 chunk
不对外导出，也意味着 Event 的生命周期语义由宿主框架定义。允许为此修改
保留源码，但改动限定在宿主接缝：`Service` 基类、`ctx.effect/on/emit/
parallel/logger`、scope carrier、typert 注册和 `declare module` 扩展。
替代物是一个本地最小 `EventHost`（事件总线、反序 disposer、logger），
Session/append/fork/repair/surface/JSONL 逻辑逐字节不动，并由保留的上游
测试锁定行为。具体步骤见 [`tasks.md`](tasks.md) 第 3.1 节。

同理，Event 需要消息的持久化形状，但不需要完整的 DSH LLM runtime。应只
保留 Event 真正接受和产生的消息类型、构造规则及 JSON 形状，并将其定义为
跨语言可实现的 Perix 契约。

完成解耦后：

- 打包后的 JS、声明文件和 Python 包不能要求安装任何 DSH 包；
- 公共 API、类型、模块扩展和错误标识不能泄漏 DSH 命名空间；
- DSH 名称只能存在于 `third_party`、来源说明、许可证或明确的回归夹具中；
- 不能通过复制整个 DSH runtime 来规避依赖清理。

## 多语言要求

TypeScript 和 Python 是同一 Event 契约的两个原生实现。Python 包必须包含
Session、追加、持久化、restore、resume、fork、repair 和投影所需的实际逻辑；
它不是只包含 HTTP/IPC 客户端的薄 SDK，也不直接加载 TypeScript 源码。

两种实现必须在以下方面等价：

- 接受与拒绝相同的 Event/Session 数据；
- 使用相同的字段语义、序号规则、生命周期、fork 前缀和 repair 规则；
- 对同一确定性夹具产生相同的规范化逻辑结果；
- 一方写出的持久化轨迹可由另一方 restore、继续追加和 fork；
- Python 写出的轨迹可以直接交给 TypeScript Trajectory UI 展示。

随机 ID、时间戳和压缩字节不要求天然逐字节相同，但它们必须满足相同约束；
解码、规范化后的 Event 和派生结果必须等价。需要逐字节比较时，测试夹具应
固定所有非确定性输入。

UI 继续使用 TypeScript/React，没有把前端改成 Python 的必要。跨语言连接点
是共同的 Event 数据与行为契约，而不是 UI 语言。

## 测试要求

测试是抽离本身的一部分，不是最后补充：

- 保留 DSH 上游 Event、持久化和 Trajectory 回归测试作为行为基线；
- TypeScript 与 Python 各自在 `packages/event/<language>/tests/`
  拥有完整单元、集成、持久化、安装包和异常输入测试；
- 双向互操作测试统一放在 `tests/event/cross-language/`；
- `conformance/` 保存两种语言共同执行的夹具和预期结果；
- 必须覆盖 TS 写/Python 读写、Python 写/TS 读写、双向 restore/resume/fork；
- 必须覆盖正常退出、截断/损坏日志修复、序号冲突、并发 Session、明文和
  压缩格式；
- UI 必须与 DSH 行为对照，并覆盖 Python 生成轨迹和大规模 Event 历史；
- 打包测试必须在空白消费者项目中验证运行时和严格类型边界。

任何为去除 DSH 依赖而改写的代码，都要先由保留下来的上游测试锁定行为，
再增加面向新公共接口和跨语言契约的测试。

## Nexent 接入目标

Nexent 是首个明确的 Python 使用方。它应能直接安装 Python Event 包，在
自身进程内记录轨迹，并执行 restore、resume 和 fork，不要求部署 Node server
或管理 TypeScript 子进程。Nexent 现有的前端流重连概念与这里的 Event resume
应保持区分。

Nexent 接入不应产生一套专属格式；它必须使用与 TypeScript 实现相同的
schema 和 conformance 契约，因此其轨迹也能由现有 Trajectory UI 读取。

## 当前已知差距

TypeScript 裁剪版的 DSH/Cordis 解耦已于 2026-09-01 完成（tasks.md R13–R23）。
下面保留当时的差距清单及其处理结果，作为审计记录：

- `@perix/event-sdk/runtime` 已改为 Perix 自有的 `EventHost`（R16–R21）；
- `@perix/event-sdk/messages` 已改为 Perix 自有的 `runtime/src/messages.ts`（R15）；
- core 与 persistence 的全部 DSH 运行时依赖已由 `runtime/` 替换（R14–R21）；
  SDK 产物只剩 `koffi`（win32）一个第三方运行时依赖；UI 闭包按 R24 评估；
- TypeScript 的 restore 入口已收敛为 `runtime.restore(id)`，与 Python 对应（R21）；
- Python v0 原生实现和当前跨语言 conformance 已完成，但不能代替上述
  TypeScript 依赖清理，也不代表整个抽离已达到最终生产完成标准。

这些差距应按上述分类逐项处理，不能通过改包名或增加 server 掩盖。

2026-09-01 评审补充的差距（编号对应 `tasks.md`）：

- 生成物中的 `@deepseek-ai/cordis` 引用已随 R17–R19 消失；`rewrite-public-namespaces.mjs`
  与打包测试的泄漏断言仍待 R22、R09 收尾；
- 三个 `invariant` 子路径曾是 SDK 出口，它们是 Cordis companion plugin，已删除（R13）；
- Python 曾有 DSH 没有的 `.event.lock` 文件锁，`contract.md` 还误把它写成共同
  契约；锁已删除，`resume()` 保留为文档化的 `restore()` 别名（R01、R11、R12）；
- `KNOWN_SESSION_EVENT_TYPES` 两份手抄副本已由 conformance 单一来源与双侧测试锁定（R08）；
- `views.client.spec.tsx` 中与 shell 无关的 25 个用例已移植到独立宿主，桩掉的能力已登记（R05、R10）；
- 根目录早期的 `spec/`、`rfcs/`、`schemas/v0`、`conformance/cases` 从零设计草案与
  Event 实现矛盾，已于 2026-09-01 删除（R03）；
- 裁剪源码与 `third_party` 快照的一致性已由 `verify:upstream-identity` 校验（R07）。

下一阶段（待执行，任务书见 [`tasks/R25-R29-dsh-free.md`](tasks/R25-R29-dsh-free.md)，
清单 R25–R29）：保留源码里的 `@deepseek-ai/*` import 名字改为相对路径，UI 闭包
真正用到的 `dsh-client-store` 与 `dsh-client-ui-primitives` 子集从快照裁入仓库，
其余仅类型的包本地化，最终仓库开发也不再从注册表安装任何 DSH 包。

## 完成标准

只有同时满足以下条件，才可以把 Event 抽离称为生产可用：

- DSH 行为基线和 Trajectory UI 水准未退化；
- TypeScript/Python 均有完整原生实现和完整测试；
- 两种语言通过同一 conformance 套件并能双向操作持久化轨迹；
- 发布产物不存在 DSH 运行时或公共命名空间泄漏；
- Nexent 可以仅依赖 Python 包完成记录、restore、resume 和 fork；
- 所有必要偏离都有来源说明、理由和防回归测试。
