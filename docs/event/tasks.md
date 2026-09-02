# Event 抽离实施清单

本清单落实 [`README.md`](README.md) 中的目标和约束。完成标记必须以代码、
测试或打包验证为依据；仅创建目录或 API 占位不算完成。

> 总体状态：**进行中**。目录组织、Python 实现、跨语言契约和当前测试矩阵
> 已完成；TypeScript 的 DSH/Cordis 解耦仍有未完成项，因此 Event 抽离尚不能
> 标记为生产可用。

## 条目格式

带 `R` 编号的条目来自 2026-09-01 的系统性评审，统一使用以下模板：

```text
- [ ] **R00** · 难度 易/中/难 · 风险 低/中/高 · 位置 <文件或目录>
  - **问题**：当前是什么状态，为什么不符合目标。
  - **处理**：要做成什么样。
  - **依赖**：前置条目；无则写"无"。
```

**执行顺序不按重要性，而按"容易改、风险小"优先**，见文末"执行顺序"表。

## 1. 文档与基线

- [x] 将 Event 专属文档统一到 `docs/event/`。
- [x] 固定 DSH 来源版本、抽离原则、非目标和完成标准。
- [x] 记录 TypeScript 与 Python 的公共 API、持久化格式和行为映射。
- [x] 为每项必要偏离保留来源、理由和回归测试。

- [x] **R01** · 难度 易 · 风险 低 · 位置 `docs/event/contract.md`
  - **问题**：第 76 行把 advisory file lock 写成了 TS/Python 共同契约。DSH 的
    JSONL 后端没有任何文件锁（`session-persistence-jsonl/src` 中无
    flock/lock 逻辑），锁只存在于 Python。
  - **处理**：改为"Python-only 扩展，TypeScript 不参与该锁协议"；若 R11 决定
    删锁，则整段删除。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：删除锁段落，改为"两种实现都不使用跨进程文件锁，与 DSH 一致"。

- [x] **R02** · 难度 易 · 风险 低 · 位置 `docs/event/contract.md` 行为接口映射表
  - **问题**：表格只写了"共同语义"，读者会把"逻辑等价"误读为"API 等价"。
    TS 独有：write-behind 批处理、`SessionPreparation`/`prepare`、
    `listSnapshots`、带 `AbortSignal` 的 `inspect`、borrowed live source。
    Python 独有：`resume()`（目前只是 `restore()` 的别名）。
  - **处理**：表格增加"仅某一语言提供"一列，逐项标注。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：新增"仅单侧提供的接口"表。

- [x] **R03** · 难度 易 · 风险 低 · 位置 根 `README.md`、`rfcs/0001`、`spec/`、`schemas/v0`、`conformance/cases`、`conformance/fixtures/v0`
  - **问题**：这些文件描述另一套模型（namespace、event_id、seq 从 1 起、经
    Checkpoint fork 且"父事件不得复制"），与 DSH Event 模型（seq 从 0 起、
    fork 复制前缀、无 namespace）矛盾；根 README 仍称 RFC 0001 为
    "current model"。
  - **处理**：给上述文件加状态标记（draft / not implemented by Event）；根
    README 改为指向 `docs/event/`。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：按决策直接删除 `spec/`、`rfcs/`、`schemas/v0`、`conformance/cases`、`conformance/fixtures`、`adapters/`、`docs/architecture.md`、`docs/invariants.md`；根 README、`schemas/README.md`、`conformance/README.md` 改为只描述 Event。

- [x] **R04** · 难度 易 · 风险 低 · 位置 `third_party/deepseek-harness/README.md`
  - **问题**：声称快照包含 Trajectory 依赖闭包，但 `dsh-client-ui-primitives`、
    `dsh-client-store`、`dsh-client-ui-slots`、`dsh-api-session-controller`
    等只以注册表包形式被引用并打进 UI bundle。
  - **处理**：二选一——补入快照，或如实列出"仅注册表引用"的包清单。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：按决策补入 24 个上游目录（含 `vendor/cordis`、`vendor/schemastery`），逐字节校验通过；README 按用途分三组列出。

- [x] **R05** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/ui/trajectory/README.md`、`packages/event/typescript/TESTING.md`
  - **问题**：独立宿主用 `as never` 桩掉了 `useSessions`、`useWorkspaces`、
    `useSessionPendingInteraction`，`renderSlot` 返回 null，`viewRequest`
    恒为 null；被排除的上游测试只写在 `vitest.config.ts` 注释里。
  - **处理**：README 列出"已知不可用的 DSH Trajectory 能力"；TESTING.md 列出
    被排除的 `views.client.spec.tsx`、`client-bundle.client.spec.ts` 为
    已知缺口。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：UI README 新增 "Known limitations of the standalone host"，TESTING.md 新增 "Known gaps"。

- [x] **R06** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/packages/client/ui-trajectory/package.json` 等非 workspace 保留包
  - **问题**：这些 manifest 不参与构建，却把 `workspace:^` 改成了一整套注册表
    版本依赖，是"死清单"。
  - **处理**：二选一——恢复为上游原样并在 TS README 标注"仅审计用途"，或把
    它们接入 workspaces 与构建。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：`package.json` 恢复上游原样；`tsconfig.json` 必须保留本地版本（Vite 读取最近的 tsconfig，上游 `references` 指向不存在的目录），已在 TS README 登记为例外。

