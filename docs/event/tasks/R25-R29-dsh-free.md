# 任务：彻底移除 TypeScript 侧对 DeepSeek Harness 的一切依赖

> 对应清单：[`../tasks.md`](../tasks.md) 第 3.2 节 R25–R29。
> 执行者：Codex。状态：进行中（R25–R28 已完成，R29 待执行）。
>
> 本文自包含；执行前先读 [`../architecture.md`](../architecture.md)（抽离原则）、
> [`../tasks.md`](../tasks.md) 第 3 节（已完成的解耦）、
> [`../../../packages/event/typescript/README.md`](../../../packages/event/typescript/README.md)
> 和 [`../../../AGENTS.md`](../../../AGENTS.md)（提交与推送规则）。

## 目标

完成后，仓库满足以下四条，且缺一不可：

1. `packages/event/**`、`tests/**`、`apps/**` 下的任何 `.ts/.tsx/.mjs` 文件，
   其 `import`、`export ... from`、`declare module`、`require()` 中都不再出现
   `@deepseek-ai/` 前缀。
2. 任何 `package.json`、`package-lock.json`、`vitest.config.ts`、`tsconfig*.json`
   中都不再出现 `@deepseek-ai` 字样；`npm ls` 输出里没有 `@deepseek-ai/*`；
   根 `package.json` 的 `overrides` 删除。
3. `npm run verify` 全绿：上游回归套件（当前 626 + 94 个用例）、Perix
   TS/Python/跨语言/打包测试全部通过，`verify:upstream-identity` 通过。
4. `@perix/event-sdk`、`@perix/event-ui` 的发布产物与今天行为一致；
   `tests/package/package-consumer.mjs` 的泄漏断言继续通过并按第 4 步收紧。

`third_party/deepseek-harness/upstream/` 是唯一允许保留 DSH 名称的地方，
它是审计快照，不参与构建。

## 现状（2026-09-01）

已经消除的：`@perix/event-sdk` 发布产物不含任何 DSH 引用，运行时依赖只剩
`koffi` 与 `@types/node`；Cordis、dsh-scope、dsh-llm、dsh-brand、dsh-util-values、
dsh-timeout、schemastery、typert 已由 `packages/event/typescript/runtime/` 替代。

仍然存在的两类：

| 类别 | 现状 | 数量 |
| --- | --- | --- |
| A. 代码里的名字 | 保留源码仍写 `from '@deepseek-ai/dsh-session'` 等，由 `sdk/vite.config.ts`、`sdk/tsconfig*.json`、`vitest.config.ts`、`tsconfig.tests.json`、`ui/trajectory/tsconfig.json` 的别名解析到本地文件 | 核心 14 个文件；UI 闭包约 30 个文件 |
| B. 真实的注册表包 | `@perix/event-ui` 的 devDependencies 列出 25 个 `@deepseek-ai/*`，构建时打进 bundle；根 `package.json` 用 `overrides` 钉住版本 | 运行时真正用到 2 个包，其余只提供类型 |

B 类的精确用量（保留 UI 源码 + `ui/trajectory/src`，不含测试）：

**运行时（值）导入，必须裁入仓库：**

| 包 | 用到的导出 | 上游位置 | 备注 |
| --- | --- | --- | --- |
| `dsh-client-store` | `createSnapshotStore`；类型 `ObservableSnapshot`、`SnapshotStore` | `packages/client/store/src`（3 个文件） | 第三方依赖 `immer`、`zustand` |
| `dsh-client-ui-primitives` | `IconChevronRightOutline14`、`IconSettingsOutline16`、`IconSparkle16`、`IconUserOutline16`、`IconSearchOutline16`、`Tooltip`、`JsonTree`、`MarkdownText`、`extractMarkdownPlainText`；类型 `JsonTreeLabels`、`MarkdownLabels` | `packages/client/ui-primitives/src`（75 个文件，取闭包子集） | 第三方依赖：`shiki`、`@shikijs/langs`、`mdast-util-*`、`micromark-*`、`katex`、`anser`、`clsx`、`@types/mdast` |

**仅类型导入，改为本地类型模块或裁入对应类型文件：**

