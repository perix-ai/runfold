# Event 轨迹设施决策记录

> 语言：[English](decisions.md) | 中文
>
> 文档类型：决策记录（轻量 ADR）。每条记录一个不可从代码直接推断的取舍：
> 背景、决定、后果、相关条目。新决策追加在末尾，已作废的标注"已被 Dxx
> 取代"而不删除。

## D01 · 不 vendor 或 bundle Cordis，用本地 EventHost 替换宿主接缝

- 日期：2026-09-01
- 背景：DSH 的 `SessionStore`、`SessionPersistence`、JSONL 后端都继承 Cordis
  `Service`，靠 `ctx.effect/on/emit/parallel`、scope carrier、typert 注册和
  `declare module` 扩展工作。把 Cordis 打进内部 chunk 可以让发布产物不暴露
  它，但 Event 的生命周期语义仍由一个插件平台定义，这是反向依赖。
- 决定：不 vendor、不 bundle。允许修改保留源码，但只限宿主接缝行；用
  `runtime/src/host.ts` 的 `EventHost` 提供事件总线、反序释放的作用域和
  组合槽，并复现"经作用域读取的服务视图绑定该作用域"这一条 Cordis 语义。
- 后果：五个保留文件进入允许差异清单；scope 过滤分发、typert、invariants
  插件不再保留，对应三个上游测试排除；其余 626 个上游测试经测试专用垫片
  原样通过。R30 又用 11 个独立测试锁定 EventHost 的事件、effect、scope、释放
  和服务绑定行为，并修复 effect 初始化期间重入释放与异步拒绝观察两处偏差。
- 相关：tasks.md R16–R21；`architecture.md` 3.4。

## D02 · 删除早期从零设计的 Runtime Data 草案

- 日期：2026-09-01
- 背景：仓库早期的 `spec/`、`rfcs/0001`、`schemas/v0`、`conformance/cases`、
  `adapters/`、`docs/architecture.md`、`docs/invariants.md` 描述 namespace、
  event_id、seq 从 1 起、经 Checkpoint fork 且"父事件不得复制"的模型，与
  正在抽离的 DSH Event 模型（seq 从 0 起、fork 复制前缀、无 namespace）矛盾。
- 决定：直接删除，不做标注保留；git 历史保留。
- 后果：仓库只描述 Event 设施；State、Checkpoint、Artifact、Effect 等设施
  留待 Event 生产可用后另起需求。
- 相关：tasks.md R03。

## D03 · Python 不使用跨进程文件锁

- 日期：2026-09-01
- 背景：Python 移植曾在每个 Session 目录写 `.event.lock` 做 advisory 锁，DSH
  的 JSONL 后端没有任何跨进程锁，且规格文档误把它写成共同契约。
- 决定：删除文件锁，保留进程内 `RLock`；两种实现的单写者契约一致：同一
  Session 同一时刻只能有一个写入进程，由调用方保证。
- 后果：两种实现的磁盘足迹相同；Nexent 若需要多进程互斥，另立需求。
- 相关：tasks.md R01、R11。

## D04 · Trajectory UI 的依赖闭包先原样从注册表打包（已被 D05 取代）

- 日期：2026-09-01
- 背景：`@runfold/trajectory-ui` 运行时真正用到的 DSH 包只有 `dsh-client-store` 和
  `dsh-client-ui-primitives` 的一个子集，其余二十余个包只提供类型；构建时
  它们被打进 bundle，消费者不安装任何 DSH 包。
- 决定：R24 评估阶段维持"原样打包"，不裁 shiki 语法；仓库开发时用根
  `overrides` 把注册表闭包钉在快照版本。
- 后果：这是 R24 评估时的过渡状态。R25–R29 已按 D05 完成替换：store 与
  UI-primitives 的实际运行时闭包已从固定快照裁入，所需通用第三方依赖直接
  声明，25 个 DSH devDependencies、根 `overrides` 和 lockfile 中的 DSH 包均已
  删除。因此本条不再描述当前依赖状态。
- 相关：tasks.md R24。

