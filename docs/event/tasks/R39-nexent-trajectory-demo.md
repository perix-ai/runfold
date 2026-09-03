# 任务：Nexent 轨迹恢复与 fork 可播放 Demo

> 对应清单：[`../tasks.md`](../tasks.md) R39。
> 执行者：Codex。状态：已完成（2026-09-02，本地实验）。

## 背景

R38 已用自动化和 1440×900 静态证据证明 Nexent 能显示 21 Turn 真实轨迹、
DSH 右侧详情、跨进程 restore/resume 与稳定边界 fork。静态图片不适合第一次
接触 Event 的读者理解操作顺序，也不能直观看到按钮、恢复前后和 fork 导航。

## 目标

- 在 `docs/event/demos/nexent/` 提交可直接播放的短视频和说明页。
- 先展示完整轨迹是什么：Session、时间线、Turn/Step/Tool 层级和长列表。
- 展示轨迹区现有按钮与详情：刷新、分叉、时长、轮次/调用折叠、搜索，以及
  概述、参数、结果、Schema、计时。
- 演示真实冷恢复：进程 A 写入并退出，进程 B 从同一持久化 Session 恢复续写，
  页面刷新后出现新 Turn。恢复是运行时语义，不伪造一个“恢复”按钮。
- 演示稳定完成边界的 fork：点击 Nexent 页面“分叉”，导航到子会话，并显示
  `parentSession`、`seedLength` 与独立子分支后缀。

## 原则与边界

- 使用 Nexent 本地实验分支和真实 `CoreAgent` 生成的 Event；不手写另一套展示
  数据，不改 Event v0、保留的 DSH Trajectory UI 或 Nexent 产品布局。
- 可以使用确定性本地桩提供外围 user/agent/conversation HTTP 数据，但必须在
  说明页明确；真实 Event 记录、恢复、fork 和 UI 投影不得用截图冒充。
- Demo 以中文画面标注说明事实，不加入合成旁白。目标分辨率至少 1440×900，
  视频应使用仓库和常见浏览器可播放的格式，并控制在普通 Git 提交可接受大小。
- 同时保留封面图、章节说明、生成与验证命令、时长/分辨率/编码和 SHA-256，便于
  后续直接观看与审计。

## 验收

1. 视频依次覆盖完整轨迹、工具栏/详情、冷恢复、fork 四段，不把 restore 与页面
   刷新或 SSE transport reconnect 混为一谈。
2. 冷恢复前后的 Session id 相同，恢复前缀不变；fork 子页可见父 Session、继承
   Event 数和独立后缀。
3. 抽取开头、中间、恢复后和 fork 后关键帧做视觉检查；文字可读、无敏感信息、
   无错误弹窗或明显裁切。
4. 媒体探测确认文件可解码、时长合理、分辨率至少 1440×900；仓库链接存在。
5. 主仓相关验证通过，完成记录补齐后才在清单中勾选 R39。

## 完成记录

### 交付结果

- 在 [`../demos/nexent/`](../demos/nexent/) 提交 64.58 秒可播放 Demo、封面和
  独立说明页。视频按“完整轨迹 → 浏览按钮 → 右侧详情 → 中断恢复 → Fork”排序，
  画面中逐项标出刷新、分叉、时长、轮次、调用、搜索和详情五个页签。
- Demo 使用 H.264 High / yuv420p、1440×900、12 fps、无音轨，文件大小
  1,610,370 字节。中文字幕和高亮覆盖在真实 UI 验收帧上，不改 Nexent 组件、
  Event 内容或产品布局；说明页明确它是操作后状态帧的顺序合成，不冒充连续录屏。
- 轨迹由 Nexent 本地实验分支的真实 `CoreAgent` 生成。进程 A 写入前 10 Turn 后
  退出，进程 B 从同一个 `nexent-r39-parent` 冷恢复并继续到 21 Turn；页面刷新后
  可见 `restored-21`。随后在 UI 中实际点击“分叉”，导航到
  `nexent-r39-fork`，顶部可见父 Session、继承 189 个 Event，底部可见独立
  `fork-21`。
- 页面外围 user、agent、conversation HTTP 使用确定性本地桩；真实 Event、
  持久化、恢复、工具 Schema、Fork 和 Trajectory 投影均未使用桩。Nexent 分支
  仍无 remote、未推送。

### 轨迹证据

- 恢复前父轨迹为 10 个完成 Turn、97 个 Event；最终父轨迹为 21 个完成 Turn、
  197 个 Event。前 97 个 Event 逐行比较一致。
- Fork 在 20 个完成 Turn 后的稳定边界执行，子轨迹 `seedLength=189`；父子前
  189 个 Event 逐行比较一致，随后分别独立续写。
- 恢复前、最终父轨迹、最终子轨迹 JSONL SHA-256 依次为
  `f00e0b9ef7ae5e79b3e21d0e85946fb0f009b51b0eb477f676dc4599b37ba940`、
  `5bd9cffa495667ae49b0b51623c5a6f668bace79ea2c2cf18f76972641664b74`、
  `ac19f80cf285ca9607f51402b64fae43910647fae30086e1ccdd584f1aca8530`。

### 媒体与仓库验证

- `ffmpeg` 完整解码 775 帧，退出码 0；媒体探测确认时长 `00:01:04.58`、单个
  H.264 High 1440×900 yuv420p 视频流、12 fps、无音轨。
- 在 00:01、00:08、00:26、00:47、00:57、01:02 抽取 6 张关键帧并逐张视觉
  检查：中文字幕和按钮高亮可读，完整轨迹、详情、恢复、Fork 与证据页均无明显
  裁切、敏感信息或错误弹窗。
- MP4 SHA-256 为
  `d54b95717e142d2e72e723cb4894ca01ae639bc24a21a3fd8feadc024df0d913`；封面
  SHA-256 为
  `f090e352f1fc1228a4766de9b98cec8dbe76b131213f92da0b84382584e95535`。
- 5 个相关 Markdown 文件的全部本地链接存在，`git diff --check` 通过；
  `npm run verify:upstream-identity` 仍通过 204 个保留文件、10 个必要差异和
  139 个声明映射。R39 只增加文档媒体，没有修改实现；其依赖 R38 的 Nexent
  540/540、前端 26/26、类型检查、生产构建和主仓完整门禁结果保持不变。
