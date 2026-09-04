# Event trajectory infrastructure documentation

This directory is the map for the Event infrastructure's design and project
records. It contains no independent rules or logic; the linked documents are
authoritative, and conflicts must be resolved in documentation before the
implementation changes.

The five governing documents use paired language files. English `<name>.md` is
canonical and Chinese `<name>.zh.md` is its translation. Operational
`tasks.md` and `tasks/` records remain Chinese-only because they change
frequently.

| Document | Language | Purpose |
| --- | --- | --- |
| Requirements | [`English`](requirements.md) · [`中文`](requirements.zh.md) | What must be built and what qualifies as complete |
| Architecture | [`English`](architecture.md) · [`中文`](architecture.zh.md) | Components, boundaries, and rules for upstream code and dependencies |
| Specification | [`English`](specification.md) · [`中文`](specification.zh.md) | Shared TypeScript/Python v0 interfaces, disk format, and conformance criteria |
| Testing | [`English`](testing.md) · [`中文`](testing.zh.md) | Evidence that requirements are met without behavioral regression |
| Decisions | [`English`](decisions.md) · [`中文`](decisions.zh.md) | Context, decisions, and consequences for key tradeoffs |
| [`tasks.md`](tasks.md) | Chinese | Plan, progress, and execution order |
| [`tasks/`](tasks/) | Chinese | Self-contained briefs keyed by checklist identifier |
| [`demos/`](demos/) | English | Demo catalog with each demo's name, content, date, and published files |
| [`demos/nexent/`](demos/nexent/) | Chinese | Playable Nexent trajectory, cold-restore, and fork acceptance demo |
| [`evidence/`](evidence/) | Assets | Nexent screenshots and trajectory acceptance evidence for R37/R38 |
| [`../../integrations/nexent/`](../../integrations/nexent/) | English | Replayable, verifiable Event integration patches by Nexent version |

Recommended reading order: `requirements.md` → `architecture.md` →
`specification.md` → `tasks.md` (Chinese operational record).

Code-level documentation lives alongside each implementation:
[`packages/event/typescript/README.md`](../../packages/event/typescript/README.md)
(source mapping and necessary deviations),
[`packages/event/typescript/TESTING.md`](../../packages/event/typescript/TESTING.md)
(test matrix),
[`packages/event/python/README.md`](../../packages/event/python/README.md), and
[`third_party/deepseek-harness/README.md`](../../third_party/deepseek-harness/README.md)
(upstream snapshot).
