# 学生插件课程库、课程升级与设置 Implementation Plan

> **For agentic workers:** 按当前 Codex 工作流逐任务执行；每个任务完成后运行对应检查并审阅变更，再进入下一任务。

**Goal:** 按已确认的第十二版设计，实现学生插件的课程列表分页、课程升级、学习记录迁移、课程资源交付与本地缓存、首页显示设置和授权码入口，并为学生登录与真实推荐保留清晰的后端边界。

**Architecture:** 课程内容仍以服务端最新可交付 `CourseRelease` 为真源，插件 background 继续作为唯一网络与本地存储边界。插件以 `courseId` 锁定课程，以 `releaseId` 判断版本，以 `lessonId + node.id` 迁移学习记录；popup/设置页打开时触发本机已安装课程的全量轻量版本检查，精确匹配到已安装课程的 B 站页面时触发该 `courseId` 的课程级轻量检查，popup 只负责显示和发起操作。版本检查只返回已安装课程的升级摘要，真正升级时再请求课程包和资源，服务端二次校验。课程 JSON 留在 `chrome.storage.local`，媒体 Blob 留在 IndexedDB/Cache Storage，按哈希去重并通过 staging + 原子切换更新。学生登录和推荐课程不伪造数据，作为后续独立账户/目录域。

**Tech Stack:** TypeScript、Vite、Chrome MV3、`chrome.storage.local`、FastAPI、Pydantic、SQLAlchemy、Alembic、Vitest、pytest、JSON Schema。

---

## 现有数据资产盘点

### 服务端课程与交付资产

1. `v1_courses` 的 `Course`：课程身份、标题、版本族/来源字段、状态和修订号。当前有效授权按 `course_id` 工作。
2. `v1_lessons` 的 `Lesson`：课节身份、顺序、标题和稳定 `lesson_id`。
3. `v1_video_references` 的 `VideoReference`：B 站 `platform_video_id`、`page`、`cid`，用于课程页面精确匹配。
4. `ScriptDraft`：教师仍在编辑的草稿，不直接作为学生交付内容。
5. `CourseRelease` 与课节快照：不可变的已发布课程版本，顶层包含 `courseId`、`releaseId`、`releaseNumber`、`updatedAt` 和课程包内容。
6. `AccessCode`、`GrantItem`、`Redemption`：授权码、授权范围和当前本机领取关系；服务端通过 `effective_grants()` 合并有效资格。
7. `course-package.schema.json`：学生课程包契约，当前为 v3，已经包含课程版本、B 站分 P 引用、稳定节点和资源清单。

### 插件本地资产

1. `LocalIdentity`：当前 Chrome 配置生成的本机身份和证明，用于兑换及免输授权码的更新检查。
2. `InstalledCourse`：当前安装的课程内容。现有结构已保存 `courseId`、课节、节点、`publishedAt` 和授权来源，但缺少完整 `releaseId`/`releaseNumber`，需要补齐。
3. `AuthorizationSource`：记录哪次兑换带来了哪些课程，不保存授权码原文。
4. `LearningState`：按 `courseId -> lessonId -> nodeId` 保存完成状态、尝试历史和播放位置。
5. `QuarantineEntry`：损坏数据的隔离记录，升级失败不能绕过这条保护边界。
6. 新增 `StudentSettings`：只保存本机偏好，包括 `showRedeemEntry`、`showRecommendations`、`syncMode`、快捷键和受限的 mascot 选项；打开 popup/设置页和精确匹配课程页的检查不由设置开关屏蔽。

### 品牌与视觉资产

- 网站标准图标：`v1/site/assets/knownmap-icon.png`。
- 插件标准图标：`v1/extension/assets/icon-48.png`，当前与网站标准图标内容一致。
- 网站统一字标规则：`KnownMap` 中 K 使用 `#e8b428`，M 使用 `#c56e52`。
- 已确认的设计资产：`docs/superpowers/assets/2026-08-28-course-library-sync-layout.html`。

## 当前流程

```text
教师编辑 ScriptDraft
  -> 发布 CourseRelease
  -> 教师按 course_id 创建 AccessCode/GrantItem
  -> 学生在插件输入授权码
  -> POST /api/v1/student/redemptions
  -> 服务端建立 Redemption，解析最新可交付 release
  -> 返回经过授权范围裁剪的课程包
  -> background 校验课程包
  -> CourseLibrary.installCourse() 写入 InstalledCourse
  -> B 站页面按 BVID + page/cid 找到课程并运行
```