| 包 | 用到的类型 |
| --- | --- |
| `cordis` | `Context`（仅作为 `register*Definition(ctx)` 的参数类型；`ui/trajectory/src/trajectory-runtime.ts` 用 `as unknown as Context` 造了一个只含 `uiConversation` 的对象） |
| `dsh-api-session-controller/client`、`/types` | `SessionSnapshot`、`SessionProjectionMap`、`UseProjection`、`SessionLiveEventEntry`、`SessionEventLikeEntry`、`SessionEventLike`、`SessionBinding`、`SessionListState`、`ChunkRowEvent` |
| `dsh-client-ui-conversation/client` | `ConversationNodeDefinition`、`ConversationViewDefinition`、`ConversationSnapshot`、`InputActions`、`InputState`、`MessageImageLoader`、`RequestView`、`ConversationNodeContext`、`ConversationPromptSnapshot`、`RenderMessageImages`、`AssistantRequestConfig` 等（`packages/client/ui-conversation/src/client/contract/` 已保留 4 个文件，其余从快照补入） |
| `dsh-client-ui-slots` | `InjectFace`、`PropsLocale`、`PropsRenderSlots`、`TranslateNS`、`SnapshotSelectorHook`、`HostObservable`（4 个源文件，整体裁入） |
| `dsh-client-ui-session/client` | `SessionPendingInteractionSnapshot` |
| `dsh-client-locale/client` | 仅 `import type {}` 副作用增强（`TranslateNS` 命名空间） |
| `dsh-attachment` | `ImageAttachmentRef`（`runtime/src/messages.ts` 已有同形定义） |
| `dsh-llm/types`、`/brand` | `ContentBlock`、`StreamChunk`、`ToolSchema`、`MessageId`（`runtime/src/messages.ts` 已有） |
| `dsh-session/types` | `SessionId`、`SessionEvent`（保留源码内部引用，改相对路径） |
| `dsh-agent/types`、`dsh-tools/types`、`dsh-compaction/types`、`dsh-llm-retry/types`、`dsh-commands/brand`、`dsh-tool-todo/client` | `import type {}` 副作用增强：它们向 `SessionEventMap`、`ContentBlockMap` 等合并插件事件的数据类型（`tool/call`、`compaction/*`、`llm/retry`、`todo/write`、`command/*`），Trajectory 渲染这些事件时依赖这些形状 |
| `dsh-api-workspace-controller/client` | `WorkspaceSnapshot`（仅上游测试与 `EventTrajectory` 的 `as never` 桩） |
| `dsh-invariants` | 仅 `invariant.ts` 文件，不参与构建 |

## 约束

- 仍然遵守 `architecture.md` 3.1 的优先级：先保行为，再去耦合，最后才美化。不重写任何算法。
- 裁入仓库的每个上游文件都必须来自固定 commit `dd6322d604e00eec1ba5e0c8541159906a21094a`，
  放在 `packages/event/typescript/packages/` 下保持上游相对路径，并纳入
  `scripts/verify-upstream-identity.mjs` 的比对范围。凡不在快照里的上游包，
  先按 `third_party/deepseek-harness/README.md` 的规则补入快照，再裁剪。
- 本地新写的代码只能放在 `packages/event/typescript/runtime/`、`ui/trajectory/`、
  `test-support/`、`tests/`，并在对应 README 登记来源与理由。
- 上游测试文件（`packages/**/tests/`）不改内容。它们的 `import` 里的 DSH 名字
  通过 `vitest.config.ts` 别名解析到本地文件，这是唯一允许"名字仍在"的地方；
  如果决定连测试文件也改写，必须把改写规则写进一致性脚本的映射表。
- 每一步都是独立可提交的绿色状态；按 AGENTS.md 逐步提交并推送。

## 步骤（按容易改、风险小排序）

### 第 1 步（R25）：一致性脚本支持"声明的改写映射"

把 `scripts/verify-upstream-identity.mjs` 改成三段式比对：

1. 读取保留文件与上游文件；
2. 对**上游**内容应用一张显式的 specifier 映射表（例如
   `'@deepseek-ai/dsh-brand'` → `'../../../../runtime/src/brand.ts'`，按文件相对
   位置计算），映射表与 `ALLOWED_DIFFERENCES` 一起写在脚本里；
3. 映射后仍必须逐字节相等，否则报错。

这样第 2、3 步改写 import 之后，"除 import 行外与上游一致"仍然是机器可验证的
事实，`ALLOWED_DIFFERENCES` 不会膨胀。先在不改任何源码的情况下让脚本通过
（映射表为空时行为与现在相同），单独提交。

### 第 2 步（R26）：核心与持久化源码的 import 改写

**完成（2026-09-02）。** 14 个实现文件登记 26 条 specifier 映射；三个
`invariant.ts` 与三个宿主专用测试从保留树删除。完整 `npm run verify` 通过，
身份审计结果为 126 个保留文件、9 个文档化差异、26 个声明映射。UI 闭包仍需的
Session、LLM、attachment 类型映射保留到 R27，不属于 SDK 构建依赖。

