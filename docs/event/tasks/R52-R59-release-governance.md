# 任务：发布元数据、产物时效与治理缺口

> 对应清单：[`../tasks.md`](../tasks.md) 第 9 节 R52–R59。
> 来源：2026-09-03 对 R36–R51 的独立复核。执行者：Codex。状态：待执行。
>
> 复核结论：R36–R51 的行为、依赖与身份工作已达标。完整 `npm run verify`
> 串行通过；代码级 `@deepseek-ai/` 引用与旧命名残留均为空；`npm ls` 无 DSH
> 包；身份校验 204/10/139 与文档数字一致；`third_party` 快照与固定 commit
> 逐字节一致；许可证中的 DeepSeek 版权行与上游完全相同。下列条目都不推翻
> 已完成的结论，只补上"从可用到可发布、可长期维护"之间的缺口。

## R52 · 发布元数据缺失（阻塞首次发布）

**证据**

```text
@runfold/event          缺: repository, homepage, bugs, keywords, publishConfig
@runfold/trajectory-ui  缺: repository, homepage, bugs, keywords, publishConfig
packages/event/python/pyproject.toml  缺: [project.urls]
```

**影响**

- `@runfold/*` 是 scoped 包，没有 `publishConfig.access: "public"` 时
  `npm publish` 默认按 restricted 处理，无付费账户会直接失败。
- npm 与 PyPI 页面没有回源链接。`OPEN_SOURCE_POLICY.md` 把可追溯来源列为
  分发要求，缺 `repository` 与这条要求不一致。

**处理**

两个 npm 包补 `repository`（含 `directory`）、`homepage`、`bugs`、`keywords`
与 `publishConfig.access`；`pyproject.toml` 补 `[project.urls]`。在
`scripts/verify-public-identity.mjs` 增加断言，使其不可回退。

仓库地址按决策 D07 使用 `https://github.com/perix-ai/runfold`，组织名不迁移。
`@runfold` 是包命名空间，`perix-ai` 是托管组织，两者不需要一致；这是 D06 建立
的"产品名与维护者名分离"的直接结果，不要在本任务里顺手改动。

## R53 · Nexent 补丁中的 vendored tarball 已过期

**证据**

`integrations/nexent/v2.5.0/manifest.json` 记录 TypeScript 产物来自
`2249c5f`。其后两个提交改动了发布包内容：

| 提交 | 影响的发布内容 |
| --- | --- |
| `ba50409` | `sdk/`、`ui/trajectory/` 的 `package.json`、`LICENSE`、`NOTICE.md` |
| `0a420bd` | 同上，另加 `README.md`、`vite.library.config.ts`、`scripts/third-party-notices.mjs` |

具体差异：`2249c5f` 时的 `sdk/LICENSE` 只有 `Copyright (c) 2026 DeepSeek`；
当前多一行 `Copyright (c) 2026 Heiki Scott (original Runfold additions and
modifications)`。因此 patch 0003 里 Nexent 会安装的
`runfold-event-0.1.0.tgz` 与 `runfold-trajectory-ui-0.1.0.tgz` 携带的是旧版
版权声明，且不含 `0a420bd` 引入的第三方声明生成结果。

`OPEN_SOURCE_POLICY.md` 分发要求第 1、3 条要求每个发布包携带适用的版权声明
与包级 `LICENSE`/`NOTICE.md`。当前 vendored 产物不满足这两条。

（`cb5916e` 对 `runtime/src/messages.ts` 的改动只是 JSDoc 文本，不构成行为
差异。）

**处理**

用当前 HEAD 重建两个 tarball，重放补丁 0003，更新 `manifest.json` 的
`sourceRevision`、`sha256`、`result.*` 与 `SHA256SUMS`；在
`integrations/nexent/v2.5.0/README.md` 说明 tarball 与仓库版本的绑定关系。

## R54 · integrations 与 demo 产物不在任何门禁内

**证据**

`package.json` 与 `scripts/*.mjs` 中没有任何对 `integrations/` 的引用；
`SHA256SUMS` 与 `manifest.json` 的哈希只在 R44 执行当时人工核对过一次。
我复核时手动执行 `shasum -a 256 -c SHA256SUMS` 全部通过，但这不是回归保障：
任何人改动补丁、清单或 demo 资产都不会被 `npm run verify` 发现。

**处理**

新增 `scripts/verify-integration-artifacts.mjs` 并纳入 `npm run verify`，
至少校验三点：`SHA256SUMS` 与实际文件一致；`manifest.json` 中每个补丁条目的
`bytes`/`sha256` 与文件一致；`series` 与 `patches/` 目录一一对应且顺序完整。
`docs/event/demos/nexent/README.md` 中已登记的 MP4/封面哈希一并校验。

补丁能否干净应用需要 Nexent 基线，不适合放进本仓门禁；改为在
`integrations/nexent/README.md` 写明重放前置条件与命令，并记录最近一次重放的
日期与结果。

## R55 · Demo 音视频资产的第三方来源未登记

**证据**

`docs/event/demos/nexent/README.md` 说明旁白由 `edge-tts 7.2.8` 生成
（微软 Edge 朗读服务）。仓库根 `NOTICE.md` 与各包 `NOTICE.md` 中检索
`demo`、`mp3`、`mp4`、`tts`、`narration`、`audio` 均无结果。