当前已经存在但未接入插件 UI 的升级检查基础能力：

```text
插件 popup 打开
  -> background 读取本机 courseId + 已安装 releaseId
  -> POST /api/v1/student/course-updates/check（只返回版本摘要）
  -> 服务端重新计算当前本机有效授权集合
  -> 返回本机已安装课程的 status=unchanged|update|unauthorized 摘要，或空 courses 表示没有已安装课程需要检查
  -> 学生点击升级，或自动模式确认没有活跃学习会话
  -> POST /api/v1/student/course-updates/apply（请求完整课程包）
  -> 服务端再次核对授权、courseId 和期望 releaseId
  -> 插件按稳定 lessonId + node.id 迁移 LearningState
  -> 原子替换课程并保存新 releaseId
```

B 站课程页触发的是同一条检查链路，但范围收窄到当前精确匹配的课程：

```text
B 站 content script 解析当前 URL
  -> 通过 BVID + page/cid 精确找到已安装课程 courseId
  -> 未匹配到课程：结束，不请求后端
  -> 匹配到课程：background 调用 course-updates/check，指定 courseId
  -> 后端比较整门课程的最新 CourseRelease
  -> 有差异则提示/升级，无差异则继续学习
```

当前缺口是：`CourseRelease` 的版本信息尚未完整落到插件本地；现有 `POST /api/v1/student/course-updates` 一次返回课程包，不能作为轻量检查接口；`CourseLibrary` 没有课程升级方法；background 没有 popup/设置页打开检查和升级消息；popup 只有授权码兑换和插件 ZIP 更新入口；设置没有本地偏好存储；课程列表没有按 3 门限制和分页。更重要的是，课程包当前只有资源元数据，教师资源读取接口不能给学生使用，插件没有二进制资源仓库和资源解析器；字幕在发布快照中存在但没有进入学生课程包。

## 后端接口清单

### 本轮后端接口设计

1. `POST /api/v1/student/redemptions`
   - 作用：输入授权码，创建或复用当前本机的 `Redemption`，按 `course_id` 返回最新可交付课程包。
   - 保持现有字段：`schemaVersion`、`idempotencyKey`、`accessCode`、`localIdentityId`、`localProof`、`client`。
   - 插件首次领取继续使用现有接口，不新增“领取课程码”后端路径。

2. `POST /api/v1/student/course-updates/check`（新增轻量检查接口）
   - 触发时机：popup 或设置页打开、精确匹配到已安装课程的 B 站页面，或学生手工点击“检查更新”。
   - 请求提交本机 `installedCourses: [{courseId, releaseId, releaseNumber}]`、本机身份和证明；B 站课程页触发时额外提交 `courseIds: [matchedCourseId]`，popup 全量检查不提交筛选项。
   - 服务端通过 `effective_grants()` 校验本机是否仍有权访问客户端提交的课程，但不遍历或返回本机未安装的课程。
   - 只返回客户端提交的已安装课程摘要：`courseId`、标题、当前 `releaseId`、`releaseNumber`、`status: unchanged|update|unauthorized`；不返回未提交课程，也不返回完整课程包。
   - `courseId` 相同但 `releaseId` 不同即标记为 `update`；相同版本标记为 `unchanged`；缺少本地 `releaseId` 按未知版本处理并标记为 `update`；授权失效标记为 `unauthorized`，不返回课程包。

3. `POST /api/v1/student/course-updates/apply`（新增升级交付接口）
   - 请求提交学生选中的 `courseId`、检查时看到的期望 `releaseId`、本机身份和证明。
   - 服务端再次计算有效授权，并确认期望版本仍是该课程当前可交付版本；不一致则拒绝并要求重新检查。
   - 通过现有 `crop_package()` 返回授权范围内的完整课程包，避免仅凭客户端摘要安装内容。
   - 插件升级失败时继续保留旧课程；成功后才替换本地课程和版本元数据。

