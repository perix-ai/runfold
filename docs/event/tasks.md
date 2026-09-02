# Event 抽离实施清单

本清单落实 [`README.md`](README.md) 中的目标和约束。完成标记必须以代码、
测试或打包验证为依据；仅创建目录或 API 占位不算完成。

> 总体状态：**进行中**。目录组织、Python 实现、跨语言契约和当前测试矩阵
> 已完成；TypeScript 的 DSH/Cordis 解耦仍有未完成项，因此 Event 抽离尚不能
> 标记为生产可用。

## 1. 文档与基线

- [x] 将 Event 专属文档统一到 `docs/event/`。
- [x] 固定 DSH 来源版本、抽离原则、非目标和完成标准。
- [x] 记录 TypeScript 与 Python 的公共 API、持久化格式和行为映射。
- [x] 为每项必要偏离保留来源、理由和回归测试。

## 2. 仓库组织

- [x] 可复用实现统一放在 `packages/event/<language>/`，采用项目优先、语言其次的结构。
- [x] 开发宿主放在 `apps/event/typescript/trajectory-demo/`，不混入可发布库。
- [x] 单语言测试随实现放置，跨语言测试统一放在 `tests/event/cross-language/`。
- [x] 共享 schema 与 conformance 数据分别放在 `schemas/event/` 和 `conformance/event/`。
- [x] 未修改的 DSH 来源快照独立保存在 `third_party/deepseek-harness/`。

## 3. TypeScript 解耦

- [x] 审计 `packages/event/typescript/` 中全部 `@deepseek-ai/*` 与 Cordis 依赖。
- [ ] 删除 Harness 宿主、scope、typert、插件生命周期等非 Event 能力。
- [ ] 将 Event 必需的消息、ID 和 JSON 工具裁剪为 Perix 自有最小实现。
- [ ] 移除 `@perix/event-sdk/runtime` 对 Cordis 的整包导出。
- [ ] 移除 `@perix/event-sdk/messages` 对 `dsh-llm` 的整包导出。
- [x] 保持 Session、fork、repair、surface、JSONL 和 Trajectory 行为不退化。
- [ ] 验证打包产物不存在 DSH 运行时依赖或公共命名空间泄漏。

## 4. Python 原生实现

- [x] 建立可安装的 `perix-event-sdk` 包及清晰的公开 API。
- [x] 实现 Session header、Event envelope、连续序号和 JSON 值校验。
- [x] 实现 surface append/replace、来源序号验证和消息投影。
- [x] 实现 request header/context fold、chunk row 与 seq-range 编解码。
- [x] 实现 SessionStore、restore、resume 和稳定前缀 fork。
- [x] 实现中断 turn/tool/step 的确定性 repair。
- [x] 实现 DSH 兼容的明文 JSONL 持久化、追加、读取、列表和 torn-tail 修复。
- [x] 实现 DSH 兼容的 Zstandard 多 frame 读写，并提供明确的可选依赖策略。
- [x] 实现空白项目安装与公共 API smoke test。

## 5. 跨语言契约

- [x] 将共享有效/无效轨迹夹具放入 `conformance/`。
- [x] TypeScript 和 Python 对同一夹具给出相同接受/拒绝结果。
- [x] TypeScript 写出的轨迹可由 Python restore、resume、append 和 fork。
- [x] Python 写出的轨迹可由 TypeScript restore、resume、append 和 fork。
- [x] Python 轨迹可由 TypeScript Trajectory UI 投影和渲染。
- [x] 规范化后的 header、Event、surface、messages 和 repair 结果等价。

## 6. 测试与交付

- [x] 保留并通过 DSH 上游 Event 与 Trajectory 回归套件。
- [x] Python 单元测试覆盖全部核心行为、错误边界和异常输入。
- [x] Python 集成测试覆盖持久化重启、repair、resume 和 fork。
- [x] 明文、Zstandard、packed chunks、截断日志和大历史均有测试。
- [x] 根级 `verify` 同时运行 TypeScript、Python、跨语言和打包测试。
- [x] README、测试矩阵和本清单与当前实现一致。

## 7. 总体验收

- [ ] Event 轨迹设施达到生产可用。只有以上所有任务均完成、公共产物不再
  泄漏 DSH 运行时依赖，并通过完整验证后才能勾选此项。
