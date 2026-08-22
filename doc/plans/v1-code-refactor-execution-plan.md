# KnownMap v1 代码重构执行计划

文档版本：`0.2.0`

状态：待审核；本文件只拆解代码重构，不授权修改产品代码、部署或生产数据

`0.2.0` 与 2026-08-23 建立的两份实现基准对齐：设计 06 第 4.5 节 HTTP 端点清单和
设计 03 第 7.0 节表归属。同时修正 §2 的后端测试数（96 → 97 实测），
并把 9 处已登记跨模块越界的清偿列为阶段 1 工作包 `1F`。
模块目录命名以本文件第 5 节为准，`tools/module-check.mjs` 已对齐。

重构基线：`main@0e503a4`；计划分支：`codex/v1-rewrite`

需求真源：[`../requirements/v1/README.md`](../requirements/v1/README.md)

设计真源：[`../design/v1/README.md`](../design/v1/README.md)

上级开发计划：[`v1-development-plan.md`](v1-development-plan.md)

测试计划：[`v1-test-plan.md`](v1-test-plan.md)

## 1. 结论与实施边界

当前代码已经验证了产品主链路的技术可行性，但它仍是连续叠加形成的 `v0.9.1` 原型，不能通过整理文件名直接变成 v1。
本轮采用“保留已验证规则，按目标边界逐段替换”的方式，不在一个分支里同时重写后端、Web、插件、运行时和发布系统。

```text
冻结需求与设计
  -> 阶段 0：工程/契约/干净初始化门禁
  -> 阶段 1：身份、工作空间、课程与制作底座
  -> 阶段 2：课程级发布、授权、兑换与课程包
  -> 阶段 3：教师和管理员 Web 应用
  -> 阶段 4：学生插件课程库与本机状态
  -> 阶段 5：B 站运行时与学习状态机
  -> 阶段 6：发布、安全、恢复与旧入口隔离
  -> 阶段 7：真实验收与 v1.0.0
```

每个阶段单独分支、单独 PR/MR、单独门禁。结构变更与业务行为变更分开提交；任何阶段失败时，上一阶段仍可运行和验证。

## 2. 只读代码审计基线

2026-08-22 对 `main@517c0ec` 的只读验证结果：

- Node：`331 passed / 0 failed`；
- 后端：`97 passed`，应用行覆盖率约 `95%`；
- Alembic：单一 head `0011_fix_admin_auth_schema`；
- Ruff：10 个错误，包含 7 个未定义类型引用和 3 个未使用 import；
- 后端测试产生 42 条依赖/SQLite/Alembic 弃用警告；
- 工作区存在 7 份 `verified` 生产发布记录；
- 真实 Chrome、B 站和公网插件闭环仍没有完整、可重复的当前证据。

自动化全绿不能证明现有 UI 主链路正确。当前后端 `CourseDetail` 返回 `lessons[]`，而
`teacher-web/app.js` 仍读取 `state.course.lesson`；现有前端测试主要扫描源码字符串，没有执行真实应用状态流，因此没有发现这个断点。

## 3. 什么已经存在，如何处理

| 现有能力 | 主要位置 | 处理结论 | v1 承接方式 |
| --- | --- | --- | --- |
| Argon2 密码、HMAC 会话摘要、管理员/教师隔离 | `backend/app/services/*auth*`、`api/deps.py` | 保留安全语义，重建公共基础设施 | 共享无角色业务含义的密码/令牌原语；角色状态、Cookie、授权仍分开 |
| UUID 课程和多课节关系 | `models/course.py`、`models/lesson.py` | 保留身份经验，重建 v1 字段与约束 | 补 revision、归档、交付暂停、显式顺序和视频引用规则 |
| 四类节点校验与编辑器纯逻辑 | `schemas/script.py`、`node-plugin-registry.js`、`timeline-model.js` | 优先复用规则与测试样例 | 由版本化 JSON Schema 生成/校验 Python 与 TypeScript 类型 |
| 草稿整份保存 | `script_service.py`、`script_drafts` | 保留聚合写入方式 | 增加 revision 前置条件、摘要和冲突响应 |
| 发布快照 | `publish_service.py`、`published_scripts` | 替换数据模型 | 改为 `CourseRelease + ReleaseLessonSnapshot` 的课程级原子发布 |
| 授权码摘要与范围裁剪 | `access_code_service.py`、`access_grants` | 保留密码学与 fail-closed 经验 | 重建为 AccessCode、GrantItem、Redemption、资格并集和本机证明 |
| 课程包双端复验 | `course-package-contract.js`、`plugin_course_config.py` | 保留原则，替换双真源 | JSON Schema 为包真源，OpenAPI 为 HTTP 真源 |
| 插件整库原子写入与串行锁 | `storage.js`、`course-downloader.js` | 优先复用算法与失败样例 | 新 storage root、LocalIdentity、staging、quarantine 和版本锁定 |
| BVID 精确匹配、SPA 清理、最小播放器控制 | `course-runtime.js`、`bili-player.js` | 保留 adapter 经验 | 多候选显式选择，LearningSession 锁定 release，不静默取第一条 |
| 精确提交、白名单、哈希、原子发布与回滚 | `tools/*release.sh` | 保留发布不变量，拆分职责 | 构建、迁移、部署、探针、回退分别可测；不复制两个 700–800 行脚本 |
| 销售页与飞书入口 | `teacher-web/forsales.html`、`trial-intake.js` | 暂时原样保留 | 阶段 6 才迁移发布路径，不让应用重构阻塞公开入口 |

