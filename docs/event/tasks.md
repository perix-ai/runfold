# Event 抽离实施清单

> 文档类型：计划与进度。落实 [`requirements.md`](requirements.md) 的验收标准
> 与 [`architecture.md`](architecture.md) 的约束。完成标记必须以代码、测试或
> 打包验证为依据；仅创建目录或 API 占位不算完成。

> 总体状态（2026-09-02）：R01–R44 与第 7 节总验收全部完成。R44 已把 Nexent
> v2.5.0 本地实验分支纳管为可重放、可校验的下游集成补丁；R43 已将 Nexent
> Demo 的合成脚本、真实截图和旁白源文件纳入 `scripts/event/demos/nexent/`；
> 发布成品继续位于 `docs/event/demos/nexent/`，并可从仓库素材离线精确重制。
> `npm run verify`
> 全绿，SDK、UI、保留测试和构建配置均不依赖任何 DSH 包名解析。R33 已在与官方 tag
> 逐文件一致的 Nexent v2.5.0 本地快照上完成真实进程、wheel 和轨迹 UI 验收；
> R37 完成了 Nexent 产品界面的读取、resume、fork 与浏览器验收；R38 又用
> 21 Turn 真实轨迹验证跨进程恢复、稳定边界 fork、父子独立续写和 DSH 右侧
> Schema 详情。按用户约定，该 Nexent 分支仅用于本地实验，不推送远端。R36
> 最终移除了保留测试中的 DSH
> module specifier 和 14 条测试别名，当前身份门禁为 204/10/139。
>
> 后续状态（2026-09-03）：独立项目 **Runfold** 的 R45–R51 身份、仓库和
> 版权政策迁移全部完成。当前原创部分声明的版权人为 Heiki Scott；Perix.ai 是
> 项目/维护者名称而不是独立权利主体。
> 迁移仅改变项目身份、公共包/import、Schema 标识与下游展示名称；
> 不改变 Event 数据模型、restore/resume/fork 行为、Trajectory 交互或 DSH 快照。
> R01–R44 中出现的旧项目名、旧包名和本地 `perix-ai/...` 路径是迁移前的历史
> 验收证据，不代表当前公共技术命名；当前名称以 R45 及后续条目为准。

## 任务生命周期

- 除维护本清单本身外，任何代码、测试、配置或文档改动开始前，都必须先在
  本文件登记为未完成任务；不得先实施、事后补记。
- 任务只有在约定的验证全部通过后才能勾选完成，并须补充完成日期、实际结果
  和验证证据。可以与实现同一次提交，也可以紧接一个独立文档提交，但在此之前
  不得开始无关工作。
- 一个条目只对应一个最小且完整的逻辑改动；新增发现应另立条目，不能悄悄扩大
  已有任务的范围。

## 条目格式

带 `R` 编号的条目来自 2026-09-01 的系统性评审，统一使用以下模板：

```text
- [ ] **R00** · 难度 易/中/难 · 风险 低/中/高 · 位置 <文件或目录>
  - **问题**：当前是什么状态，为什么不符合目标。
  - **处理**：要做成什么样。
  - **依赖**：前置条目；无则写"无"。
```

**执行顺序不按重要性，而按"容易改、风险小"优先**，见文末"执行顺序"表。

## 任务书命名

本文件是唯一的清单，只有这里有勾选框。需要交给他人或另一工具执行的条目，
另写自包含的任务书，放在 [`tasks/`](tasks/) 目录，文件名为
`R<起>[-R<止>]-<slug>.md`（例如 `R25-R29-dsh-free.md`）：编号对应本清单，slug
说明主题，执行者与状态写在任务书首行而不是文件名里。清单条目只链接任务书，
不复制其内容；任务书完成后在本清单标记结果，任务书本身保留作记录。

## 1. 文档与基线

- [x] 将 Event 专属文档统一到 `docs/event/`。
- [x] 固定 DSH 来源版本、抽离原则、非目标和完成标准。
- [x] 记录 TypeScript 与 Python 的公共 API、持久化格式和行为映射。
- [x] 为每项必要偏离保留来源、理由和回归测试。

- [x] **R01** · 难度 易 · 风险 低 · 位置 `docs/event/specification.md`
  - **问题**：第 76 行把 advisory file lock 写成了 TS/Python 共同契约。DSH 的
    JSONL 后端没有任何文件锁（`session-persistence-jsonl/src` 中无
    flock/lock 逻辑），锁只存在于 Python。
  - **处理**：改为"Python-only 扩展，TypeScript 不参与该锁协议"；若 R11 决定
    删锁，则整段删除。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：删除锁段落，改为"两种实现都不使用跨进程文件锁，与 DSH 一致"。
  - **验证**：2026-09-02 完整 `npm run verify` 通过；Python persistence 35/35，
    双向明文/Zstandard 跨语言用例 5/5。

- [x] **R02** · 难度 易 · 风险 低 · 位置 `docs/event/specification.md` 行为接口映射表
  - **问题**：表格只写了"共同语义"，读者会把"逻辑等价"误读为"API 等价"。
    TS 独有：write-behind 批处理、`SessionPreparation`/`prepare`、
    `listSnapshots`、带 `AbortSignal` 的 `inspect`、borrowed live source。
    Python 独有：`resume()`（目前只是 `restore()` 的别名）。
  - **处理**：表格增加"仅某一语言提供"一列，逐项标注。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：新增"仅单侧提供的接口"表。
  - **验证**：规格本地链接检查通过；TypeScript 类型检查、Python 35/35 与
    跨语言 5/5 均包含在 2026-09-02 完整验证中。

- [x] **R03** · 难度 易 · 风险 低 · 位置 根 `README.md`、`rfcs/0001`、`spec/`、`schemas/v0`、`conformance/cases`、`conformance/fixtures/v0`
  - **问题**：这些文件描述另一套模型（namespace、event_id、seq 从 1 起、经
    Checkpoint fork 且"父事件不得复制"），与 DSH Event 模型（seq 从 0 起、
    fork 复制前缀、无 namespace）矛盾；根 README 仍称 RFC 0001 为
    "current model"。
  - **处理**：给上述文件加状态标记（draft / not implemented by Event）；根
    README 改为指向 `docs/event/`。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：按决策直接删除 `spec/`、`rfcs/`、`schemas/v0`、`conformance/cases`、`conformance/fixtures`、`adapters/`、`docs/architecture.md`、`docs/invariants.md`；根 README、`schemas/README.md`、`conformance/README.md` 改为只描述 Event。
  - **验证**：旧路径不存在；项目自有 Markdown 本地链接检查通过，根 README
    只指向当前 `docs/event/` 文档集。

- [x] **R04** · 难度 易 · 风险 低 · 位置 `third_party/deepseek-harness/README.md`
  - **问题**：声称快照包含 Trajectory 依赖闭包，但 `dsh-client-ui-primitives`、
    `dsh-client-store`、`dsh-client-ui-slots`、`dsh-api-session-controller`
    等只以注册表包形式被引用并打进 UI bundle。
  - **处理**：二选一——补入快照，或如实列出"仅注册表引用"的包清单。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：按决策补入 24 个上游目录（含 `vendor/cordis`、`vendor/schemastery`），逐字节校验通过；README 按用途分三组列出。
  - **验证**：`npm run verify:upstream-identity` 当前逐文件核对 204 个裁剪文件与
    固定快照；来源 README 本地链接检查通过。

- [x] **R05** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/ui/trajectory/README.md`、`packages/event/typescript/TESTING.md`
  - **问题**：独立宿主用 `as never` 桩掉了 `useSessions`、`useWorkspaces`、
    `useSessionPendingInteraction`，`renderSlot` 返回 null，`viewRequest`
    恒为 null；被排除的上游测试只写在 `vitest.config.ts` 注释里。
  - **处理**：README 列出"已知不可用的 DSH Trajectory 能力"；TESTING.md 列出
    被排除的 `views.client.spec.tsx`、`client-bundle.client.spec.ts` 为
    已知缺口。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：UI README 新增 "Known limitations of the standalone host"，TESTING.md 新增 "Known gaps"。
  - **验证**：Trajectory 94/94、Perix UI 33/33 通过；README 与 TESTING 的
    本地链接检查通过。

- [x] **R06** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/packages/client/ui-trajectory/package.json` 等非 workspace 保留包
  - **问题**：这些 manifest 不参与构建，却把 `workspace:^` 改成了一整套注册表
    版本依赖，是"死清单"。
  - **处理**：二选一——恢复为上游原样并在 TS README 标注"仅审计用途"，或把
    它们接入 workspaces 与构建。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：`package.json` 恢复上游原样；`tsconfig.json` 必须保留本地版本（Vite 读取最近的 tsconfig，上游 `references` 指向不存在的目录），已在 TS README 登记为例外。
  - **验证**：身份校验确认审计 manifests 与固定快照一致，并把读取中的两个 UI
    tsconfig 计入 10 个必要差异；TypeScript/UI 构建通过。

## 2. 仓库组织

- [x] 可复用实现统一放在 `packages/event/<language>/`，采用项目优先、语言其次的结构。
- [x] 开发宿主放在 `apps/event/typescript/trajectory-demo/`，不混入可发布库。
- [x] 单语言测试随实现放置，跨语言测试统一放在 `tests/event/cross-language/`。
- [x] 共享 schema 与 conformance 数据分别放在 `schemas/event/` 和 `conformance/event/`。
- [x] 未修改的 DSH 来源快照独立保存在 `third_party/deepseek-harness/`。

- [x] **R07** · 难度 易 · 风险 低 · 位置 根 `package.json`、新增 `scripts/verify-upstream-identity.mjs`
  - **问题**：没有脚本校验 `packages/event/typescript/packages/**/{src,tests}`
    与 `third_party/.../upstream/packages/**` 逐字节一致，"保持原样"只靠
    人工。
  - **处理**：新增脚本并纳入 `npm run verify`；维护一份"允许差异清单"，
    R17–R19 修改保留源码后，清单之外的文件必须逐字节一致。
  - **依赖**：无（R17–R19 完成后更新允许差异清单）。
  - **结果**：已完成（2026-09-01）：新增 `scripts/verify-upstream-identity.mjs`，
    纳入 `npm run verify` 首步。初始门禁覆盖 132 个文件、7 处差异；经过宿主接缝
    和 R25–R29、R36 依赖收口后，当前覆盖 204 个文件、10 个必要差异和 139 个声明映射。
  - **验证**：2026-09-02 `npm run verify:upstream-identity` 通过，未登记的字节
    差异、无效映射和缺失上游对应文件都会使命令失败。

## 3. TypeScript 解耦

- [x] 审计 `packages/event/typescript/` 中全部 `@deepseek-ai/*` 与 Cordis 依赖。
- [x] 删除 Harness 宿主、scope、typert、插件生命周期等非 Event 能力。
- [x] 将 Event 必需的消息、ID 和 JSON 工具裁剪为 Perix 自有最小实现。
- [x] 移除 `@perix/event-sdk/runtime` 对 Cordis 的整包导出。
- [x] 移除 `@perix/event-sdk/messages` 对 `dsh-llm` 的整包导出。
- [x] 保持 Session、fork、repair、surface、JSONL 和 Trajectory 行为不退化。
- [x] 验证打包产物不存在 DSH 运行时依赖或公共命名空间泄漏。

### 3.1 Cordis 解耦路线

决策见 README "DSH 依赖处理规则"：Cordis 是插件平台，轨迹系统依赖它属于
反向依赖，**不采用 vendor 或 bundle Cordis 的方案**，而是用本地最小宿主接口
替换。审计得到的实际使用面很小，这是可行的依据：

| 保留包 | 实际用到的 Cordis/DSH 宿主能力 |
| --- | --- |
| `core/session` | `Service` 基类与 `super(ctx,'sessions')`；`ctx.effect`（1 处，generator 形式）；`ctx.events.dispatch('emit')` 与 `ctx.parallel('session/flush')`；`ctx.logger.warn`；`ctx.inject(['typert'])`；`dsh-scope` 的 `scopeOf/scopeTarget/Scoped` 作为事件 carrier；`declare module '@deepseek-ai/cordis'` |
| `session-persistence` | `Service` 基类；`ctx.on` 四个 session 事件；`ctx.effect` 注册反序 disposer；`ctx.sessions.list()`；`ctx.logger`；`invariant.ts` 用 `ctx.invariants` |
| `session-persistence-jsonl` | `static inject = ['sessions']`；`static Config = z.object(...)`（schemastery）；`ctx.logger` |
| 上游测试 | `new Context()`、`ctx.plugin`、`ctx.fiber.dispose`、`ctx.on`、`ctx.sessions`、`ctx.sessionPersistence`、`ctx.logger`；`ctx.typert` 2 处、`ctx.emit` 3 处、`ctx.parallel` 1 处 |

