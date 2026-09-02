# 任务：Nexent 长轨迹恢复、fork 与全景 UI 验收

> 对应清单：[`../tasks.md`](../tasks.md) R38。
> 执行者：Codex。状态：进行中（2026-09-02，本地实验）。

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

待执行。
