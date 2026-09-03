# 任务：Nexent 有声交互 Demo 与 DSH 控件一致性

> 对应清单：[`../tasks.md`](../tasks.md) R40。
> 执行者：Codex。状态：进行中（2026-09-02，本地实验）。

## 背景

R39 已提交可播放的 Nexent 轨迹 Demo，但它使用真实操作后的 UI 状态帧合成，
没有声音，也没有连续展示“选中目标 → 指向控件 → 点击 → 页面结果”的动作。
用户要求为 Demo 增加声音，清楚展示 restore/resume/fork，并要求界面与
DeepSeek Harness 一致；发现不一致时必须先讨论，不能自行设计新控件。

## 源码核对结果

- 保留的 `client/ui-trajectory` 源码没有 Resume、Refresh 或顶部 Fork 控件；
  轨迹自身只提供时长、轮次、调用、搜索和事件详情交互。
- DeepSeek Harness 的 Fork 入口位于 `client/ui-chat` 的
  `MessageIconActions`：用户先定位已完成消息，再点击该消息旁的分支图标，宿主
  使用消息对应的 Event seq 执行 Fork。
- DeepSeek Harness 的 Session resume 位于 `api/session-controller` 宿主生命周期：
  打开冷 Session 或发起需要 Agent 的操作时自动 resolve/resume，没有轨迹面板
  “Resume”按钮。
- Nexent 当前轨迹页顶部的“刷新 / 分叉”由本地实验接入新增，用于调用 Nexent
  的轨迹读取和 Fork API；它们不在 DSH `EventTrajectory` 组件中。轨迹主体仍由
  原样保留的 DSH 组件渲染。

因此，“在轨迹旁显示 Resume/Fork 按钮”与“完全采用 DSH 原界面”不是同一种
方案。新增 Resume 按钮或继续把 Fork 放在轨迹顶部都会形成 Nexent 宿主差异，
必须由用户明确选择，R40 才能继续。

## 已确认决策

用户于 2026-09-02 确认两个 Fork 入口同时保留，但职责分开：

1. **聊天快捷 Fork**：采用 DSH 原行为，在已完成的助手消息旁显示分支图标，按
   该消息对应的完成 Turn 边界分叉。
2. **轨迹精细 Fork**：作为明确标识的 Nexent 宿主扩展，在 DSH Trajectory 外层
   选择任一完成 Turn 及其 Event seq，再点击分叉。不得修改 DSH 组件内部源码。
3. **Resume**：继续采用 DSH 的自动宿主语义，不新增 Resume 按钮；Demo 显示
   进程 A 退出、冷 Session 被进程 B 打开并续写的真实过程。
4. **Demo**：加入中文旁白和同步字幕，连续展示鼠标移动、选择、点击、加载/导航
   和结果，不再只依赖静态前后帧。

DSH `EventTrajectory` 源码、布局和内部交互均不得修改；Nexent 外层扩展必须在
文档和 Demo 中如实标识。

## 选定方案后的实施项

- 使用中文旁白，配字幕；旁白只解释画面中真实发生的动作。
- 录出鼠标定位、目标选中、按钮按下、加载/导航和最终状态，不再只用静态前后帧
  表达关键行为。
- Restore 必须继续由进程 A 退出、全新进程 B 读取同一持久化 Session 验证；
  不把页面刷新或 SSE reconnect 叫作 restore/resume。
- Fork 必须从明确可见的稳定边界产生真实子 Session，并显示父 Session、
  `seedLength` 和独立后缀。
- 新 Demo 仍放在 `docs/event/demos/nexent/`，保留旧版直到新版完成全部验证；
  新版完成后更新章节、媒体信息、哈希和 R40 记录。
- Nexent 继续只改本地实验分支，不配置 remote、不推送。

## 验收

1. 聊天 Fork 与 DSH 的消息级入口一致；轨迹 Fork 明确属于 Nexent 外层扩展。
2. 声音清楚、无削波，与动作和字幕同步；无敏感信息。
3. Fork 点击入口、目标边界和子会话结果在连续画面中可见。
4. Resume 的画面和旁白符合所选语义，不虚构 DSH 中不存在的按钮。
5. 媒体完整、关键帧检查、代码/测试门禁和任务记录全部通过后才能勾选 R40。

## 完成记录

方案已确认，等待实现与验证。
