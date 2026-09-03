# Event v0 接口与数据规格

> 文档类型：接口与数据规格（specification）。回答"两种实现共同遵守的逻辑
> 接口、磁盘格式与一致性验收是什么"。需求见 [`requirements.md`](requirements.md)，
> 架构见 [`architecture.md`](architecture.md)。

本文件记录 TypeScript 与 Python 共同遵守的 Event v0 逻辑接口和持久化
边界。行为基线来自 DeepSeek Harness `0.1.2-alpha.3`（commit
`dd6322d604e00eec1ba5e0c8541159906a21094a`）；字段、序号、surface、repair
和磁盘格式以保留的 DSH 测试及 `conformance/event/v0/` 为准。

## 逻辑模型

- 一个 Session 由一个 header 和从 `0` 开始连续递增的 Event 序列组成。
- Event envelope 固定为 `type`、`seq`、`time`、`data`，可按规则携带
  `surfaceOp`、`sourceEventSeqs` 和 `ignorable`。
- 所有持久化值必须是无环、无损的 JSON；序号和时间必须是 JavaScript
  safe integer，Python 不允许写出 TypeScript 会舍入的整数。
- `user/message`、`assistant/message` 和 `tool/result` 是当前三个 surface
  Event；其他 Event 不得携带 surface 元数据。
- header 和 Event 的磁盘字段始终使用共同的 camelCase 名称。Python 只在
  方法参数和属性名上使用 snake_case，不改写数据字段。

公共 envelope schema 位于 [`schemas/event/v0/`](../../schemas/event/v0/)。
schema 描述可移植结构，完整的顺序、surface、repair 和未知 Event 规则由
实现与 conformance 用例共同约束。

## 行为接口映射

| 行为 | TypeScript | Python | 共同语义 |
| --- | --- | --- | --- |
| 创建 | `runtime.sessions.create(...)` | `store.create(...)` | 创建 header；Event 尚为空时保持惰性物化 |
| 追加 | `session.append(type, data, opts)` | `session.append(type, data, surface_op=..., source_event_seqs=...)` | 校验并复制 JSON，分配连续 `seq` 和当前毫秒时间 |
| 读取 | `sessionPersistence.load/inspect` | `persistence.load/inspect` | 返回独立、已校验的逻辑快照；`load` 提交必要 repair |
| 恢复/续写 | `runtime.restore(id)` | `store.restore/resume` | 采用原 header 和完整持久化前缀，只追加缺失的 `session/end-seed` |
| 持久化屏障 | `runtime.sessions.flush(session)` | `store.flush(session)` | 调用返回时此前 Event 已持久化 |
| fork | `runtime.sessions.fork(...)` | `store.fork(...)` | 仅接受存在且不位于 open turn 内的 inclusive 前缀 |
| 后缀读取 | `readFrom(id, seq)` | `read_from(id, seq)` | 从逻辑 seq 返回已展开 Event，不泄漏 packed row |
| 原始轨迹 | `readRaw(id)` | `read_raw(id)` | 返回解压后的逻辑 JSONL 文本和 header |
| 消息投影 | `deriveMessages()` | `derive_messages()` | 按当前 surface 顺序得到相同消息 |

TypeScript 通过 `createEventRuntime({ persistence })` 组合一个 `EventHost`、
`SessionStore` 和可选的持久化后端；`runtime.restore(id)` 是 `prepare` 后
发布 Session 的一步式入口。Python 使用 `SessionStore` 与 persistence 直接
组合。两侧都不依赖 Cordis，也不运行 server、sidecar 或子进程。

上表描述的是**逻辑等价**，不是 API 等价。下列接口只有一侧提供，另一侧
没有对应物，调用方不能假设它们存在：

| 接口 | 提供方 | 说明 |
| --- | --- | --- |
| write-behind 批处理（`writeBatchMaxDelayMs`） | 仅 TypeScript | Python 的 `flush` 同步写盘，没有延迟批次；两侧对外的持久化屏障语义相同 |
| `SessionPreparation` / `persistence.prepare` | 仅 TypeScript | 未发布 Session 的所有权句柄；`runtime.restore` 封装了它，与 Python 的 `restore` 对应 |
| `listSnapshots` | 仅 TypeScript | 返回 header 与 revision token；Python 只有 `list` 返回 header |
| `inspect(id, signal)` 的 `AbortSignal` | 仅 TypeScript | Python 的 `inspect` 不可取消 |
| borrowed live source | 仅 TypeScript | 读取时若同 id 的 Session 已在线，返回其快照；Python 直接读磁盘 |
| `store.resume(id)` | 仅 Python | 与 `store.restore(id)` 完全相同的别名，保留只为与本文档的 resume 术语对应 |

## restore、resume 与 fork