`OPEN_SOURCE_POLICY.md` 的"第三方接收"要求：进入分发产物的新依赖必须有明确
且兼容的许可；捆绑的代码与资产必须携带其许可所要求的全部声明。检入仓库的
六段 MP3 与合成后的 MP4 属于分发资产，目前没有对应登记。

**处理**

在 `NOTICE.md` 增加一节，说明 demo 音频的生成工具、服务与使用条款结论；
若结论不明确，改用可自证许可的方案（本地 TTS、无旁白版本，或以字幕替代
语音）。同时补上 R37/R38 证据截图中 Nexent 界面的来源与许可说明。

> 本项涉及第三方服务条款判断，超出代码审阅范围，需要由你确认口径后再执行。

## R56 · 上游持久化测试对固定 5 秒超时敏感

**证据**

我在与其他任务并行时运行 `npm run verify`，`jsonl.spec.ts` 与
`zstd.spec.ts` 各有 1 个协调器用例超时失败，单用例报告耗时约 459 秒；串行
重跑同一套件 626/626 通过，总耗时 3.95 秒。`vitest.config.ts` 未配置
`testTimeout`，使用默认 5000 ms。

这不是实现缺陷，但在 CI 并行或共享 runner 上会成为间歇性失败。

**处理**

给这两个 fixture 驱动的套件设置明确的 `testTimeout`（例如 20000 ms），或在
`vitest.config.ts` 中按项目统一提高；在 `TESTING.md` 说明该超时的用途，避免
以后被当作"测试变慢"而调回。

## R57 · 文档地图与布局规则落后于目录现状

**证据**

- `docs/event/evidence/`（7 张验收截图）存在，但不在 `docs/event/README.md`
  的文档地图里；该文件的定位是"只是地图"，遗漏即失效。
- `AGENTS.md` 的"Repository layout"列出了 packages、apps、tests、schemas、
  conformance、third_party，但没有涵盖后来新增的 `scripts/`、
  `integrations/`、`docs/<domain>/demos/`、`docs/<domain>/evidence/`。
- `scripts/` 目前同时放校验脚本与 demo 合成源码
  （`scripts/event/demos/nexent/`），职责不单一。

**处理**

补全 `docs/event/README.md` 地图；在 `AGENTS.md` 增加四条布局规则；决定
demo 合成源码留在 `scripts/event/demos/` 还是移到 `tools/`，并在规则中固定。

## R58 · 身份校验脚本的字符串拼接缺少解释

**证据**

`scripts/verify-public-identity.mjs:10`

```js
const legacyWord = ['per', 'ix'].join('')
```

拆写是必要的（脚本会扫描包括自身在内的全部文本文件，写出字面量会自我告警），
但没有注释说明，读者容易误判为混淆或笔误。

**处理**

加一行注释说明拆写原因。

## R59 · 发布命名空间尚未注册

**证据（2026-09-03 实测）**

| 名字 | 状态 |
| --- | --- |
| npm `@runfold` scope、`@runfold/event`、`@runfold/trajectory-ui` | 未占用 |
| PyPI `runfold-event`、`runfold` | 未占用 |
| GitHub 组织 `runfold` | 不存在 |
| GitHub 组织 `perix-ai` | 已存在 |

**影响**

R52 会把这些名字写进发布元数据。名字一旦被他人抢注，要么改名重做一遍 R45–R48
的迁移，要么在受污染的命名空间下发布。

**处理**

首次发布前注册 npm `@runfold` scope 与 PyPI `runfold-event`，可一并占位 PyPI
`runfold`。GitHub 组织按决策 D07 不迁移，也不需要新建；若将来 Runfold 要独立
于维护方，再按 D07 的后果一节处理。

注册涉及账号与凭据，Codex 不执行注册本身：准备好 `npm publish --dry-run` 与
`python -m build` 的产物清单，把待注册名字、执行命令和前置账号要求写进本条
结果栏，由维护者本人完成注册后回填日期。

## 验收

```bash
npm run verify
```

```bash
node -e "const m=require('./packages/event/typescript/sdk/package.json');['repository','homepage','bugs','publishConfig'].forEach(k=>{if(!m[k])throw new Error('missing '+k)})"
```

```bash
cd integrations/nexent/v2.5.0 && shasum -a 256 -c SHA256SUMS
```

```bash
npm publish --dry-run --workspace @runfold/event
```

R52、R54、R56、R57、R58 完成后，`npm run verify` 应同时覆盖发布元数据、
集成产物哈希与文档地图；R53 完成后 vendored tarball 与 HEAD 一致；R59 只做
发布前准备，注册动作由维护者执行；R55 需要维护者先给出条款口径。

## 执行顺序

1. R52 → R56 → R57 → R58：互不依赖的低风险项，各自独立提交。
2. R53：依赖 R52 定稿的 manifest，重建 tarball 并重放补丁 0003。
3. R54：依赖 R53 的新哈希，再把校验脚本接进 `npm run verify`。
4. R59：R52 完成后准备发布清单，交维护者注册。
5. R55：等待维护者给出条款口径后再动。

每步独立绿色、独立提交、立即推送（`AGENTS.md`）。
