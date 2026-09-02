# 任务：生产验收前的行为、互操作与文档收口

> 对应清单：[`../tasks.md`](../tasks.md) R30–R32。
> 执行者：Codex。状态：进行中（R30 已完成，R31–R32 待执行）。
>
> 执行前先读 [`../requirements.md`](../requirements.md)、
> [`../architecture.md`](../architecture.md)、
> [`../testing.md`](../testing.md)、
> [`../../../packages/event/typescript/README.md`](../../../packages/event/typescript/README.md)
> 和 [`../../../AGENTS.md`](../../../AGENTS.md)。

## 目标

补齐当前全量测试没有覆盖到的两个生产门禁：本地 `EventHost` 对固定上游
Cordis 生命周期子集的行为一致性，以及 Python/TypeScript 通过公开 restore API
双向续写同一轨迹。完成代码与依赖任务后，再让文档逐项反映真实状态。

本任务不是重写 EventHost、设计通用 Event Bus、恢复完整 Cordis，也不增加
server、adapter 或 DSH shell 能力。

## 已确认的现状

2026-09-01 审查时，构建、809 个测试、两个空白消费者安装测试和 132 文件的
上游一致性校验均通过；以下缺口仍能独立复现：

1. `packages/event/typescript/tests/` 没有直接覆盖 `EventHost` 的测试文件，
   `tests/sdk/public-api.spec.ts` 只验证它能导出和构造。
2. effect body 内重入 `host.dispose()`，随后返回的 disposer 不会执行；相同轨迹
   在固定版本 Cordis 中会执行一次。
3. `host.effect(() => Promise.reject(error))` 会产生 `unhandledRejection`，到
   dispose 才出现 `PromiseRejectionHandledWarning`；固定版本 Cordis 不会产生
   未处理 rejection。
4. 跨语言测试的 Python → TypeScript 路径使用 `persistence.load()` 加
   `sessions.create({ seed })`，没有调用 `runtime.restore()`。人工验证表明当前
   明文和 Zstandard 都能 restore，但该事实没有永久回归测试。
5. `tasks.md` R07 与 TypeScript README 仍写 7 处例外；当前
   `verify:upstream-identity` 实际报告 132 个文件、9 处登记差异，其中五个是
   宿主接缝源码、四个是 tsconfig。

## R30：EventHost 生命周期校准

先新增 `packages/event/typescript/tests/runtime/event-host.spec.ts`，并为它增加
明确的根级测试入口，纳入 `npm test`。测试至少覆盖：

- `on/emit/parallel/internal/dispatch` 的顺序、`this` carrier 与错误语义；
- effect 的单次释放、反注册顺序、同步与异步 disposer、失败记录且不阻断其他
  独立 effect；
- effect 初始化期间发生重入 dispose 时，已经产生以及随后返回的 disposer 都
  恰好执行一次；
- Promise effect resolve/reject 与并发 dispose，不产生未处理 rejection，失败按
  固定上游行为可观察；
- 子 scope 主动释放、父 scope 级联释放、重复/并发释放；
- `provide/get` 的重复注册、解除注册，以及服务经不同 scope 读取时 `ctx` 正确
  绑定。

预期行为以固定快照中的 Cordis `vendor/cordis/src/fiber.ts`、`events.ts` 为证据，
把必要的行为轨迹写成测试预期；测试和发布包不得因此依赖 Cordis。先让新增的两
个缺陷用例在当前实现失败，再只修改 `runtime/src/host.ts` 的必要生命周期代码。
不得修改保留的 Session、persistence 或 Trajectory 算法来绕过宿主问题。

## R31：双向公开 restore 门禁

修改 `tests/event/cross-language/python-conformance.spec.ts`：

1. Python 分别写出 `none` 与 `zstd` 轨迹并关闭真实 store；
2. 新 TypeScript runtime 直接调用 `runtime.restore(id)`；
3. 断言原 header 与 Event 前缀保持一致，只按规格增加一次
   `session/end-seed`；
4. TypeScript 继续 append、flush、fork 后关闭；
5. Python 通过公开 `restore/resume` 重新读取父子 Session，验证续写内容、连续
   seq 与 lineage；
6. 保留 TypeScript 写、Python restore/resume/fork 的反向链路。

不要保留一条只经 `persistence.load + sessions.create` 的替代路径来冒充公开
restore 验收；底层 load 可以作为额外断言，但不能替代第 2 步。

## R32：文档事实同步

R29–R31 完成后，逐项核对并更新：

- `docs/event/tasks.md` 的总体状态、R07 数量、执行结果和总体验收前置；
- `packages/event/typescript/README.md` 的允许差异数量、五个源码宿主接缝、
  上游一致性措辞和测试布局；
- `docs/event/{requirements,architecture,specification,testing,decisions}.md` 中对
  DSH 依赖、公开 restore 与测试覆盖的描述；
- 根 README、Python/TypeScript README 和任务书之间的本地链接。

历史决策可以保留，但必须明确标注当时状态与后续结果；不能继续用现在时描述
已经失效的依赖或未覆盖的测试。

## 验收

R30 完成时至少运行新增 runtime 测试、`test:upstream:event`、`test:sdk`、
`test:system`；R31 完成时运行完整跨语言测试；两项行为改动全部完成后运行：

```bash
npm run verify
```

R32 是文档改动，另做本地链接检查、`git diff --check`，并确认清单中每个已完成
R 条目都有日期、结果和验证证据。每个 R 条目作为独立绿色提交，按 AGENTS.md
立即推送；只有完成对应验收后才能勾选。