涉及 14 个文件：

```text
packages/core/session/src/{index,types,surface,repair,request-header,chunk-rows}.ts
packages/session/session-persistence/src/{index,coordinator,preparations,write-behind,revision,errors}.ts
packages/session/session-persistence-jsonl/src/{index,format}.ts
```

改写规则（只动 import/export 行）：

| 现在 | 改为 |
| --- | --- |
| `@deepseek-ai/dsh-session`、`/types`、`/surface`、`/chunk-rows` | 相对路径到 `packages/core/session/src/*.ts` |
| `@deepseek-ai/dsh-session-persistence` | 相对路径到 `packages/session/session-persistence/src/index.ts` |
| `@deepseek-ai/dsh-brand`、`dsh-util-values`、`dsh-timeout` | 相对路径到 `runtime/src/{brand,values,timeout}.ts` |
| `@deepseek-ai/dsh-llm`、`/brand`、`/types` | 相对路径到 `runtime/src/messages.ts` |
| `@perix/event-sdk/runtime`（import 与 `declare module`） | **保留不动**。它是本包的公开子路径，自引用合法，且 `declare module` 用相对 `.ts` 路径无法进入发布的 d.ts |

完成后：删除 `sdk/vite.config.ts`、`sdk/tsconfig.json`、`sdk/tsconfig.lib.json`、
`vitest.config.ts`、`tsconfig.tests.json`、`ui/trajectory/tsconfig.json` 中对应的
`@deepseek-ai/*` 别名；`sdk/scripts/rewrite-internal-type-imports.mjs` 只剩
`@perix/event-sdk/runtime` 一项映射，评估后可保留或删除。把改写规则登记进第 1 步
的映射表。`npm run verify` 必须全绿。

三个 `invariant.ts` 与被排除的三个测试（`scoped/typert/invariant.spec.ts`）仍引用
Cordis：把它们从保留树中删除（源码在快照里可查），并在 TS README 的表格里
注明"未保留"。同时删除 `sdk/src/*` 中不再需要的入口（当前已无 invariant 入口）。

### 第 3 步（R27）：UI 闭包的类型依赖本地化

**完成（2026-09-02）。** 新增本地 UI 类型与 Event 增强模块，保留 UI 源码的
45 条新增 specifier 映射由身份脚本逐字节约束；独立宿主以最小注册接口取代 Cordis
cast，并删除不用的浏览器插件入口与 invariants companion。完整 `npm run verify`
通过；身份审计结果为 124 个保留文件、9 个文档化差异、71 个声明映射。

新建 `packages/event/typescript/runtime/src/ui-types.ts`（或按来源拆成几个文件），
承接上表"仅类型导入"的全部类型。做法二选一，按每个类型的来源决定：

- 类型定义在快照里且自身没有 DSH 依赖闭包的（`ui-slots` 4 个文件、`ui-session`
  的快照类型、`api/session-controller/src/client/*` 中的纯类型文件、
  `ui-conversation/src/client/contract/*` 剩余文件）：直接裁入
  `packages/event/typescript/packages/` 对应路径，纳入一致性比对；
- 类型只是几行接口、但所在文件拖着整个运行时（`SessionSnapshot` 所在的
  session-controller 服务文件、`Context`）：在 `ui-types.ts` 中按上游逐字段复制，
  文件头注明来源路径与 commit。

`register*Definition(ctx: Context)` 五个函数只用 `ctx.uiConversation.events.register`
与 `ctx.uiConversation.inspectRequestPrompt`：把参数类型改为本地
`TrajectoryRegistrationContext` 接口（两个成员），`ui/trajectory/src/trajectory-runtime.ts`
去掉 `as unknown as Context`。这是允许的宿主接缝改动，登记进映射表或
`ALLOWED_DIFFERENCES`。

六个 `import type {} from '@deepseek-ai/dsh-*/types'` 副作用增强：从快照复制它们
对 `SessionEventMap`/`ContentBlockMap`/`MessageSourceMap` 的 `declare module` 片段到
`runtime/src/event-types.ts`，把增强目标改为 `'@perix/event-sdk/session/types'`（同样是
本包公开子路径），并让 Trajectory 定义文件改 import 这个本地模块。用
`tests/ui/event-trajectory.spec.tsx` 里现有的工具调用、压缩、重试事件渲染断言证明
数据形状未丢。

### 第 4 步（R28）：UI 闭包的运行时依赖裁入仓库

