# 任务：Nexent 轨迹面板产品化接入

> 对应清单：[`../tasks.md`](../tasks.md) R37。
> 执行者：Codex。状态：已完成（2026-09-02，本地实验）。

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

## 完成记录

### 实施结果

- Nexent 本地分支为 `codex/event-trajectory-v2.5.0`，没有配置 remote，也没有
  push。R37 对应提交依次为：
  - `64347a3`：接入 Python Event 记录、鉴权读取、分页、resume 与稳定边界 fork；
  - `1280f2a`：提交从 Perix `3a1f931` 打包的 SDK/UI tarball 与锁文件；
  - `88a4621`：增加严格分页、错误映射、视图保持和 fork URL 的前端客户端；
  - `e3a25a2`：在原 Thread 中嵌入 `@perix/event-ui`，保留原聊天和 Composer；
  - `0475d45`：增加统一前端测试命令并记录产品接入与验证方法。
- 浏览器只提交 `conversation_id`；Python 服务先校验 tenant/user/conversation，
  再解析稳定 SHA-256 Session id。浏览器不能传文件路径或任意 Session id。
- 前端直接动态加载 tarball 中的 `TrajectoryViewer` 与原 CSS，没有复制 DSH
  组件、重写轨迹视图、iframe、Node sidecar 或 Event server。运行中按最后序号
  增量刷新；fork 默认选择最新完成的 `turn/end`，创建 Event 子 Session 与 Nexent
  子会话后导航到子轨迹。

### 自动化验证

- Nexent Python：539/539 通过。其中 Event Agent 实进程记录/恢复/fork 9 项、
  service 14 项、FastAPI 10 项；原 CoreAgent、run_agent、NexentAgent 和
  AgentModel 回归分别为 165、32、239、70 项。
- Nexent 前端：`pnpm test` 26/26；
  `pnpm exec tsc --noEmit --incremental false` 通过；`pnpm build` 通过，
  `/[locale]/newchat` 的 First Load JS 为 1.41 MB。
- Perix 主仓：`npm run verify` 通过；上游身份仍为 207 个保留文件、10 个已记录
  差异、87 个映射，969 个 Vitest、36 个 Python unittest、TypeScript 类型检查、
  三个构建以及 TypeScript/Python 空白消费者安装全部成功。

### 浏览器验收与证据

在 1280×720 的内置浏览器中，以仓库提交的 R33 父子 JSONL 作为 Event 数据完成
以下检查：默认仍为原 Nexent 对话及 Composer；切换后显示相同 DSH 工具栏、
时间轴、2 个 Turn、模型 Step、`python_interpreter` Tool 及 `add`/
`final_answer` 子工具；搜索可过滤，调用折叠由 8 行收至 2 行并可恢复，工具行可
打开带概述/参数/结果/Schema/计时的详情；时长模式可切换；刷新后保持轨迹视图。
fork 后 URL 切换至子会话，显示父 Session `nexent-real`、继承 21 个事件和独立的
第 3 个 Turn。补齐临时验收桩的既有 memory 状态接口后，页面无 console error。

- [原聊天基线](../evidence/r37/chat-baseline.jpg)，SHA-256
  `6835f9ad84375b9260d1866e6d27bc6354f0a240255476fe7f100a7ea2033f17`
- [父轨迹](../evidence/r37/parent-trajectory.jpg)，SHA-256
  `e9fc41f5258f179ab2dc89511e5149e59fc0bd11959b6e17f4805fc47829c96e`
- [fork 子轨迹](../evidence/r37/fork-trajectory.jpg)，SHA-256
  `6d6fa9e6b4719d873faf9fee3b97c9eb54d5565842e4cb6f0b833b1495ce14ef`

### 边界与已知限制

- 浏览器验收的 Event 数据是 R33 真实 Nexent Agent 生成并提交的父子轨迹，但
  页面外围的用户、Agent 与 conversation HTTP 响应使用确定性本地验收桩；真实
  FastAPI 权限与错误映射由上述 service/app 测试覆盖，真实 Agent 进程链路由
  9 项独立进程测试覆盖。
- 为原样保留 DSH Trajectory 行为，当前 UI CSS 产物约 1.55 MB，Nexent
  `newchat` 首载约 1.41 MB；拆分语法高亮资源属于后续独立性能任务，不在 R37
  中改写上游 UI。
- 本结果仅存在于 Nexent 本地实验分支。向 Nexent 官方仓提交、部署和生产身份
  环境验收均需要先与其团队沟通，R37 未越过该边界。
