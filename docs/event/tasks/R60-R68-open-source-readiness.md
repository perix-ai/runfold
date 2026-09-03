# 任务：公开仓库的法律归属与开源就绪缺口

> 对应清单：[`../tasks.md`](../tasks.md) 第 10 节 R60–R68。
> 来源：2026-09-03 对"仓库已公开"状态的复核。执行者：Codex。状态：待执行。
>
> 背景：`github.com/perix-ai/runfold` 已是 public 仓库（MIT，11 个 topics）。
> 下列缺口按"已公开"而不是"准备公开"来评估。

## 复核已确认无问题的部分

- 已跟踪文件中无 API key、token、私钥、`.env` 或凭据文件；
- 无个人绝对路径泄漏；
- `LICENSE`、`NOTICE.md`、`COPYRIGHT.md`、`CONTRIBUTING.md`、
  `OPEN_SOURCE_POLICY.md` 齐备，DeepSeek Harness 的来源、版权与 MIT 条款完整；
- `CONTRIBUTING.md` 明确了贡献授权与版权不自动转让的边界。

## R60 · Nexent（Huawei）MIT 归属缺失【优先】

**证据**

`integrations/nexent/v2.5.0/patches/` 的九个补丁是 `git format-patch` 导出的
diff，其中 0001、0002、0005 三个各含 600–1700 行以 `+`/`-` 开头的内容，包含
Nexent 源文件的上下文行与修改行。Nexent 的许可证是 MIT，版权行为
`Copyright (c) 2025 Huawei Technologies Co., Ltd. All rights reserved.`。

在 `NOTICE.md`、`LICENSE`、`COPYRIGHT.md`、`OPEN_SOURCE_POLICY.md` 中检索
`nexent` 与 `huawei` 均无结果。

**影响**

MIT 要求"在软件的所有副本或实质性部分中包含版权声明与许可声明"。仓库以公开
方式再分发了 Nexent 源码的实质片段，却没有携带其版权与许可声明。这与
`OPEN_SOURCE_POLICY.md` 对第三方接收物的自身要求也不一致（DeepSeek 已按此
处理，Nexent 未处理）。

**处理**

1. `NOTICE.md` 增加一段：`integrations/nexent/` 下的补丁包含来自 Nexent
   `v2.5.0`（commit `86d75923dd549008d725d83db18a93d654c84fb0`）的源码片段，
   版权 (c) 2025 Huawei Technologies Co., Ltd.，MIT 许可；并说明这些补丁是
   互操作实验，未提交给 Nexent 上游也未获其背书（该免责声明当前只在
   `integrations/nexent/v2.5.0/README.md` 里，应上提到 NOTICE）。
2. 在 `integrations/nexent/` 内放置 Nexent 的 MIT 许可证原文副本，路径参照
   `third_party/deepseek-harness/LICENSE` 的做法。
3. `scripts/verify-public-identity.mjs` 增加断言：`NOTICE.md` 必须同时提到
   Huawei 与 Nexent，与现有 DeepSeek 断言同级。
4. 复核 demo MP4 中出现的 Nexent 界面与商标，结论并入 R55。

**依赖**：无。R55 若先执行，可与之合并为一次 NOTICE 修订。

## R61 · 无 CI，公开仓库无法验证外部 PR【优先】

**证据**

仓库无 `.github/` 目录：没有 workflow、issue/PR 模板、CODEOWNERS。
`npm run verify` 目前只在维护者本机运行过。

**影响**

仓库已公开且接受贡献（`CONTRIBUTING.md` 明确欢迎 PR），但任何外部 PR 都没有
自动验证。R56 刚把测试超时从 5 秒提到 20 秒，理由正是"共享 CI runner"，而
CI 并不存在。

**处理**

1. 新增 `.github/workflows/verify.yml`：在 `push` 与 `pull_request` 上运行
   `npm ci && npm run verify`；矩阵至少覆盖 Node 22 与 Python 3.11；缓存 npm。
   注意 `test:python:package` 需要网络装 pip 构建后端，若 CI 受限则拆成可选
   job 并在 TESTING.md 说明。
2. 新增 `.github/ISSUE_TEMPLATE/`（bug、feature 两类）与
   `.github/pull_request_template.md`，模板中要求填写"对应 tasks.md 条目"，
   把 `AGENTS.md` 的任务先行规则落到外部贡献流程。
3. 新增 `.github/CODEOWNERS`，至少覆盖 `third_party/`、`scripts/`、
   `packages/event/typescript/packages/`（保留源码，改动需谨慎）。

**依赖**：无。

