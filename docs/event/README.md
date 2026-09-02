# Event 轨迹设施文档

本目录是 Event 设施的全部设计与管理文档。本文件只是地图，不含任何规则或
逻辑；规则以各文档为准，冲突时先改文档再改实现。

| 文档 | 类型 | 回答的问题 |
| --- | --- | --- |
| [`requirements.md`](requirements.md) | 需求说明书 | 要做什么，做到什么程度算完成 |
| [`architecture.md`](architecture.md) | 技术架构文档 | 由哪些部分组成，边界在哪里，按什么原则处理上游代码与依赖 |
| [`specification.md`](specification.md) | 接口与数据规格 | TypeScript 与 Python 共同遵守的 v0 逻辑接口、磁盘格式与一致性验收 |
| [`testing.md`](testing.md) | 验证策略 | 用什么证明需求被满足、行为没有退化 |
| [`decisions.md`](decisions.md) | 决策记录 | 关键取舍的背景、决定与后果 |
| [`tasks.md`](tasks.md) | 计划与进度 | 做到哪了，还剩什么，按什么顺序做 |
| [`tasks/`](tasks/) | 任务书 | 交给他人或工具执行的自包含任务，文件名对应清单编号 |

建议阅读顺序：`requirements.md` → `architecture.md` → `specification.md` →
`tasks.md`。

代码级文档在各自目录：
[`packages/event/typescript/README.md`](../../packages/event/typescript/README.md)
（来源映射与必要偏离）、
[`packages/event/typescript/TESTING.md`](../../packages/event/typescript/TESTING.md)
（测试矩阵）、
[`packages/event/python/README.md`](../../packages/event/python/README.md)、
[`third_party/deepseek-harness/README.md`](../../third_party/deepseek-harness/README.md)
（上游快照）。