## 4. 当前必须重新整理的结构

### 4.1 后端

1. `access_code_service.py` 同时承担凭证、范围校验、发布读取、裁剪和包组装，超过单一业务动作边界。
2. 路由层重复计时、操作日志、提交和错误映射；`teacher_lessons.py` 反向 import `teacher_courses.write_operation`。
3. 管理员和教师认证实现高度重复，但两边安全能力不一致；教师端缺少管理员端已有的损坏哈希处理和抗枚举 dummy verify。
4. `PublishedScript` 按课节保存整门课程包，同一次发布产生多份重复快照并分别递增版本。
5. 当前 Alembic 链描述旧原型 schema；`D-V1-012` 要求 v1 使用新的干净初始化，不能把“旧表为空”当成 v1 schema 已建立。
6. ORM 类型前向引用没有按 Ruff 可理解方式声明，静态门禁尚未成立。

### 4.2 教师与管理员 Web

1. `teacher-web/app.js` 610 行，页面状态、API 编排、固定演示数据、课程创建、草稿、发布和授权 UI 混在一个 IIFE。
2. 教师页面固定 BVID、513 秒和内置字幕，只读取第一门课程/一个课节，并已与 `lessons[]` API 漂移。
3. `styles.css` 3,081 行，销售、编辑器和历史样式职责混杂；`admin.html` 961 行，结构与样式集中。
4. `api-client.js` 和 `admin.js` 各自复制 base URL、fetch、JSON、错误映射逻辑。
5. Node 页面测试大量使用字符串包含断言，无法证明 DOM 事件、异步竞态、路由恢复和失败后的可操作状态。

### 4.3 学生插件

1. `src/` 同时是历史共享代码、MV3 产物和未来应用根，缺少 TypeScript 构建边界与产物清单。
2. `api-config.js` 固定 `127.0.0.1:8000`，manifest 没有生产 API host permission，公网课程领取无法成立。
3. `course-downloader.js` 同时处理网络、校验、示例课程、迁移、学习状态和写锁；错误全部折叠为少数字符串，诊断信息不足。
4. popup 与 B 站书包重复课程列表和错误文案渲染。
5. 当前存储只有课程和简化 node state，没有 LocalIdentity、证明、授权来源、发布版本锁定、追加式尝试、局部隔离与恢复。
6. 同视频多课节被契约拒绝，运行时只选第一个匹配课节，与 `D-V1-010` 冲突。

### 4.4 测试、工具与文档

1. 现有 331 个 Node 测试中混有历史页面/文案/兼容约束，不能整体作为 v1 必须保留的行为。
2. 缺少 React 应用可执行测试、MV3 构建产物测试、真实 DOM 集成、服务端到插件包的契约生成检查。
3. 两个发布脚本合计超过 1,500 行，文本断言多于隔离环境行为测试。
4. v1 工作树当前另有未提交的追踪矩阵和文档检查工作；执行本计划前先独立收口，不能与产品重构混入同一提交。

## 5. 目标代码边界

目录在阶段 0 用最小骨架锁定，后续只在对应阶段填充：