## R62 · 缺 SECURITY.md 与 CODE_OF_CONDUCT.md

**影响**

无 `SECURITY.md` 意味着安全问题只能公开提 issue，没有私下披露渠道；GitHub 的
社区标准清单也会标红。无行为准则对接受外部贡献的项目是常见缺项。

**处理**

`SECURITY.md` 写明支持的版本、私下报告方式（GitHub Private Vulnerability
Reporting 或指定邮箱）与响应预期。`CODE_OF_CONDUCT.md` 采用 Contributor
Covenant 2.1 并填写联系方式。两者都从 `CONTRIBUTING.md` 链接。

**依赖**：无。

## R63 · 缺 CHANGELOG.md

**影响**

即将发布 0.1.0（R59），但没有变更记录。使用方无法判断版本间差异，
`OPEN_SOURCE_POLICY.md` 的可追溯要求也缺一环。

**处理**

新增 `CHANGELOG.md`，采用 Keep a Changelog 格式，首条为 0.1.0 未发布条目，
概括 Event 子系统的能力边界与已知限制（不含 State/Checkpoint 等非目标）。

**依赖**：R59（发布时确定日期）。

## R64 · `@runfold/trajectory-ui` 缺 description

**证据**

`@runfold/event` 与 `runfold-event` 都有 `description`，只有
`packages/event/typescript/ui/trajectory/package.json` 没有。npm 包页面与搜索
结果会留空。

**处理**

补一句描述，并在 `scripts/verify-public-identity.mjs` 中与其他元数据断言同级
断言其存在且非空。

**依赖**：R52。

## R65 · 身份脚本内旧名字面量与自身白名单不一致

**证据**

`scripts/verify-public-identity.mjs` 顶部用 `['per', 'ix'].join('')` 构造旧名
以避免自检命中（R58 已补注释说明原因），但第 80、84、137、157 行直接写了
`github.com/perix-ai/runfold` 字面量，并为脚本自身加了一条白名单分支放行。

**影响**

同一文件既隐藏又拼写同一个词，读者难以判断哪种写法是规范；自身白名单还扩大了
扫描器的豁免面。

**处理**

四处改用已有的 `publicRepository` 常量（`.git` 后缀用模板字符串拼接），随后
删除 `isAllowedReference` 中针对脚本自身的分支，确认 `verify:public-identity`
仍通过。

**依赖**：R52、R58。

## R66 · GitHub About 的 homepage 为空

R51 已设置 description 与 topics，homepage 字段仍为空。指向文档入口或未来的
文档站。**依赖**：无。

## R67 · 大文件留在 git 中【需你决策】

**证据**

已跟踪的最大文件：`docs/event/demos/nexent/trajectory-restore-fork-demo.mp4`
约 2.8 MB，`integrations/nexent/v2.5.0/patches/0003-*.patch` 约 2.0 MB（内含
vendored tarball），`integrations/nexent` 合计 2.3 MB。

**影响**

每次 clone 都会拉取这些二进制，且它们会随每次重建产生新的 blob，历史只增不减。
不影响功能，属于长期维护成本。

**处理（需先决策）**

三种口径：保持现状；把 MP4 移到 GitHub Releases 并在文档中引用；或对二进制启用
Git LFS。R53 会重建补丁 0003 的 tarball，届时会再产生一份新 blob，建议在
R53 之前定下口径。

**依赖**：R53 之前。

## R68 · 文档语言策略【需你决策】

`README.md`、`CONTRIBUTING.md`、`NOTICE.md`、`LICENSE` 等对外文件是英文，而
`docs/event/` 下的需求、架构、规格、验证、决策、清单全部是中文。对外部贡献者
而言，规则文档不可读等于无法按 `CONTRIBUTING.md` 的要求参与。

**处理（需先决策）**

三种口径：维持中文并在 README 说明这是维护者工作文档；关键文档
（requirements、architecture、specification）提供英文版；或整体切换英文。
不建议机器翻译后无人校对。

**依赖**：无。

## 验收

```bash
npm run verify
```

R60、R64、R65 完成后 `verify:public-identity` 应覆盖新断言；R61 完成后同一
命令应在 GitHub Actions 上通过；R67、R68 需你先给出口径。

## 执行顺序

1. R60 → R62 → R63 → R66：法律与社区健康文件，互不依赖。
2. R64 → R65：发布元数据与脚本一致性，依赖 R52。
3. R61：CI 与模板，改动面独立但需要在 GitHub 上观察首次运行。
4. R67、R68：等你给口径。

每步独立绿色、独立提交、立即推送（`AGENTS.md`）。
