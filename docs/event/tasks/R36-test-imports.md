# 任务：移除保留上游测试文件中的 DSH import 名称

> 对应清单：[`../tasks.md`](../tasks.md) 第 6 节 R36。
> 执行者：Codex。状态：已完成（2026-09-02）。
>
> 前置：R25–R29 已完成。本文沿用 [`R25-R29-dsh-free.md`](R25-R29-dsh-free.md)
> 建立的机制：`scripts/verify-upstream-identity.mjs` 的 `SPECIFIER_MAPPINGS`
> 对上游内容应用声明的改写后再逐字节比对。

## 目标

完成后：

1. `packages/event/typescript/packages/**/tests/` 下不再有任何
   `@deepseek-ai/` import；
2. `vitest.config.ts`、`tsconfig.tests.json` 及所有配置文件中不再有
   `@deepseek-ai` 字样，任务书 R25–R29 里"测试专用别名"的例外取消；
3. 除 `third_party/` 外，不再有以 `@deepseek-ai/` 为目标的 import、export、
   require 或 module augmentation；字面名称只用于身份映射声明、审计 manifests、
   来源注释和防泄漏断言（见“可选”）；
4. `npm run verify` 全绿，上游测试用例数不减少（当前 626 + 182 + 94）。

## 执行前现状（2026-09-02）

初审按测试入口统计为 25 个；执行时逐文件审计确认实际有 26 个含上游包名的
测试树文件，其中包含一个 `locale.client.ts` 辅助文件。3 个原本被排除，余下
23 个靠 `vitest.config.ts` 的 14 条别名解析：

| 上游 specifier | 出现次数 | 改写目标（相对路径，脚本按文件位置计算） |
| --- | --- | --- |
| `@deepseek-ai/dsh-session`、`/types`、`/chunk-rows`、`/surface` | 26 + 2 + 2 + 1 | `packages/core/session/src/{index,types,chunk-rows,surface}.ts` |
| `@deepseek-ai/dsh-llm`、`/types` | 13 + 1 | `runtime/src/messages.ts` |
| `@deepseek-ai/cordis` | 8 | `test-support/cordis-shim.ts` |
| `@deepseek-ai/dsh-scope` | 1 | `test-support/scope-shim.ts` |
| `@deepseek-ai/dsh-util-values` | 2 | `runtime/src/values.ts` |
| `@deepseek-ai/dsh-session-persistence-jsonl` | 2 | `packages/session/session-persistence-jsonl/src/index.ts` |
| `@deepseek-ai/dsh-client-ui-conversation/client` | 8 | `ui/trajectory/src/conversation-client.ts` |
| `@deepseek-ai/dsh-client-ui-renderer/client` | 2 | `packages/client/ui-renderer/src/client/bind.ts` |
| `@deepseek-ai/dsh-client-store` | 2 | `packages/client/store/src/index.ts` |
| `@deepseek-ai/dsh-client-ui-slots` | 1 | `runtime/src/ui-types.ts` |
| `@deepseek-ai/dsh-api-session-controller/client`、`/types` | 2 + 1 | `runtime/src/ui-types.ts` |
| `@deepseek-ai/dsh-client-locale/src/locales/{en,zh}.ts` | 1 + 1 | `packages/client/locale/src/locales/{en,zh}.ts` |
| `@deepseek-ai/dsh-client-ui-trajectory`、`/client` | 1 + 1 | 需评估：上游 `src/client/index.ts` 插件入口未保留，看用例实际取用什么，映射到 `ui/trajectory/src/trajectory-runtime.ts` 或删除该用例 |

另有 3 个文件一直被 `vitest.config.ts` 排除且引用本仓库没有的包
（`dsh-client-test-runtime`、`dsh-client-ui-chat`、`dsh-api-workspace-controller`、
`dsh-client-ui-session`、`ui-conversation/src/...` 深路径）：

