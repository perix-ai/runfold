# 任务：Nexent 轨迹面板产品化接入

> 对应清单：[`../tasks.md`](../tasks.md) R37。
> 执行者：Codex。状态：进行中（2026-09-02，本地实验）。

## 背景

R33 已证明 Nexent 的真实 Python Agent 可以写入公共 Event v0，并且生成的父子
Session 能由 TypeScript SDK restore、投影并交给保留的 DSH Trajectory UI
渲染。该验收没有修改 Nexent 前端：Nexent 原聊天页仍只消费其
`MessageObserver -> SSE -> assistant-ui` 消息流，不能直接读取 Event Session。

本任务把已经独立的 Trajectory UI 接入 Nexent 产品界面。它是下游消费者集成，
不改变 Event v0、Session、persistence、repair 或 fork 的公共语义。

## 目标

- 保留 Nexent 原聊天执行面板，在同一会话页面增加独立的“轨迹”视图。
- 前端直接消费 `@perix/event-ui`，不得复制、重写或 iframe 包装 DSH 面板。
- Nexent 现有 Python 后端使用 `perix-event-sdk` 读取和操作 Event Session；不增加
  独立 Event server、Node sidecar 或 TypeScript 子进程。
- 建立租户隔离的 `conversation_id <-> event session_id` 稳定映射，使读取、继续
  和分叉都作用于正确的会话。
- fork 创建 Event 子 Session 和对应的 Nexent 子会话；resume 继续已有 Session，
  原会话历史前缀保持不变。

## 实施边界

1. **交付依赖**：Nexent 必须通过可复现的 package/tarball/revision 使用
   `@perix/event-ui` 和 `@perix/event-sdk`；提交中不得出现开发机绝对路径。
2. **后端边界**：在 Nexent 既有 FastAPI app/service 分层中增加轨迹读取、fork
   和 resume 所需的最小接口。浏览器不直接读取 JSONL 文件。
3. **前端边界**：在当前聊天 Thread 中增加“对话 / 轨迹”入口；原 Reasoning、
   Tool、Plan、Verification、Sources 和 Composer 展示保持不变。
4. **权限边界**：所有 Session 查找先经过现有 conversation/tenant/user 权限；
   不允许调用方用任意路径或未授权 session id 读取文件。
5. **运行边界**：同一 Event Session 的单写者、稳定 cwd、cold repair 和
   open-turn fork 拒绝继续由 Python SDK及 R33 调用层保证，不在 UI 重写。
6. **上游边界**：Nexent 改动只提交到本地分支，不配置 remote、不推送；若要向
   官方提交，须先与 Nexent 团队沟通并另立任务。

## 验收

- 后端测试覆盖：无配置、Session 不存在、越权、合法读取、分页/长历史、并发
  writer、resume、稳定边界 fork、非法 open-turn fork，以及 Event 错误到 HTTP
  错误的映射。
- 前端测试覆盖：默认仍显示聊天、切换轨迹、加载/空/错误状态、父 Session 和
  fork lineage、刷新后选择保持，以及原聊天组件不退化。
- 使用 R33 的真实 Nexent 父子轨迹运行浏览器级验收；轨迹面板的工具栏、时间轴、
  Turn/Step/Tool 层级、搜索、折叠与详情交互必须与独立 DSH 面板一致。
- Nexent 相关后端和前端回归通过；Perix 主仓 `npm run verify` 继续通过。
- 记录实际提交、命令、测试数、视觉证据、已知限制与未推送边界后，才能在清单
  中勾选 R37。