## D05 · 彻底移除 DSH 名称与注册表依赖（已完成）

- 日期：2026-09-01
- 完成：2026-09-02
- 背景：保留源码里的 `@deepseek-ai/*` import 名字靠六处构建/测试别名解析；
  UI 闭包仍依赖 25 个注册表包（D04）。使用方要求代码里的名字和真实依赖都
  去掉。
- 决定：立项 R25–R29，任务书 [`tasks/R25-R29-dsh-free.md`](tasks/R25-R29-dsh-free.md)。
  关键设计是把一致性脚本改为"对上游内容应用显式映射表后再逐字节比对"，
  使 import 改写后上游一致性仍可机器验证；`@runfold/event/runtime` 自引用
  保留，因为 `declare module` 用相对 `.ts` 路径无法进入发布的 d.ts。
- 后果：R25–R29 完成后，生产实现 import、参与安装的 manifests、lockfile、
  `npm ls --all` 和 SDK/UI 发布产物均无 DSH registry namespace；R36 又把保留
  测试中的模块 specifier 与测试配置别名改为受身份校验约束的本地相对路径。
  固定上游名称只保留在审计 manifests、来源/许可证文字和用于断言名称不得泄漏
  的测试文本中，不参与模块解析。身份校验当前覆盖 204 个文件、10 个必要差异和
  139 个声明映射；完整验证共通过 1005 个行为测试及 TypeScript/Python 空白
  消费者安装测试。
- 相关：tasks.md 3.2 节、R36。

## D06 · 技术身份使用 Runfold，维护身份与法定版权人分离

- 日期：2026-09-03
- 背景：项目将作为独立的 agent runtime data platform 供其他团队集成。把维护
  组织名称写进包、import、Schema 和下游 UI，会无必要地进入使用方代码；完全
  隐去维护者与原创权利归属又会损失清晰的版权边界。
- 决定：独立项目名为 Runfold；TypeScript、Python、Schema 与 UI 的公共技术
  身份统一使用 Runfold。Perix.ai 是项目与维护者名称；按 R50 的用户确认，当前
  原创 Runfold 代码、修改和可受保护编排声明的版权人为自然人 Heiki Scott。
  DeepSeek Harness 的固定来源、原版权和 MIT 许可继续完整保留。
- 后果：0.1.0 尚未对外发布，因此执行干净迁移，不提供旧包名兼容别名。迁移前
  的任务与验收记录保留原名作为历史事实，但不构成当前 API 文档。
- 相关：tasks.md R45–R50。

## D07 · GitHub 组织保持 perix-ai，发布命名空间注册 Runfold

- 日期：2026-09-03
- 背景：D06 之后出现名称层级不一致的疑问：包与 import 用 Runfold，代码托管在
  `github.com/perix-ai/runfold`。2026-09-03 实测四处命名空间的占用情况：npm
  `@runfold` scope、`@runfold/event`、`@runfold/trajectory-ui`、PyPI
  `runfold-event` 与 `runfold`、GitHub 组织 `runfold` 全部空闲，`perix-ai`
  已存在。
- 决定：GitHub 组织保持 `perix-ai` 不迁移。理由有三：组织名代表维护方、仓库名
  代表产品，`perix-ai/runfold` 符合这一约定，`runfold/runfold` 冗余；迁移会
  抹掉 D06 刻意建立的"产品名与维护者名分离"；使用方只输入
  `npm i @runfold/event` 与 `pip install runfold-event`，组织名仅出现在仓库
  URL 中。同时在首次发布前注册 npm `@runfold` scope 与 PyPI `runfold-event`，
  避免 R52 写入发布元数据的名字被抢注。
- 后果：`repository` 等元数据指向 `github.com/perix-ai/runfold`。若将来
  Runfold 需要独立于维护方（`COPYRIGHT.md` 已预留版权转让路径），再新建
  `runfold` 组织并转移仓库；GitHub 对重命名与转移保留永久重定向，届时成本
  仍然可控。
- 相关：tasks.md R52、R59；任务书 `tasks/R52-R59-release-governance.md`。
