# Event 轨迹设施验证策略

> 文档类型：验证策略。回答"用什么证明需求被满足、行为没有退化"。具体的
> 测试文件矩阵与命令见
> [`packages/event/typescript/TESTING.md`](../../packages/event/typescript/TESTING.md)。

## 1. 原则

测试是抽离本身的一部分，不是最后补充。任何为去除 DSH 依赖而改写的代码，
都要先由保留下来的上游测试锁定行为，再增加面向新公共接口和跨语言契约的
测试。

## 2. 验证层次

| 层次 | 证明什么 | 位置 |
| --- | --- | --- |
| 上游一致性 | 保留源码除登记的宿主接缝外与固定 commit 逐字节一致 | `scripts/verify-upstream-identity.mjs`，`npm run verify` 首步 |
| 公共项目身份 | 当前源码、配置、文档和 Nexent 补丁不重新引入旧技术命名；维护权利、历史来源和负向测试仅按文件白名单保留 | `scripts/verify-public-identity.mjs` |
| 上游行为基线 | DSH 的 Event、持久化、Trajectory 回归测试在裁剪版上原样通过 | `packages/event/typescript/packages/**/tests`，经 `test-support/` 垫片运行 |
| 宿主生命周期 | `EventHost` 对保留代码使用的 Cordis 生命周期子集等价，覆盖事件、effect、scope、释放和服务绑定 | `packages/event/typescript/tests/runtime/` |
| 单语言实现 | TypeScript 与 Python 各自的单元、集成、持久化、异常输入测试 | `packages/event/<language>/tests/` |
| 跨语言契约 | 共享夹具的接受/拒绝结果、repair 结果、事件类型清单一致；TS 写/Python 读写，Python 写/TS 读写，双向 restore/resume/fork；真实 Nexent 父子轨迹通过 TS 公共 restore 与 UI | `conformance/event/v0/`，`tests/event/cross-language/` |
| UI | 与 DSH 视图行为对照（上游 views 用例的独立宿主移植），Python 生成的轨迹可渲染，大规模历史可渲染 | `packages/event/typescript/tests/ui/` |
| 发布产物 | TS 包安装到空白项目；Python 在隔离 builder 生成 wheel，再由第二个空白环境以 `--no-index` 只安装该 artifact；严格类型边界、公开运行时和无 DSH 引用均通过 | `packages/event/typescript/tests/package/`，`packages/event/python/tests/package_consumer.py` |

## 3. 必须覆盖的场景

- 正常退出、截断/损坏日志修复、序号冲突、并发 Session；
- 明文与 Zstandard 两种物理格式，packed chunk 行的写入与展开；
- restore 后继续追加；末尾已有 `session/end-seed` 的重复打开幂等，而带新 live
  后缀的下一次 restore 追加一个新边界；fork 只接受稳定前缀；
- TS 写/Python 读写，Python 写/TS 读写；
- UI 对 Python 生成轨迹与 20,000 级 Event 历史的渲染。

## 4. 已知缺口

未纳入抽离树的上游测试及其理由记录在
[`packages/event/typescript/TESTING.md`](../../packages/event/typescript/TESTING.md)
的 "Known gaps" 一节；每一项要么已由独立宿主下的等价测试覆盖，要么测试的是
Event 组件不具备的 shell 机制。

## 5. 入口

当前完整门禁校验 204 个保留文件、10 个必要差异和 139 个声明映射，并运行
1005 个行为测试（626 Event、182 UI runtime、94 Trajectory、11 EventHost、
15 SDK、33 UI、36 Python、1 系统、7 跨语言），随后安装 TypeScript 与 Python
空白消费者。构建后还会扫描 Runfold 公共身份，并由两个空白消费者检查发布包
名称、内容及随包许可证。

```bash
npm run verify
```

按层次单独运行的命令见 `package.json` 的 `scripts` 与 TESTING.md。