## 2. 仓库组织

- [x] 可复用实现统一放在 `packages/event/<language>/`，采用项目优先、语言其次的结构。
- [x] 开发宿主放在 `apps/event/typescript/trajectory-demo/`，不混入可发布库。
- [x] 单语言测试随实现放置，跨语言测试统一放在 `tests/event/cross-language/`。
- [x] 共享 schema 与 conformance 数据分别放在 `schemas/event/` 和 `conformance/event/`。
- [x] 未修改的 DSH 来源快照独立保存在 `third_party/deepseek-harness/`。

- [ ] **R07** · 难度 易 · 风险 低 · 位置 根 `package.json`、新增 `scripts/verify-upstream-identity.mjs`
  - **问题**：没有脚本校验 `packages/event/typescript/packages/**/{src,tests}`
    与 `third_party/.../upstream/packages/**` 逐字节一致，"保持原样"只靠
    人工。
  - **处理**：新增脚本并纳入 `npm run verify`；维护一份"允许差异清单"，
    R17–R19 修改保留源码后，清单之外的文件必须逐字节一致。
  - **依赖**：无（R17–R19 完成后更新允许差异清单）。

## 3. TypeScript 解耦

- [x] 审计 `packages/event/typescript/` 中全部 `@deepseek-ai/*` 与 Cordis 依赖。
- [ ] 删除 Harness 宿主、scope、typert、插件生命周期等非 Event 能力。
- [ ] 将 Event 必需的消息、ID 和 JSON 工具裁剪为 Perix 自有最小实现。
- [ ] 移除 `@perix/event-sdk/runtime` 对 Cordis 的整包导出。
- [ ] 移除 `@perix/event-sdk/messages` 对 `dsh-llm` 的整包导出。
- [x] 保持 Session、fork、repair、surface、JSONL 和 Trajectory 行为不退化。
- [ ] 验证打包产物不存在 DSH 运行时依赖或公共命名空间泄漏。

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

