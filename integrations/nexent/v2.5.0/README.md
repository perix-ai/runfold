# Nexent v2.5.0 Event 人工验收

## 同学只做这一件事

准备 Git、Node.js 22+、系统自带的 `unzip` 和可访问 npm/GitHub 的网络，然后在
Runfold 仓库根目录运行：

```bash
npm run accept:nexent
```

脚本会直接下载并校验约 55 MB 的 Nexent 固定归档，不执行 `git clone`；随后应用
唯一补丁、按锁文件安装前端依赖、运行 27 个测试和 TypeScript 检查，最后打开带
固定数据的 Event UI。页面打开后只需：

1. 确认原“对话”视图正常；
2. 切到“轨迹”，确认 Event 时间线和详情可见；
3. 刷新页面，确认原 Session 和 Event 仍能恢复读取；
4. 选择一个已完成 Turn，点击“分叉”，确认跳到全新的 child Session，并显示
   `parentSession` 和 `seedLength`。

检查完在运行脚本的终端按 `Ctrl+C`。默认路径不需要 Python、Docker、数据库、
Redis、MinIO、Nexent 后端或模型 API Key，也不会写入真实业务数据。
Event 验收也不启用 memory/vector：Nexent 页面壳层虽会全局检查向量模型状态，
fixture 只回答该状态检查以隐藏无关向导，不安装或连接任何向量服务。

当前锁定的前端依赖共 1,067 个包。首次运行通常需要约 2–3 GB 可用空间；之后会
复用 `build/nexent-v2.5.0-acceptance/`，无需重复设置环境。

## 可选：完整回归

只有修改了 Python/backend 或准备正式交付时，才需要额外安装 `uv` 并运行：

```bash
npm run accept:nexent:full
```

完整模式使用 Python 3.11，运行 540 个定向 Python 测试、相同的前端门禁和生产
构建，建议准备约 3 GB 可用空间。它只声明 8 个直接测试依赖（当前解析为约 40
个包），会复用已有环境，并隔离模型、向量、存储和文档处理等无关顶层导入。
它仍不启动任何真实服务，也不需要 API Key；构建通过后会删除 `.next` 中间产物。

## 如果失败

终端会停在失败步骤并给出原因。所有下载和环境文件只在
`build/nexent-v2.5.0-acceptance/` 这一个被 Git 忽略的目录中；需要完全重来时，
保留有用内容后删除该目录再运行同一条命令即可。脚本不会在仓库中生成需要人工
处理的额外日志或配置文件。

`manifest.json`、`series`、`SHA256SUMS` 和 `patches/` 是自动校验所需的机器文件，
人工验收不用操作。旧补丁拆分、本地分支和重放过程保留在 Git 历史中，不再混入
当前验收入口。

这是 Runfold 的本地互操作实验，不是 Nexent 官方发布。补丁所含 Nexent 源码继续
遵循本目录的 [`LICENSE`](LICENSE)。
