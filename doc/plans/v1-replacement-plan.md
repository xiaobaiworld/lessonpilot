# v1 替换计划

文档版本：`0.1.0`

状态：待审核。本文件只定「每样东西是拷贝还是重建」，不授权修改产品代码。

需求真源：[`../requirements/v1/README.md`](../requirements/v1/README.md)

设计真源：[`../design/v1/README.md`](../design/v1/README.md)

上级计划：[`v1-development-plan.md`](v1-development-plan.md)

## 1. 采用的方式

**在仓库里新建 `v1/` 目录，从零建立新系统。旧系统原地冻结，不修不改。
v1 通过真实验收后，整目录删除旧系统。**

前提是 `D-V1-012`：当前服务端没有保留价值的业务数据、没有正式课程发布、
没有学生本机数据。因此不需要数据迁移，也不需要新旧系统同时对外服务。

**出现真实老师在生产使用后，这个前提就不成立，必须重开本决策。**

不采用「在现有目录里逐段替换」：旧后端是按技术分层平铺的，新设计要求按业务模块划分，
两种结构在同一目录下共存会让「这个文件属于哪套」长期说不清，删旧代码时要逐文件挑。
整目录隔离让删除动作变成一次 `git rm -r`。

不采用「开新仓库」：文档、需求编号、追踪矩阵和八个检查工具都要跨仓引用，
成本明显高于收益。

## 2. 目录形态

```text
v1/                          新系统
  backend/                   FastAPI，按六个业务模块划分
  web/                       教师端与管理端
  extension/                 学生插件
  README.md                  v1 自身的运行说明

backend/  teacher-web/  src/     旧系统，冻结只读
doc/  tools/  tests/fixtures/v1/ 新旧共享
```

旧系统三个职责：现状证据、参考实现、回归基线。**不修 bug、不加功能、不做重构。**
生产上如果出现必须修的问题，先停下来讨论，不要顺手改 —— 改了就等于两套代码同时活跃。

## 3. 每类资产的处理

「拷贝」指原样复制，不改逻辑；只允许改 import 路径和模块导出方式。
「重建」指按 v1 设计重写，旧代码只作参考。

### 3.1 文档与规范

| 内容 | 处理 | 依据 |
| --- | --- | --- |
| `doc/requirements/v1/`、`doc/design/v1/` | **不动**，v1 直接用 | 已冻结，本来就是为 v1 写的 |
| `doc/decisions/`、`doc/lessons.md`、`doc/INDEX.md`、`doc/dev-rules.md` | **不动** | 与目录结构无关 |
| `doc/traceability/v1-requirements.tsv` | **不动**，实现时回填证据列 | 256 个编号已覆盖 |
| `doc/archive/` | **不动** | 只作追溯 |

需要改的只有引用了旧路径的地方：`dev-rules.md` 第 5 节的后端模块边界、
`INDEX.md` 的代码入口表、根 `README.md`。这些在骨架建立后一次改完。

### 3.2 检查工具

| 内容 | 处理 |
| --- | --- |
| `tools/doc-check.mjs`、`endpoint-check.mjs`、`contract-check.mjs`、`secret-scan.mjs`、`dependency-check.mjs`、`build-traceability.mjs` | **不动**，直接用 |
| `tools/module-check.mjs` | **改扫描路径**：从 `backend/app/services` 改为 `v1/backend/modules`，判定规则不变 |
| `tools/web-release.sh`、`teacher-platform-release.sh`、`deploy/` | **不动** | 与业务无关，已在生产验证过固定提交、SHA256、原子切换和回滚 |
| `tools/assemble-workspace.js` | **旧系统专用**，随旧系统一起删 |

`module-check.mjs` 的 `FILE_OWNER` 目前按文件名映射模块，改成按目录判定后
新增文件自动归属，不需要逐个登记。

### 3.3 格式定义与夹具

| 内容 | 处理 |
| --- | --- |
| `src/contracts/` 两份 JSON 格式定义、版本清单 | **移到 `v1/contracts/`**，内容不变 |
| `tests/fixtures/v1/` 31 个夹具 | **不动** | 已验证行为与文件名一致 |
| `src/shared/course-contract.js`（485 行）、`course-package-contract.js`（209 行） | **删除**，不拷贝 | 它们是手写校验器，v1 改由 JSON 格式定义生成或校验（`DEV-STRUCT-001`）。这是「格式定义只写一份」的落地动作 |
| `src/shared/bridge-protocol.js`（214 行） | **重建** | 消息格式已在 JSON 格式定义里，实现要按新格式重写 |
| `src/shared/api-config.js`、`workspace-origins.js` | **重建**，很小 | 端点路径按新清单变了 |