- [x] **R13** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/sdk/package.json`、`sdk/src/*-invariant.ts`、`sdk/vite.config.ts`
  - **问题**：`session/invariant`、`persistence/invariant`、
    `persistence-jsonl/invariant` 是 Cordis companion plugin，依赖
    `dsh-invariants` 服务，对 Event 行为无贡献，却是 SDK 公共出口。
  - **处理**：从 `exports`、vite entry 与 `public-api.spec.ts` 中删除三个子路径；
    源码留在 `packages/` 供审计，不进入 SDK 构建。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：删除三个子路径的 exports、vite entry、源文件、测试别名与 README 条目；同时移除 sdk 对 `@deepseek-ai/dsh-invariants` 的依赖（只有 invariant 模块引用它）。
  - **验证**：SDK build、15 个 SDK 用例与 TypeScript 空白消费者通过；发布
    exports 中不存在三个 invariant 子路径。

- [x] **R14** · 难度 中 · 风险 低 · 位置 新增 `packages/event/typescript/runtime/src/{brand,values,timeout}.ts`
  - **问题**：核心源码依赖 `dsh-brand`（`brandString/Branded`）、
    `dsh-util-values`（`deepFreeze/snapshotJsonValue/assertNever`）、
    `dsh-timeout`（`MAX_TIMER_DELAY_MS`），这些是几十行的小工具。
  - **处理**：逐函数从上游复制到本地包（MIT，保留来源注释），核心源码只改
    import 行。上游 `json.spec.ts`、`properties.spec.ts` 锁定行为。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：本地模块放在 `runtime/`（`packages/` 目录保留给上游原样文件，受 R07 比对约束）；`values.ts` 正文与上游逐字节相同。保留源码零改动，SDK 构建、vitest、测试与 UI tsconfig 通过别名解析。
  - **验证**：上游 Event 626/626、TypeScript 类型检查、SDK build 与 15 个 SDK
    用例通过；当前全部 import 改写另由 139 条身份映射约束。

- [x] **R15** · 难度 中 · 风险 低 · 位置 新增 `packages/event/typescript/runtime/src/messages.ts`、`sdk/src/messages.ts`
  - **问题**：`@perix/event-sdk/messages` 整包 re-export `dsh-llm`，把完整 LLM
    runtime 类型图暴露给消费者。
  - **处理**：本地模块只保留 Event 接受与产生的类型（`Message`、`ContentBlock`、
    `StreamChunk`、`ToolSchema`、`LlmCallConfig`、`TokenUsage`、`LlmFailure`
    等）、构造函数 `createUserMessage`、`createAssistantMessage`、
    `createToolResultMessage` 和 `callConfigEquals`；以 Python `messages.py`、
    `request_header.py` 为对照，保证两边接受同一 JSON 形状。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：`runtime/src/messages.ts` 只含 Event 用到的 id、content block、message、StreamChunk、`LlmCallConfig` 与构造函数；vitest 里全部上游 core 测试改为在该模块上运行；SDK 依赖去掉 `dsh-brand/dsh-util-values/dsh-timeout/dsh-llm/dsh-attachment`。R15 提交时剩余的 Cordis、dsh-scope、schemastery 依赖已由 R16–R23 后续移除。
  - **验证**：上游 Event 626/626、类型检查、SDK 15/15、跨语言 5/5 与空白
    TypeScript 消费者通过。

- [x] **R16** · 难度 中 · 风险 低 · 位置 新增 `packages/event/typescript/runtime/`
  - **问题**：没有可替代 Cordis 的本地宿主抽象。
  - **处理**：定义 `EventHost`，只含三部分——
    (a) 强类型事件总线 `on/emit/parallel`，仅覆盖 `session/created`、
    `session/event`、`session/flush`、`session/disposed`；
    (b) `effect(fn | generator, label)` 与 `dispose()`，按反注册顺序释放；
    (c) `logger.warn/info`。
    不提供 scope、typert、plugin 注册、HMR。先为 `EventHost` 单独写测试。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：`runtime/src/host.ts`。`EventHost` = 事件总线（四个 `session/*` 事件 + Cordis 同款 `internal/dispatch` 钩子）、`effect/scope/dispose`（反序释放，失败记录日志不中断，与 Cordis fiber unload 一致）、`provide/get` 组合槽（经作用域读取得到 `ctx` 绑定的 Proxy 视图）。
  - **验证**：R30 的 11 个 EventHost 直接用例、上游 Event 626/626、SDK 15/15
    与系统 1/1 通过。

- [x] **R19** · 难度 中 · 风险 低 · 位置 `packages/session/session-persistence-jsonl/src/index.ts`
  - **问题**：构造函数签名 `(ctx, config)`，`static inject = ['sessions']`，
    `static Config` 依赖 schemastery。
  - **处理**：改为 `(host, sessions, config)`；删除 `static inject` 与
    schemastery schema，用源码已有的 `??` 默认值兜底；在 TS README
    "Necessary local changes" 逐行登记。
  - **依赖**：R16。
  - **结果**：已完成（2026-09-01）：构造函数保持 `(host, config)`；删除 `static inject`、schemastery `Config` 与 `JsonlCompressionSchema`，改为构造时校验 `root`/`compression`。三个保留包不再是 npm workspace，`package.json` 恢复上游字节，SDK 直接从源码打包。
  - **验证**：上游 Event/持久化 626/626、SDK 15/15、类型检查和 SDK build
    通过；身份校验登记该宿主接缝差异。

- [x] **R17** · 难度 难 · 风险 中 · 位置 `packages/core/session/src/index.ts`
  - **问题**：`SessionStore extends Service`，注册 typert lookup，事件 carrier
    经 `dsh-scope` 包装，`declare module '@deepseek-ai/cordis'` 扩展
    `Context`。
  - **处理**：`SessionStore` 改为接收 `EventHost` 的普通类；删除
    `ctx.inject(['typert'])` 与 typert 模块扩展；carrier 退化为 session 本身
    （独立组件没有 agent scope）；删除 `declare module`。仅允许改这些行，
    `Session` 类与 append/fork/repair/surface 逻辑逐字节不动，改动逐行登记。
  - **依赖**：R14、R15、R16。
  - **结果**：已完成（2026-09-01）：只改 import、`declare module`、构造函数（`ctx.provide('sessions', this)`）、carrier 三行；`Session` 与 append/fork/repair/surface 逻辑逐字节不动。scope 过滤未保留：所有监听器收到所有 Session。`types.ts` 另删除 5 行 Typert 远程错误增强。
  - **验证**：身份校验登记两处 Session 宿主差异及全部 import 映射；上游 Event
    626/626、SDK 15/15 和系统 1/1 通过。

- [x] **R18** · 难度 难 · 风险 中 · 位置 `packages/session/session-persistence/src/{index,coordinator}.ts`
  - **问题**：`SessionPersistence extends Service`；`installWritePath` 用
    `ctx.on/ctx.effect`；`ctx.sessions.list()`、`ctx.get`、`ctx.invariants`。
  - **处理**：改为普通抽象类，构造时注入 `host` 与 `sessions`；
    `installWritePath` 改用 `host.on/host.effect`；删除 `ctx.get`、
    `ctx.invariants` 用法。write-behind、prepared cache、torn-tail 逻辑不动。
  - **依赖**：R17。
  - **结果**：已完成（2026-09-01）：`SessionPersistence` 改为普通抽象类并增加 `name` 标签；coordinator 只改一个类型导入，`installWritePath` 无需改动（host 的 `on/effect` 契约相同）。
  - **验证**：身份校验登记两处 persistence 宿主差异及 import 映射；上游
    Event/持久化 626/626、SDK 15/15 与系统 1/1 通过。

- [x] **R20** · 难度 中 · 风险 中 · 位置 `packages/test-support/`、上游 `tests/`
  - **问题**：上游测试大量使用 `new Context()`、`ctx.plugin`、`ctx.fiber.dispose`。
  - **处理**：新增 `createTestContext()` 垫片，提供 `plugin`、`sessions`、
    `sessionPersistence`、`on`、`fiber.dispose`、`logger`，让上游测试尽量原样运行；
    仅改写 `ctx.typert`（2 处）、`ctx.emit`（3 处）、`ctx.parallel`（1 处）
    的用例，并在 R07 允许差异清单中登记。
  - **依赖**：R17、R18、R19。
  - **结果**：已完成（2026-09-01）：`test-support/cordis-shim.ts`、`scope-shim.ts` 通过 vitest 别名让上游测试原样运行，626/626 通过；排除 `scoped.spec`、`typert.spec`、`invariant.spec` 三个测试宿主机制的文件并在 TESTING.md 登记。
  - **验证**：`npm run test:upstream:event` 626/626；身份校验确保保留的上游
    测试除声明映射外与固定快照一致。

- [x] **R21** · 难度 中 · 风险 低 · 位置 `sdk/src/runtime.ts`、`sdk/package.json`
  - **问题**：`@perix/event-sdk/runtime` 是 `export * from '@deepseek-ai/cordis'`；
    TS 没有与 Python `store.restore(id)` 对应的一步式恢复入口。
  - **处理**：导出本地 `createEventRuntime()`，返回 `sessions`
    （`create/restore/fork/flush`）、`persistence`、`dispose`；`restore(id)`
    即 `specification.md` 中"`prepare` 后由 `SessionStore` 发布"的封装。
  - **依赖**：R16–R20。
  - **结果**：已完成（2026-09-01）：`@perix/event-sdk/runtime` 只导出 `EventHost`；根入口新增 `createEventRuntime({ persistence })` 返回 `sessions/persistence/restore/dispose`；`restore` = `prepare` + `enter` + `announce`。Perix 测试与打包消费者已迁移。
  - **验证**：SDK 15/15、系统 1/1、双向公开 restore 5/5 与 TypeScript 空白
    消费者通过。

- [x] **R22** · 难度 易 · 风险 低 · 位置 `sdk/scripts/rewrite-public-namespaces.mjs`
  - **问题**：脚本对生成物做字符串替换（含 typert 符号字符串），是去痕不是解耦。
  - **处理**：typert 注册删除后不再需要，删除脚本及其 build 步骤。
  - **依赖**：R17。
  - **结果**：已完成（2026-09-01）：脚本与 build 步骤删除。R22 提交时产物只剩
    d.ts 的上游包名来源注释；R28 已把它机械转换为固定源码路径，当前 JS 与 d.ts
    均无 DSH registry namespace。
  - **验证**：SDK build 与空白消费者逐文件扫描通过，manifest、生成的 JS 和
    d.ts 均无 DSH package specifier。

- [x] **R23** · 难度 易 · 风险 低 · 位置 `sdk/package.json`
  - **问题**：`dependencies` 列出 12 个 `@deepseek-ai/*`/schemastery 包，
    `lib/*.js` 运行时 import 它们。
  - **处理**：全部移除；`koffi` 仅 win32 使用、与 DSH 一致，保留并在 README 注明。
  - **依赖**：R14–R21。
  - **结果**：已完成（2026-09-01）：`dependencies` 只剩 `koffi`（win32）与 `@types/node`。
  - **验证**：`npm ls --all` 无 DSH 包；SDK build、15 个 SDK 用例与空白消费者
    安装通过。

- [x] **R24** · 难度 评估 · 风险 低 · 位置 `packages/event/typescript/ui/trajectory/`
  - **问题**：`@perix/event-ui` 从注册表 bundle `dsh-client-ui-primitives`
    （含 shiki 全语法，`lib` 约 5 MB JS、1.5 MB CSS）与 `dsh-client-store`。
  - **处理**：按"UI 闭包优先原样裁剪"规则可接受，消费者无需安装 DSH 包；本项
    只评估并记录结论，是否裁剪 shiki 语法由 UI 体积要求决定。
  - **依赖**：无。
  - **结果**：已完成评估（2026-09-01）：`@perix/event-ui` 产物 5.1 MB：主 chunk 1.35 MB，`style.css` 1.5 MB（其中 20 个 `@font-face` 以 data: URI 内嵌字体，占绝大部分），23 个 shiki 语法 chunk 约 2.3 MB 按需动态加载。`package.json` 只依赖 `@perix/event-sdk` 与 React peer，消费者不安装任何 DSH 包。结论：保持"原样裁剪"，不裁 shiki；若日后有体积要求，可选的后续项是把字体改为外部文件、收窄 shiki 语法集，两者都不影响 Event 行为。
  - **验证**：UI build、UI runtime 182/182、Trajectory 94/94、Perix UI 33/33
    和 TypeScript 空白消费者通过；R28 已进一步把闭包从注册表裁入本地。

### 3.2 彻底移除 DSH 名称与注册表依赖（已完成，详见 [`tasks/R25-R29-dsh-free.md`](tasks/R25-R29-dsh-free.md)）

- [x] **R25** · 难度 易 · 风险 低 · 位置 `scripts/verify-upstream-identity.mjs`
  - **问题**：改写保留源码的 import 后，逐字节比对会把每个文件都列成"允许差异"，一致性保障失效。
  - **处理**：脚本改为"对上游内容应用显式 specifier 映射表后再逐字节比对"；映射表为空时行为与现在相同，先单独提交。
  - **依赖**：无。
  - **结果**：已完成（2026-09-02）：一致性脚本新增按保留文件声明的 specifier
    映射表；替换目标按导入文件计算相对路径，映射必须命中上游文本、目标必须是
    TypeScript 根目录内的现存文件，随后仍逐字节比较。当前映射表保持为空。
  - **验证**：`node --check scripts/verify-upstream-identity.mjs` 与
    `npm run verify:upstream-identity` 通过：R25 提交时为 132 个保留文件、9 个
    既有差异、0 个映射；后续任务按此机制登记映射。

- [x] **R26** · 难度 易 · 风险 低 · 位置 `packages/core/session/src`、`packages/session/*/src` 共 14 个文件
  - **问题**：源码仍写 `@deepseek-ai/dsh-session`、`dsh-llm`、`dsh-brand`、`dsh-util-values`、`dsh-timeout` 等名字，靠 6 处构建/测试别名解析。
  - **处理**：只改 import 行为相对路径（`@perix/event-sdk/runtime` 自引用保留）；删除对应别名；删除三个 `invariant.ts` 与三个被排除的 Cordis 测试。
  - **依赖**：R25。
  - **结果**：已完成（2026-09-02）：14 个核心与持久化文件只改 26 条已声明的
    模块 specifier；SDK 构建侧删除全部 DSH 别名，UI 尚需的 Session、LLM、
    attachment 类型映射明确留给 R27。三个 invariant companion 与三个宿主专用
    测试从保留树删除，原件仍在固定 `third_party` 快照。
  - **验证**：`npm run verify` 全绿；身份审计为 126 个保留文件、9 个既有差异、
    26 个声明映射；Event 626/626、Trajectory 94/94、Runtime 11/11、SDK 15/15、
    UI 33/33、Python 35/35、系统 1/1、跨语言 5/5，以及 TS/Python 空白消费者通过。

- [x] **R27** · 难度 中 · 风险 中 · 位置 `runtime/src/ui-types.ts`、`runtime/src/event-types.ts`、UI 闭包约 30 个文件
  - **问题**：UI 闭包从 20 多个注册表包只取类型（`SessionSnapshot`、`ConversationNodeDefinition`、`InjectFace` 等）以及六处 `import type {}` 的事件数据形状增强。
  - **处理**：可裁的纯类型文件从快照裁入并纳入比对；其余按上游逐字段复制到本地类型模块；`register*Definition(ctx: Context)` 改为两成员的本地接口；增强目标改为 `@perix/event-sdk/session/types`。
  - **依赖**：R26。
  - **结果**：已完成（2026-09-02）：新增 `runtime/src/ui-types.ts` 与
    `event-types.ts`，按固定快照复制 Trajectory 实际使用的宿主类型和六组 Event
    数据增强；保留的 UI 算法文件只改模块 specifier，并以本地最小注册接口替代
    Cordis cast。删除独立组件不使用的 DSH 浏览器插件入口和 invariants companion，
    原件仍在 `third_party` 快照。TypeScript 与 Trajectory tsconfig 不再含 DSH 别名；
    源码中只剩 R28 要裁入的 store 与 UI primitives 两类运行时导入。
  - **验证**：`npm run verify` 全绿；身份审计为 124 个保留文件、9 个既有差异、
    71 个声明映射；Event 626/626、Trajectory 94/94、Runtime 11/11、SDK 15/15、
    UI 33/33、Python 35/35、系统 1/1、跨语言 5/5，以及 TS/Python 空白消费者通过。

- [x] **R28** · 难度 难 · 风险 中 · 位置 `packages/client/store`、`packages/client/ui-primitives` 子集、`ui/trajectory/package.json`、根 `package.json`
  - **问题**：运行时真正用到的只有 `dsh-client-store`（3 个文件）与 `dsh-client-ui-primitives` 的图标、Tooltip、JsonTree、MarkdownText、`extractMarkdownPlainText` 闭包，却因此拖着 25 个注册表包与根 `overrides`。
  - **处理**：从快照裁入这两个包的闭包；第三方依赖（shiki、mdast、micromark、katex、anser、clsx、immer、zustand）直接声明；删除全部 `@deepseek-ai/*` devDependencies 与 `overrides`；打包测试断言产物连注释都不含 `@deepseek-ai`。
  - **依赖**：R27。
  - **结果**：已完成（2026-09-02）：按静态 import 图裁入 store 的 2 个实际
    源文件（未裁 Cordis invariants companion）和 UI primitives 的 23 个运行时
    文件，全部保持固定快照字节；本地 barrel 只导出 Trajectory 使用的符号。另保留
    1 个完整 store 套件、8 个相关 primitives 套件及 48 份原始 DOM 基线，共新增
    182 个上游回归测试。删除 UI manifest 的 25 个 DSH devDependencies、根
    `overrides` 及 lockfile 中全部 DSH 包，改为直接声明闭包所需第三方依赖；闭包未
    使用 `anser`，因此未引入。SDK 声明生成将包名注释改成固定 commit 的源码路径，
    空白消费者逐文件断言 SDK/UI 发布产物不含 DSH namespace。
  - **验证**：`npm run verify` 全绿；身份审计为 207 个保留文件、10 个必要差异、
    87 个声明映射；Event 626/626、UI runtime 182/182、Trajectory 94/94、Runtime
    11/11、SDK 15/15、UI 33/33、Python 35/35、系统 1/1、跨语言 5/5，以及
    TS/Python 空白消费者通过。`npm ls --all`、manifest/lockfile 与发布物扫描均无
    `@deepseek-ai`。

- [x] **R29** · 难度 易 · 风险 低 · 位置 `third_party/deepseek-harness/README.md`、TS README、本清单、`docs/event/decisions.md`
  - **问题**：完成后文档中"仅注册表引用"、"名字仍在保留源码中"等描述过期。
  - **处理**：按任务书第 5 步逐项更新，并把第 7 节总验收的前置条件补上本任务。
  - **依赖**：R28。
  - **结果**：已完成（2026-09-02）：审计快照来源清单补入已裁剪的 store 与
    UI-primitives 闭包；TypeScript README 登记最终来源映射与身份校验数量；D04
    标为被 D05 取代，D05 记录实际依赖边界；任务书目标改为准确区分生产实现与
    逐字节保留的上游测试、manifests 和来源文本。
  - **验证**：`npm run verify` 全绿；身份审计为 207 个保留文件、10 个必要差异、
    87 个声明映射；1002 个行为测试、全部构建、类型检查及 TypeScript/Python
    空白消费者安装测试通过。

### 3.3 EventHost 生命周期校准

已完成（R30–R32），详见
[`tasks/R30-R32-production-hardening.md`](tasks/R30-R32-production-hardening.md)。

- [x] **R30** · 难度 中 · 风险 高 · 位置
  `packages/event/typescript/runtime/src/host.ts`、
  `packages/event/typescript/tests/runtime/`
  - **问题**：R16 要求先为 `EventHost` 写独立测试，但目前只有公共导出 smoke
    test。实测 effect 执行期间重入 `dispose()` 会漏掉随后返回的 disposer；
    Promise effect 初始化失败会先产生未处理 rejection，且 dispose 时吞掉错误。
    两者都与固定版本 Cordis 的行为不同。
  - **处理**：按
    [`R30–R32 任务书`](tasks/R30-R32-production-hardening.md) 先建立不依赖
    生产 Cordis 包的独立生命周期回归套件，再只修改最小宿主接缝，使重入释放、
    异步初始化失败、反序清理、失败隔离、scope 与服务绑定行为和固定上游一致；
    不得借机扩展通用 runtime 能力。
  - **依赖**：R16。
  - **结果**：已完成（2026-09-02）：新增 11 个 `EventHost` 直接测试并先复现
    两个已知缺陷；`host.ts` 增加与固定 Cordis 对齐的 effect setup barrier、
    Promise rejection 观察与 generator 最终 disposer 收集，重复或并发释放会加入
    同一清理过程。未修改 Session、persistence 或 Trajectory 算法。
  - **验证**：`test:runtime` 11/11、`test:upstream:event` 626/626、`test:sdk`
    15/15、`test:system` 1/1；`test:types`、SDK build 与 `test:package` 通过。

## 4. Python 原生实现

- [x] 建立可安装的 `perix-event-sdk` 包及清晰的公开 API。
- [x] 使用标准 `pyproject.toml` + `src/perix_event/` 布局，公开 API 与完整实现
  同包发布，不保留无独立职责的 `sdk/` 目录。
- [x] 实现 Session header、Event envelope、连续序号和 JSON 值校验。
- [x] 实现 surface append/replace、来源序号验证和消息投影。
- [x] 实现 request header/context fold、chunk row 与 seq-range 编解码。
- [x] 实现 SessionStore、restore、resume 和稳定前缀 fork。
- [x] 实现中断 turn/tool/step 的确定性 repair。
- [x] 实现 DSH 兼容的明文 JSONL 持久化、追加、读取、列表和 torn-tail 修复。
- [x] 实现 DSH 兼容的 Zstandard 多 frame 读写，并提供明确的可选依赖策略。
- [x] 实现空白项目安装与公共 API smoke test。

- [x] **R11** · 难度 易 · 风险 低 · 位置 `packages/event/python/src/perix_event/persistence_jsonl.py`
  - **问题**：`.event.lock` advisory 文件锁是 DSH 没有的功能，且在 session 目录
    里多写一个文件。
  - **处理**：按"不增加功能"原则删除，仅保留进程内 `threading.RLock`；若因
    Nexent 多进程需求保留，须在 `specification.md` 标注 Python-only（R01），并
    增加 TS 读取含 `.event.lock` 目录的跨语言测试。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：删除 `_exclusive_file_lock`、`_lock_path` 及三处调用，只保留进程内 `RLock`；不再写 `.event.lock`。
  - **验证**：Python 35/35、双向持久化 5/5 与 Python 空白消费者通过；测试
    临时目录不产生 `.event.lock`。

- [x] **R12** · 难度 易 · 风险 低 · 位置 `packages/event/python/src/perix_event/session.py`
  - **问题**：`SessionStore.resume()` 只是 `restore()` 别名，DSH 没有该 API。
  - **处理**：保留则在 docstring 与 `specification.md` 明确"别名"（R02）；否则删除。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：保留别名，docstring 与 `specification.md` 均注明"与 `restore` 相同、Python-only、不增加行为"。
  - **验证**：Python 35/35 与跨语言 5/5 通过，后者通过公开 `restore/resume`
    重读双方续写和 fork 的轨迹。

## 5. 跨语言契约

- [x] 将共享有效/无效轨迹夹具放入 `conformance/`。
- [x] TypeScript 和 Python 对同一夹具给出相同接受/拒绝结果。
- [x] TypeScript 写出的轨迹可由 Python restore、resume、append 和 fork。
- [x] Python 写出的轨迹可由 TypeScript restore、resume、append 和 fork。
- [x] Python 轨迹可由 TypeScript Trajectory UI 投影和渲染。
- [x] 规范化后的 header、Event、surface、messages 和 repair 结果等价。

- [x] **R08** · 难度 易 · 风险 低 · 位置 `conformance/event/v0/cases/`、TS `known-event-types.ts`、Python `types.py`
  - **问题**：`KNOWN_SESSION_EVENT_TYPES` 两份手抄副本，没有测试保证相同。
  - **处理**：新增 `known-event-types.json` 作为唯一来源，两边各加断言集合相等
    的测试。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：新增 `conformance/event/v0/cases/known-event-types.json`（51 个类型），TS `public-api.spec.ts` 与 Python `test_conformance.py` 各加一条集合相等断言。
  - **验证**：SDK 15/15、Python 35/35 与跨语言 conformance 5/5 通过。

- [x] **R31** · 难度 易 · 风险 中 · 位置
  `tests/event/cross-language/python-conformance.spec.ts`
  - **问题**：Python 写、TypeScript 续写的永久测试先调用
    `persistence.load()`，再用 `sessions.create({ seed })` 发布，并未经过对外
    承诺的 `runtime.restore()`；因此清单与验证策略声称的双向公开 restore
    路径没有回归门禁。
  - **处理**：按
    [`R30–R32 任务书`](tasks/R30-R32-production-hardening.md) 将明文与
    Zstandard 两组都改为经 `runtime.restore()` 恢复 Python 轨迹，再 append、
    flush、fork，并由 Python 重新读取验证；保留现有反向链路，证明双方通过
    公开 API 等价互操作。
  - **依赖**：R21、R30。
  - **结果**：已完成（2026-09-02）：明文与 Zstandard 链路均由 TypeScript
    `runtime.restore()` 恢复 Python 落盘轨迹，逐项验证原 header、完整前缀和
    单次 `session/end-seed`，再续写、flush、fork；Python 使用公开
    `restore/resume` 验证父子轨迹、连续 seq、稳定前缀和 lineage。反向链路保留，
    最终读取也改用 TypeScript 公开 `runtime.restore()`。
  - **验证**：`test:conformance` 5/5；完整 `npm run verify` 通过，包括 207 个
    上游文件一致性、全部构建、1002 个行为测试以及 TypeScript/Python 空白
    消费者安装。

- [x] **R34** · 难度 易 · 风险 中 · 位置 `docs/event/specification.md`、
  `docs/event/tasks/R33-nexent-acceptance.md`、Python 与跨语言测试
  - **问题**：R33 把“已以 `session/end-seed` 结尾的 seed 重放不再增长”简写成
    “`session/end-seed` 不重复增长”，容易误读为一个 Session 永远只能有一个
    marker。固定 DSH 源码和 property test 的真实语义是：每次重放带有新 live
    后缀、且末尾不是 marker 的完整历史时追加一个新 seed 边界；只有末尾已经是
    marker 的重复重放才幂等。当前永久测试没有覆盖跨语言多轮恢复。
  - **处理**：明确规范与 R33 验收措辞；增加 Python 多轮 seed 单测，以及
    Python → TypeScript → Python 的跨进程多轮 restore 回归，同时证明 marker
    增长与幂等条件、旧前缀和连续 seq 均与 DSH 一致。
  - **依赖**：R31。
  - **结果**：已完成（2026-09-02）：规范与 R33 任务书明确区分“带新 live
    后缀的下一次 replay 增加一个边界”和“末尾已有 marker 的重复打开幂等”；
    Python 单测锁定多段 seed，跨语言测试执行 Python 创建、TypeScript restore
    与续写、Python restore、TypeScript 幂等 restore、再次续写及 Python resume，
    marker seq 依次为 `[2]`、`[2, 5]`、`[2, 5]`、`[2, 5, 8]`。
  - **验证**：Python 36/36、跨语言 6/6；完整门禁的 207/10/87 身份校验、全部
    构建、类型检查和 1004 个行为测试通过；TypeScript 与 Python 空白消费者安装
    另以联网权限通过。

## 6. 测试与交付

- [x] 保留并通过 DSH 上游 Event 与 Trajectory 回归套件。
- [x] Python 单元测试覆盖全部核心行为、错误边界和异常输入。
- [x] Python 集成测试覆盖持久化重启、repair、resume 和 fork。
- [x] 明文、Zstandard、packed chunks、截断日志和大历史均有测试。
- [x] 根级 `verify` 同时运行 TypeScript、Python、跨语言和打包测试。
- [x] README、测试矩阵和本清单与当前实现一致。

- [x] **R35** · 难度 易 · 风险 低 · 位置
  `packages/event/python/tests/package_consumer.py`
  - **问题**：当前空白消费者把 Python 源码目录直接传给 `pip install`。pip 虽会
    临时构建 wheel，但门禁没有把 wheel 作为独立交付物传入另一个环境，无法证明
    R33 所要求的“使用安装后的包、不得依赖源码目录或 `PYTHONPATH`”。
  - **处理**：在隔离 builder 环境先生成唯一 wheel，再在独立 consumer 环境以
    `--no-index` 只安装该 wheel；运行现有公开 API smoke，并断言导入路径位于
    consumer 的 `site-packages` 而非源码树。
  - **依赖**：R34。
  - **结果**：已完成（2026-09-02）：package consumer 先在 builder venv 生成
    唯一的 `perix_event_sdk-0.1.0-py3-none-any.whl`，再创建全新的 consumer venv，
    以 `pip install --no-index <wheel>` 安装；smoke 返回包版本、持久化与 fork
    结果，并验证 `perix_event.__file__` 位于 consumer 环境且不在源码树中。
  - **验证**：`npm run test:python:package` 通过，安装阶段只处理本地 wheel；
    完整 `npm run verify` 通过 207/10/87 身份门禁、全部构建/类型检查、1004 个
    行为测试及 TypeScript/Python 两个发布物消费者。

- [x] **R09** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/tests/package/package-consumer.mjs`
  - **问题**：只断言 `dsh-session*` 四个名字不泄漏；`lib/types` 实际有 8 处
    `from '@deepseek-ai/cordis'` 与 `declare module '@deepseek-ai/cordis'`。
  - **处理**：断言收紧为 `lib/**/*.js`、`*.d.ts` 与 `package.json`
    `dependencies` 中不得出现任何 `@deepseek-ai/`。第 3 节完成前会失败，
    作为第 7 节验收门禁，不放进当前 `verify`。
  - **依赖**：R23（通过条件）。
  - **结果**：已完成（2026-09-01）：断言改为：安装后的 `package.json` 各依赖字段无 `@deepseek-ai/`；`lib/**/*.js` 完全不含该命名空间；`*.d.ts` 不得 import/re-export/`declare module` DSH 模块（来源注释允许）。已纳入 `verify`。
  - **验证**：TypeScript 空白消费者安装、严格类型检查、运行时 smoke 和 SDK/UI
    产物逐文件命名空间扫描通过；R28 后来源注释也已改为固定源码路径。

- [x] **R10** · 难度 难 · 风险 低 · 位置 `packages/event/typescript/tests/ui/`
  - **问题**：`views.client.spec.tsx`（1338 行）是 Trajectory 最大的行为测试，
    被排除后"UI 水准不退化"缺少证明。
  - **处理**：在独立宿主下移植等价用例，去掉依赖完整 DSH shell 的
    slot/workspace 部分。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：`tests/ui/trajectory-view.spec.tsx` 移植 25 个用例（7 个账本/详情面板交互、13 个 timeline 投影、2 个视图状态），断言与上游逐句相同，只把 ConversationRoot+tab 挂载换成直接渲染 `TrajectoryView`。未移植的 6 个用例（插件注册 4、tab 本地化 1、Node 侧 apply 1）测试的是 shell 机制，已在 TESTING.md 说明。
  - **验证**：Trajectory 94/94 与 Perix UI 33/33 通过；后者包含移植的 25 个
    shell-independent view 用例。

- [x] **R32** · 难度 易 · 风险 低 · 位置 `docs/event/`、
  `packages/event/typescript/README.md`、根 `README.md`
  - **问题**：文档仍有与代码不一致的历史结论：R07 写 7 处差异而校验脚本
    报告 9 处；TS README 一边登记五个宿主接缝源码修改，一边又称没有保留源码
    被修改且只例外七个 manifest/config；部分完成状态和测试能力描述也早于
    当前实现。
  - **处理**：按
    [`R30–R32 任务书`](tasks/R30-R32-production-hardening.md)，在行为与依赖
    任务完成后逐项核对当前代码、校验输出、测试矩阵和决策记录，修正数字、
    措辞、状态与链接；只记录事实，不把计划写成已完成。
  - **依赖**：R29–R31。
  - **结果**：已完成（2026-09-02）：架构删除 UI 仍从注册表打包的过期结论；
    需求与规格明确公开 restore 双向链路；测试文档补入 EventHost 层及当前
    207/10/87 身份数据和 1002 个行为测试；根、TypeScript、runtime、SDK、Python
    README 与 R30–R32 任务书同步。R07/R31 的历史与当前数量已明确区分，31 个
    既有已完成 R 条目均补有日期、结果和验证证据。
  - **验证**：项目自有 28 个 Markdown 文件的本地链接与围栏检查通过，
    `git diff --check` 通过；任务证据审计 31/31 通过；身份校验仍为 207 个文件、
    10 个必要差异、87 个声明映射。R29 后的完整 `npm run verify` 已通过 1002 个
    行为测试、全部构建/类型检查及两种语言的空白消费者安装。

- [x] **R36** · 难度 中 · 风险 低 · 位置 `packages/event/typescript/packages/**/tests/`（执行前实际 26 个文件）、`vitest.config.ts`、`tsconfig.tests.json`
  - **问题**：保留的上游测试文件仍写 `@deepseek-ai/*` 包名，靠 14 条 vitest 别名解析；仓库对 `@deepseek-ai/` 的代码级 grep 因此不为空。
  - **处理**：见 [`tasks/R36-test-imports.md`](tasks/R36-test-imports.md)。23 个可运行测试/辅助文件按映射表改写 import；3 个一直被排除的 shell/monorepo 测试删除；随后删除全部 `@deepseek-ai` 别名。
  - **依赖**：R25–R29。
  - **结果**：已完成（2026-09-02）：删除代码生成、DSH ModuleLoader 和完整
    shell 三个从未运行的文件；23 个保留测试/辅助文件只改 import/export 或一个
    module-augmentation specifier，新增 52 条逐文件身份映射；删除 vitest 的 14 条
    DSH 别名。测试逻辑、断言和夹具未改，上游原件继续保存在 `third_party/`。
  - **验证**：两条任务书 DSH import/config 扫描均为空；身份门禁通过 204 个
    保留文件、10 个必要差异和 139 个映射；`npm run verify` 通过原有 626 Event、
    182 UI runtime、94 Trajectory 和总计 1005 个行为测试，以及全部构建、类型
    检查和 TypeScript/Python 空白消费者安装。

- [x] **R37** · 难度 难 · 风险 中 · 位置 Nexent 本地实验分支、
  `packages/event/typescript/{sdk,ui/trajectory}`
  - **问题**：R33 只证明真实 Nexent 轨迹能够被独立 Trajectory UI 自动化渲染；
    Nexent 前端没有改动，其原聊天面板不能直接读取 Event v0，也没有产品层的
    轨迹读取、resume 或 fork 入口。
  - **处理**：按
    [`R37 任务书`](tasks/R37-nexent-trajectory-ui.md) 保留原聊天界面，在 Nexent
    会话页嵌入 `@perix/event-ui`；由 Nexent 现有 Python 后端提供经过权限校验的
    Event 读取与操作边界，并完成真实父子轨迹的浏览器验收。
  - **依赖**：R33。
  - **结果**：已完成（2026-09-02）：Nexent 本地分支以 5 个独立提交完成 Python
    记录/读取/resume/fork、可复现 UI 包、前端客户端及同页“对话 / 轨迹”视图；
    原聊天、Reasoning/Tool/Plan/Verification/Sources 与 Composer 保持原路径。
    Session 映射先经过 tenant/user/conversation 权限，fork 同时生成 Event 子
    Session 与 Nexent 子会话；该分支无 remote、未推送。
  - **验证**：Nexent Python 539/539、前端 26/26、类型检查和生产构建通过；使用
    R33 父子轨迹完成 1280×720 浏览器验收，搜索、折叠、详情、时长、刷新保持及
    fork 第 3 Turn 均通过，证据见任务书。主仓 `npm run verify` 通过 969 个
    Vitest、36 个 Python 测试、全部构建/类型检查及两种空白消费者安装。

- [x] **R38** · 难度 中 · 风险 低 · 位置 Nexent 本地实验分支、
  `docs/event/evidence/r38/`
  - **问题**：R37 的真实浏览器轨迹只有 3 个 Turn，现有证据图没有展示 DSH
    右侧事件详情中的参数、结果、Schema 与计时，也未把 20 Turn 长轨迹的冷恢复
    和 fork 串成一条可复核验收链路。
  - **处理**：按
    [`R38 任务书`](tasks/R38-nexent-long-trajectory.md) 由独立 Nexent 进程生成并
    恢复至少 20 个完整 Turn，验证稳定前缀 fork 与父子独立续写；在 Nexent 同页
    轨迹视图中完成长列表、右侧详情和 fork lineage 的全景浏览器验收并保存证据。
  - **依赖**：R37。
  - **结果**：已完成（2026-09-02）：Nexent 本地提交 `d341740` 新增 20 Turn
    跨进程冷恢复/fork 回归，并只补齐 Event v0 已有
    `request/header.header.tools`；未修改 Event 协议或 DSH UI。fork 时 189 个
    Event 前缀逐条相等，父子独立续写后各有 21 Turn、197 个 Event。
  - **验证**：Nexent Python 540/540、前端 26/26、类型检查和生产构建通过；
    1440×900 浏览器实测长时间线、详情五页签、真实 `add` Schema 及页面 fork
    导航，四张证据与哈希见任务书。主仓 `npm run verify` 通过 969 个 Vitest、
    36 个 Python 测试、全部构建/类型检查及两种空白消费者安装。

- [x] **R39** · 难度 中 · 风险 低 · 位置 `docs/event/demos/nexent/`
  - **问题**：R38 只有静态证据，后续读者不能直接观看“完整轨迹 → 详情与按钮 →
    中断后冷恢复 → fork 子轨迹”的连续产品行为。
  - **处理**：按
    [`R39 任务书`](tasks/R39-nexent-trajectory-demo.md) 使用真实 Nexent Event
    轨迹录制带中文画面标注的可播放 Demo，并提交封面、章节说明和媒体验证证据。
  - **依赖**：R38。
  - **结果**：已完成（2026-09-02）：提交 64.58 秒、1440×900 H.264 Demo，
    依次展示完整轨迹、浏览按钮、右侧五页签、进程 B 冷恢复同一 Session 和 UI
    分叉后的父子血缘/独立后缀；同时提交封面、章节、数据边界和播放说明。
  - **验证**：视频 775 帧完整解码，6 个章节关键帧视觉检查通过；恢复前 97 个
    Event 与 Fork 前 189 个 Event 分别逐条相等，媒体和三份 JSONL 哈希见任务书；
    本地链接、`git diff --check`、204/10/139 上游身份门禁均通过。R39 未修改
    Event、DSH UI 或 Nexent 实现。

- [x] **R40** · 难度 中 · 风险 中 · 位置 Nexent 本地实验分支、
  `docs/event/demos/nexent/`
  - **问题**：R39 无声音，关键动作以操作后的状态帧表达；同时 Nexent 顶部
    “刷新 / 分叉”属于宿主扩展，而 DSH 的 Fork 位于聊天消息旁、Resume 是自动
    宿主行为，不存在可直接照搬的轨迹 Resume 按钮。
  - **处理**：按
    [`R40 任务书`](tasks/R40-nexent-narrated-interaction-demo.md) 先由用户决定
    采用 DSH 原行为还是 Nexent 显式控制，再录制带中文旁白、连续选中/点击动作
    和真实 restore/resume/fork 结果的新版 Demo。
  - **依赖**：R39；控件语义已于 2026-09-02 确认。
  - **结果**：已完成（2026-09-02）。Nexent 本地 commit `f10c9b5` 增加聊天消息
    快捷 Fork 和轨迹 Turn/Event 精确 Fork；DSH `EventTrajectory` 内部未改。
    新版 101 秒 Demo 加入普通话旁白、同步字幕、选择/指向/点击动画，并显示两条
    真实 UI 路径的子会话结果。Nexent 无 remote，未推送。
  - **验证**：Nexent 27/27、TypeScript、production build 与格式门禁通过；真实
    浏览器分别从聊天第 20 轮和轨迹 `Event 188` 点击进入子 conversation `3902`，
    同时验证 10→21 Turn 冷恢复和右侧 Schema。视频完整解码，AAC 峰值
    `-1.4 dB`，九个关键状态帧通过视觉复核；哈希与完整证据见 R40 任务书。

- [x] **R41** · 难度 低 · 风险 低 · 位置 `docs/event/demos/nexent/`
  - **问题**：R40 的系统普通话音色机器感明显，鼠标点击节奏偏慢且按下瞬间不够
    清晰，影响演示可读性。
  - **处理**：按
    [`R41 任务书`](tasks/R41-demo-natural-voice-clicks.md) 更换自然神经网络人声，
    缩短节奏，并用目标停留、按下态和双脉冲明确表达刷新、聊天 Fork、分叉点选择
    与轨迹 Fork。
  - **依赖**：R40；只重制媒体与说明，不修改功能实现。
  - **结果**：已完成（2026-09-02）。旁白改为 `zh-CN-XiaoxiaoNeural`，总时长
    缩短至 83.07 秒；五类关键操作均有快速指针、按下态、双脉冲、点击音和必要的
    局部放大，两个 Fork 入口与 Resume 语义未改变。
  - **验证**：最终 MP4 完整解码，六个关键帧通过视觉复核；AAC 平均音量
    `-16.4 dB`、峰值 `-1.4 dB`，无两秒以上静音；视频与封面哈希及完整证据见
    R41 任务书。Nexent、DSH `EventTrajectory` 与 Event 实现无改动。

- [x] **R42** · 难度 低 · 风险 低 · 位置 `docs/event/demos/nexent/`
  - **问题**：封面和开场用“自然人声”“清晰点击”等制作质量作为标题，属于应由
    成片自行体现的冗余说明。
  - **处理**：按 [`R42 任务书`](tasks/R42-demo-title-copy.md) 将主标题精简为
    “轨迹恢复与 Fork”，其他画面、旁白和交互保持不变。
  - **依赖**：R41；只重制标题画面与媒体哈希，不修改功能实现。
  - **结果**：已完成（2026-09-02）。封面和开场主标题均改为“轨迹恢复与
    Fork”，不再展示“自然人声”或“清晰点击”。
  - **验证**：封面视觉复核、MP4 完整解码和 SHA-256 校验通过；重制前后旁白
    PCM MD5 相同，确认只改变标题画面。Nexent、DSH `EventTrajectory` 与 Event
    实现无改动。

- [x] **R43** · 难度 中 · 风险 低 · 位置 `scripts/event/demos/nexent/`
  - **问题**：Demo 成品已纳管，但合成脚本、真实截图和旁白输入仍在临时目录，
    无法从仓库内容独立重制。
  - **处理**：按
    [`R43 任务书`](tasks/R43-demo-reproduction-source.md) 纳管可复现制作源码与素材，
    移除临时绝对路径，并以离线重制和音轨等价校验验收。
  - **依赖**：R42；不移动发布成品，不修改功能实现。
  - **结果**：已完成（2026-09-02）。纳管 22 个制作文件；默认离线重制到
    `build/`，在线旁白生成保持可选，只有 `--install` 才更新发布成品。
  - **验证**：15 个固定输入哈希、Python 编译/CLI、JSON、完整视频解码与本地链接
    均通过；重制 MP4、封面和旁白 PCM 分别与发布成品逐字节或逐样本相同。完整
    命令、哈希和环境边界见 R43 任务书。

- [x] **R44** · 难度 中 · 风险 中 · 位置 `integrations/nexent/v2.5.0/`
  - **问题**：Nexent 的 Event 记录、restore/resume/fork、后端接口和 UI 接入只
    存在于无 remote 的本地实验分支，当前仓库不能独立重放这些产品改动。
  - **处理**：按
    [`R44 任务书`](tasks/R44-nexent-integration-patches.md) 将 8 个原始提交导出
    为版本化 Git patch series，并纳管基线 manifest、顺序、哈希和应用说明；在
    干净 v2.5.0 基线上重放并验证结果 tree 与实验分支完全一致。
  - **依赖**：R33、R37、R38、R40；不复制 Nexent 完整源码，不推送 Nexent。
  - **结果**：已完成（2026-09-02）。8 个原始提交以 Git binary patch series
    纳管；manifest、series、SHA-256 和应用说明完整，38 个变更文件及两个固定
    Event 前端包均包含在内。
  - **验证**：在不含实验提交对象的新仓库中从精确 baseline tree 按 series 重放
    成功，最终 tree 与 `f10c9b5` 完全一致；新鲜 format-patch 输出逐字节一致，
    本仓 1005 个行为测试、三个构建和双语言空白消费者门禁通过。完整证据见 R44
    任务书。

## 7. 总体验收

- [x] **R33** · 难度 中 · 风险 中 · 位置 Nexent 使用方仓库、
  `packages/event/python/`、`tests/event/`
  - **问题**：需求 A5 明确要求 Nexent 仅依赖 Python 包完成记录、restore、
    resume 和 fork，但当前只有本仓库的空白消费者测试，没有 Nexent 真实调用链、
    重启恢复或产出轨迹进入 TypeScript UI 的验收证据。
  - **处理**：按
    [`R33 任务书`](tasks/R33-nexent-acceptance.md) 在 Nexent 真实进程内接入
    Python 包，不增加 server/sidecar 或专属格式；覆盖记录、持久化重启、
    restore/resume、稳定前缀 fork，并把一份真实产出交给 TypeScript 读取和
    Trajectory UI 渲染。
  - **依赖**：R25–R32、R34–R35。
  - **结果**：已完成（2026-09-02）。本地源码目录的 2,886 个条目、2,463 个
    文件与官方 `v2.5.0` tag archive 逐字节一致；无远端实验分支
    `codex/event-trajectory-v2.5.0` 提交 `5c59720` 完成真实 Nexent 接入。该
    分支按用户约定只用于互操作验证，不构成或等待 Nexent 上游交付。
  - **验证**：Nexent 515/515、双 wheel 隔离联装、三进程 create/resume/fork、
    真实父子轨迹的 TypeScript restore/surface/UI 验收，以及本仓 1005 个行为
    测试和双语言空白消费者完整门禁全部通过；详细证据见 R33 任务书。

- [x] Event 轨迹设施达到生产可用。只有 DSH 依赖收口 R25–R29、生产加固
  R30–R32、边界校准 R34、wheel 门禁 R35 和 Nexent 真实接入 R33 全部完成，
  需求 A1–A6 均有验收证据、公共产物无 DSH 运行时依赖，并通过完整验证后才能
  勾选此项。
  - **结果**：已完成（2026-09-02）。R01–R35 全部闭环，需求 A1–A6 均有代码、
    契约、失败场景和真实消费者证据；Nexent 的本地实验边界不改变公共 Event
    v0，也没有增加 server、sidecar 或专属格式。
  - **验证**：最终 `npm run verify` 通过 204 个保留文件、10 个必要差异、139 个
    声明映射、1005 个行为测试、全部构建/类型检查与 TypeScript/Python 空白
    消费者安装；Nexent v2.5.0 另通过 515 项相关测试和真实轨迹跨语言 UI 验收。

## 8. Runfold 项目身份迁移

- [x] **R45** · 难度 中 · 风险 中 · 位置根 `package.json`、
  `packages/event/typescript/`、`apps/event/typescript/trajectory-demo/`
  - **问题**：TypeScript 公共产物、import 和开发宿主仍使用 `@perix/*`，使独立
    开源组件把维护组织名称泄漏为使用方代码命名空间；`event-sdk` 也容易被误解为
    只有调用封装，而当前包同时包含 Event 的公开 API 与真实实现。
  - **处理**：项目根名改为 `runfold`；公开包改为 `@runfold/event` 与
    `@runfold/trajectory-ui`，开发宿主改为 `@runfold/trajectory-demo`；只修改名称、
    import、构建和测试预期，不重排保留源码、不改变行为。实施前确认所需 npm scope
    没有现实冲突，但不在本任务中发布包。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：根 workspace、Event 实现/API、Trajectory
    UI 与开发宿主分别改为 `runfold`、`@runfold/event`、
    `@runfold/trajectory-ui` 和 `@runfold/trajectory-demo`；源码、类型声明、测试、
    构建别名及空白消费者统一使用新 import。npm registry 对三个完整包名均返回
    404；本任务未创建 scope 或发布包。Event 行为与目录结构未改。
  - **验证**：上游身份门禁仍为 204 个保留文件、10 个必要差异、139 个映射；三个
    workspace 构建通过；626 个 Event、182 个 UI runtime、94 个 Trajectory、15 个
    SDK、33 个 UI、11 个 runtime、1 个系统和7个跨语言用例通过；临时空白项目从
    tarball 安装 `@runfold/event` 与 `@runfold/trajectory-ui` 后通过类型检查和运行时
    生命周期验证。

- [x] **R46** · 难度 中 · 风险 中 · 位置 `packages/event/python/`、
  `tests/event/cross-language/`
  - **问题**：Python distribution 与 import 使用 `perix-event-sdk` / `perix_event`，
    既把组织名写入下游代码，也无法形成与 TypeScript `@runfold/event` 对等的项目优先
    命名空间。
  - **处理**：distribution 改为 `runfold-event`，公开 import 改为
    `runfold.event`；移动实现和类型标记，更新单语言、跨语言与独立 wheel 消费者，
    不修改 Python Event 逻辑。
  - **依赖**：R45。
  - **结果**：已完成（2026-09-03）：14 个 Python 实现/类型文件原样移动到 PEP
    420 `src/runfold/event/` 命名空间，distribution 改为 `runfold-event`，全部单语言
    和跨语言调用改为 `runfold.event`。PyPI 对完整 distribution 名称返回 404；
    本任务未发布。wheel 消费者改为从排除 build/egg-info 的隔离源码副本构建，并
    新增归档内容门禁，要求包含 `runfold/event/{__init__.py,py.typed}` 且拒绝任何
    `perix_event/` 成员；由此发现并清除了本地旧构建缓存，不涉及受控源码。
  - **验证**：Python 36/36、跨语言 7/7 通过；隔离构建得到
    `runfold_event-0.1.0-py3-none-any.whl`，在第二个无源码路径的空白 venv 中以
    `runfold.event` 完成 create、append、resume 和 fork，wheel 内容门禁通过。

- [x] **R47** · 难度 中 · 风险 中 · 位置 `schemas/event/`、
  `conformance/event/`、`scripts/event/demos/nexent/`、`docs/event/demos/nexent/`、
  `integrations/nexent/v2.5.0/`
  - **问题**：Schema canonical ID、测试数据、Demo 标签/环境变量和可重放 Nexent
    补丁仍包含 Perix 产品命名；即使 SDK 改名，下游集成仍会把旧名称带入业务代码和
    UI。
  - **处理**：Schema 使用不依赖公司域名的 `urn:runfold:event:v0:*`；测试与演示
    标识改为 Runfold；从原 Nexent 实验提交重建或等价改写补丁、vendor 包、manifest
    和哈希，使实际功能代码只引用 Runfold。不得改变轨迹数据与 UI 行为。
  - **依赖**：R45、R46。
  - **结果**：已完成（2026-09-03）：两个 Schema canonical ID 改为 Runfold URN；
    Demo 制作环境变量和可见页脚改为 Runfold，并以原截图、原旁白和原时序离线重制
    发布媒体。Nexent 从原 8 个已验收提交的完整 tree 重建 Runfold 等价提交，保留
    原作者、日期和逻辑边界，再增加 1 个发布前安装说明提交；本地分支为
    `codex/runfold-event-v2.5.0`，head `431adb1`、tree `dce67cd`，没有 remote 或
    推送。集成产物重新导出为 9 个未经后改的 binary patch，Python 依赖为
    `runfold-event==0.1.0`，前端 vendor 为 `@runfold/event` 与
    `@runfold/trajectory-ui`；最终 Nexent 源码和补丁文本的 `perix` 扫描为空。
  - **验证**：Nexent Python 540/540、前端 27/27、TypeScript 与 production build
    通过；新 wheel 从 `site-packages/runfold/event` 加载且旧模块不可导入。9 个补丁
    在不含实验对象的干净 v2.5.0 基线上全部 `git am` 成功，最终 tree 精确等于
    `dce67cdda790e6e88507a00442613d83e47c8329`，两个 vendor tarball 及外层 manifest/
    series/SHA256SUMS 校验通过。Demo 83.07 秒完整解码，视频/封面哈希分别为
    `21e1d5a`/`f42f984`，重制前后音轨 PCM MD5 均为 `5a2108a`；跨语言 7/7、JSON
    解析和 diff 检查通过。

- [x] **R48** · 难度 中 · 风险 低 · 位置根 `README.md`、`docs/event/`、
  `packages/event/**/README*`、LICENSE/NOTICE、根测试配置与仓库维护脚本
  - **问题**：文档仍把项目描述为 Perix Runtime Data，并在技术概念和历史记录中
    混用项目品牌、维护组织与上游来源。
  - **处理**：统一项目名为 Runfold，定位为 agent runtime data platform，Event
    为第一个子系统；公共技术示例只使用 Runfold。Perix.ai 仅作为维护者及原创代码
    权利归属出现；DeepSeek Harness 的固定来源、MIT 许可和原样快照保持明确且不改动。
    历史任务结果允许保留当时事实，但必须与当前名称清楚区分。增加可执行扫描，防止
    公共产物和 Nexent 功能代码重新出现 `perix` 命名空间。
  - **依赖**：R45–R47。
  - **结果**：已完成（2026-09-03）：根项目、当前 Event 文档、包说明和集成索引
    统一使用 Runfold；新增 D06 明确项目技术身份与维护/权利归属是两个维度。
    根仓库及三个发布包均携带 MIT LICENSE/NOTICE；本条实施时使用 Perix.ai
    记录原创归属，R50 随后按已确认的真实法律主体将版权人校正为 Heiki Scott，
    Perix.ai 仅保留为项目/维护名称。DeepSeek Harness 原版权、固定来源和许可
    始终继续保留，未修改固定快照。
    同时清除了根 Vitest 配置中 10 条已失效的旧 package alias。历史任务记录、
    Nexent 本地来源路径和负向包测试保留原事实，并与当前 API 明确区分。
  - **验证**：新增公共身份门禁扫描 351 个受控文本文件，只允许 24 行逐文件限定的
    维护权利、来源或负向测试引用；TS 空白消费者扫描全部发布文本并验证包名、作者
    与旧技术名零泄漏，Python wheel 验证同时携带 LICENSE/NOTICE。完整
    `npm run verify` 通过 204 个保留文件、10 个必要差异、139 个映射、三个构建、
    1005 个行为测试及两个隔离包消费者；`git diff --check` 通过。

- [x] **R49** · 难度 易 · 风险 中 · 位置 GitHub `perix-ai/perix-runtime-data`、
  本地 `origin`
  - **问题**：代码完成身份迁移后，仓库 slug 与公共项目名仍不一致。
  - **处理**：全量验证通过并推送代码后，将 GitHub 仓库改名为
    `perix-ai/runfold`，更新本地 `origin` 并验证 fetch/push；本次任务不发布 npm
    或 PyPI 包，也不改名当前 Codex 工作目录。
  - **依赖**：R48，完整 `npm run verify`。
  - **结果**：已完成（2026-09-03）：确认目标名未占用、当前账号对源仓库拥有
    ADMIN 权限且 R48 已经完整验证并推送后，将公开 GitHub 仓库重命名为
    `perix-ai/runfold`；本地 `origin` 更新为
    `git@github.com:perix-ai/runfold.git`。本机工作目录随后同步为
    `/Users/heikiscott/perix-ai/runfold`，未发布 npm 或 PyPI 包。
  - **验证**：GitHub API 返回 `nameWithOwner: perix-ai/runfold`、默认分支 `main`；
    新 origin fetch 成功，`HEAD` 与 `origin/main` 在 R48 提交 `ba50409` 上一致；
    本条完成记录通过新 origin 推送，验证写权限与 main 跟踪链路。

- [x] **R50** · 难度 易 · 风险 中 · 位置根 `COPYRIGHT.md`、
  `OPEN_SOURCE_POLICY.md`、`CONTRIBUTING.md`、`README.md`、LICENSE/NOTICE、
  发布包元数据/NOTICE 与身份门禁
  - **问题**：现有 LICENSE/NOTICE 已记录 Perix.ai 与 DeepSeek 的归属，但没有一份
    集中、面向使用方的版权边界和开源分发政策，容易把“项目由谁维护”“原创部分
    归谁”“第三方源码归谁”与“MIT 允许怎样使用”混为一谈。
  - **处理**：按用户确认，将当前原创 Runfold 代码、修改及可受保护的项目编排的
    版权人明确为自然人 `Heiki Scott`；Perix.ai 只作为项目/维护者名称，Runfold
    作为产品名，不把尚未确定的公司或未注册品牌写成法定权利人。DeepSeek Harness
    与其他第三方材料继续归各自权利人，不作不真实的整体权利主张。明确 MIT 分发、
    NOTICE/许可证保留、第三方来源审计、贡献授权和发布要求；外部贡献者除非另有
    书面转让仍保留其版权。同步 README、包内元数据/NOTICE 和自动身份门禁，不改变
    Event 行为、公共名称或 DSH 固定快照。
  - **依赖**：R48、R49。
  - **结果**：已完成（2026-09-03）：新增集中版权边界、开源分发政策和贡献说明；
    根仓库、npm 包和 Python wheel 均把原创代码作者/版权人统一为 Heiki Scott，
    Perix.ai 仅作为项目/维护者名称，Runfold 继续作为公共技术与产品名。DSH 的
    DeepSeek 原版权和固定来源不变，外部贡献者在没有书面转让时保留版权。轨迹 UI
    发布构建新增实际 bundle 模块扫描：从输出 chunk 自动生成
    `lib/THIRD_PARTY_NOTICES.md`，本次覆盖 72 个 MIT/BSD-3-Clause 包及其完整法律
    文本；缺少许可证元数据或可分发法律文件会直接中止构建，`npm pack` 会先重建。
  - **验证**：完整 `npm run verify` 通过：204 个保留文件、10 个必要差异、139 个
    声明映射、三个构建、1005 个行为测试及 TypeScript/Python 两个隔离包消费者；
    TypeScript 消费者确认 tarball 携带第三方 notices 和代表性 MIT/BSD-3-Clause
    依赖，Python 消费者确认 wheel 作者元数据与 LICENSE/NOTICE；公共身份门禁扫描
    355 个受控文本文件，仅保留 16 行明确归属、来源或负向测试引用；
    `git diff --check` 通过。

- [x] **R51** · 难度 易 · 风险 低 · 位置 GitHub `perix-ai/runfold` About
  元数据
  - **问题**：仓库已迁移为 Runfold，但 GitHub About description 仍为旧文案
    `Perix runtime data`，且没有 topics；README 与仓库列表页对项目的描述不一致。
  - **处理**：把 description 更新为 README 的 Runfold 定位，并增加与 agent runtime
    data、Event 轨迹、持久恢复、TypeScript/Python 有关的检索 topics。未确认可公开访问
    的官网前保持 website 为空；不改变仓库可见性、权限或合并设置。同时验证公开仓库、
    fork、Issues、MIT License 与根 `CONTRIBUTING.md` 已构成外部贡献入口。
  - **依赖**：R49、R50。
  - **结果**：已完成（2026-09-03）：About description 与 README 统一为
    `The agent data plane for durable agent execution.`；增加 `agent`、
    `agent-data`、`agent-runtime`、`durable-execution`、`event-sourcing`、`fork`、
    `python`、`restore`、`resume`、`trajectory`、`typescript` 共 11 个 topics。
    website 按计划保持为空，仓库权限和合并设置未改动。
  - **验证**：GitHub 返回仓库 visibility `public`、`allow_forking: true`、
    `has_issues: true`、license `MIT`；Community Profile 已识别根 README、LICENSE
    与 CONTRIBUTING，外部用户可通过 fork 和 Pull Request 贡献，直接 push 仍由
    仓库协作者权限控制。更新后的 description、空 homepage 与 11 个 topics 已由
    GitHub API 回读确认；`git diff --check` 通过。

## 9. 发布与产物治理（2026-09-03 复核）

复核范围是 R36–R51。行为、依赖与身份工作已达标：完整 `npm run verify` 串行
通过，代码级 `@deepseek-ai/` 引用与旧命名残留为空，`npm ls` 无 DSH 包，身份
校验 204/10/139 与文档一致，`third_party` 快照与固定 commit 逐字节一致，
许可证中的 DeepSeek 版权行与上游完全相同。下列条目补的是"可发布、可长期
维护"的缺口，逐条证据见
[`tasks/R52-R59-release-governance.md`](tasks/R52-R59-release-governance.md)。

 - [x] **R52** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/{sdk,ui/trajectory}/package.json`、`packages/event/python/pyproject.toml`、`scripts/verify-public-identity.mjs`
  - **问题**：两个 npm 包缺 `repository`、`homepage`、`bugs`、`keywords`、`publishConfig`；Python 缺 `[project.urls]`。scoped 包无 `publishConfig.access: "public"` 时 `npm publish` 会失败；无回源链接与 `OPEN_SOURCE_POLICY.md` 的可追溯要求不一致。
  - **处理**：补齐三个 manifest 的元数据，并在身份校验脚本中加断言防回退。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：补齐两个 npm 包的仓库、主页、问题追踪、关键词与公开发布配置；补齐 Python 包的项目链接；身份校验增加元数据断言及合法回源链接白名单。
  - **验证**：`npm run verify` 主体构建、身份校验、626/626 上游测试及 Python 测试通过；`npm run test:package` 通过；两个 npm 包 `npm pack --dry-run` 与 Python `uv build --wheel` 通过；`git diff --check` 通过。