```text
backend/
  app/
    modules/
      identity/
      workspace_course/
      authoring_release/
      entitlement_delivery/
      admin_support/
      runtime_audit/
    infrastructure/
      database/
      security/
      logging/
    api/

src/
  contracts/                 # JSON Schema、版本清单、生成物检查
  web/
    teacher/                 # React + TypeScript + Vite
    admin/                   # React + TypeScript + Vite
    shared/                  # 纯 UI/HTTP 基础设施，无角色权限决定
  extension/
    background/
    popup/
    content/
    host/bilibili/
    storage/

tests/
  fixtures/v1/
  contracts/
  browser/
  manual/v1/
```

销售页先留在现有轻量入口；后端现有路径在对应 v1 模块通过门禁后再退役。不要先做全仓库移动再开始业务验证。

## 6. 分阶段执行工作包

### 阶段 0：工程、契约与干净初始化

依赖：冻结需求、设计和追踪/文档检查修改先独立收口 —— 已于 2026-08-23 完成（8 个提交），
本前置条件已解除。同期建立了两份实现基准，阶段 0 起即可对照：

| 基准 | 位置 | 检查工具 |
| --- | --- | --- |
| HTTP 端点清单（41 个，按六模块分组） | 设计 06 第 4.5 节 | `node tools/endpoint-check.mjs` |
| 表归属（12 张表分配到六模块） | 设计 03 第 7.0 节 | `node tools/module-check.mjs` |

两者已进入 `node --test`。新增未登记端点、新增跨模块表访问都会失败。

工作包：

1. `0A` 建立 Node workspace、TypeScript/Vite/React 最小依赖锁、`src/web`、`src/extension`、`src/contracts` 空骨架；旧页面和旧插件继续可运行。
2. `0B` 建立版本清单：HTTP/OpenAPI、course package、extension message、local storage、Web/extension build version。
3. `0C` 把课程包和插件消息定义为 JSON Schema 真源，生成或校验 TypeScript/Python 适配；未知主版本安全拒绝。
4. `0D` 建立匿名夹具：两个教师、两台本机身份、重复内容课节、同视频多课节、两次发布、多授权来源、损坏/旧契约。
5. `0E` 建立 v1 数据库入口和旧 schema 拒绝门禁。现有“迁移后旧表为空”测试只保留为历史证据，不能作为 v1 初始化完成条件。
6. `0F` 把 Ruff、TypeScript typecheck、Node/Python 测试、契约生成无 diff、文档链接、秘密扫描和依赖扫描接入 CI。
   文档链接、编号、追踪矩阵、端点清单和模块边界五项已由 `tools/doc-check.mjs`、
   `tools/endpoint-check.mjs`、`tools/module-check.mjs` 覆盖并进入 `node --test`；
   本工作包只需补 Ruff、typecheck、契约生成无 diff、秘密扫描和依赖扫描。

门禁：旧应用不回归；v1 骨架可构建；Python/TypeScript 对同一夹具给出一致结果；旧响应、旧存储和旧数据库不会进入 v1；静态检查零错误。

`0C` 的 JSON Schema 真源建立后，HTTP 侧同时导出 OpenAPI 并与设计 06 第 4.5 节端点清单对照：
清单是按冻结需求推导的预期，OpenAPI 是实现事实，两者不一致时先判断哪一侧错，不默认代码正确。

提交建议：`build: establish v1 workspace`、`feat: establish v1 contracts`、`test: establish v1 clean initialization gates`。

### 阶段 1：身份、工作空间、课程与制作底座

1. `1A` 提取安全基础原语（密码验证、令牌摘要、时间、随机数），管理员和教师业务流程仍由各自模块拥有。
2. `1B` 新建 v1 AdminAccount、TeacherAccount、Session、Workspace schema 和 migration；实现停用/恢复、凭证版本和会话整体失效。
3. `1C` 新建 Course、Lesson、VideoReference、显式 sequence、revision、归档和交付暂停字段/规则。
4. `1D` 新建版本化 ScriptDraft 聚合、四类节点校验、摘要和 optimistic revision；保存冲突返回稳定错误且不覆盖任一版本。
5. `1E` 路由只做协议/权限/错误映射；应用服务拥有事务；仓储不决定权限。统一操作审计写入入口，删除路由间反向 import。