4. 现有 `POST /api/v1/student/course-updates`
   - 暂作为兼容路径处理已有调用，后续迁移到 `check`/`apply` 两阶段契约后再决定是否下线。
   - 若保留，必须收紧 `knownReleases` 为明确的 `courseId + releaseId` 结构，拒绝未知字段和空标识，不能继续用裸 `dict`。

5. `POST /api/v1/student/course-assets/authorize` + `GET /api/v1/student/course-assets/{assetId}`（新增学生资源接口）
   - `authorize` 接收 `courseId`、`releaseId` 和资源哈希清单；服务端重新核对本机有效授权及资源是否属于该发布版本，返回短期、限定范围的资源访问凭证。
   - `GET` 使用短期凭证读取资源文件，支持 `Range`、`ETag` 和正确的 `Content-Type`，供视频/音频按需加载；不暴露教师接口和永久下载链接。
   - background 负责凭证申请、资源下载和哈希校验；课程页只拿到受控媒体地址或本地缓存引用，不携带 `localProof`。

### 本轮不新增的接口

- 课程列表、课程分页和首页显示设置全部基于插件本地 `InstalledCourse` 和 `StudentSettings`，不新增服务端课程列表接口。
- 自动检查、提示升级和手工检查共用 `course-updates/check`；实际升级共用 `course-updates/apply`，不按 UI 模式复制后端业务。
- `GET /api/v1/meta/version` 仅为服务探针，不参与课程升级判断。

### 后续独立账户与推荐域的接口草案

当前仓库没有学生账户表、学生会话或推荐目录，不能在本轮直接接通。后续冻结账户契约后，接口边界应为：

- `POST /api/v1/student/auth/login`：创建 HttpOnly 学生会话。
- `GET /api/v1/student/auth/me`：返回当前学生账户状态。
- `POST /api/v1/student/auth/logout`：撤销当前会话。
- `GET /api/v1/student/recommendations?limit=10`：只返回真实可展示的推荐元数据，不直接返回未授权课程包。

账户域还必须定义学生账户与 `LocalIdentity` 的绑定方式、换机规则、密码/验证码方式和跨设备学习记录范围；这些规则冻结前，登录窗口只作为独立入口，不得改变当前授权码和本机学习链路。推荐接口还必须定义推荐来源、可见性、排序和“查看后如何领取”的业务规则，不能用写死的演示课程替代。

## 文件边界

- 修改 `v1/contracts/schemas/extension-storage.schema.json`：增加课程版本元数据和本地设置的兼容字段。
- 修改 `v1/contracts/schemas/course-package.schema.json`：补齐字幕交付字段，并明确资源清单是引用/校验元数据，不承载媒体二进制。
- 修改 `v1/extension/storage/types.ts`、`v1/extension/storage/index.ts`：保存/读取版本元数据、设置默认值、原子迁移学习状态。
- 新建 `v1/extension/storage/assets.ts`：定义 IndexedDB/Cache Storage 资源仓库、按哈希复用、引用记录、配额检查和无引用清理。
- 新建 `v1/extension/storage/settings.ts`：定义 `StudentSettings`、默认值和受限设置更新函数。
- 新建 `v1/extension/runtime/course-upgrade.ts`：请求更新、课程版本比较和状态迁移的纯函数/服务。
- 修改 `v1/extension/background/validate.ts`：保留并验证 `releaseId`、`releaseNumber`。
- 修改 `v1/extension/background/redeem.ts`：复用统一课程包校验结果，保留版本元数据，并接入资源下载流程。
- 修改 `v1/extension/background/service-worker.ts`：增加检查升级、执行升级、设置读取和设置写入消息。
- 修改 `v1/contracts/schemas/extension-messages.schema.json`、`v1/extension/background/messages.test.ts`：登记新增 background 消息。
- 修改 `v1/extension/popup/index.ts`、`v1/extension/popup/popup.css`：实现首页课程上限、更多分页、升级浮窗、授权码入口和设置入口。
- 新建 `v1/extension/popup/settings.ts`：渲染本地设置页并提交设置消息。
- 修改 `v1/extension/shared/library-view.ts`：提供最多 3 门展示、分页数据和需要升级状态视图。
- 修改 `v1/extension/content/richText.ts`、`window.ts`：将课程资源引用解析为受控的本地/授权媒体地址，确保图片、语音和视频真正可显示/播放。
- 修改 `v1/backend/app/modules/entitlement_delivery/schemas.py`、`routes.py`：增加 `course-updates/check` 版本摘要接口和 `course-updates/apply` 课程包交付接口，保留兼容路径并收紧版本请求结构。
- 修改 `v1/backend/app/modules/entitlement_delivery/routes.py`、新建 `v1/backend/app/modules/entitlement_delivery/asset_delivery.py`：增加按课程版本和有效授权签发的资源访问/流式下载接口，不能复用教师资源 URL。
- 修改 `v1/backend/tests/test_entitlement_delivery_api.py`：覆盖只检查已安装课程、同版本无变化、旧版本升级、期望版本过期、未授权课程不返回、未知字段和授权范围裁剪。
- 修改 `v1/extension/storage/storage.test.ts`、新建 `v1/extension/storage/assets.test.ts`、新建 `v1/extension/runtime/course-upgrade.test.ts`、扩展 `v1/extension/background/redeem.test.ts`、`v1/extension/popup/popup.test.ts`：覆盖存储兼容、节点迁移、资源去重/覆盖/回滚、消息和显示规则。
- 修改 `docs/superpowers/specs/2026-08-28-student-course-library-and-upgrade-design.md`、`changelog.md`、`next.md`：完成后记录已验证行为。

