# v1 替换计划

文档版本：`0.2.0`

状态：已于 2026-08-23 审核接受。本文件记录目录隔离替换决策和资产处置依据，不授权修改产品代码，
也不作为逐工作包执行真源；实施步骤统一见 [`v1-code-refactor-execution-plan.md`](v1-code-refactor-execution-plan.md)。

需求真源：[`../requirements/v1/README.md`](../requirements/v1/README.md)

设计真源：[`../design/v1/README.md`](../design/v1/README.md)

上级计划：[`v1-development-plan.md`](v1-development-plan.md)

## 1. 采用的方式

**在仓库里新建 `v1/` 目录，从零建立新系统。旧系统原地冻结功能和结构变更，
只允许处理 P0、数据/凭证安全和生产可用性问题。v1 完成真实验收、生产切换、观察和回退验证后，
再通过独立退役阶段删除旧系统。**

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

旧系统三个职责：现状证据、参考实现、回归基线。**不加功能、不做结构重构。**
发现普通缺陷只登记，不为旧结构继续演进；P0、数据/凭证安全和生产可用性问题允许修复，但必须先有回归测试，
并判断相同缺陷是否也存在于 v1。修复旧系统不等于承诺新旧两套长期同步。

## 3. 每类资产的处理

表中的「拷贝」对静态资源表示逐字节复制；对代码表示第 4 节定义的“行为保持式迁入”，
允许为 TypeScript、模块接口、错误模型和生命周期做有特征测试保护的适配，不等于复制旧结构。
「重建」指按 v1 设计重写，旧代码只作参考。

### 3.1 文档与规范

| 内容 | 处理 | 依据 |
| --- | --- | --- |
| `doc/requirements/v1/`、`doc/design/v1/` | **不动**，v1 直接用 | 已冻结，本来就是为 v1 写的 |
| `doc/decisions/`、`doc/lessons.md`、`doc/INDEX.md`、`doc/dev-rules.md` | **不动** | 与目录结构无关 |
| `doc/traceability/v1-requirements.tsv` | **不动**，实现时回填证据列 | 256 个编号已覆盖 |
| `doc/archive/` | **不动** | 只作追溯 |

过渡期需要同步的是引用旧路径或旧命令的规则与计划：`dev-rules.md`、`next.md`、开发/测试/执行计划；
`INDEX.md` 的代码入口表和根 `README.md` 等 v1 骨架真实存在后再更新，不能提前把计划路径写成实现事实。

### 3.2 检查工具

| 内容 | 处理 |
| --- | --- |
| `tools/doc-check.mjs`、`secret-scan.mjs`、`build-traceability.mjs` | **保留规则，验证扫描范围**：必须覆盖 `v1/`，不能因旧默认路径产生假绿 |
| `tools/endpoint-check.mjs`、`contract-check.mjs`、`dependency-check.mjs` | **改为识别 v1 真源和依赖根**：当前分别硬编码旧 API、`src/contracts`、根 Node/旧后端依赖 |
| `tools/module-check.mjs` | **同时识别旧基线和 v1**：v1 按 `v1/backend/app/modules/<domain>/` 目录判定；旧白名单只服务冻结基线 |
| `tools/web-release.sh`、`teacher-platform-release.sh`、`deploy/` | **保留发布不变量，重建 v1 路径并拆分职责**：精确提交、白名单、SHA-256、不可变目录和原子切换继续保留；build、migration、deploy、probe、rollback 分开验证 |
| `tools/assemble-workspace.js` | **旧系统专用**，随旧系统一起删 |

所有检查工具在阶段 0 都要增加“测试发现/扫描范围”自测：故意在 `v1/` 放入一个违规夹具时检查必须失败；
删除违规夹具后才能恢复通过。仅修改输出文案或让旧目录继续通过，不算 v1 门禁建立完成。