6. `1F` 按设计 03 第 7.0 节表归属清偿已登记的 9 处跨模块表访问，逐条从
   `tools/module-check.mjs` 的 `KNOWN_VIOLATIONS` 删除（白名单过期同样会失败）：

   | 文件 | 越界 | 修法 |
   | --- | --- | --- |
   | `services/access_code_service.py` | `Course`、`Lesson`、`lesson_repository`、`published_script_repository` | 课节有序列表与最新可交付发布快照改由拥有方提供应用服务；排序规则和发布有效性判断不留在授权模块 |
   | `services/admin_teacher_service.py` | 构造 `Teacher` 行、`teacher_repository` | 由身份模块提供「创建教师账号」「重置密码并失效会话」服务，管理模块在一个事务内组合调用 |
   | `repositories/admin_teacher_repository.py` | `Teacher`、`Course`、`Workspace` | 教师摘要与课程计数分别由身份模块和课程模块提供只读摘要 |

   `admin_teacher_service` 这一处不是「不该跨模块」而是「跨模块方式错误」：`FR-AUTH-002`
   与 04 第 5 节要求教师账号与工作空间同事务建立，本就是跨模块动作，
   区别在于应当调用对方的应用服务，而不是自己构造对方的行。去掉跨模块调用会破坏该冻结约束。

7. `1G` 目录改为 `modules/<domain>/` 后，同步更新 `tools/module-check.mjs` 的 `FILE_OWNER`
   为按目录判定；约束本身不变。同时修正 §2 记录的 `CourseDetail.lessons[]` 与
   `app.js` 读 `course.lesson` 的断点 —— 该字段 API 从不返回，实测 `app.js` 有 6 处
   `course.lesson`、0 处 `lessons`。

门禁：两个教师的交叉资源访问全部拒绝且无副作用；停用立即使现有会话失效但不删业务数据；重复内容和同视频课节合法；草稿冲突可恢复；
`node tools/module-check.mjs` 无新增越界，且本阶段涉及的 `KNOWN_VIOLATIONS` 条目已清空；
本阶段新建或改名的端点已在设计 06 第 4.5 节登记，`node tools/endpoint-check.mjs` 无清单外端点。

### 阶段 2：课程级发布、授权、兑换与课程包

1. `2A` 以 CourseRelease、ReleaseLessonSnapshot、ReleaseAvailability 替换 PublishedScript 语义；先完整校验，再在一个事务中写整门课程发布。
2. `2B` 加入发布 intent/idempotency、课程级 release number、源 revision 摘要、预览与权利确认事实。
3. `2C` 重建 AccessCode、GrantItem 和 Redemption；凭证领取窗口、授权项有效期、在线资格和已安装内容生命周期分离。
4. `2D` 建立本机学习标识摘要与证明校验，重复兑换幂等，多授权来源按并集计算；任何来源失效不清空其它来源。
5. `2E` 从 CourseRelease 派生范围裁剪后的版本化课程包，生成摘要；响应不得包含草稿、授权摘要、字幕或教师内部字段。
6. `2F` OpenAPI 客户端和课程包生成物进入契约测试；删除 Python/JavaScript 手工双写的相同规则。

门禁：发布失败不产生部分 release；同一 intent 重试只有一个结果；兑换失败不创建部分关系；范围并集、终止、到期、重新下载和禁止字段均有真实数据库集成测试。

### 阶段 3：教师和管理员 Web 应用

1. `3A` 建立共享 HTTP transport、request ID、错误分类和通用 UI 状态组件；不共享管理员/教师会话与权限决定。
2. `3B` 先迁移管理员应用：登录、教师列表、创建、重置、停用/恢复和高风险确认；与旧页面做行为对照后切入口。
3. `3C` 迁移教师应用外壳：登录、课程列表、课程/课节 CRUD、显式顺序和可恢复路由，不再读取第一门课程/第一课节。
4. `3D` 把 node registry、timeline model、subtitle parser 作为纯领域/UI 模块迁入；组件负责渲染，server state、未保存输入和编辑器状态分开。
5. `3E` 接入 revision 草稿保存、冲突恢复、真实预览、课程级发布、授权范围和一次性授权码显示。
6. `3F` 每个旧页面只有在新应用通过自动化和真实浏览器对照后才停止发布；销售页不因应用框架迁移而重写。

门禁：React 测试执行 DOM/事件/异步状态，不用源码字符串代替；真实浏览器完成多课程多课节、刷新、冲突、预览、发布、授权和失败恢复。