## 实施任务

### Task 1: 冻结课程升级和设置契约

**Files:**
- Modify: `v1/contracts/schemas/course-package.schema.json`
- Modify: `v1/contracts/schemas/extension-storage.schema.json`
- Modify: `v1/extension/storage/types.ts`
- Create: `v1/extension/storage/settings.ts`
- Test: `v1/extension/storage/contract.test.ts`

- [ ] 为 `InstalledCourse` 增加可选 `releaseId` 和 `releaseNumber`，旧课程读取时规范化为 `null`；不改变现有 storage root 主版本，避免旧用户整根隔离。
- [ ] 为 root 增加可选 `settings`，缺失时填入：`showRedeemEntry: true`、`showRecommendations: true`、`syncMode: 'prompt'`、默认快捷键 `Alt+K`、标准 mascot；不增加会屏蔽必要检查的开关。
- [ ] 扩展课程包契约，明确课程资源只传清单与哈希；补上课节字幕字段，确保已保存的字幕能进入学生课程包。
- [ ] 用字符串联合类型限制 `syncMode` 和 mascot 选项，不接受任意 URL、脚本或 CSS。
- [ ] 增加契约测试：旧 root 仍可读，新字段能通过 schema，未知设置字段被拒绝，默认值与设计一致。
- [ ] 运行 `npm --prefix v1 test -- storage/contract.test.ts`，预期新增契约测试通过。
- [ ] Commit: `feat: define course upgrade and student settings contracts`

### Task 2: 保存课程发布版本元数据

**Files:**
- Modify: `v1/extension/background/validate.ts`
- Modify: `v1/extension/background/redeem.ts`
- Modify: `v1/extension/storage/index.ts`
- Test: `v1/extension/background/redeem.test.ts`
- Test: `v1/extension/storage/storage.test.ts`

- [ ] 让 `checkCoursePackage()` 返回 `releaseId` 和 `releaseNumber`，并在 `InstalledCourse` 中保存。
- [ ] 对缺失版本字段的旧本机课程保留可学习能力，但升级检查发送“版本未知”的条目，使服务端返回当前可交付版本摘要。
- [ ] 重复安装同一课程时只替换该课程；其它课程、授权来源和学习记录不变。
- [ ] 增加测试：首次兑换保存版本、旧课程读取兼容、错误版本不写入、同课程更新不清除其它课程。
- [ ] 运行 `npm --prefix v1 test -- background/redeem.test.ts storage/storage.test.ts`，预期全部通过。
- [ ] Commit: `feat: persist installed course release metadata`

### Task 3: 实现节点识别和学习状态迁移

**Files:**
- Create: `v1/extension/runtime/course-upgrade.ts`
- Modify: `v1/extension/storage/index.ts`
- Test: `v1/extension/runtime/course-upgrade.test.ts`

