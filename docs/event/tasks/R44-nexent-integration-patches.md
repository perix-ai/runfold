# 任务：纳管 Nexent Event 下游集成补丁

> 对应清单：[`../tasks.md`](../tasks.md) R44。
> 执行者：Codex。状态：进行中（2026-09-02）。

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

