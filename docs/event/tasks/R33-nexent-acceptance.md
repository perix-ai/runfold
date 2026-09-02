# 任务：Nexent 真实消费者接入与验收

> 对应清单：[`../tasks.md`](../tasks.md) R33、需求 A5。
> 执行者：Codex。状态：执行中（本地实现与验收完成，等待可写 Nexent 远端）。
>
> 前置：R25–R32、R34–R35 全部完成；执行前确认用户指定的 Nexent 仓库、分支和
> 依赖交付方式，不在未授权仓库中改动代码。

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

## 实施记录（2026-09-02）

- 使用官方 Nexent `develop` 基线
  `4e1fb31dd169917edcee549efc59957124d9d449`；集成位于本地分支
  `codex/event-trajectory`，提交
  `94c06828e4633c73d9da56c47482bc8da43fed9a`。该提交尚未发布到可写远端，
  因此本任务与总体验收暂不标记完成。
- Nexent 的 `event` extra 精确固定到 Perix commit
  `2eea3f17e6a917ef3d640405b360664728d31e84` 的
  `perix-event-sdk` 0.1.0；默认 `dev` 测试 extra 会同时安装 `event`，避免
  自动化验收静默跳过。
- SDK 在 `CoreAgent` 的真实模型、根 `python_interpreter` 和实际子工具边界
  写 Event；每个边界立即 flush。`AgentRunInfo` 接受调用方提供的稳定绝对
  `root`、`cwd` 和租户限定 `session_id`，恢复时拒绝 cwd 漂移。调用层使用
  POSIX advisory lease 保证同一 Session 跨进程单写者，没有修改 Event
  persistence，也没有增加 server、sidecar、Adapter 或 Nexent 专属 Event。
- Nexent 自动化测试共 515/515 通过：`test_event_trajectory.py` 9、
  `test_core_agent.py` 165、`test_run_agent.py` 32、
  `test_nexent_agent.py` 239、`test_agent_model.py` 70。覆盖真实
  `CoreAgent` 工具运行、三进程 create/resume/fork、安装包来源、跨进程重复
  writer 拒绝、非法 Event 原子失败、open-turn fork 拒绝、cwd 漂移拒绝以及
  assistant/tool-call 两个崩溃边界的确定性 repair。
- 从 rebased Nexent 提交与固定 Event 提交分别构建 wheel，在全新 Python 3.11
  环境中以 `--no-index --no-deps` 只安装两个 wheel；两个模块均从
  `site-packages` 加载并成功持久化完整 7-Event turn。Nexent wheel metadata
  同时包含固定 Event URL 和 `dev -> event` 依赖。
- [`真实夹具`](../../../tests/event/cross-language/fixtures/nexent-r33/README.md)
  来自三个关闭 `PYTHONPATH` 的独立 Nexent 进程；只去除了临时 cwd 与长系统
  prompt。[`TypeScript 验收`](../../../tests/event/cross-language/nexent-trajectory.spec.tsx)
  使用公共 restore API 验证父 Session、21-Event fork 前缀、surface/messages、
  根/子工具因果和 seed marker，并由保留的 Trajectory UI 渲染三轮轨迹。
- 本仓完整门禁的全部阶段通过：207 个保留文件、10 个必要差异、87 个声明
  映射和 1005 个行为测试全部通过，TypeScript 与 Python 空白消费者均从发布
  产物安装成功。两个需要联网安装依赖的消费者阶段在允许联网的环境中分别
  补跑通过。

## 剩余步骤

1. 将 `94c06828` 推送到用户授权且可写的 Nexent 远端，记录可访问的 branch/PR
   URL；当前官方 `git@github.com:ModelEngine-Group/nexent.git` 对现有凭据拒绝
   写入，现有 `gh` 凭据也无效。发布后将 `tasks.md` 的 R33 与总验收同时勾选。