**完成（2026-09-02）。** 静态 import 图确认并裁入 2 个 store 源文件、23 个
UI-primitives 源文件，以及对应的 9 个上游套件和 48 份 DOM 基线；新增 182 个测试。
25 个 DSH devDependencies、根 overrides 和 lockfile 中全部 DSH 包已删除，第三方
依赖改为直接声明。完整 `npm run verify` 通过；身份审计为 207 个保留文件、10 个
文档化差异、87 个声明映射，`npm ls --all` 与发布物扫描均无 DSH registry namespace。

1. 从快照裁入 `packages/client/store/src`（3 个文件）；`immer`、`zustand`
   加入 `@perix/event-ui` 的 dependencies（打包进 bundle 时可放 devDependencies，
   以 `vite.library.config.ts` 的 external 设置为准，保持现状：只 external React）。
2. 从快照裁入 `packages/client/ui-primitives/src` 中被 `Icon*`、`Tooltip`、
   `JsonTree`、`MarkdownText`、`extractMarkdownPlainText` 引用到的闭包（按 import
   图追，预计 30–50 个文件，包含 markdown、代码高亮、KaTeX 渲染）。它们的第三方
   依赖（`shiki`、`@shikijs/langs`、`mdast-util-*`、`micromark-*`、`katex`、`anser`、
   `clsx`、`@types/mdast`）按上游 `package.json` 的版本范围加入 `@perix/event-ui`。
   注意 `ui-primitives` 自身对 `cordis` 的引用（如有）按第 3 步的方式处理。
3. `ui-conversation` 剩余的运行时需要（当前只保留了 assembler 与 request-inspection）
   若第 3 步暴露出新的值导入，同样从快照裁入。
4. 删除 `@perix/event-ui` devDependencies 里全部 `@deepseek-ai/*`；删除根
   `package.json` 的 `overrides`；`npm install` 重生成 lockfile；确认
   `npm ls @deepseek-ai/dsh-session` 等命令报"empty"。
5. `vitest.config.ts` 里剩余的 `@deepseek-ai/*` 别名只应服务上游测试文件；
   `ssr.noExternal` 里的 `dsh-client-ui-primitives` 删除。
6. `tests/package/package-consumer.mjs` 增加断言：安装后的 `@perix/event-ui/lib`
   与 `@perix/event-sdk/lib` 的所有 `.js/.d.ts` 完全不含 `@deepseek-ai`（连注释也不含；
   保留源码的 `@module @deepseek-ai/...` JSDoc 改为 `Upstream: <相对路径> @ dd6322d6`
   形式，并登记进映射表）。

### 第 5 步（R29）：收尾

- `third_party/deepseek-harness/README.md`：更新"仅注册表引用"那一组为"已裁入"。
- `packages/event/typescript/README.md`：来源映射表补上新裁入的目录；删除
  "Original DSH module specifiers remain only inside retained upstream source"
  一段，改为描述映射表机制。
- `docs/event/decisions.md` 的 D04/D05 标注结果，`tasks.md` R25–R29 标记完成，写明每步的
  文件数与验证结果。
- 全量 `npm run verify` 通过后，把 `tasks.md` 第 7 节总验收项的前置条件更新为
  "包括本任务"。

## 验收命令

```bash
npm run verify
```

```bash
grep -rnE "(from|import|require|declare module)\s*\(?\s*['\"]@deepseek-ai/" packages tests apps --include='*.ts' --include='*.tsx' --include='*.mjs' | grep -v third_party
```

```bash
grep -rn "@deepseek-ai" package.json package-lock.json vitest.config.ts packages/event/typescript/*/package.json packages/event/typescript/*/*/package.json packages/event/typescript/tsconfig*.json
```

```bash
npm ls 2>/dev/null | grep -c "@deepseek-ai" || true
```

前两条 grep 与最后一条计数都必须为空或 0（第二条允许 `packages/**/tests/` 中的
上游测试文件命中，前提是它们通过 vitest 别名解析且映射表已登记）。

## 预计工作量与风险

| 步骤 | 工作量 | 风险 |
| --- | --- | --- |
| R25 脚本 | 半天 | 低 |
| R26 核心 import 改写 | 半天 | 低，上游 626 用例锁定 |
| R27 UI 类型本地化 | 1 天 | 中，类型增强漏项会在 `test:types` 与 UI 渲染测试暴露 |
| R28 UI 运行时裁入 | 2–3 天 | 中，`ui-primitives` 的 markdown/shiki 管线体量最大，但其依赖全是第三方 |
| R29 收尾 | 半天 | 低 |