| 文件 | 处理 |
| --- | --- |
| `core/session/tests/gen-persistence-catalog.spec.ts` | 删除：测试 DSH monorepo 代码生成契约 |
| `client/ui-trajectory/tests/client-bundle.client.spec.ts` | 删除：测试 DSH 浏览器 ModuleLoader 打包契约，已由 `tests/package` 替代 |
| `client/ui-trajectory/tests/views.client.spec.tsx` | 删除：其 25 个与 shell 无关用例已移植到 `tests/ui/trajectory-view.spec.tsx`（R10），其余 6 个测试 shell 机制 |

三个文件的原始字节都在 `third_party` 快照中；删除后从 `vitest.config.ts`
的 `exclude` 移除对应行。

## 约束

- 只改 import/export 行，每一处都进入 `SPECIFIER_MAPPINGS`；不允许把测试文件
  加入 `ALLOWED_DIFFERENCES`。
- 不改测试逻辑、断言与夹具。若某个 specifier 的本地目标缺少上游导出（例如
  `dsh-client-ui-trajectory/client` 的 `apply/inject`），优先补一个本地
  test-support 垫片并登记来源，其次才是删除该用例，并在 TESTING.md 登记。
- 改写后上游用例数不得减少（删除的 3 个文件本来就被排除，不计入）。
- 各阶段先做针对性验证；整个 R36 通过完整门禁后作为一个编号任务提交并立即
  推送，不提交中间失败或半完成状态。

## 步骤

1. 先删除 3 个被排除的文件及其 `exclude` 行，确认现有测试数量不变。
2. 按上表为 23 个文件登记映射并改写 import；`tsconfig.tests.json` 若有对应
   `paths` 一并删除；跑 `test:upstream`、`test:types`。
3. 删除 `vitest.config.ts` 中全部 `@deepseek-ai` 别名，删除
   `tsconfig.tests.json` 中残留的 `@deepseek-ai` 路径；跑 `npm run verify`。
4. 更新 `packages/event/typescript/README.md`（"Retained tests kept unmodified"
   一段改为描述映射机制）、`TESTING.md`（Known gaps 表）、
   `docs/event/decisions.md` D05 后果、`tasks.md` R36 结果。

## 验收命令

```bash
grep -rnE "(from|import|require|declare module)\s*\(?\s*['\"]@deepseek-ai/" packages tests apps scripts vitest.config.ts --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.json' | grep -v third_party
```

```bash
grep -rn "@deepseek-ai" vitest.config.ts package.json packages/event/typescript/tsconfig*.json packages/event/typescript/*/package.json packages/event/typescript/*/*/package.json
```

两条都必须为空，然后 `npm run verify` 全绿。

## 完成记录

- 删除 `gen-persistence-catalog.spec.ts`、`client-bundle.client.spec.ts` 和
  `views.client.spec.tsx`，同时删除其 `vitest.config.ts` 排除项；三者从未计入
  当前测试数，原件仍在固定 `third_party` 快照。
- 23 个保留测试/辅助文件仅把 DSH 模块 specifier 改为本地相对路径，测试逻辑、
  断言与夹具未改。`fork.spec.ts` 的 module augmentation 同样改为对应的本地
  `types.ts` 路径。
- `SPECIFIER_MAPPINGS` 新增 52 条逐文件声明，总数由 87 增至 139；删除 3 个文件
  后保留文件由 207 变为 204，必要差异仍为 10。身份门禁证明改写之外的字节与
  固定 DSH 快照一致。
- `vitest.config.ts` 删除全部 14 条 DSH 别名；`tsconfig.tests.json` 原本已无
  DSH path，因此无需改动。两条验收扫描均为空。
- 完整 `npm run verify` 通过：626 Event、182 UI runtime、94 Trajectory 及总计
  1005 个行为测试不减少，三个构建、TypeScript 类型检查和 TypeScript/Python
  空白消费者安装全部成功。

## 可选（不在本任务内，需用户决定）

保留源码与测试的 JSDoc `@module @deepseek-ai/...` 来源注释目前仍在。它们是
文本而非依赖，任务书 R25–R29 第 4 步第 6 点已要求发布产物不含该字样。若要
连源码注释也归零，另立任务：把每行改为 `Upstream: <上游相对路径> @ dd6322d6`
并登记进映射表。
