# 任务：Nexent 真实消费者接入与验收

> 对应清单：[`../tasks.md`](../tasks.md) R33、需求 A5。
> 执行者：Codex。状态：待执行。
>
> 前置：R25–R32、R34 全部完成；执行前确认用户指定的 Nexent 仓库、分支和依赖
> 交付方式，不在未授权仓库中改动代码。

## 目标

证明 `perix-event-sdk` 不只是能在合成的空白项目中安装，而是能在 Nexent 的
真实 Python 进程内记录 agent 轨迹，并跨进程重启执行 restore、resume 和 fork；
产出的格式仍是共同 Event v0，能够被 TypeScript SDK 和 Trajectory UI 直接读取。

## 边界

- Nexent 直接调用 Python 原生实现，不增加 Node server、sidecar 或 TypeScript
  子进程。
- 不建立 Nexent 专属 Event 格式，不在本任务设计 Adapter 体系。
- 不把 Nexent 的前端流重连等同于 Event resume。
- 若 Nexent 需要当前契约之外的事件或并发模型，先另立需求和任务，不能在接入
  中暗改共享 v0 行为。

## 实施步骤

1. 在用户指定的 Nexent 基线中确认 Session 生命周期、消息/tool 结果产生点、
   进程退出与恢复入口，以及现有 session id/cwd 的来源。
2. 用可复现的包版本或本仓库构建的 wheel 安装 `perix-event-sdk`，记录精确版本
   与 Nexent commit；不得依赖源码目录或临时 `PYTHONPATH`。
3. 在真实执行链路创建 Session，按共享类型写入至少一个完整 turn、assistant
   step 和 tool 调用/结果，并在退出前执行持久化屏障。
4. 新进程对同一 Session 执行 restore/resume，继续追加后验证 seq 连续、旧前缀
   不变；每个带新 live 后缀的 replay 恰好增加一个 `session/end-seed` 边界，
   已以该 marker 结尾的历史再次打开则不增长（DSH 语义见 R34）。
5. 从稳定边界 fork，验证 `parentSession`、`seedLength`、cwd、独立后续追加以及
   父 Session 不被修改。
6. 将一份去敏后的真实 Nexent 轨迹作为验收夹具或可重复生成的测试产物交给
   TypeScript：完成 restore、消息/surface 投影和 Trajectory UI 渲染。
7. 在两边仓库记录测试命令、版本、产物位置和限制；回到 `tasks.md` 更新 R33
   结果，再判断需求 A5 和总体验收是否可以勾选。

## 必须覆盖的失败场景

- 重复在线恢复同一个 Session 被明确拒绝；
- 非法或不连续 Event 不会部分写入；
- 进程在 open turn 中断后按 DSH 规则 repair，再允许继续追加；
- fork 边界位于 open turn 内时拒绝；
- 同一 Session 的单写者约束被 Nexent 明确遵守或在调用层保证。

## 验收证据

- Nexent 仓库中的自动化集成测试通过，且使用安装后的 Python 包；
- 本仓库 `npm run verify` 通过；
- Nexent 真实产出的轨迹由 TypeScript SDK 与 Trajectory UI 验证通过；
- `docs/event/specification.md` 不需要 Nexent 专属例外；若确需变化，先新增需求、
  决策和独立任务，R33 保持未完成。