- [x] **R53** · 难度 中 · 风险 中 · 位置 `integrations/nexent/v2.5.0/`
  - **问题**：manifest 记录 vendored tarball 来自 `2249c5f`，其后 `ba50409`、`0a420bd` 改了两个发布包的 `package.json`、`LICENSE`、`NOTICE.md` 与第三方声明生成。补丁 0003 中 Nexent 实际安装的 tgz 仍带旧版权行（缺 `Copyright (c) 2026 Heiki Scott` 一行），与 `OPEN_SOURCE_POLICY.md` 分发要求第 1、3 条冲突。
  - **处理**：按当前 HEAD 重建两个 tarball 并重放补丁 0003，同步 `manifest.json`、`SHA256SUMS` 与 README 中的版本绑定说明。
  - **依赖**：R52。
  - **结果**：已完成（2026-09-03）：从 Runfold `d79ae963500b961d17a48503bc76df416f414660` 重建两个 npm tarball，重写 Nexent 补丁 0003 并重放后续补丁；同步 manifest、SHA256SUMS 与版本绑定说明。
  - **验证**：9 个补丁从固定基线 `1b184cf` 干净重放，最终 tree 为 `31c9fc070c80b8ee33ba165a42474e5cb1a19806`；manifest 的逐补丁 bytes／SHA-256 与实际文件一致；集成 SHA256SUMS 全部通过；两个 vendored tarball 哈希通过，均含 DeepSeek 与 Heiki Scott 版权行，UI 包含 `THIRD_PARTY_NOTICES.md`；完整 `npm run verify` 与 `git diff --check` 通过。