- [ ] 实现课程版本比较：按 `lessonId + node.id` 匹配，不按标题、时间或数组位置猜测；返回新增、删除、未变更和已修改节点集合。
- [ ] 对节点生成稳定标准化指纹：排除 `id`、学生状态和 `captionId`，保留互动语义、正文、触发时间、效果和展示提示。
- [ ] 实现状态迁移：未变更节点保留 `done`；已修改节点从 `done` 移除但保留 `attempts`；新增节点不加入 `done`；删除节点从当前可见进度中排除但保留历史记录。
- [ ] 课程版本迁移和课程内容替换必须在同一个 `CourseLibrary` 串行写操作内完成；任何校验或写入失败都保留旧课程。
- [ ] 增加测试：同 id 未改、同 id 改内容、新增、删除、课节新增/删除、节点重建为新 id、迁移失败回滚。
- [ ] 运行 `npm --prefix v1 test -- runtime/course-upgrade.test.ts storage/storage.test.ts`，预期所有迁移反例通过。
- [ ] Commit: `feat: migrate learning state across course upgrades`

### Task 4: 接通 background 的课程升级链路

**Files:**
- Modify: `v1/extension/background/service-worker.ts`
- Modify: `v1/extension/background/redeem.ts`
- Modify: `v1/contracts/schemas/extension-messages.schema.json`
- Modify: `v1/extension/background/messages.test.ts`
- Test: `v1/extension/runtime/course-upgrade.test.ts`

- [ ] 增加 `checkCourseUpdates` 消息：由 popup 打开事件、精确匹配的 B 站课程页或手工检查触发；background 读取本地课程版本和本机身份，调用 `POST /api/v1/student/course-updates/check`，返回全量或指定课程的版本摘要，不写入课程。
- [ ] 增加 `upgradeCourse` 消息：接收已检查的 `courseId + expectedReleaseId`，调用 `POST /api/v1/student/course-updates/apply` 获取完整课程包，重新校验课程包，执行节点进度迁移，再原子写入新课程。
- [ ] 自动、提示、手动三种模式都使用同一检查/交付链路；模式只决定检查结果后的处理方式。自动模式在当前学习会话活跃时返回“延后”，不得热切换。
- [ ] 明确禁止 background 定时轮询、浏览器启动轮询和未匹配 B 站页面触发检查；只有精确匹配到已安装课程的 B 站页面才允许课程级检查。
- [ ] 所有课程检查、课程包和资源授权 API 请求留在 background；popup 不直接访问 API，不直接读写 `chrome.storage`。媒体元素如需在线读取，只能使用 background 获取的短期受控地址，不携带 `localProof`。
- [ ] 增加未知消息、未知课程、版本回退、响应畸形、网络超时和重复点击测试。
- [ ] 运行 `npm --prefix v1 test -- background/messages.test.ts runtime/course-upgrade.test.ts`，预期消息和失败路径通过。
- [ ] Commit: `feat: connect background course upgrade flow`

### Task 5: 收紧后端升级请求契约并补回归

**Files:**
- Modify: `v1/backend/app/modules/entitlement_delivery/schemas.py`
- Modify: `v1/backend/app/modules/entitlement_delivery/routes.py`
- Modify: `v1/backend/tests/test_entitlement_delivery_api.py`

- [ ] 新增 `InstalledCourseVersion`、`CourseUpdateCheckWrite` 和 `CourseUpdateApplyWrite` Pydantic 模型，字段只允许 `course_id`、`release_id`、`release_number`、可选 `course_ids` 及本机身份字段，禁止未知字段。
- [ ] 新增 check 路由：只处理客户端提交的已安装课程；服务端用 `effective_grants()` 校验这些课程的授权，`releaseId` 不同返回 `update`，相同版本返回 `unchanged`，授权失效返回 `unauthorized`；不遍历、不返回本机未安装课程，也不返回完整课程包。
- [ ] 新增 apply 路由：只接受选中的课程和检查时的期望 `releaseId`，服务端再次确认它仍是最新可交付版本，再用现有 `crop_package()` 返回课程包。
- [ ] 保持旧 `/course-updates` 的兼容行为并标明迁移边界，避免旧插件突然失效。
- [ ] 增加回归：未安装课程不被发现、已知最新版本无候选、旧版本出现升级、期望版本过期、未授权课程不泄露包、部分授权只返回允许课节/节点、未知字段返回 422。
- [ ] 运行 `cd v1/backend && uv run pytest tests/test_entitlement_delivery_api.py`，预期现有和新增用例全部通过。
- [ ] Commit: `fix: validate course update release references`

