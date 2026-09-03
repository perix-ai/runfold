# 任务：Nexent 长轨迹恢复、fork 与全景 UI 验收

> 对应清单：[`../tasks.md`](../tasks.md) R38。
> 执行者：Codex。状态：已完成（2026-09-02，本地实验）。

## 背景

R37 已把保留的 DSH Trajectory UI 原样嵌入 Nexent，并用 R33 的 3 Turn 父子轨迹
验证读取、刷新、搜索、折叠和 fork。现有证据仍不足以回答两个更具体的问题：

1. Nexent 在较长轨迹上是否真实经历了进程重启后的 restore/resume，并保持完整
   Event 前缀和连续序号；
2. Nexent 页面是否能同时展示 DSH 轨迹主区和右侧事件详情，包括参数、结果、
   Schema 与计时，而不是只证明主时间线能出现。

## 原则与边界

- 本任务是现有能力的加深验收，不重新设计 Event、fork 或 UI。
- 直接使用 Nexent 本地实验分支现有的 `perix-event-sdk`、`@perix/event-ui` 和
  `EventTrajectory` 接入；不得复制或重写 DSH 轨迹组件。
- “20 步”按至少 20 个完整 Turn 验收；每个 Turn 至少有一个模型 Step，轨迹中
  同时包含真实 Tool call，确保详情抽屉能显示输入、结果与 Schema。
- restore 必须发生在新的 Python 进程中；仅在同一对象上继续 append 不算恢复。
- fork 必须位于完成 Turn 的稳定边界。子 Session 精确继承该前缀，父子随后各自
  续写，且不得互相污染。
- Nexent 分支继续只做本地实验，不新增 remote、不 push；Perix 主仓的任务记录和
  去敏视觉证据按仓库规则提交并推送。
- 若现有代码通过，不修改生产实现；若发现缺陷，先在 R38 中记录明确失败证据，
  再做最小修复并补回归测试。

## 执行与验收

1. 用确定性 Nexent `CoreAgent` 在进程 A 写入前 10 个完整 Turn 并关闭 writer。
2. 用进程 B 对同一 Session 执行冷 restore/resume，再写入后 10 个完整 Turn；验证
   序号连续、前 10 Turn 字节级不变、20 个 `turn/start`/`turn/end` 成对闭合。
3. 从稳定 `turn/end` 边界 fork；用独立进程分别续写父 Session 和子 Session，
   验证 `parentSession`、`seedLength`、继承前缀与分支后缀。
4. 通过 Nexent 的轨迹读取形状把真实父子 Event 提供给产品页面，不手写另一套
   展示事件；确认分页合并不会丢失或重复事件。
5. 在至少 1440×900 视口完成浏览器验收并保存：
   - 20+ Turn 父轨迹全景，能观察长列表、时间轴、Turn/Step/Tool 层级；
   - 选中 Tool/Event 后的右侧详情全景，能看到概述、参数、结果、Schema、计时；
   - fork 子轨迹全景，能看到父 Session、继承事件数和独立后缀。
6. 记录 Event/Turn 数、fork 边界、父子哈希或等价前缀证据、实际命令、截图哈希、
   测试结果及任何限制。相关定向测试与主仓完整门禁全部通过后，才能勾选 R38。

## 完成记录

### 实施结果

- 20 Turn 跨进程 restore/fork 回归已先通过，父子各自续写后均为 21 Turn、
  197 个 Event，子 Session 的 `seedLength` 为 189，继承前缀逐事件相等。
- 2026-09-02 首次浏览器检查确认右侧详情抽屉及“概述 / 参数 / 结果 / Schema /
  计时”页签均来自保留的 DSH UI，但真实 Nexent Tool 详情显示“Schema 不可用”。
  代码审计定位为 Nexent `EventTrajectory.record_request()` 没有把本次模型请求的
  Tool schema 写入 Event v0 `request/header.header.tools`。该字段正是保留 UI 建立
  `callId -> schema` 索引的来源。
- 因此 R38 需要一项必要的最小生产修复：复用 Nexent 已交给模型的工具集合，按
  Event v0 `ToolSchema` 形状写入 request header，并补 Python 回归；不修改 Event
  协议、DSH Trajectory 组件或 Nexent 页面布局。
- Nexent 本地分支提交 `d341740` 完成该修复和长轨迹回归：
  `CoreAgent` 复用固定版本 smolagents 的实际工具 schema 转换，
  `EventTrajectory.record_request()` 将结果写入现有
  `request/header.header.tools`。无工具时不增加参数或额外依赖，因此原隔离单测
  与无工具路径保持不变。该仓库没有 remote，提交未推送。

### 轨迹与 fork 证据