`module-check.mjs` 的 `FILE_OWNER` 目前按文件名映射模块，v1 改成按目录判定后新增文件自动归属，
不需要逐个登记；旧系统的已知越界保持只读基线，不与 v1 豁免合并。

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
| 密码哈希、令牌摘要、时间与随机数工具 | **行为保持式迁入** | 保留 Argon2 参数、摘要方式和测试向量，并重新检查 v1 安全边界 |
| `app/config.py`、`logging.py`、`middleware.py` | **参考重建** | 结构可沿用，但要接新的错误码和 request_id 约定 |
| 端点 | **按 [端点清单](../design/v1/06-interface-contracts.md#45-v1-http-端点清单) 建立** | 41 个：14 个路径不变、7 个改名、20 个新建 |

**旧后端不加新端点。** 你提到「可能再要加新端点，这样不好」—— 确认按此执行：
旧后端端口冻结在当前 21 个，新端点只在 `v1/backend/` 里建。

开发期本机可以同时跑两个后端：默认旧的 `127.0.0.1:8000`、新的 `127.0.0.1:8001`，
实际地址由显式环境配置决定，不写入业务代码，也不因此放宽生产 CORS/host allowlist。
新实现需要对照旧行为时直接发请求比对，比读代码可靠。两者各自独立的数据库文件。

### 3.5 教师端与管理端网页

**整体重建。** 旧的没有构建工具、没有模块系统：`visual-node-editor.js` 796 行、
`app.js` 610 行、`admin.js` 500 行、`styles.css` 3081 行。按 `ARCH-DEC-01`
用 TypeScript + Vite + React 重建。

| 内容 | 处理 |
| --- | --- |
| 页面外壳、状态管理、路由 | **重建** |
| `teacher-web/subtitle-context.js`（174 行） | **行为保持式迁入**：字幕解析与时间对齐逻辑，已有 13 项测试 |
| `teacher-web/timeline-model.js`（125 行） | **行为保持式迁入**：时间线计算，纯函数，已有测试 |
| `teacher-web/node-plugin-registry.js`（230 行） | **参考重建**：结构可用，但四类节点字段要对齐新的 JSON 格式定义 |
| `teacher-web/forsales.html` 销售页 | **拷贝，不重建** | 公开静态页，不需要 React。已在生产验证过 |
| `teacher-web/styles.css`（3081 行） | **不拷贝** | 与旧 DOM 结构耦合，React 组件下无法直接用。视觉效果作为参照 |
| `teacher-web/sample.js`、`demo-captions.js`、`workspace-diagnostics.js` | **不拷贝** | 原型演示用 |

### 3.6 学生插件

分两半：**碰 B 站页面的行为保持式迁入，碰存储和网络的重建。**

理由是这两半的风险方向相反。B 站页面适配是在真实环境反复试出来的，
重写要把同样的坑再踩一遍；存储和消息格式是 v1 明确改了语义的，拷贝会带进旧结构。

| 内容 | 处理 |
| --- | --- |
| `src/content/video/bili-player.js`（224 行） | **行为保持式迁入**：播放器定位、当前时间读取、暂停继续。真实环境验证过，见 `tests/manual/bilibili-iframe-current-time/` |
| `src/content/subtitle/subtitle-blocker.js`、`blocker-layout.js`（203 行） | **行为保持式迁入**：B 站原生字幕遮挡处理 |
| `src/content/mascot/mascot.js`（340 行）与 CSS | **行为保持式迁入**：页面内挂载与定位，已验证 |
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

行为保持式迁入的代码要**补 v1 侧的测试**，不复用旧测试文件 —— 旧测试大量断言源码字符串
而非行为（这也是 `CourseDetail.lessons[]` 与 `app.js` 读 `course.lesson` 的断点
能长期存在的原因）。

## 4. 迁入的规矩

代码采用“行为保持式迁入”，不是要求永久保留字节级副本：

1. 每项迁入代码记录精确来源提交和路径，例如
   `// 行为基线：main@<commit>:src/content/video/bili-player.js`，避免旧目录删除后失去追溯入口。
2. 先建立能够锁定已验证行为的特征测试，再做 TypeScript、模块接口、错误模型和生命周期适配；
   适配不能顺手改变业务语义。
3. 需要改变业务语义时改列为“参考重建”，回到 v1 设计和需求编号，先补失败测试再实现。
4. 密码哈希、摘要、时间和随机数工具保留算法参数与测试向量，不因“复制”跳过新安全边界检查。
5. Logo、PNG、SVG 等静态资源可以逐字节复制并核对摘要。
6. 迁入完成立刻补 v1 侧测试，不依赖旧测试文件作为 v1 通过证据。

## 5. 过渡期测试与检查入口

阶段 0 必须建立一个仓库级总入口，使本地和 CI 使用同一组命令，并防止测试 glob 静默漏掉 v1：

```text
仓库总门禁
  ├─ 旧系统回归基线
  ├─ 文档/编号/追踪矩阵
  ├─ v1 Node/TypeScript 单元与契约测试
  ├─ 旧后端冻结基线
  ├─ v1 后端测试、Ruff 与迁移检查
  └─ 依赖、秘密、端点、模块和发布清单检查
```

根 `npm test` 在过渡期必须编排旧测试、文档检查和 v1 测试；测试发现本身要有自测或清单断言，
不能只看“失败数为 0”。旧后端继续用 `cd backend && uv run pytest` 保存基线，v1 后端使用
`cd v1/backend && uv run pytest`。`dependency-check.mjs` 必须同时检查根 Node、v1 Node、旧后端和 v1 后端的声明与锁文件。

## 6. 执行顺序

1. **建 `v1/` 骨架**：目录、`package.json`、Vite/TypeScript 配置、FastAPI 入口、
   空数据库迁移。能启动、能跑测试即可，不写业务逻辑。
2. **改 `module-check.mjs` 扫描路径**，让模块边界检查从第一天就对 `v1/` 生效。
3. **搬格式定义**：`src/contracts/` → `v1/contracts/`，更新工具路径。
4. **按第 3、4 节迁入可继承的部分**，逐个补特征测试和 v1 测试。
5. **按开发计划阶段 1–6 写业务代码**，每阶段一个提交批次。
6. **阶段 7 完成真实验收并切换 v1**，保留上一套完整发布组合和旧代码回退入口。
7. **阶段 8 独立退役旧系统**：观察期和一个完整真实交付周期通过、消费者与恢复责任清零后，
   删除 `backend/`、`teacher-web/`、`src/`、`tools/assemble-workspace.js` 和 35 个旧测试文件，
   同时更新 `INDEX.md`、根 `README.md`、`dev-rules.md`、发布清单和历史证据入口。

第 1–4 步不改变任何用户可见行为，但仍按可独立回退的小提交完成；每步聚焦验证后再进入下一步，
不把目录、依赖、契约搬迁和代码迁入压成一个不可审查的大提交。

## 7. 删除旧系统的条件

以下全部满足才执行第 6 节第 7 步：

1. 阶段 7 真实老师和真实学生闭环通过（`D-V1-005`）；
2. v1 在指定 Chrome 与 B 站上完成人工验收，证据在 `tests/manual/v1/`；
3. 追踪矩阵 256 个编号没有 P0 项停留在待验证或阻塞；
4. v1 插件固定 ZIP 已发布并能从精确提交重复构建；
5. v1 已完成生产切换，并经过预先定义的观察期和至少一个完整真实交付周期；
6. 上一套完整 Web/API/插件/Schema 组合的回退和恢复演练已通过；
7. 已识别的旧 API、页面、插件消息、存储键、书签、发布脚本和文档消费者全部为零或已有明确拒绝/重定向；
8. 旧系统不再承担恢复、追溯或安全处置责任，现状证据价值已由 v1 测试、发布记录和文档承接；
9. 删除旧系统使用独立 PR/MR 和发布记录，不与首次 v1 生产切换混合。

不满足就不删。旧系统占用的磁盘和认知成本远低于「删早了没有参照物」的代价。

## 8. 与既有计划的关系

本文件保存“为什么选择同仓库 `v1/` 目录隔离替换”的已接受决策和资产处置依据；
[`v1-code-refactor-execution-plan.md`](v1-code-refactor-execution-plan.md) 是唯一逐工作包实施真源，
已经吸收本文件的目录、工具、测试、发布、切换和退役结论。后续不得依靠“某文件部分章节覆盖另一文件”的方式维护计划。

设计 09 的迁移切换设计不受影响：它定的是运行时切换顺序和数据处理边界，
不规定目录形态。`D-V1-012` 也不受影响 —— 本文件正是它的直接推论。

## 9. NOT in scope

- 新建独立仓库：会复制文档、检查工具和发布责任，当前没有收益。
- 新旧业务数据双写或自动迁移旧数据：`D-V1-012` 已采用干净初始化和明确拒绝。
- 在旧系统继续开发新功能或为新架构预先重构旧目录：会恢复两套活跃实现。
- 借目录替换新增微服务、消息队列、多平台、学生账号或 AI 能力：均超出冻结 v1 范围。