### 3.4 后端

**整体重建。** 旧后端按技术分层平铺（`api/`、`models/`、`repositories/`、`schemas/`、
`services/` 各 12 个文件），新设计要求按六个业务模块划分，且模块之间不能直接查对方的表。
这不是移动文件能达到的，两种结构的依赖方向不同。

| 内容 | 处理 |
| --- | --- |
| 六个业务模块 | **重建**：`identity`、`workspace_course`、`authoring_release`、`entitlement_delivery`、`admin_support`、`runtime_audit` |
| 数据库迁移（11 个 Alembic 版本） | **重建为单个初始迁移** | 无数据要迁，不需要保留 11 步演化史 |
| 密码哈希、令牌摘要、时间与随机数工具 | **拷贝** | Argon2 参数和摘要方式已验证，重写只会引入风险 |
| `app/config.py`、`logging.py`、`middleware.py` | **参考重建** | 结构可沿用，但要接新的错误码和 request_id 约定 |
| 端点 | **按 [端点清单](../design/v1/06-interface-contracts.md#45-v1-http-端点清单) 建立** | 41 个：14 个路径不变、7 个改名、20 个新建 |

**旧后端不加新端点。** 你提到「可能再要加新端点，这样不好」—— 确认按此执行：
旧后端端口冻结在当前 21 个，新端点只在 `v1/backend/` 里建。

开发期本机同时跑两个后端：旧的 `127.0.0.1:8000`，新的 `127.0.0.1:8001`。
新实现需要对照旧行为时直接发请求比对，比读代码可靠。两者各自独立的数据库文件。

### 3.5 教师端与管理端网页

**整体重建。** 旧的没有构建工具、没有模块系统：`visual-node-editor.js` 796 行、
`app.js` 610 行、`admin.js` 500 行、`styles.css` 3081 行。按 `ARCH-DEC-01`
用 TypeScript + Vite + React 重建。

| 内容 | 处理 |
| --- | --- |
| 页面外壳、状态管理、路由 | **重建** |
| `teacher-web/subtitle-context.js`（174 行） | **拷贝**：字幕解析与时间对齐逻辑，已有 13 项测试 |
| `teacher-web/timeline-model.js`（125 行） | **拷贝**：时间线计算，纯函数，已有测试 |
| `teacher-web/node-plugin-registry.js`（230 行） | **参考重建**：结构可用，但四类节点字段要对齐新的 JSON 格式定义 |
| `teacher-web/forsales.html` 销售页 | **拷贝，不重建** | 公开静态页，不需要 React。已在生产验证过 |
| `teacher-web/styles.css`（3081 行） | **不拷贝** | 与旧 DOM 结构耦合，React 组件下无法直接用。视觉效果作为参照 |
| `teacher-web/sample.js`、`demo-captions.js`、`workspace-diagnostics.js` | **不拷贝** | 原型演示用 |

### 3.6 学生插件

分两半：**碰 B 站页面的拷贝，碰存储和网络的重建。**

理由是这两半的风险方向相反。B 站页面适配是在真实环境反复试出来的，
重写要把同样的坑再踩一遍；存储和消息格式是 v1 明确改了语义的，拷贝会带进旧结构。

| 内容 | 处理 |
| --- | --- |
| `src/content/video/bili-player.js`（224 行） | **拷贝**：播放器定位、当前时间读取、暂停继续。真实环境验证过，见 `tests/manual/bilibili-iframe-current-time/` |
| `src/content/subtitle/subtitle-blocker.js`、`blocker-layout.js`（203 行） | **拷贝**：B 站原生字幕遮挡处理 |
| `src/content/mascot/mascot.js`（340 行）与 CSS | **拷贝**：页面内挂载与定位，已验证 |
| `src/content/course-runtime.js`（170 行） | **参考重建** | 要接新的会话锁定和多课节选择（`FR-RUNTIME-*`）|
| `src/background/storage.js`、`course-downloader.js`（411 行） | **重建** | 本机存储 Schema 变了，要加 `LocalIdentity` 和本机证明 |
| `src/background/service-worker.js`、`operations.js`（309 行） | **重建** | 消息格式按新的 JSON 定义 |
| `src/popup/`（271 行，含 HTML 与 CSS） | **重建** | 课程库界面按新设计 |
| `src/content/access-code/access-panel.js`（239 行） | **参考重建** | 兑换流程加了学生确认和安装摘要 |

### 3.7 品牌与静态资源

| 内容 | 处理 |
| --- | --- |
| `src/assets/` Logo SVG、四个尺寸 PNG、圆形/方形/透明变体 | **拷贝**，一个字节不改 |
| `teacher-web/assets/knownmap-icon.png` | **拷贝** |
| `docs/knownmap-logo-resources.md` | **不动** |

### 3.8 测试

| 内容 | 处理 |
| --- | --- |
| `tests/doc-consistency.test.mjs`（33 项） | **不动**，测的是文档和工具，与目录无关 |
| `tests/fixtures/v1/` | **不动** |
| 其余 35 个 `.test.js` 文件（331 项） | **留在原地，随旧系统一起冻结** | 它们是 v0.9.1 的回归基线，不改造 |
| `v1/` 的测试 | **新建**，按 [测试计划](v1-test-plan.md) 组织 |
| `tests/manual/` 历史验收记录 | **不动**，只作追溯；v1 人工验收写入 `tests/manual/v1/` |

拷贝过来的代码要**补 v1 侧的测试**，不复用旧测试文件 —— 旧测试大量断言源码字符串
而非行为（这也是 `CourseDetail.lessons[]` 与 `app.js` 读 `course.lesson` 的断点
能长期存在的原因）。

## 4. 拷贝的规矩

拷贝不是随手复制，三条要求：

1. **每个拷贝文件在头部注明来源**：`// 拷贝自 src/content/video/bili-player.js（v0.9.1），
   仅改 import 路径。行为变更必须先改 v1 设计。` 这样后续读代码的人知道它不是新写的，
   改它之前会先去看旧实现为什么这么写。
2. **只允许改 import 路径和导出方式**。任何逻辑改动都不算拷贝，改成「参考重建」并补测试。
3. **拷贝完立刻补 v1 侧测试**，不依赖旧测试文件。

## 5. 执行顺序

1. **建 `v1/` 骨架**：目录、`package.json`、Vite/TypeScript 配置、FastAPI 入口、
   空数据库迁移。能启动、能跑测试即可，不写业务逻辑。
2. **改 `module-check.mjs` 扫描路径**，让模块边界检查从第一天就对 `v1/` 生效。
3. **搬格式定义**：`src/contracts/` → `v1/contracts/`，更新工具路径。
4. **按第 3 节拷贝可继承的部分**，逐个补测试。
5. **按开发计划阶段 1–6 写业务代码**，每阶段一个提交批次。
6. **阶段 7 真实验收通过后删除旧系统**：`backend/`、`teacher-web/`、`src/`、
   `tools/assemble-workspace.js` 和 35 个旧测试文件一次删除，同时更新
   `INDEX.md`、根 `README.md` 和 `dev-rules.md`。

第 1–4 步不改变任何用户可见行为，可以连续做完再一起验收。

## 6. 删除旧系统的条件

以下全部满足才执行第 5 节第 6 步：

1. 阶段 7 真实老师和真实学生闭环通过（`D-V1-005`）；
2. v1 在指定 Chrome 与 B 站上完成人工验收，证据在 `tests/manual/v1/`；
3. 追踪矩阵 256 个编号没有 P0 项停留在待验证或阻塞；
4. v1 插件固定 ZIP 已发布并能从精确提交重复构建；
5. 旧系统的现状证据价值已由 v1 的测试和文档承接。

不满足就不删。旧系统占用的磁盘和认知成本远低于「删早了没有参照物」的代价。

## 7. 与既有计划的关系

本文件替换 [`v1-code-refactor-execution-plan.md`](v1-code-refactor-execution-plan.md)
第 1 节和第 5 节关于「逐段替换」和目标目录的部分。该文件的其余内容
（只读审计基线、分阶段工作包、测试路径图、失败模式、提交规则）继续有效。

审核通过后，该文件的第 1、5 节按本文件修订，版本升到 `0.3.0`。

设计 09 的迁移切换设计不受影响：它定的是运行时切换顺序和数据处理边界，
不规定目录形态。`D-V1-012` 也不受影响 —— 本文件正是它的直接推论。