- 进程 A 写入 Turn 1–10：97 个 Event、10 个完成 Turn、10 个完成 Step、3 个
  Tool call；进程退出并释放 writer 后，进程 B 对同一 Session 调用真实
  `SessionStore.resume()`，写入 Turn 11–20 并在完成边界 fork。
- fork 时父 Session 有 189 个 Event（序号 `0..188`）、20 个完成 Turn、20 个
  完成 Step、5 个 Tool call。子 Session 元数据为
  `parentSession=nexent-r38-parent`、`seedLength=189`；父子前 189 个 Event 的
  SHA-256 都是 `f7c19bf5c2e9e920753f5f19bdd4dd53b7b929021384b826486e559952dec07d`。
- 两个新的独立进程随后分别写入父 Turn `parent-21` 与子 Turn `fork-21`。最终
  两边均为 197 个 Event（序号 `0..196`）、21 个完成 Turn、21 个完成 Step、
  5 个 Tool call，且另一分支的后缀没有出现。最终 JSONL SHA-256 分别为父
  `c1564afe8b98ab5a5e7d4ce2184e9d1954f18bfb4e1b7ef27d0fe17955c8376c`、子
  `1c3f6d3bfab46573cc93b90f1429209b0d61d817bdde8317786a74943052236a`。

### 自动化验证

- Nexent Python 相关矩阵 540/540：Event 轨迹 10、CoreAgent 165、run_agent 32、
  NexentAgent 239、AgentModel 70、service 14、FastAPI 10。新增长轨迹测试使用
  真实 `CoreAgent` 和独立 Python 进程，不以内存对象续写冒充 restore。
- Nexent 前端 `pnpm test` 26/26，
  `pnpm exec tsc --noEmit --incremental false` 与 `pnpm build` 通过；生产构建中
  `/[locale]/newchat` First Load JS 仍为 1.41 MB。修改没有触碰前端源码或保留的
  DSH UI 包。
- `ruff check` 通过修改的 Event 记录器与测试，三个修改的 Python 文件通过
  `py_compile`。完整 `core_agent.py` 仍保留上游已有的非本任务 lint 债务，本任务
  没有顺手格式化或扩张修改范围。
- Perix 主仓 `npm run verify` 通过：204 个保留文件、10 个必要差异、139 个
  specifier 映射，969 个 Vitest、36 个 Python 测试、TypeScript 类型检查、三个
  构建以及 TypeScript/Python 空白消费者安装全部成功。

### 浏览器验收与视觉证据

在 1440×900 内置浏览器中载入上述真实父轨迹。时间线和长列表完整呈现 21 个
Turn、模型 Step、`python_interpreter` Tool 及 `add`/`final_answer` 子工具。选中
Turn 17 的 `add` 后，保留的 DSH 右侧详情显示“概述 / 参数 / 结果 / Schema /
计时”五个页签；概述同时显示参数 `{a: 2, b: 3}`、结果 `5`、工具说明和 3 毫秒
时长，Schema 页显示 `object`、`properties` 与 `required: ["a", "b"]`，不再是
“Schema 不可用”。

随后直接点击 Nexent 页面“分叉”按钮，URL 从父会话 `3801` 导航到子会话
`3802`；子页顶部显示父 Session、继承 189 个 Event，列表底部显示独立的
`fork-21` 后缀。页面外围用户、Agent 和 conversation 数据使用确定性本地验收
桩；真实 FastAPI 权限、分页和 fork 错误映射由上述 24 项 service/app 测试覆盖。

- [21 Turn 父轨迹全貌](../evidence/r38/nexent-parent-21-turn-overview.jpg)，
  1440×900，SHA-256
  `8ffae256645f23950a5771fb472410c0e173dfa8282d6a8e11608bfb037c6a1f`
- [工具详情概述](../evidence/r38/nexent-tool-detail-overview.jpg)，1440×900，
  SHA-256 `e03d7614ef0ac7a79d464e997e09d7f310a9a66a51a9c7c374af87b720ce57c8`
- [工具 Schema 详情](../evidence/r38/nexent-tool-schema-detail.jpg)，1440×900，
  SHA-256 `35b7ef6b7512a2501572e50c10af120f551d47ad8cad37d992d1f5e8f76018d5`
- [fork 子轨迹全貌](../evidence/r38/nexent-fork-child-21-turn.jpg)，1440×900，
  SHA-256 `d6165b5fc63854bded829f6420ad580fcd8f3eb1c94a926e807267b14887c840`

本验收只补齐 Nexent Event request header 中原本缺失的工具 schema；Event v0、
DSH Trajectory 源码、交互和布局均未修改。Nexent 结果继续只存在于本地实验分支，
不代表已向官方提交或部署。
