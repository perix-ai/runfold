# Event 轨迹设施技术架构

> 文档类型：技术架构文档。回答"由哪些部分组成、边界在哪里、按什么原则
> 处理上游代码与依赖"。需求见 [`requirements.md`](requirements.md)，接口与
> 数据格式见 [`specification.md`](specification.md)，关键取舍的来龙去脉见
> [`decisions.md`](decisions.md)。

## 1. 总体结构

```text
                 conformance/event/v0  (共享用例与夹具)
                 schemas/event/v0      (共享 wire schema)
                          ▲
          ┌───────────────┴────────────────┐
          │                                │
  TypeScript 实现                     Python 实现
  packages/event/typescript/          packages/event/python/
  ├─ packages/   DSH 保留源码          src/perix_event/
  │   core/session                     ├─ session.py / surface.py / repair.py
  │   session/session-persistence      ├─ persistence_jsonl.py / format.py
  │   session/session-persistence-jsonl├─ chunk_rows.py / messages.py
  │   client/*   Trajectory UI 闭包     └─ ...
  ├─ runtime/    Perix 自有宿主与工具
  │   host.ts (EventHost) / create.ts / messages.ts / values.ts / brand.ts
  ├─ sdk/        @perix/event-sdk 发布边界
  └─ ui/trajectory/  @perix/event-ui 发布边界
          │                                │
          └──────── tests/event/cross-language ────────┘
```

两种实现是同一契约的两个原生实现；跨语言连接点是共同的 Event 数据与行为
契约，不是 UI 语言。UI 只有 TypeScript/React 一份。

## 2. 组件

| 组件 | 位置 | 职责 | 详细说明 |
| --- | --- | --- | --- |
| Session 核心 | `packages/event/typescript/packages/core/session` | Event 校验、追加、不可变快照、surface 投影、fork 前缀、repair | DSH 原样保留，仅宿主接缝改动 |
| 持久化接缝 | `.../packages/session/session-persistence` | 抽象后端、写后台协调器、prepare/borrow、torn-tail 修复 | 同上 |
| JSONL 后端 | `.../packages/session/session-persistence-jsonl` | 明文与 Zstandard 多 frame 日志、packed chunk 行、原子物化 | 同上 |
| 宿主与工具 | `.../runtime/` | `EventHost`（事件总线、作用域、组合槽）、`createEventRuntime()`、消息与 JSON 小工具 | [`runtime/README.md`](../../packages/event/typescript/runtime/README.md) |
| TypeScript SDK | `.../sdk/` | 发布边界，只做导出与打包 | [`sdk/README.md`](../../packages/event/typescript/sdk/README.md) |
| Trajectory UI | `.../packages/client/*` + `.../ui/trajectory/` | DSH 会话组装器、投影与 React 视图，加一个独立宿主 | [`ui/trajectory/README.md`](../../packages/event/typescript/ui/trajectory/README.md) |
| Python 实现 | `packages/event/python/` | 同一契约的原生实现，可独立安装 | [`python/README.md`](../../packages/event/python/README.md) |
| 上游快照 | `third_party/deepseek-harness/` | 固定 commit 的审计快照，不参与构建 | [`third_party README`](../../third_party/deepseek-harness/README.md) |

## 3. 设计原则

### 3.1 冲突时的优先级

1. 保持 DSH 已有的可观察行为；
2. 去除 DSH 专属耦合，使 Event 可独立使用；
3. 保证 TypeScript/Python 的逻辑等价与数据互操作；
4. 最后才考虑 API 美化、重命名或目录重构。

不能仅因为"可以写得更漂亮"就改写 DSH 代码。每一处偏离都必须由独立化、
跨语言或发布要求直接驱动，并由测试证明没有改变目标行为。

### 3.2 源码与目录职责

| 位置 | 职责 | 是否允许适配 |
| --- | --- | --- |
| `third_party/deepseek-harness/upstream/` | 固定版本的 DSH 原始审计快照 | 不允许；保持上游原样 |
| `packages/event/typescript/packages/` | 从 DSH 裁剪出的源码，保持上游相对路径 | 只允许独立化所需的宿主接缝改动，且由 `scripts/verify-upstream-identity.mjs` 逐文件登记 |
| `packages/event/typescript/{runtime,sdk,ui,test-support}/` | Perix 自有代码 | 自由，但每个文件说明替代了什么、为什么 |
| `packages/event/python/` | 原生 Python 实现 | 按共享契约实现，不翻译 UI |
| `tests/event/` | 跨语言集成与互操作测试 | 不归属于任一单语言实现 |
| `schemas/`、`conformance/` | 跨语言、与实现无关的数据结构与行为夹具 | 版本化演进 |

