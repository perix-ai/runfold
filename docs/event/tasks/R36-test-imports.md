# 任务：移除保留上游测试文件中的 DSH import 名称

> 对应清单：[`../tasks.md`](../tasks.md) 第 6 节 R36。
> 执行者：Codex。状态：待执行。
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
3. 除 `third_party/` 外，整个仓库对 `@deepseek-ai/` 的 grep 只剩保留源码的
   `@module @deepseek-ai/...` JSDoc 来源注释（见"可选"）；
4. `npm run verify` 全绿，上游测试用例数不减少（当前 626 + 182 + 94）。

## 现状（2026-09-02）

25 个保留测试文件仍写上游包名，靠 `vitest.config.ts` 的 14 条别名解析：

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
- 每一步独立绿色、独立提交、立即推送（`AGENTS.md`）。

## 步骤

1. 先删除 3 个被排除的文件及其 `exclude` 行，跑 `npm run verify`，单独提交。
2. 按上表为 22 个文件登记映射并改写 import；`tsconfig.tests.json` 若有对应
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

## 可选（不在本任务内，需用户决定）

保留源码与测试的 JSDoc `@module @deepseek-ai/...` 来源注释目前仍在。它们是
文本而非依赖，任务书 R25–R29 第 4 步第 6 点已要求发布产物不含该字样。若要
连源码注释也归零，另立任务：把每行改为 `Upstream: <上游相对路径> @ dd6322d6`
并登记进映射表。
