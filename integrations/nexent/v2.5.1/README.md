# Nexent v2.5.1 Event 人工验收

## 这个目录是什么

Nexent 官方在 2026-09-01 发布了 v2.5.1（tag commit `b089f87c`）。它相对 v2.5.0
只改了 17 个文件：聊天欢迎页新增建议卡片、NL2Agent 提示词调整、Agent 因模型被
删除而标记为不可用、LLM 评估调用的流式参数修复，以及对应的前端文案和测试。这些
改动不涉及 Event 记录、恢复、分叉和轨迹 UI。

本目录把 [`../v2.5.0/`](../v2.5.0/) 中同一份 Runfold Event 集成移植到 v2.5.1
官方基线上，与 v2.5.0 并列保存、互不覆盖：同一个 `runfold-event` Python 包、
同一对 `@runfold/event` 与 `@runfold/trajectory-ui` 前端 tarball、同样的 39 个
变更文件和同样的验收流程。移植时只有一处冲突：上游给聊天欢迎页加了
`suggestions` 属性，而 Event 补丁把该区域包进了“对话 / 轨迹”视图切换；补丁已
保留两者。补丁基于官方 v2.5.1 tag commit 重新生成，不是对 v2.5.0 补丁的文本
改写。

验收结论与 v2.5.0 一致：Event 轨迹可在 Nexent 页面查看，刷新后恢复读取，
从已完成 Turn 分叉得到带 `parentSession` 与 `seedLength` 的全新 child Session。

## 同学只做这一件事

准备 Git、Node.js 22+、系统自带的 `unzip` 和可访问 npm/GitHub 的网络，然后在
Runfold 仓库根目录运行：

```bash
npm run accept:nexent:2.5.1
```

脚本会直接下载并校验约 55 MB 的 Nexent v2.5.1 固定归档，不执行 `git clone`；
随后应用唯一补丁、按锁文件安装前端依赖、运行 27 个测试和 TypeScript 检查，
最后打开带固定数据的 Event UI。页面打开后只需：

1. 确认原“对话”视图正常；
2. 切到“轨迹”，确认 Event 时间线和详情可见；
3. 刷新页面，确认原 Session 和 Event 仍能恢复读取；
4. 选择一个已完成 Turn，点击“分叉”，确认跳到全新的 child Session，并显示
   `parentSession` 和 `seedLength`。

检查完在运行脚本的终端按 `Ctrl+C`。默认路径不需要 Python、Docker、数据库、
Redis、MinIO、Nexent 后端或模型 API Key，也不会写入真实业务数据。Event 验收
也不启用 memory/vector：Nexent 页面壳层会全局检查向量模型状态，fixture 只回答
该状态检查以隐藏无关向导，不安装或连接任何向量服务。

v2.5.1 与 v2.5.0 使用相同的前端锁文件，共 1,067 个包。首次运行通常需要约
2–3 GB 可用空间；之后会复用 `build/nexent-v2.5.1-acceptance/`，与 v2.5.0 的
`build/nexent-v2.5.0-acceptance/` 互不影响，两个版本可以在同一台机器上先后验收。

## 可选：完整回归

只有修改了 Python/backend 或准备正式交付时，才需要额外安装 `uv` 并运行：

```bash
npm run accept:nexent:2.5.1:full
```

完整模式使用 Python 3.11，运行 540 个定向 Python 测试、相同的前端门禁和生产
构建，建议准备约 3 GB 可用空间。它只声明 8 个直接测试依赖（当前解析为约 40
个包），会复用已有环境，并隔离模型、向量、存储和文档处理等无关顶层导入。
它仍不启动任何真实服务，也不需要 API Key；构建通过后会删除 `.next` 中间产物。

## 如果失败

终端会停在失败步骤并给出原因。所有下载和环境文件只在
`build/nexent-v2.5.1-acceptance/` 这一个被 Git 忽略的目录中；需要完全重来时，
保留有用内容后删除该目录再运行同一条命令即可。脚本不会在仓库中生成需要人工
处理的额外日志或配置文件。

`manifest.json`、`series`、`SHA256SUMS` 和 `patches/` 是自动校验所需的机器文件，
人工验收不用操作。`npm run verify:integration-artifacts` 会同时校验 v2.5.0 和
v2.5.1 两个目录。

这是 Runfold 的本地互操作实验，不是 Nexent 官方发布。补丁所含 Nexent 源码继续
遵循本目录的 [`LICENSE`](LICENSE)。
