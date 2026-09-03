# 任务：纳管 Nexent Event Demo 可复现源码

> 对应清单：[`../tasks.md`](../tasks.md) R43。
> 执行者：Codex。状态：已完成（2026-09-02）。

## 背景

成品视频、封面和观看说明位于 `docs/event/demos/nexent/`，位置符合文档型 Demo
的用途；但 R42 使用的合成脚本、真实浏览器截图和旁白源文件仍只存在于临时目录，
仓库无法独立重制成片。

## 实施范围

- 保持发布成品位于 `docs/event/demos/nexent/`。
- 在 `scripts/event/demos/nexent/` 纳管视频合成脚本、旁白生成脚本、旁白文本、
  已验收的语音输入、真实浏览器截图和制作说明。
- 删除脚本中的临时目录与本机 ffmpeg 二进制硬编码；输入、输出默认相对仓库根目录，
  ffmpeg 可从 PATH 或显式参数解析。
- 已验收音频作为确定性合成输入；在线神经语音重新生成是可选步骤，不能成为本地
  重制视频的前置条件。
- 不修改 Nexent、DSH `EventTrajectory` 或 Event 行为。

## 验收

1. 从仓库检出后，只需 Python、Pillow 与 ffmpeg 即可离线重制 MP4 和封面。
2. 默认重制结果覆盖到临时输出目录，不能意外覆盖已发布成品；显式安装步骤才更新
   `docs/event/demos/nexent/`。
3. 重制视频完整解码，音轨 PCM 与当前成品一致，封面和关键标题帧通过视觉复核。
4. 脚本、素材和 README 不含凭据、临时绝对路径或未说明的本机依赖。
5. Demo 说明、任务清单和来源哈希同步后才可标记完成。

## 完成记录

- 新增 `scripts/event/demos/nexent/`，共 22 个文件、约 1.3 MiB：合成脚本、
  旁白生成脚本与文本、九张真实浏览器截图、六段已验收 MP3、依赖文件、制作说明
  和 `SHA256SUMS`。
- `compose.py` 不再引用临时素材目录或本机私有 ffmpeg 路径；默认输出到 Git 忽略的
  `build/event-demo/nexent/`，通过 PATH、`--ffmpeg` 或 `PERIX_DEMO_FFMPEG`
  解析 ffmpeg，只有显式 `--install` 才安装发布成品。
- 默认合成读取仓库内已验收音频，完全离线；`generate_narration.py` 单独提供可选的
  在线神经语音重生成，默认同样只写 `build/`。
- 15 个输入文件通过 `shasum -a 256 -c SHA256SUMS`；清单 SHA-256 为
  `a5fc89acf1439808b8adb9c0319c3c78869e008f36011e903aa6f182794ab363`。
- 从仓库素材重新生成的 83.07 秒 MP4 完整解码，参数为 1440×900、24 fps、
  H.264 High 与 AAC-LC；视频和封面与当前发布成品逐字节一致，旁白 PCM MD5 同为
  `5a2108a0458412f1a66e9e4bc4759163`。
- 两个 Python 脚本编译及 `--help` 入口、旁白 JSON、文档本地链接和临时路径扫描
  均通过；Nexent、DSH `EventTrajectory` 与 Event 实现没有改动。