`upstream/` 是为这次抽离保留的范围化快照，不是 DSH 整仓镜像；纳入快照的
每个上游文件都必须与固定 commit 逐字节一致。若后续发现依赖闭包缺少上游
文件，应从同一固定版本补入，而不是在 `third_party` 中改写。Python 使用
标准 `pyproject.toml` + `src/perix_event/` 布局，不增加没有独立职责的目录。

### 3.3 DSH 依赖处理规则

"尽可能保持原样"不等于继续依赖整个 DSH。对每一个 `@deepseek-ai/*`、
Cordis 服务或 DSH shell 类型，按它在 Event 中承担的实际职责逐项处理：

| 依赖类别 | 处理方式 | 典型内容 | 现状 |
| --- | --- | --- | --- |
| Event 核心行为 | 保留源码和算法，只改独立化必需的导入与组合边界 | Session、追加、fork、repair、projection | 保留 |
| Event 必需但由 DSH 定义的类型/小工具 | 裁剪最小实现到 `runtime/` | Message/ContentBlock、ID brand、deep-freeze、JSON snapshot、timeout 常量 | 已替换 |
| Harness 宿主与插件机制 | 删除；影响生命周期的部分用最小本地接口重现 | Cordis Context/Service、scope、typert、插件注册 | 已由 `EventHost` 替换，见 [`decisions.md`](decisions.md) D01 |
| Trajectory 所需的 UI 依赖闭包 | 优先原样裁剪；只替换完整 DSH shell 才提供的宿主接口 | conversation assembler、renderer binding、slots、locale、theme | 运行时子集仍从注册表打包，裁入计划见 `tasks/R25-R29-dsh-free.md` |
| 与 DSH 无关且确有必要的通用第三方库 | 可以保留并锁定版本 | React、shiki、压缩或文件处理库 | 保留 |

完成解耦后的硬性要求：打包后的 JS、声明文件和 Python 包不能要求安装任何
DSH 包；公共 API、类型、模块扩展和错误标识不能泄漏 DSH 命名空间；DSH
名称只能存在于 `third_party`、来源说明、许可证或明确的回归夹具中；不能
通过复制整个 DSH runtime 来规避依赖清理。

### 3.4 宿主接缝：EventHost

DSH 的 Event 代码通过 Cordis 插件平台获得三样东西：`session/*` 生命周期
事件的总线、带反序释放的所有权作用域、按名字查找的服务槽。`EventHost`
只提供这三样，并复现 Cordis 唯一被生命周期依赖的语义：经作用域读取的服务
是绑定该作用域的视图，因此在子作用域创建的 Session 随该作用域销毁。没有
插件注册、依赖注入、scope 过滤分发和类型注册表。

`createEventRuntime({ persistence })` 是组合根：一个 host、一个
`SessionStore`、一个可选持久化后端，外加与 Python `SessionStore.restore`
对应的 `restore(id)`。

### 3.5 多语言等价

TypeScript 和 Python 是同一 Event 契约的两个原生实现。Python 包包含
Session、追加、持久化、restore、resume、fork、repair 和投影所需的实际逻辑，
不是只含 HTTP/IPC 客户端的薄 SDK，也不加载 TypeScript 源码。

两种实现必须在以下方面等价：接受与拒绝相同的 Event/Session 数据；相同的
字段语义、序号规则、生命周期、fork 前缀和 repair 规则；对同一确定性夹具
产生相同的规范化逻辑结果；一方写出的持久化轨迹可由另一方 restore、继续
追加和 fork；Python 写出的轨迹可以直接交给 TypeScript Trajectory UI 展示。

随机 ID、时间戳和压缩字节不要求逐字节相同，但必须满足相同约束；解码、
规范化后的 Event 和派生结果必须等价。需要逐字节比较时，测试夹具固定所有
非确定性输入。API 覆盖面的差异（TS 独有的 write-behind、`prepare`、
`listSnapshots` 等）在 [`specification.md`](specification.md) 中逐项列出。

### 3.6 偏离政策

相对上游的每一处偏离都要同时具备：来源（上游文件与 commit）、理由（独立化、
跨语言或发布要求之一）、防回归测试。TypeScript 侧的登记地点是
[`packages/event/typescript/README.md`](../../packages/event/typescript/README.md)
的"Necessary local changes"和 `scripts/verify-upstream-identity.mjs` 的允许
差异清单；Python 侧的登记地点是 `specification.md` 的"Python 必要实现映射"。