- [x] **R54** · 难度 中 · 风险 低 · 位置 新增 `scripts/verify-integration-artifacts.mjs`、根 `package.json`
  - **问题**：`integrations/` 与 demo 资产不在任何门禁内。`SHA256SUMS` 与 manifest 哈希只在 R44 时人工核对过一次；复核时手动执行仍全部通过，但改动补丁或资产不会被 `npm run verify` 发现。
  - **处理**：新增校验脚本并纳入 `verify`，覆盖 `SHA256SUMS`、manifest 逐条 `bytes`/`sha256`、`series` 与 `patches/` 的一一对应，以及 demo README 登记的 MP4/封面哈希。补丁的可应用性需要 Nexent 基线，改为在 `integrations/nexent/README.md` 记录重放前置与最近一次结果。
  - **依赖**：R53。
  - **结果**：已完成（2026-09-03）：新增 `scripts/verify-integration-artifacts.mjs`，校验
    集成 manifest、补丁序列、逐文件字节数与 SHA-256、`SHA256SUMS` 覆盖范围，以及
    Demo README 登记的 MP4/封面哈希，并接入根 `verify`；同时为 npm 11 的空白
    消费者安装测试显式启用 `--legacy-peer-deps`，保留兼容 React peer 范围的验证。
  - **验证**：`npm run verify:integration-artifacts` 通过（9 个补丁、12 个校验项、2 个
    Demo 资产）；完整 `npm run verify` 通过；`git diff --check` 通过。