### 阶段 4：学生插件课程库与本机状态

1. `4A` 建立 TypeScript MV3 构建，manifest 和固定 ZIP 由构建清单生成；background 是唯一网络与底层持久化边界。
2. `4B` 新建 storage root：LocalIdentity、InstalledCourse、AuthorizationSourceCache、LocalLearningState、QuarantineEntry；旧 root 明确拒绝，不迁移。
3. `4C` 建立本机证明、兑换摘要、学生确认、staging、完整复验和按课程原子提交；取消、超时、损坏、空间不足均保持最后有效数据。
4. `4D` 实现课程库浏览、删除、重置、资格状态、重新下载/更新影响摘要；资格失效不远程删除已安装内容。
5. `4E` popup 和 content 共用无 DOM 假设的 view-model/错误目录，分别渲染；不复制课程列表规则和错误文案。
6. `4F` 配置生产/本地 API 构建目标和 host permissions；禁止运行时猜环境或接受任意 endpoint。

门禁：旧/空/畸形响应、并发兑换、取消安装、更新失败、单课程损坏、多课程隔离和本机数据不上传均有自动化证据；固定 ZIP 可从精确提交重复构建且摘要一致。

### 阶段 5：B 站运行时与本机学习状态机

1. `5A` host adapter 只拥有 B 站 DOM、video 定位、时间、暂停/继续和 SPA 生命周期；课程逻辑不引用选择器。
2. `5B` 匹配返回全部候选；零候选静默、单候选启动、多候选让学生选择，LearningSession 锁定 course/lesson/release。
3. `5C` 分离 NodeInputDraft、NodeAttempt、NodeOutcome、ResumePosition 和 Progress；业务提交 ID 幂等，正式尝试追加保存。
4. `5D` 建立节点调度器与唯一学习窗口状态机，四类 renderer 接入共同生命周期；关闭、错误、跳过、不支持和完成不能互相冒充。
5. `5E` 处理 seek、刷新、播放器重建、SPA、全屏、离线、扩展更新和课程库更新；当前会话不热切换 release。

门禁：纯状态机和 adapter 集成自动化通过；指定桌面 Chrome/B 站人工矩阵逐项留证；无匹配页面不显示 KnownMap 课程 UI，离开页面后无旧监听和窗口。

### 阶段 6：安全、运维、发布与切换

1. `6A` 拆分 build、migration、deploy、probe、rollback；共享校验库，保留精确提交、白名单、SHA-256、不可变目录和原子切换。
2. `6B` 发布清单记录 Web/API/extension/schema/storage/migration 版本支持矩阵；组件不兼容时在切换前失败。
3. `6C` 完成环境启动校验、密钥/依赖/SAST、日志禁入、请求关联、业务审计和健康/版本探针。
4. `6D` 把备份保留改为已接受的 30 天，并执行代表性副本恢复、对象/归属对账和故障回退演练。
5. `6E` 隔离旧数据库、旧 storage、旧 API/页面/诊断入口；只有消费者、恢复和追溯责任均清零后才物理删除。

门禁：全量 `SEC-*`、`OPS-*`、`MIG-*` 通过；候选失败可回到完整上一组合，不允许只回退 Web 或只回退 API；恢复验证证明备份可读且业务对象对账一致。

### 阶段 7：真实验收与发布

按 [`v1-test-plan.md`](v1-test-plan.md) 和 `D-V1-005` 完成真实老师、真实学生、第二次独立交付、重启恢复、更新、失败恢复、备份恢复和回退。256 个需求编号只有获得可重复证据后才能改为“已验证”。

## 7. 测试路径图

```text
管理员接入教师
  -> [权限/停用/会话/审计]
教师建立课程与课节
  -> [归属/重复内容/同视频/顺序/revision]
教师编辑并预览
  -> [字幕本机/节点 schema/冲突/预览隔离]
课程级发布
  -> [原子性/idempotency/不可变 release/权利确认]
创建授权并兑换
  -> [秘密/范围/来源并集/本机证明/重复请求]
插件确认并安装
  -> [包校验/staging/原子替换/局部恢复/版本矩阵]
B 站匹配并学习
  -> [0/1/N 候选/会话锁定/SPA/seek/全屏/离线]
记录本机学习状态
  -> [草稿/尝试/outcome/progress/重置/不上传]
构建与发布
  -> [精确提交/摘要/迁移/健康/备份/恢复/回退]
```