### Task 5A: 实现课程资源交付、缓存和回滚

**Files:**
- Modify: `v1/backend/app/modules/entitlement_delivery/routes.py`
- Create: `v1/backend/app/modules/entitlement_delivery/asset_delivery.py`
- Modify: `v1/backend/app/modules/authoring_release/asset_storage.py`
- Modify: `v1/contracts/schemas/course-package.schema.json`
- Create: `v1/extension/storage/assets.ts`
- Modify: `v1/extension/background/redeem.ts`
- Modify: `v1/extension/background/validate.ts`
- Modify: `v1/extension/content/richText.ts`
- Modify: `v1/extension/content/window.ts`
- Test: `v1/backend/tests/test_authoring_assets_api.py`
- Test: `v1/backend/tests/test_entitlement_delivery_api.py`
- Test: `v1/extension/storage/assets.test.ts`
- Test: `v1/extension/content/richText.test.ts`

- [ ] 保持服务端文件与数据库元数据分离：生产环境的 `asset-storage` 必须使用持久化磁盘或对象存储，不能放在代码发布目录，也不能把媒体二进制塞进 SQLite/课程 JSON。
- [ ] 增加学生资源授权接口：只允许当前有效授权访问目标 `courseId + releaseId` 引用的资源；返回短期、限定资源范围的访问凭证/地址，支持音频和视频的 Range/ETag，不复用教师资源 URL。
- [ ] 让课程领取和升级先取得课程包与资源清单，再在 background 下载所有必需资源；逐项校验 `sha256`、`byteSize`、`mimeType` 和引用关系，任何一项失败都不切换课程。
- [ ] 升级过程中向 popup/课程页报告资源准备进度 `X/Y`；全部内容和资源验证完成后显示“课程已升级到第 X 版”，失败时明确提示“仍使用旧版本”。
- [ ] 使用 IndexedDB/Cache Storage 保存二进制 Blob，使用 `sha256 + mimeType` 做物理去重；`assetId` 只做逻辑引用，同 ID 换哈希时写新 Blob，禁止原地覆盖旧 Blob。
- [ ] 为每个 `courseId + releaseId` 维护资源引用集合；课程切换成功后再清理旧版本无引用资源，清理失败不能影响课程使用。
- [ ] 增加配额不足、下载中断、重复资源、同 ID 内容替换、删除资源、旧版本回滚和媒体引用缺失测试。
- [ ] 将 `asset://assetId` 在运行时解析为受控本地/授权媒体地址；图片、语音、视频必须实际可渲染/播放。B 站原视频继续只作为播放载体，不下载。
- [ ] 对 PDF/DOCX 等文件明确返回不支持；如业务确认需要，再单独设计 `document`/`pdf` 类型和阅读器，不将其混入本轮媒体逻辑。
- [ ] 运行 `cd v1/backend && uv run pytest tests/test_authoring_assets_api.py tests/test_entitlement_delivery_api.py` 与 `npm --prefix v1 test -- storage/assets.test.ts content/richText.test.ts`，预期资源授权、校验、缓存和渲染用例通过。
- [ ] Commit: `feat: deliver and cache course assets safely`

### Task 5B: 实现多课程升级队列和中断恢复

**Files:**
- Modify: `v1/extension/storage/types.ts`
- Modify: `v1/extension/storage/index.ts`
- Modify: `v1/extension/runtime/course-upgrade.ts`
- Modify: `v1/extension/background/service-worker.ts`
- Modify: `v1/contracts/schemas/extension-storage.schema.json`
- Modify: `v1/contracts/schemas/extension-messages.schema.json`
- Test: `v1/extension/storage/storage.test.ts`
- Test: `v1/extension/runtime/course-upgrade.test.ts`
- Test: `v1/extension/background/messages.test.ts`