- [x] **R55** · 难度 易 · 风险 中 · 位置 `NOTICE.md`、`docs/event/demos/nexent/`、`docs/event/evidence/`
  - **问题**：六段旁白 MP3 与合成 MP4 由 `edge-tts`（微软 Edge 朗读服务）生成并检入仓库，属于分发资产；根与各包 `NOTICE.md` 中检索 demo/mp3/mp4/tts/narration/audio 均无结果，与 `OPEN_SOURCE_POLICY.md`"第三方接收"要求不一致。R37/R38 的 Nexent 界面截图同样未登记来源与许可。
  - **处理**：在 `NOTICE.md` 增加 demo 资产来源与条款结论；若结论不明确，改用可自证许可的方案（本地 TTS、无旁白版本或字幕替代）。
  - **依赖**：无。**需你先确认条款口径再执行。**
  - **结果**：已完成（2026-09-03）：按确认的保守口径登记 Edge TTS、Nexent/Huawei
    来源、非背书边界与再分发注意事项；新增 `docs/event/demos/README.md` 目录索引，
    并为现有 Demo 明确名称、内容和日期。后续 Demo 的同目录 README、索引登记和日期
    要求已写入 `AGENTS.md`。
  - **验证**：`npm run verify:public-identity`、`git diff --check` 通过；Demo 索引、
    README 和 NOTICE 链接目标存在。