- `inspect` 可以返回内存中的确定性 repair 视图，但不修改 torn physical tail。
- `load` 丢弃最后一个不完整物理记录，保留已经完整写出的 Event，并按 DSH
  顺序补齐未完成的 tool result、`step/end` 和 `turn/end`。
- resume 采用 restore 后的完整历史；每次完整历史在上一次 seed 边界之后包含
  新的 live 后缀、且末尾不是 `session/end-seed` 时，构造生命周期追加一个新的
  marker 来标记本次 seed/live 边界。重复恢复已经以该 marker 结尾的同一历史
  则保持幂等，不会为单纯浏览或再次打开继续增长。这与固定 DSH property test
  的“每个显式 replay 一个边界、terminal marker replay 幂等”一致。
- fork 的 `boundary` 是 inclusive Event seq。子 Session 保存
  `parentSession` 与 `seedLength`，继承 parent 的 `cwd`，但拥有新的 id 和
  `createdAt`。

共享 repair 输入与逐字段预期结果固定在
[`conformance/event/v0/cases/repair.json`](../../conformance/event/v0/cases/repair.json)。

## JSONL 物理格式

```text
<root>/
└── <project-key>/
    └── <encoded-session-id>/
        └── session.jsonl[.zstd]
```

- 第一条 JSONL record 是 `type: "session"` 的 header；后续 record 是 Event
  或 storage-only packed chunk row。
- 三个以上连续且形状完全匹配的 text/reasoning/tool-call delta 可以写成一个
  packed row；读取后必须还原为逐 Event 历史。
- 连续的 `sourceEventSeqs` 可以在磁盘上写成 `[start, end]` range；公开逻辑
  API 总是返回展开后的整数数组。
- `none` 使用 UTF-8 明文 JSONL。`zstd` 使用多个相互独立、带 checksum 的
  Zstandard frame：header 独占第一个 frame，每个追加批次形成后续 frame。
- 同一 root 不能混用明文和 Zstandard；旧版 project 目录下的平铺
  `<id>.jsonl[.zstd]` 明确拒绝，不能静默忽略。
- 物化采用临时文件、fsync 和原子发布；追加失败回滚到原长度。
- 两种实现都不使用跨进程文件锁，与 DSH 一致：同一 Session 同一时刻只能有
  一个写入进程，由调用方保证。进程内串行化由 TypeScript 的持久化协调器和
  Python 的每 Session `RLock` 各自负责。

Python 3.14 使用标准库 `compression.zstd`；Python 3.10–3.13 通过
`runfold-event[zstd]` 使用 `zstandard`。两条路径写出同一种 checksummed
frame，不把压缩实现暴露进逻辑 API。

## Python 必要实现映射

Python 不是对 TypeScript 源码逐行翻译，也不是远程 SDK；它按相同可观察
行为原生实现。下列偏离均由语言或独立发布要求直接产生：

| DSH 行为来源 | Python 位置 | 必要理由 | 回归证据 |
| --- | --- | --- | --- |
| `core/session` | `runfold/event/session.py`、`surface.py`、`repair.py`、`request_header.py` | 去除 Cordis、brand 和完整 LLM runtime，只保留 Event 行为 | Python core tests、共享 validation/repair cases |
| `core/session/chunk-rows`、`seq-ranges` | `chunk_rows.py` | 保持同一 storage codec，供两种语言直接交换文件 | packed fixture 与双向 JSONL tests |
| `session-persistence-jsonl` | `format.py`、`persistence_jsonl.py`、`_zstd.py` | Python 进程内原生 persistence；不引入 Node server | plain/Zstd/torn-tail/restart/package tests |
| DSH JSON snapshot 与 message 小工具 | `_json.py`、`messages.py`、`types.py` | Event 只需要最小 JSON/message 形状，不能依赖整个 DSH runtime | invalid-input、message 与安装测试 |

Python 返回独立快照，避免调用方修改内部日志；TypeScript 返回 deep-frozen
对象。两者的可观察保证相同：已接受的历史不能被调用方改写。

## 一致性验收

`conformance/event/v0/` 同时包含有效/无效 Session、确定性 repair 和 packed
JSONL 投影。系统测试还执行以下真实文件链路：

- Python 写明文/Zstandard，TypeScript 经 `runtime.restore()` 恢复，再 append、
  flush、fork，最后由 Python 经 `restore/resume` 重读；
- TypeScript 写明文/Zstandard，Python 经 `restore/resume` 恢复、append、fork，
  最后由 TypeScript 经 `runtime.restore()` 重读；
- Python 轨迹进入保留的 TypeScript Trajectory UI 并渲染消息；
- 规范化后的 header、Event、surface、messages 和 repair 逐字段相等。

随机 UUID、实时 `createdAt`/`time`、JSON object key order 和压缩后的 frame
字节不要求跨语言逐字节相同；固定输入的逻辑结果必须相同。
