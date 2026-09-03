# Nexent Event Demo 制作源码

这里保存 [`docs/event/demos/nexent/`](../../../../docs/event/demos/nexent/) 中成品
视频的确定性合成输入和制作脚本。发布目录只放便于观看的 MP4、封面与说明；本
目录负责可复现性。

## 内容

- `compose.py`：从固定截图和已验收旁白离线合成视频、点击音和封面。
- `captures/`：Nexent v2.5.0 本地实验分支 `f10c9b5` 的真实浏览器验收截图；
  鼠标、点击反馈、局部放大和字幕由合成脚本叠加。
- `narration/`：R41 验收通过的六段 `zh-CN-XiaoxiaoNeural` MP3，是默认的确定性
  输入；离线合成不调用语音服务。
- `narration.json` 与 `generate_narration.py`：旁白文本和可选的在线重新生成工具。
- `SHA256SUMS`：脚本启动时自动校验的全部截图与旁白输入。

## 离线重制

需要 Python 3.10+、ffmpeg、Pillow 和一套支持中文的本机字体。脚本会优先使用
macOS 的 STHeiti、Linux 常见 Noto CJK/WenQuanYi 字体；其他环境可设置
`RUNFOLD_DEMO_FONT_REGULAR` 与 `RUNFOLD_DEMO_FONT_MEDIUM` 指向 TTF、TTC 或 OTF。

```bash
python3 -m venv /tmp/runfold-event-demo-venv
/tmp/runfold-event-demo-venv/bin/pip install \
  -r scripts/event/demos/nexent/requirements.txt
/tmp/runfold-event-demo-venv/bin/python \
  scripts/event/demos/nexent/compose.py
```

ffmpeg 不在 PATH 时，可传 `--ffmpeg /absolute/path/to/ffmpeg`，或设置
`RUNFOLD_DEMO_FFMPEG`。默认输出到被 Git 忽略的
`build/event-demo/nexent/`，不会覆盖发布成品。确认结果后，只有显式增加
`--install` 才会复制到 `docs/event/demos/nexent/`。

## 校验

```bash
ffmpeg -v error \
  -i build/event-demo/nexent/trajectory-restore-fork-demo.mp4 \
  -f null -
shasum -a 256 \
  build/event-demo/nexent/trajectory-restore-fork-demo.mp4 \
  build/event-demo/nexent/cover.jpg
```

在 macOS STHeiti 和 ffmpeg 7.1 环境中，预期 SHA-256 为：

| 输出 | SHA-256 |
| --- | --- |
| `trajectory-restore-fork-demo.mp4` | `21e1d5af6c975d59eb21472cfc43fbf89cb898d024238a71c8163ee0e078b36e` |
| `cover.jpg` | `f42f9849a4d09893ada754c0084644bd7dd0aba945dd5e9291df6a8c559720fe` |

不同字体或 ffmpeg 版本可能产生不同的容器字节；验收时还应检查 1440×900、24 fps、
83.07 秒、AAC 音轨、完整解码，以及关键画面内容。

## 可选：重新生成旁白

这一步需要联网，但不是合成视频的前置条件。默认写入 `build/`，不会覆盖已验收的
`narration/`：

```bash
/tmp/runfold-event-demo-venv/bin/pip install \
  -r scripts/event/demos/nexent/requirements-voice.txt
/tmp/runfold-event-demo-venv/bin/python \
  scripts/event/demos/nexent/generate_narration.py
```

在线语音服务升级后输出可能变化。若确需替换默认旁白，应先试听、重新同步动作，
再更新 `SHA256SUMS`、成品哈希和对应任务记录。