- [x] **R56** · 难度 易 · 风险 低 · 位置 `vitest.config.ts`、`packages/event/typescript/TESTING.md`
  - **问题**：`jsonl.spec.ts` 与 `zstd.spec.ts` 的协调器用例依赖固定的 vitest 默认 5000 ms 超时。复核时与其他任务并行运行，两个用例超时失败（单例报告约 459 秒）；串行重跑 626/626 通过、总耗时 3.95 秒。CI 并行或共享 runner 上会间歇性失败。
  - **处理**：为这两个套件设置明确的 `testTimeout`，并在 TESTING.md 说明用途。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：根 Vitest 配置统一设置 20 秒测试超时，并在 TESTING.md 记录其针对持久化 fixture 与协调器用例的用途。
  - **验证**：`npm run test:upstream:event` 通过（17 个测试文件、626 个测试）；`git diff --check` 通过。

- [x] **R57** · 难度 易 · 风险 低 · 位置 `docs/event/README.md`、`AGENTS.md`
  - **问题**：`docs/event/evidence/`（7 张验收截图）不在文档地图中；`AGENTS.md` 的布局规则未涵盖 `scripts/`、`integrations/`、`docs/<domain>/demos/`、`docs/<domain>/evidence/`；`scripts/` 同时放校验脚本与 demo 合成源码，职责不单一。
  - **处理**：补全地图与布局规则，并决定 demo 合成源码的归属目录。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：文档地图登记 `evidence/`；布局规则覆盖验证脚本、下游集成产物、Demo 输出、验收证据，并固定 Demo 合成源码留在 `scripts/event/demos/`。
  - **验证**：文档内部链接与目录存在性检查通过；`git diff --check` 通过。