每个箭头至少有一项集成或浏览器证据；每个方括号内的分支至少有成功、主要失败和边界测试。源码字符串断言只能证明静态发布边界，不能作为业务行为的唯一证据。

## 8. 主要生产失败模式与门禁

| 新路径 | 现实失败 | 自动化 | 错误处理 | 用户结果 |
| --- | --- | --- | --- | --- |
| 草稿保存 | 两标签页覆盖 | revision 冲突集成测试 | 保留两侧状态 | 明确比较/重试，不静默覆盖 |
| 课程发布 | 第 N 个课节校验失败 | 原子事务测试 | 整体回滚 | 显示失败课节，不产生 release |
| 授权兑换 | 超时后客户端重试 | idempotency + 唯一约束 | 返回同一 Redemption | 不重复授权，不要求猜成功 |
| 包安装 | 校验后存储空间不足 | staging/写入失败测试 | 保留旧课程 | 显示可恢复错误 |
| 多课节同视频 | 多个合法候选 | 0/1/N 匹配测试 | 学生选择并锁定 | 不静默进入错误课节 |
| B 站 SPA | 页面/播放器重建 | adapter 生命周期测试 + Chrome | 解绑并重新定位 | 不重复节点、不残留窗口 |
| 课程更新 | 学习中出现新 release | 会话版本锁定测试 | 下次会话才切换 | 当前学习不热切换 |
| 发布切换 | 新 API 与旧插件混用 | 版本矩阵/候选探针 | 切换前失败或稳定拒绝 | 不写入未知结构 |
| 数据恢复 | 备份文件存在但不可恢复 | 隔离恢复与对账 | 阻止发布/记录故障 | 不把“有文件”冒充可恢复 |

任何路径若同时“无测试、无错误处理、用户无可见提示”，按 critical gap 阻止阶段完成。

## 9. 每步 `next.md` 与提交规则

每个工作包开始前把以下内容写入 `next.md`：目标、需求/设计编号、允许修改的文件、先失败的测试、日志来源、验收命令和回退点。

每个工作包按固定循环：

```text
失败测试/人工脚本
  -> 最小实现
  -> 聚焦验证
  -> 全量回归与静态/安全检查
  -> 文档、changelog、lessons、追踪矩阵同步
  -> 单一提交并 push
```

阶段完成后创建 PR/MR，执行整阶段文档审计和独立工程审查；CI、文档、风险和用户授权确认前不合并。不要把 8 个阶段合成一个长期重构分支。

## 10. 规范加载范围

本计划已读取：全局开发流程、项目 `doc/lessons.md`、FastAPI、数据建模与数据流、测试、安全编码、可观测性、错误处理专项规范，以及系统能力索引。

当前不适用：AI/LLM 集成规范，因为 v1 明确不接入 AI；表格、文档、幻灯片和外部批量 UI 专项不适用。后续若新增 AI、外部文件批处理、远程部署工具或浏览器批量自动化，再按触发条件补读对应规范和系统工具说明。

## 11. NOT in scope

- 微服务、Redis、消息队列、容器编排和多节点高可用：当前 SQLite 单节点小规模交付不需要。
- B 站以外平台、手机端和 Chrome Web Store：冻结范围外，不能借重构顺手扩展。
- 学生账号、服务端学习数据、跨设备同步和教师报表：违反当前单机隐私/产品边界。
- AI 制作、评分、追问和个性化路径：`D-V1-002` 已明确排除。
- 自动迁移旧服务端业务数据或旧学生本机数据：`D-V1-012` 采用干净初始化与明确拒绝。
- 先重写销售页或品牌：不阻塞 v1 业务闭环，销售入口只在阶段 6 做发布边界迁移。
- 为未来节点类型预建通用插件平台：当前只实现共同生命周期和四类基线节点。

## 12. 开始实施前的最终检查

- 当前未提交的追踪矩阵与文档检查修改已独立确认、验证和提交；
- `v1-development-plan.md`、本文件与 `next.md` 的当前阶段一致；
- 阶段 0 的目录和契约命名不存在尚未解决的多个合理方案；
- 新依赖、锁文件、CI 和迁移策略有明确变更清单；
- 当前产品代码基线测试、Ruff 错误和弃用警告已保存为“改前证据”；
- 第一工作包只建立工程骨架与测试门禁，不夹带业务重写。
