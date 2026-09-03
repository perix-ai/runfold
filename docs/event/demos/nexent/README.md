# Nexent Event 轨迹恢复与 Fork Demo

[![Nexent Event 轨迹 Demo 封面](cover.jpg)](trajectory-restore-fork-demo.mp4)

▶ [直接播放或下载 MP4](trajectory-restore-fork-demo.mp4)

这段 65 秒 Demo 展示同一套真实 Event 数据如何进入 Nexent 产品页面：先看完整
轨迹和浏览按钮，再检查右侧事件详情，最后依次验证跨进程冷恢复和 Fork。视频
没有合成旁白；中文字幕与橙色高亮只用于说明，没有改画面中的 Nexent UI 或
Event 内容。

视频由真实浏览器验收过程中、每次操作完成后捕获的 1440×900 UI 状态帧按顺序
合成。它保留了可复核的按钮前后状态和真实数据结果，但不是伪装成实时操作的
连续录屏。

## 章节

| 时间 | 内容 | 重点 |
| --- | --- | --- |
| 00:00 | 导览 | 完整轨迹、中断恢复和 Fork 的验收范围 |
| 00:03 | 完整轨迹 | 对话/轨迹入口，以及 Session、时间线、Turn、Step、Tool 层级 |
| 00:11 | 浏览按钮 | 时长、轮次/调用折叠和搜索 |
| 00:23 | 事件详情 | 概述、参数、结果、Schema、计时五个页签 |
| 00:38 | 中断恢复 | 进程 A 退出，进程 B 冷启动并恢复同一 Session |
| 00:51 | Fork | 页面分叉、父子血缘、继承边界和子轨迹独立续写 |
| 01:00 | 验证摘要 | Event/Turn 数量、继承边界和测试结果 |

## Demo 中的“恢复”是什么

恢复不是一个前端按钮。进程 A 写入 `nexent-r39-parent` 的前 10 个 Turn 后退出；
全新的进程 B 使用相同 Session ID 调用持久化层恢复，再继续写入到第 21 个 Turn。
页面右上角“刷新”只负责重新读取后端已经恢复并续写的 Event。

- 恢复前：10 个完成 Turn、97 个 Event。
- 恢复后：同一父 Session，21 个完成 Turn、197 个 Event；新增后缀为
  `restored-21`。
- Fork 边界：子 Session `nexent-r39-fork` 精确继承前 189 个 Event，并记录
  `parentSession=nexent-r39-parent`、`seedLength=189`。
- Fork 后：子 Session 独立写入 `fork-21`；父子继承前缀逐 Event 相等。

## 数据来源与边界

轨迹由 Nexent v2.5.0 本地实验分支的真实 `CoreAgent` 和 `perix-event-sdk` 生成，
恢复、持久化和 Fork 均经过实际 Python 进程。生成轨迹时使用的四个独立命令形状
如下，其中第二个命令负责冷恢复并在完成 Turn 边界创建子 Session：

```bash
python test/sdk/core/agents/test_event_trajectory.py \
  --long-event-worker "$FIXTURE_ROOT" nexent-r39-parent 1 10 -
python test/sdk/core/agents/test_event_trajectory.py \
  --long-event-worker "$FIXTURE_ROOT" nexent-r39-parent 11 10 nexent-r39-fork
python test/sdk/core/agents/test_event_trajectory.py \
  --long-event-worker "$FIXTURE_ROOT" nexent-r39-parent 21 1 -
python test/sdk/core/agents/test_event_trajectory.py \
  --long-event-worker "$FIXTURE_ROOT" nexent-r39-fork 21 1 -
```

Nexent 页面外围的 user、agent 和 conversation HTTP 数据来自确定性本地验收桩；
画面中的 Event 记录、恢复结果、工具 Schema、Fork 数据和 Trajectory UI 投影不是
桩数据。Nexent 修改只保存在无 remote 的本地实验分支，没有推送或部署到官方
项目。

## 审计证据

| 对象 | SHA-256 |
| --- | --- |
| 恢复前父 Session JSONL | `f00e0b9ef7ae5e79b3e21d0e85946fb0f009b51b0eb477f676dc4599b37ba940` |
| 最终父 Session JSONL | `5bd9cffa495667ae49b0b51623c5a6f668bace79ea2c2cf18f76972641664b74` |
| 最终子 Session JSONL | `ac19f80cf285ca9607f51402b64fae43910647fae30086e1ccdd584f1aca8530` |
| [`trajectory-restore-fork-demo.mp4`](trajectory-restore-fork-demo.mp4) | `d54b95717e142d2e72e723cb4894ca01ae639bc24a21a3fd8feadc024df0d913` |
| [`cover.jpg`](cover.jpg) | `f090e352f1fc1228a4766de9b98cec8dbe76b131213f92da0b84382584e95535` |

MP4 为 H.264 High / yuv420p、1440×900、12 fps、无音轨，实测时长
`00:01:04.58`，大小约 1.5 MiB。完整解码和关键帧复核命令：

```bash
ffmpeg -v error -i trajectory-restore-fork-demo.mp4 -f null -
ffmpeg -ss 00:00:47 -i trajectory-restore-fork-demo.mp4 \
  -frames:v 1 restore-keyframe.jpg
ffmpeg -ss 00:00:57 -i trajectory-restore-fork-demo.mp4 \
  -frames:v 1 fork-keyframe.jpg
shasum -a 256 trajectory-restore-fork-demo.mp4 cover.jpg
```

更完整的测试与浏览器证据见
[`R38 任务书`](../../tasks/R38-nexent-long-trajectory.md)；本 Demo 的制作和验收
记录见 [`R39 任务书`](../../tasks/R39-nexent-trajectory-demo.md)。