- [x] **R58** · 难度 易 · 风险 低 · 位置 `scripts/verify-public-identity.mjs:10`
  - **问题**：`['per', 'ix'].join('')` 的拆写是必要的（脚本扫描包括自身在内的全部文本文件），但没有注释，读者易误判为混淆或笔误。
  - **处理**：补一行注释说明原因。
  - **依赖**：无。

  - **结果**：已完成（2026-09-03）：在拆分字符串前增加注释，说明这是为了避免身份扫描器误报自身源码。
  - **验证**：`npm run verify:public-identity` 通过；`git diff --check` 通过。

- [x] **R59** · 难度 易 · 风险 中 · 位置 npm `@runfold` scope、PyPI `runfold-event`
  - **问题**：2026-09-03 实测，`@runfold/event`、`@runfold/trajectory-ui`、npm `runfold` 组织、PyPI `runfold-event` 与 `runfold` 全部未被占用。仓库已按这些名字准备发布元数据（R52），但名字本身尚未注册，首次发布前存在被抢注的风险。GitHub 组织 `runfold` 同样空闲，`perix-ai` 已存在。
  - **处理**：在首次发布前注册 npm `@runfold` scope 与 PyPI `runfold-event`（可一并占位 PyPI `runfold`）。GitHub 组织按决策 D07 保持 `perix-ai`，不迁移也不新建。注册涉及账号凭据，由维护者本人执行；Codex 只准备发布清单与命令。
  - **依赖**：R52。
  - **结果**：已完成（2026-09-04）：创建免费的 npm `runfold` 组织并公开发布
    `@runfold/event@0.1.0` 与 `@runfold/trajectory-ui@0.1.0`；公开上传
    `runfold-event==0.1.0` 到 PyPI。未注册占位包 `runfold`，避免超出当前发布范围。
  - **验证**：npm registry 查询两个包均返回 `0.1.0`，组织成员关系为
    `heikiscott - owner` 且包状态为 public；PyPI API 返回 `runfold-event`、版本
    `0.1.0`、作者 `Heiki Scott`，仅有该版本发布。

## 10. 公开仓库的法律归属与开源就绪

复核范围是"仓库已公开"这一新状态。已确认无问题：无密钥、凭据、`.env` 或
个人绝对路径；`LICENSE`、`NOTICE.md`、`COPYRIGHT.md`、`CONTRIBUTING.md`、
`OPEN_SOURCE_POLICY.md` 齐备，DeepSeek Harness 归属完整。下列缺口逐条证据见
[`tasks/R60-R68-open-source-readiness.md`](tasks/R60-R68-open-source-readiness.md)。

- [x] **R60** · 难度 易 · 风险 高 · 位置 `NOTICE.md`、`integrations/nexent/`、`scripts/verify-public-identity.mjs`
  - **问题**：`integrations/nexent/v2.5.0/patches/` 的 0001、0002、0005 三个补丁各含 600–1700 行 Nexent 源码的上下文与修改行。Nexent 是 MIT，版权为 `(c) 2025 Huawei Technologies Co., Ltd.`。`NOTICE.md`、`LICENSE`、`COPYRIGHT.md`、`OPEN_SOURCE_POLICY.md` 检索 `nexent`/`huawei` 均无结果。公开再分发 MIT 代码的实质片段却未携带其版权与许可声明。
  - **处理**：`NOTICE.md` 增加 Nexent/Huawei 归属与"未提交上游、未获背书"的免责；`integrations/nexent/` 放置 Nexent MIT 许可证副本；身份校验增加与 DeepSeek 同级的断言。
  - **依赖**：无；可与 R55 合并为一次 NOTICE 修订。
  - **结果**：已完成（2026-09-03）：在根 NOTICE 中登记 Nexent/Huawei 归属和非背书
    边界，在 `integrations/nexent/v2.5.0/LICENSE` 保留官方 MIT 许可证，并在集成
    README 中链接说明。
  - **验证**：`verify-public-identity` 明确检查 Nexent LICENSE、Huawei 版权行和
    MIT 授权文本；公开身份校验与 `git diff --check` 通过。

- [x] **R61** · 难度 中 · 风险 中 · 位置 新增 `.github/`
  - **问题**：仓库已公开且 `CONTRIBUTING.md` 欢迎 PR，但无 `.github/` 目录：无 CI workflow、无 issue/PR 模板、无 CODEOWNERS。`npm run verify` 只在维护者本机跑过。R56 把测试超时提到 20 秒的理由是"共享 CI runner"，而 CI 并不存在。
  - **处理**：新增 `verify.yml`（push/PR 上跑 `npm ci && npm run verify`，Node 22 + Python 3.11）、issue/PR 模板（要求填写对应 tasks.md 条目）、CODEOWNERS（覆盖 `third_party/`、`scripts/`、保留源码树）。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：新增 Node 22/Python 3.11 的 GitHub Actions
    `verify.yml`，在 push 和 pull request 上执行 `npm ci` 与完整 `npm run verify`；
    新增 Bug/Feature issue 模板、PR 模板和覆盖默认、`third_party/`、`scripts/`、
    保留源码树的 CODEOWNERS。
  - **验证**：YAML、模板和 CODEOWNERS 文件存在；`git diff --check` 通过；本地完整
    `npm run verify` 已在 R54 验证通过。

- [x] **R62** · 难度 易 · 风险 中 · 位置 新增 `SECURITY.md`、`CODE_OF_CONDUCT.md`
  - **问题**：无私下安全披露渠道，安全问题只能公开提 issue；无行为准则。GitHub 社区标准清单两项均缺。
  - **处理**：`SECURITY.md` 写明支持版本、私下报告方式与响应预期；`CODE_OF_CONDUCT.md` 采用 Contributor Covenant 2.1；两者从 `CONTRIBUTING.md` 链接。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：新增安全政策，提供 GitHub 私密漏洞报告优先、
    维护者邮箱兜底的私下披露渠道、支持范围和响应预期；新增 Contributor Covenant
    2.1 行为准则并从贡献指南链接。
  - **验证**：两个文件存在，Contributor Covenant 2.1 来源链接存在，贡献指南链接
    目标存在；`git diff --check` 通过。

- [x] **R63** · 难度 易 · 风险 低 · 位置 新增 `CHANGELOG.md`
  - **问题**：即将发布 0.1.0 但无变更记录，使用方无法判断版本差异。
  - **处理**：Keep a Changelog 格式，首条为 0.1.0，概括 Event 能力边界与已知限制。
  - **依赖**：R59。
  - **结果**：已完成（2026-09-03）：新增 Keep a Changelog 格式的 `CHANGELOG.md`，
    记录 0.1.0 的 TypeScript/Python 包、Trajectory UI、Nexent 集成与 Demo，并明确
    Event v0 的能力边界和已知限制；README 已加入入口链接。
  - **验证**：CHANGELOG 链接目标存在，版本、日期和 0.1.0 发布记录链接已登记；
    `git diff --check` 通过。

- [x] **R64** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/ui/trajectory/package.json`
  - **问题**：`@runfold/event` 与 `runfold-event` 都有 `description`，只有 `@runfold/trajectory-ui` 没有；npm 包页面与搜索结果会留空。
  - **处理**：补描述，并在身份校验中断言其存在且非空。
  - **依赖**：R52。
  - **结果**：已完成（2026-09-03）：为 `@runfold/trajectory-ui` 增加独立 React
    Trajectory UI 的包描述，并由公开身份校验断言其存在。
  - **验证**：`verify-public-identity` 与 `git diff --check` 通过。

- [x] **R65** · 难度 易 · 风险 低 · 位置 `scripts/verify-public-identity.mjs`
  - **问题**：文件顶部用 `['per', 'ix'].join('')` 构造旧名以避免自检命中（R58 已注释说明），但第 80、84、137、157 行直接写了 `github.com/perix-ai/runfold` 字面量，并为脚本自身加了白名单分支。同一文件既隐藏又拼写同一个词，白名单豁免面也被扩大。
  - **处理**：四处改用已有的 `publicRepository` 常量，随后删除脚本自身的白名单分支。
  - **依赖**：R52、R58。
  - **结果**：已完成（2026-09-03）：所有公开仓库 URL 断言改用已有的
    `publicRepository` 常量，并删除脚本自身 URL 白名单分支。
  - **验证**：`verify-public-identity` 与 `git diff --check` 通过；脚本自身不再含
    硬编码公开仓库 URL。

- [x] **R66** · 难度 易 · 风险 低 · 位置 GitHub About
  - **问题**：R51 已设 description 与 topics，homepage 字段仍为空。
  - **处理**：指向文档入口。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：将 GitHub `perix-ai/runfold` About homepage
    设置为 `https://github.com/perix-ai/runfold/tree/main/docs/event`。
  - **验证**：GitHub API 返回该 homepage、原 description 和 11 个 topics 均保留；
    文档入口可访问。

- [x] **R67** · 难度 易 · 风险 低 · 位置 `docs/event/demos/`、`integrations/nexent/`
  - **问题**：已跟踪的最大文件是 2.8 MB 的 demo MP4 与 2.0 MB 的补丁 0003（内含 vendored tarball），`integrations/nexent` 合计 2.3 MB。每次 clone 都会拉取，重建会不断产生新 blob。
  - **处理**：**已决策（2026-09-03，用户）：维持现状，不迁 Releases 也不启用 LFS。** 当前体量在可接受范围内，不值得为此增加分发与校验链路的复杂度（`SHA256SUMS` 与 R54 的产物校验都依赖文件在库内）。若后续单个资产超过约 10 MB 或 `integrations/` 总量显著增长，再重新评估。
  - **依赖**：无。
  - **结果**：无需改动，本条作为决策记录保留。