- [ ] **R13** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/sdk/package.json`、`sdk/src/*-invariant.ts`、`sdk/vite.config.ts`
  - **问题**：`session/invariant`、`persistence/invariant`、
    `persistence-jsonl/invariant` 是 Cordis companion plugin，依赖
    `dsh-invariants` 服务，对 Event 行为无贡献，却是 SDK 公共出口。
  - **处理**：从 `exports`、vite entry 与 `public-api.spec.ts` 中删除三个子路径；
    源码留在 `packages/` 供审计，不进入 SDK 构建。
  - **依赖**：无。

- [ ] **R14** · 难度 中 · 风险 低 · 位置 新增 `packages/event/typescript/packages/util/`
  - **问题**：核心源码依赖 `dsh-brand`（`brandString/Branded`）、
    `dsh-util-values`（`deepFreeze/snapshotJsonValue/assertNever`）、
    `dsh-timeout`（`MAX_TIMER_DELAY_MS`），这些是几十行的小工具。
  - **处理**：逐函数从上游复制到本地包（MIT，保留来源注释），核心源码只改
    import 行。上游 `json.spec.ts`、`properties.spec.ts` 锁定行为。
  - **依赖**：无。

- [ ] **R15** · 难度 中 · 风险 低 · 位置 新增 `packages/event/typescript/packages/messages/`、`sdk/src/messages.ts`
  - **问题**：`@perix/event-sdk/messages` 整包 re-export `dsh-llm`，把完整 LLM
    runtime 类型图暴露给消费者。
  - **处理**：本地模块只保留 Event 接受与产生的类型（`Message`、`ContentBlock`、
    `StreamChunk`、`ToolSchema`、`LlmCallConfig`、`TokenUsage`、`LlmFailure`
    等）、构造函数 `createUserMessage`、`createAssistantMessage`、
    `createToolResultMessage` 和 `callConfigEquals`；以 Python `messages.py`、
    `request_header.py` 为对照，保证两边接受同一 JSON 形状。
  - **依赖**：无。

- [ ] **R16** · 难度 中 · 风险 低 · 位置 新增 `packages/event/typescript/runtime/`
  - **问题**：没有可替代 Cordis 的本地宿主抽象。
  - **处理**：定义 `EventHost`，只含三部分——
    (a) 强类型事件总线 `on/emit/parallel`，仅覆盖 `session/created`、
    `session/event`、`session/flush`、`session/disposed`；
    (b) `effect(fn | generator, label)` 与 `dispose()`，按反注册顺序释放；
    (c) `logger.warn/info`。
    不提供 scope、typert、plugin 注册、HMR。先为 `EventHost` 单独写测试。
  - **依赖**：无。

- [ ] **R19** · 难度 中 · 风险 低 · 位置 `packages/session/session-persistence-jsonl/src/index.ts`
  - **问题**：构造函数签名 `(ctx, config)`，`static inject = ['sessions']`，
    `static Config` 依赖 schemastery。
  - **处理**：改为 `(host, sessions, config)`；删除 `static inject` 与
    schemastery schema，用源码已有的 `??` 默认值兜底；在 TS README
    "Necessary local changes" 逐行登记。
  - **依赖**：R16。

- [ ] **R17** · 难度 难 · 风险 中 · 位置 `packages/core/session/src/index.ts`
  - **问题**：`SessionStore extends Service`，注册 typert lookup，事件 carrier
    经 `dsh-scope` 包装，`declare module '@deepseek-ai/cordis'` 扩展
    `Context`。
  - **处理**：`SessionStore` 改为接收 `EventHost` 的普通类；删除
    `ctx.inject(['typert'])` 与 typert 模块扩展；carrier 退化为 session 本身
    （独立组件没有 agent scope）；删除 `declare module`。仅允许改这些行，
    `Session` 类与 append/fork/repair/surface 逻辑逐字节不动，改动逐行登记。
  - **依赖**：R14、R15、R16。

- [ ] **R18** · 难度 难 · 风险 中 · 位置 `packages/session/session-persistence/src/{index,coordinator}.ts`
  - **问题**：`SessionPersistence extends Service`；`installWritePath` 用
    `ctx.on/ctx.effect`；`ctx.sessions.list()`、`ctx.get`、`ctx.invariants`。
  - **处理**：改为普通抽象类，构造时注入 `host` 与 `sessions`；
    `installWritePath` 改用 `host.on/host.effect`；删除 `ctx.get`、
    `ctx.invariants` 用法。write-behind、prepared cache、torn-tail 逻辑不动。
  - **依赖**：R17。

- [ ] **R20** · 难度 中 · 风险 中 · 位置 `packages/test-support/`、上游 `tests/`
  - **问题**：上游测试大量使用 `new Context()`、`ctx.plugin`、`ctx.fiber.dispose`。
  - **处理**：新增 `createTestContext()` 垫片，提供 `plugin`、`sessions`、
    `sessionPersistence`、`on`、`fiber.dispose`、`logger`，让上游测试尽量原样运行；
    仅改写 `ctx.typert`（2 处）、`ctx.emit`（3 处）、`ctx.parallel`（1 处）
    的用例，并在 R07 允许差异清单中登记。
  - **依赖**：R17、R18、R19。

- [ ] **R21** · 难度 中 · 风险 低 · 位置 `sdk/src/runtime.ts`、`sdk/package.json`
  - **问题**：`@perix/event-sdk/runtime` 是 `export * from '@deepseek-ai/cordis'`；
    TS 没有与 Python `store.restore(id)` 对应的一步式恢复入口。
  - **处理**：导出本地 `createEventRuntime()`，返回 `sessions`
    （`create/restore/fork/flush`）、`persistence`、`dispose`；`restore(id)`
    即 `contract.md` 中"`prepare` 后由 `SessionStore` 发布"的封装。
  - **依赖**：R16–R20。

- [ ] **R22** · 难度 易 · 风险 低 · 位置 `sdk/scripts/rewrite-public-namespaces.mjs`
  - **问题**：脚本对生成物做字符串替换（含 typert 符号字符串），是去痕不是解耦。
  - **处理**：typert 注册删除后不再需要，删除脚本及其 build 步骤。
  - **依赖**：R17。

- [ ] **R23** · 难度 易 · 风险 低 · 位置 `sdk/package.json`
  - **问题**：`dependencies` 列出 12 个 `@deepseek-ai/*`/schemastery 包，
    `lib/*.js` 运行时 import 它们。
  - **处理**：全部移除；`koffi` 仅 win32 使用、与 DSH 一致，保留并在 README 注明。
  - **依赖**：R14–R21。

- [ ] **R24** · 难度 评估 · 风险 低 · 位置 `packages/event/typescript/ui/trajectory/`
  - **问题**：`@perix/event-ui` 从注册表 bundle `dsh-client-ui-primitives`
    （含 shiki 全语法，`lib` 约 5 MB JS、1.5 MB CSS）与 `dsh-client-store`。
  - **处理**：按"UI 闭包优先原样裁剪"规则可接受，消费者无需安装 DSH 包；本项
    只评估并记录结论，是否裁剪 shiki 语法由 UI 体积要求决定。
  - **依赖**：无。

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
    Nexent 多进程需求保留，须在 `contract.md` 标注 Python-only（R01），并
    增加 TS 读取含 `.event.lock` 目录的跨语言测试。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：删除 `_exclusive_file_lock`、`_lock_path` 及三处调用，只保留进程内 `RLock`；不再写 `.event.lock`。

- [x] **R12** · 难度 易 · 风险 低 · 位置 `packages/event/python/src/perix_event/session.py`
  - **问题**：`SessionStore.resume()` 只是 `restore()` 别名，DSH 没有该 API。
  - **处理**：保留则在 docstring 与 `contract.md` 明确"别名"（R02）；否则删除。
  - **依赖**：无。
  - **结果**：已完成（2026-09-01）：保留别名，docstring 与 `contract.md` 均注明"与 `restore` 相同、Python-only、不增加行为"。

## 5. 跨语言契约

- [x] 将共享有效/无效轨迹夹具放入 `conformance/`。
- [x] TypeScript 和 Python 对同一夹具给出相同接受/拒绝结果。
- [x] TypeScript 写出的轨迹可由 Python restore、resume、append 和 fork。
- [x] Python 写出的轨迹可由 TypeScript restore、resume、append 和 fork。
- [x] Python 轨迹可由 TypeScript Trajectory UI 投影和渲染。
- [x] 规范化后的 header、Event、surface、messages 和 repair 结果等价。

- [ ] **R08** · 难度 易 · 风险 低 · 位置 `conformance/event/v0/cases/`、TS `known-event-types.ts`、Python `types.py`
  - **问题**：`KNOWN_SESSION_EVENT_TYPES` 两份手抄副本，没有测试保证相同。
  - **处理**：新增 `known-event-types.json` 作为唯一来源，两边各加断言集合相等
    的测试。
  - **依赖**：无。

## 6. 测试与交付

- [x] 保留并通过 DSH 上游 Event 与 Trajectory 回归套件。
- [x] Python 单元测试覆盖全部核心行为、错误边界和异常输入。
- [x] Python 集成测试覆盖持久化重启、repair、resume 和 fork。
- [x] 明文、Zstandard、packed chunks、截断日志和大历史均有测试。
- [x] 根级 `verify` 同时运行 TypeScript、Python、跨语言和打包测试。
- [x] README、测试矩阵和本清单与当前实现一致。

- [ ] **R09** · 难度 易 · 风险 低 · 位置 `packages/event/typescript/tests/package/package-consumer.mjs`
  - **问题**：只断言 `dsh-session*` 四个名字不泄漏；`lib/types` 实际有 8 处
    `from '@deepseek-ai/cordis'` 与 `declare module '@deepseek-ai/cordis'`。
  - **处理**：断言收紧为 `lib/**/*.js`、`*.d.ts` 与 `package.json`
    `dependencies` 中不得出现任何 `@deepseek-ai/`。第 3 节完成前会失败，
    作为第 7 节验收门禁，不放进当前 `verify`。
  - **依赖**：R23（通过条件）。

- [ ] **R10** · 难度 难 · 风险 低 · 位置 `packages/event/typescript/tests/ui/`
  - **问题**：`views.client.spec.tsx`（1338 行）是 Trajectory 最大的行为测试，
    被排除后"UI 水准不退化"缺少证明。
  - **处理**：在独立宿主下移植等价用例，去掉依赖完整 DSH shell 的
    slot/workspace 部分。
  - **依赖**：无。

## 7. 总体验收

- [ ] Event 轨迹设施达到生产可用。只有以上所有任务均完成、公共产物不再
  泄漏 DSH 运行时依赖（R09 通过），并通过完整验证后才能勾选此项。

## 执行顺序

按"容易改、风险小"优先，跨章节排列。

| 批次 | 条目 | 性质 | 前置 |
| --- | --- | --- | --- |
| 1 | R01, R02, R05, R06, R04, R03 | 纯文档登记 | 无 |
| 2 | R11, R12 | Python 小修 | 无 |
| 3 | R13, R07, R08 | 低风险工程保障 | 无 |
| 4 | R14, R15 | TS 工具与消息替换，不动生命周期 | 无 |
| 5 | R16 → R19 → R17 → R18 → R20 → R21 | 宿主接口与保留源码改动 | 批次 4 |
| 6 | R22, R23, R09 | 收尾与泄漏门禁 | 批次 5 |
| 7 | R10, R24 | 独立长线 | 无 |
