# 任务：纳管 Nexent Event 下游集成补丁

> 对应清单：[`../tasks.md`](../tasks.md) R44。
> 执行者：Codex。状态：已完成（2026-09-02）。

## 背景

Nexent v2.5.0 的本地实验分支已经完成 Event 轨迹记录、跨进程 restore/resume、
稳定边界 fork、后端鉴权接口和 Trajectory UI 嵌入，但这些实现目前只存在于无
remote 的本地 Nexent 仓库。主仓只有任务记录、跨语言夹具、视觉证据和 Demo，
不能据此把同一组产品改动重新应用到一份干净的 Nexent 源码。

## 决策

把下游接入保存为 `integrations/nexent/v2.5.0/` 下的版本化 Git patch series：

- `integrations/` 表明它是本数据平台与外部消费者之间的接入产物，不属于
  `packages/event/` 的公共 Event 实现，也不是 `third_party/` 的未修改上游源码；
- `v2.5.0/` 将补丁与明确的 Nexent 基线绑定，后续适配新版本时新建版本目录，
  不覆盖旧补丁；
- 按原有 8 个提交分别导出补丁，保留后端、依赖、前端、文档和测试的逻辑边界；
- 使用 Git binary patch 纳管两个可复现的 Event SDK/UI tarball，不依赖开发机
  路径或未提交的本地文件；
- 不复制完整 Nexent 仓库，不创建 Nexent remote，也不向 Nexent 官方推送。

单一合并 diff 会丢失提交边界，Git bundle 又会复制完整上游对象库；二者都不如
版本化 patch series 适合审阅、重放和将来向 Nexent 团队提交。

## 交付范围

1. 导出 `snapshot/v2.5.0..codex/event-trajectory-v2.5.0` 的全部 8 个提交，使用
   `--binary --full-index`，不得手工改写补丁内容。
2. 增加机器可读 manifest，记录 Nexent 官方仓库、tag、官方 tag commit、Release
   ZIP SHA-256、本地基线 commit/tree、实验 head/tree、Perix 依赖 commit、补丁
   顺序和变更统计。
3. 增加 `series` 和 `SHA256SUMS`，使补丁顺序与内容可离线校验。
4. 编写 README，说明目录身份、前置条件、`git am` 应用方式、验证方式、版本升级
   策略，以及这仍是未提交给 Nexent 官方的实验接入。
5. 在根 README 和 Event 文档地图中提供入口；不把 Demo、截图或测试夹具复制进
   集成目录。

## 验收

- 补丁文件数量、顺序、来源提交和 SHA-256 与 manifest/series 完全一致；
- 在一份全新的本地 Nexent v2.5.0 临时克隆中按 `series` 执行 `git am` 成功；
- 重放结果的 Git tree 与实验分支
  `f10c9b54f7cdf0dadd3beb4a2e87ab1383fe077d` 的 tree 完全一致，38 个变更文件和
  两个二进制 tarball 均未丢失；
- 补丁与说明中不存在开发机绝对路径、凭据或未声明的基线；
- 本仓 Markdown 链接、diff 检查和相关门禁通过；完成后记录实际哈希和验证命令。

## 完成记录

### 交付结果

- 新增 [`integrations/nexent/v2.5.0/`](../../../integrations/nexent/v2.5.0/)，
  保存 8 个由 `git format-patch --binary --full-index --no-signature` 直接生成且未
  改写的补丁，共 2,356,943 字节；覆盖 Nexent 后端、Python Agent 记录器、
  restore/resume/fork、前端 API、Trajectory UI 嵌入、双 Fork 入口、文档和测试。
- `manifest.json` 记录官方 tag commit、Release ZIP 哈希、本地 baseline/head
  commit 与 tree、每个来源 commit/tree/subject、Event 包来源、38 个变更文件和
  4,366 增/86 删统计；`series` 固定唯一应用顺序，`SHA256SUMS` 校验 README、
  manifest、series 和全部补丁。
- 第 3 个 Git binary patch 原样携带 `@perix/event-sdk` 与 `@perix/event-ui`
  tarball。重放后的包哈希分别为
  `bb711c641314026522f2e54fe14e219411727c7192554275d8ed129ef3e1caed` 和
  `5ef17461ff7f8f0f5175687496140a2aa3bcd8ad831b7301b60863e94c7f6da1`。
- 根 README、Event 文档地图和 `integrations/` 索引已增加稳定入口；没有复制
  Nexent 完整源码、Demo 或证据图片，也没有修改或推送 Nexent 本地仓库。

### 独立重放验收

- 从 `snapshot/v2.5.0` 的 Git archive 新建一个不含实验提交对象的临时仓库；对
  上游原本已跟踪但被 `.gitignore` 命中的 4 个文件使用 `git add -f`，所得干净
  baseline tree 精确为 `b442446293b6793498dac09be0b86f1dd0d340c5`。
- 严格按 `series` 逐个执行 `git am --3way`，8 个补丁全部成功；最终 tree 精确为
  `a3c97e4630464c5d5ae9492abb5c80fac3b6fd6f`，与 Nexent 实验 head
  `f10c9b54f7cdf0dadd3beb4a2e87ab1383fe077d` 完全一致，工作区干净。
- 在另一临时目录重新运行同一 `git format-patch` 命令，8 个新输出与纳管补丁
  逐文件、逐字节一致，证明仓库版本没有手工编辑或转换。

### 验证结果

- `shasum -a 256 -c SHA256SUMS` 全部通过；机器校验确认 8 个 manifest 条目的
  顺序、文件、字节数、SHA-256、来源 commit 和 subject 一致，并与 Nexent 本地
  仓库中的来源 tree 逐项核对通过。
- 补丁集没有开发机绝对路径、临时目录、私钥或 GitHub token；Git staged
  whitespace/diff 检查通过。`.gitattributes` 只对 Git 邮件补丁关闭外层空上下文
  行误报，不改变补丁内容或应用后源码的检查规则。
- 本仓完整实现矩阵通过：204 个保留文件、10 个必要差异、139 个映射，三个构建、
  969 个 Vitest、36 个 Python 测试及 TypeScript/Python 空白消费者安装均成功。
  两个消费者安装因默认沙箱禁止联网而分别在获准联网的同一工作区重跑通过。
- 新增及修改 Markdown 的本地链接、JSON 解析、任务记录和最终 Git diff 检查
  通过。Nexent 仍停在无 remote 的本地分支
  `codex/event-trajectory-v2.5.0`，head 未变。