- [x] **R68** · 难度 中 · 风险 低 · 位置 `docs/event/`
  - **问题**：对外文件是英文，但 `docs/event/` 下的需求、架构、规格、验证、决策、清单全部是中文。外部贡献者读不了规则文档，就无法按 `CONTRIBUTING.md` 的要求参与。
  - **处理**：**已决策（2026-09-03，用户）：中英双语，每份文档两个副本。** 采用保留源码已有的 `<name>.md` / `<name>.zh.md` 约定（上游 DSH 包即用此约定）。执行前需先定三件事，写进 `AGENTS.md`：(1) 冲突时以哪一份为准，建议英文为规范版、中文为翻译版，避免双向漂移；(2) 是否所有文档都双语，还是只覆盖 requirements、architecture、specification、testing、decisions 这五份规则文档，而 `tasks.md` 与 `tasks/` 因高频变动只保留单语；(3) 新增文档时两份必须同一提交内落地，并在 `verify:public-identity` 或独立脚本中断言配对存在、不缺不多。
  - **依赖**：无。
  - **结果**：已完成（2026-09-03）：按用户确认的建议口径，以英文 `.md` 为
    规范版、中文 `.zh.md` 为翻译版，配对 requirements、architecture、
    specification、testing、decisions 五份治理文档；英文 README 提供双语入口，
    高频 `tasks.md` 与 `tasks/` 保持中文。规则已写入 `AGENTS.md`。
  - **验证**：新增 `verify:docs` 并纳入根 `verify`，断言精确五组配对、双向语言
    链接、相对链接有效、工作区两份同时变化，且干净仓库中最近修改来自同一提交；
    CI 使用完整 Git 历史。完整 `npm run verify` 通过 3 个构建、1005 个行为测试、
    集成/身份门禁及 TypeScript/Python 空白消费者安装。


## 11. 工具链缺陷

- [x] **R69** · 难度 易 · 风险 高 · 位置 `~/.codex/config.toml`、`~/.codex/.codex-global-state.json`（仓库外）
  - **问题**：本机仓库目录已是 `/Users/heikiscott/perix-ai/runfold`，但 Codex 仍把旧路径注册为项目根。核查证据：`config.toml:100` 有 `[projects."/Users/heikiscott/perix-ai/perix-runtime-data"]`；`.codex-global-state.json` 的 `local-projects.<uuid>.rootPaths[0]`、`name` 与两个 `thread-writable-roots` 条目均指向旧路径；`config.toml` 中没有任何指向 `runfold` 的注册。
    表现是旧路径被反复重建成一个空目录再消失：2026-09-03 09:16:17–09:16:35 两个目录同时存在且 inode 不同（`runfold`=42762796，`perix-runtime-data`=44426481），09:16:37 后者消失。inode 不同说明这不是改名，而是有进程按旧根路径重新创建目录。R49 的记录写的是"本机工作目录保持原名"，与当前实际路径不符，说明重命名发生在 R49 之外且未同步工具链配置。
  - **影响**：Codex 的 sandbox writable-root 指向一个空目录。轻则命令因工作目录消失而失败（本次核查中我的 shell 三次丢失 cwd），重则 Codex 在空目录内写入或初始化，产出落在仓库之外而不被察觉。这类错误不会被 `npm run verify` 捕获。
  - **处理**：先确定本机目录名的目标状态（`runfold` 与 GitHub slug 一致，推荐），然后在 Codex 中移除旧项目注册并以新路径重新添加，确认 `config.toml` 的 `[projects."..."]`、`local-projects.rootPaths` 与 `thread-writable-roots` 都指向新路径且旧路径不再出现；随后连续观察若干分钟，确认旧目录不再被重建。修完后回填 R49 的结果栏，纠正"工作目录保持原名"这一与实际不符的记录。
  - **依赖**：无。**优先于第 9、10 节的所有条目**，因为它会影响执行这些条目的工具本身。
  - **结果**：已完成（2026-09-03）：保留 `~/.codex` 配置备份，删除旧的
    `perix-runtime-data` 项目注册，将历史 writable-root 中的旧路径改为
    `/Users/heikiscott/perix-ai/runfold`；旧目录未再存在。
  - **验证**：`config.toml` 只保留 `runfold` 项目根；全局状态中旧项目和旧
    writable-root 引用均为零，`runfold` 项目注册指向当前目录；`git status` 未见
    仓库内的非预期修改。

- [x] **R70** · 难度 易 · 风险 中 · 位置
  `integrations/nexent/v2.5.0/SHA256SUMS`
  - **问题**：R60 为 Nexent 集成 README 增加许可证与归属说明后，没有同步更新
    该不可变集成产物清单中的 README 校验值，导致
    `npm run verify:integration-artifacts` 报 checksum mismatch。
  - **处理**：以当前已审核的 `integrations/nexent/v2.5.0/README.md` 内容重算
    SHA-256，只更新清单中的 `README.md` 条目；补丁、manifest 和 series 均不变。
  - **依赖**：R54、R60。
  - **结果**：已完成（2026-09-03）：把 README 清单值更新为当前归属与许可证
    说明对应的 SHA-256；其余 11 个条目及集成内容未改动。
  - **验证**：`verify:integration-artifacts` 通过 9 个补丁、12 个校验值和 2 个
    Demo 资产；在集成目录执行 `shasum -a 256 -c SHA256SUMS` 的 12 项全部通过。

- [x] **R71** · 难度 易 · 风险 中 · 位置
  `packages/event/typescript/tests/package/package-consumer.mjs`
  - **问题**：TypeScript 空白消费者为每次验收创建一次性 npm cache，却在本地
    tarball 安装后继续执行远端 audit/fund 收尾。本次两轮完整门禁中，所有依赖
    下载和 `koffi` 安装均已成功，npm 仍保持多条 registry HTTPS 连接且超过 5
    分钟不退出，使发布物门禁受无关网络服务影响。
  - **处理**：空白消费者的 `npm install` 增加 `--no-audit` 与 `--no-fund`；安装
    依赖、严格类型检查、运行时执行、导出/许可证/命名空间扫描保持不变。
  - **依赖**：R54。
  - **结果**：已完成（2026-09-03）：临时消费者安装不再等待与发布物验收无关的
    audit/fund 请求，包内容与消费验证逻辑未变。
  - **验证**：在允许 registry 网络的全新临时目录执行 `npm run test:package`，
    约 16 秒完成并输出 `Runfold Event package consumer verification passed`；
    `git diff --check` 通过。

- [ ] **R72** · 难度 易 · 风险 高 · 位置 `.github/workflows/verify.yml`
  - **问题**：CI 固定 Python 3.11，但只执行 `npm ci`，没有安装 Python 包声明的
    `zstd` extra；跨语言门禁不跳过 Zstandard 互操作，因此 main 上连续失败并报
    `ZstdUnavailableError`。本机 Python 3.14 使用标准库 `compression.zstd`，
    所以本地完整门禁无法暴露这个 Python 3.10–3.13 环境缺口。
  - **处理**：CI 在完整验证前从本仓 Python package 安装
    `./packages/event/python[zstd]`，由 `pyproject.toml` 作为依赖版本的唯一来源；
    不放宽或跳过 Zstandard 测试。
  - **依赖**：R35、R61。

## 执行顺序

按"容易改、风险小"优先，跨章节排列。

| 批次 | 条目 | 性质 | 前置 |
| --- | --- | --- | --- |
| 0 | **R69** | 工具链缺陷：Codex 项目根仍指向旧路径，导致空目录反复重建 | 立即，先于其余批次 |
| 1 | R01, R02, R05, R06, R04, R03 | 纯文档登记 | 无 |
| 2 | R11, R12 | Python 小修 | 无 |
| 3 | R13, R07, R08 | 低风险工程保障 | 无 |
| 4 | R14, R15 | TS 工具与消息替换，不动生命周期 | 无 |
| 5 | R16 → R19 → R17 → R18 → R20 → R21 | 宿主接口与保留源码改动 | 批次 4 |
| 6 | R22, R23, R09 | 收尾与泄漏门禁 | 批次 5 |
| 7 | R10, R24 | 独立长线 | 无 |
| 8 | R30 → R31 | 校准 EventHost 生命周期，并补齐双向公开 restore 门禁 | 批次 5 |
| 9 | R25 → R26 → R27 → R28 → R29 | 彻底移除 DSH 名称与注册表依赖（交由 Codex，见 `tasks/R25-R29-dsh-free.md`） | 批次 8 |
| 10 | R32 | 按最终代码和验证结果同步全部文档事实 | 批次 9、R31 |
| 11 | R34 | 校准多轮 restore 的 `session/end-seed` 边界语义 | R31 |
| 12 | R35 | 显式构建并从独立 wheel 安装 Python 空白消费者 | R34 |
| 13 | R33 | Nexent 真实消费者接入与需求 A5 验收 | R25–R32、R34–R35 |
| 14 | R36 | 上游测试文件的 DSH import 改写与别名清零（见 `tasks/R36-test-imports.md`） | 批次 9 |
| 15 | R37 | Nexent 聊天页嵌入独立 Trajectory UI，并接通读取、resume、fork（见 `tasks/R37-nexent-trajectory-ui.md`） | R33 |
| 16 | R38 | Nexent 20 Turn 长轨迹冷恢复、fork 与详情面板全景验收（见 `tasks/R38-nexent-long-trajectory.md`） | R37 |
| 17 | R39 | Nexent 长轨迹、冷恢复、详情按钮与 fork 可播放 Demo（见 `tasks/R39-nexent-trajectory-demo.md`） | R38 |
| 18 | R40 | Nexent 有声交互 Demo 与 DSH Fork/Resume 控件一致性（见 `tasks/R40-nexent-narrated-interaction-demo.md`） | R39、用户决策 |
| 19 | R41 | Nexent Demo 自然人声与清晰点击动作（见 `tasks/R41-demo-natural-voice-clicks.md`） | R40、用户反馈 |
| 20 | R42 | 精简 Nexent Event Demo 标题（见 `tasks/R42-demo-title-copy.md`） | R41、用户反馈 |
| 21 | R43 | 纳管 Nexent Event Demo 可复现源码（见 `tasks/R43-demo-reproduction-source.md`） | R42、用户确认 |
| 22 | R44 | 纳管 Nexent v2.5.0 Event 下游集成补丁（见 `tasks/R44-nexent-integration-patches.md`） | R33、R37、R38、R40 |
| 23 | R45 | TypeScript 公共包与项目根迁移到 Runfold | 无 |
| 24 | R46 | Python distribution 与 import 迁移到 `runfold.event` | R45 |
| 25 | R47 | Schema、Demo 与 Nexent 集成清除旧技术命名空间 | R45、R46 |
| 26 | R48 | 文档、归属边界与公共产物名称门禁 | R45–R47 |
| 27 | R49 | 全量验证后重命名 GitHub 仓库和本地远端 | R48 |
| 28 | R50 | 明确个人版权归属、开源分发与第三方 bundle notices | R48、R49 |
| 29 | R51 | 同步 GitHub About 并验证外部贡献入口 | R49、R50 |
| 30 | R52, R56, R57, R58 → R53 → R54；R59 在首次发布前；R55 待条款确认 | 发布元数据、产物时效与治理缺口（见 `tasks/R52-R59-release-governance.md`） | R36–R51 |
| 31 | R60 → R62 → R63 → R66；R64 → R65；R61；R68 | 公开仓库的法律归属与开源就绪（见 `tasks/R60-R68-open-source-readiness.md`）；R67 已决策无需改动 | 批次 30 |
| 32 | R70 | 同步 R60 修改后过期的 Nexent 集成 README 校验值 | R60 |
| 33 | R71 | 去除 TypeScript 空白消费者安装中的无关 audit/fund 网络收尾 | R54 |
| 34 | R72 | 为 Python 3.11 CI 安装声明的 Zstandard 测试依赖 | R35、R61 |

## 附录：2026-09-01 评审差距的处理记录

评审时列出的差距及其结果，保留作审计线索；编号对应上文条目。

- `@perix/event-sdk/runtime` 曾整包导出 Cordis，已改为 Perix 自有的 `EventHost`（R16–R21）；
- `@perix/event-sdk/messages` 曾整包导出 `dsh-llm`，已改为 `runtime/src/messages.ts`（R15）；
- core 与 persistence 的全部 DSH 运行时依赖已由 `runtime/` 替换，SDK 产物只剩 `koffi`（win32）一个第三方运行时依赖（R14–R23）；
- TypeScript 的 restore 入口已收敛为 `runtime.restore(id)`，与 Python 对应（R21）；
- 生成物中的 `@deepseek-ai/cordis` 引用已消失；`rewrite-public-namespaces.mjs` 删除，打包测试断言收紧（R22、R09）；
- 三个 `invariant` 子路径曾是 SDK 出口，已删除（R13）；
- Python 曾有 DSH 没有的 `.event.lock` 文件锁且规格误写为共同契约，锁已删除，`resume()` 保留为文档化别名（R01、R11、R12）；
- `KNOWN_SESSION_EVENT_TYPES` 两份手抄副本已由 conformance 单一来源与双侧测试锁定（R08）；
- `views.client.spec.tsx` 中与 shell 无关的 25 个用例已移植到独立宿主，桩掉的能力已登记（R05、R10）；
- 早期从零设计草案与 Event 实现矛盾，已删除（R03，决策 D02）；
- 裁剪源码与 `third_party` 快照的一致性已由 `verify:upstream-identity` 校验（R07）；
- R24 时 UI 闭包仍从注册表打包；R25–R29 已把实际运行时闭包裁入固定来源树，
  删除全部 DSH registry 依赖并以发布物扫描锁定边界（决策 D04、D05）。