- [ ] 持久化升级任务：`queued`、`downloading`、`verifying`、`ready_to_commit`、`committed`、`paused`、`failed`、`cancelled`，记录课程、旧/目标版本、资源检查点、重试次数和错误。
- [ ] 同一 `courseId + targetReleaseId` 去重；同一课程发现更高版本时更新任务目标，不创建重复任务；多课程按用户选择顺序或稳定的自动顺序排队。
- [ ] 调度器一次只处理一门课程；当前 B 站学习会话中的课程延后，其他安全课程可以继续，不能热切换当前会话。
- [ ] popup 关闭、网络中断、浏览器重启或 service worker 被回收后，下一次受控触发可以从检查点恢复；无法续传的资源单独重试，不重置整个队列。
- [ ] 实现 staging + commit 标记：提交前旧课程始终是活动版本，提交后先保证新课程和全部资源可用，再异步清理旧资源。
- [ ] 增加崩溃模拟测试：下载一半、资源校验一半、提交前停止、提交后清理前停止，均不得产生课程 JSON 与媒体资源不一致。
- [ ] 增加暂停、继续、取消和重复点击测试；取消不得删除当前正在使用的旧课程和资源。
- [ ] 运行 `npm --prefix v1 test -- storage/storage.test.ts runtime/course-upgrade.test.ts background/messages.test.ts`，预期队列和恢复测试通过。
- [ ] Commit: `feat: persist course upgrade queue and recovery`

### Task 6: 实现课程列表和升级入口

**Files:**
- Modify: `v1/extension/shared/library-view.ts`
- Modify: `v1/extension/popup/index.ts`
- Modify: `v1/extension/popup/popup.css`
- Test: `v1/extension/shared/library-view.test.ts`
- Test: `v1/extension/popup/popup.test.ts`

- [ ] 把课程视图分成“需要升级”和“全部课程”，每个列表区最多直接取 3 门；总数大于 3 时返回分页状态和更多入口，总数不大于 3 时返回无更多入口。新课程只通过授权码领取，不进入升级检查结果。
- [ ] 课程排序固定为最近安装/最近学习规则，并用 `courseId` 作为分页稳定键，避免升级后列表抖动。
- [ ] 已安装课程卡片整体可点击打开；明确的“打开课程”按钮和“升级”按钮分别执行打开与升级；新课程继续通过首页授权码入口领取。
- [ ] 实现小型升级浮窗：淡红色、普通蓝色升级按钮、小箭头收起、叉号关闭；关闭只影响浮窗，不清除待升级状态。
- [ ] 顶部复用标准 KnownMap 图标与 K/M 字标，不生成新的渐变图标。
- [ ] 增加测试：2 门/3 门不显示更多，4 门显示前 3 门和更多入口，升级文案不残留“同步”，卡片打开入口存在。
- [ ] 运行 `npm --prefix v1 test -- shared/library-view.test.ts popup/popup.test.ts`，预期显示规则全部通过。
- [ ] Commit: `feat: add paged course library and upgrade actions`

### Task 7: 实现首页显示设置和授权码入口

**Files:**
- Modify: `v1/extension/background/service-worker.ts`
- Modify: `v1/extension/popup/index.ts`
- Modify: `v1/extension/popup/popup.css`
- Modify: `v1/contracts/schemas/extension-messages.schema.json`
- Test: `v1/extension/storage/storage.test.ts`
- Test: `v1/extension/popup/popup.test.ts`

- [ ] 增加读取/更新 `StudentSettings` 的 background 消息，设置写入串行化并只允许白名单值。
- [ ] 首页默认显示“领取新课程”和“为你推荐”；设置关闭时只隐藏对应区域。
- [ ] 保留授权码输入窗口：输入授权码后调用既有 `redeem` 消息，显示领取中、成功和失败状态；失败不覆盖已有课程。
- [ ] 推荐区域先消费明确的推荐数据接口；在后端推荐域尚未冻结前，只显示可配置的空状态，不把设计草稿中的示例课程当作真实推荐数据。
- [ ] 测试设置默认值、切换持久化、授权码入口显示/隐藏和错误不覆盖。
- [ ] 运行 `npm --prefix v1 test -- storage/storage.test.ts popup/popup.test.ts`，预期设置和领取入口通过。
- [ ] Commit: `feat: add course redemption and homepage visibility settings`

### Task 8: 设置页和后续账户入口的边界实现

**Files:**
- Create: `v1/extension/popup/settings.ts`
- Modify: `v1/extension/popup/index.ts`
- Modify: `v1/extension/popup/popup.css`
- Test: `v1/extension/popup/popup.test.ts`

- [ ] 实现设置页导航和分组：学生入口、首页显示、课程升级、页面陪伴、更多功能。
- [ ] 学生入口显示当前本机未登录状态并提供独立“学生登录”按钮；不阻挡授权码领取和本机课程使用。
- [ ] 快捷键默认值为 `Alt+K`，修改入口只写入受限快捷键配置；小人 Logo 只显示标准内置资源选择，不接受远程图片 URL。
- [ ] 登录按钮在账户后端契约未实现前明确显示为独立入口状态，不伪造登录成功、跨设备同步或推荐结果。
- [ ] 测试设置页包含学生入口、授权码入口、推荐开关、快捷键和标准 Logo 选项。
- [ ] 运行 `npm --prefix v1 test -- popup/popup.test.ts`，预期设置页面契约通过。
- [ ] Commit: `feat: add extension settings surface`

### Task 9: 全量验证、文档同步和发布准备

**Files:**
- Modify: `docs/superpowers/specs/2026-08-28-student-course-library-and-upgrade-design.md`
- Modify: `changelog.md`
- Modify: `next.md`
- Modify: `doc/INDEX.md`

- [ ] 更新设计文档末尾的实施结果，只记录实际通过的行为和测试。
- [ ] 更新需求/决策索引，明确课程升级仍按当前 `course_id -> latest deliverable release`，不声称已实现独立账户跨设备同步。
- [ ] 运行 `npm test`，预期根测试和 v1 测试全部通过。
- [ ] 运行 `npm run check`、`node tools/doc-check.mjs`、`npm --prefix v1 run type-check`、`npm --prefix v1 run build`、`npm --prefix v1/extension run build:all`。
- [ ] 运行 `cd v1/backend && uv run ruff check . && uv run ruff format --check . && uv run pytest`，预期后端检查和测试全部通过。
- [ ] 检查本地/远程分支、构建 manifest、生产下载包和线上 `/api/v1/student/course-updates/check`、`apply` 行为，再决定版本发布。
- [ ] Commit: `test: verify course library and upgrade release`

## 验收标准

- 学生有 12 门课程时，首页每个列表区最多显示 3 门；超过 3 门出现正确的更多入口，3 门或更少不出现。
- “领取新课程”默认在首页显示，授权码可复用现有兑换接口；“为你推荐”默认显示但没有真实推荐数据时不伪造课程。
- 升级检查只比较当前本机已安装的 `courseId`；同一 `courseId` 的 `releaseId` 变化标记为 `update`，同版本不产生升级候选；未安装课程不进入检查结果。
- 已安装课程能保存 `releaseId`；点击插件小图标打开主 popup 或设置页触发全量版本检查，精确匹配到已安装课程的 B 站页面触发该课程的整课检查，其他 B 站页面不触发后台请求；提示模式需要学生确认，自动模式不打断当前学习，手动模式不自动应用升级。
- 多门课程升级时按持久化队列逐门处理，同一课程不重复排队；中断后能恢复检查点，升级到一半时旧课程仍可用，提交成功后才切换到新版本。
- 课程升级会同时处理课程 JSON、字幕、图片、音频和课程自有视频；资源下载完成且哈希校验通过后才切换版本，升级中显示资源进度，成功显示新版本，失败继续使用旧版本。
- 相同内容哈希的资源在课程和版本之间只保存一份；同一 `assetId` 内容变更不原地覆盖旧 Blob，删除资源在无引用后再清理。
- `chrome.storage.local` 不保存媒体二进制；学生媒体通过授权资源接口或本地 Blob 读取，教师资源接口不能被学生直接调用。
- 当前不支持 PDF/DOCX 等文件型文档；若业务需要，必须增加独立资源类型、阅读器和容量策略。
- 升级时只按稳定身份迁移：未变节点保留完成状态，改动节点清除完成状态但保留历史，新节点未完成，删除节点不再显示。
- 网络、权限、校验或存储失败均保留旧课程，不产生半更新。
- 首页和设置页复用标准 KnownMap 资源，生产代码中不存在设计草稿的渐变占位图标。
- 学生登录入口存在但不伪造账户能力；真实账户接口和推荐接口在独立契约完成前不进入课程升级主链路。
