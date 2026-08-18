# Changelog — KnownMap

Only record verified changes.

## [Unreleased]

### 教师工作台 API 联调 — 2026-08-18

- 现有 `teacher-web/editor.html` 接入登录、会话恢复、课程/课节初始化、四种节点表单、草稿保存、发布和授权码创建。
- 新增浏览器 API client、教师会话封装和本地 CORS；页面可显示发布版本和一次性授权码。
- 保留字幕只在教师浏览器解析的边界，节点 JSON 通过后端严格 schema 校验后保存。
- Playwright 本地验收通过：桌面和 375px 移动视口无横向溢出，登录到授权码创建无页面脚本错误。
- 验证：后端测试 37 pass、Node 回归 207 pass、脚本语法检查通过。

### 课程授权码与下载 — 2026-08-18

- 新增课程授权码创建和公开课程下载 API；同一授权码始终返回课程最新发布版本。
- 授权码使用高熵 Base32 格式，数据库只保存 HMAC-SHA256 摘要和末五位提示，原文仅在创建响应中返回一次。
- 未发布课程不能创建授权码；畸形码和未知码统一返回 `INVALID_ACCESS_CODE`，接口不创建学生账号、领取记录或学习数据。
- 验证：后端测试 36 pass、Node 插件回归 204 pass、Python `compileall` 通过、Alembic 空数据库迁移通过。

### 课程发布与插件配置 — 2026-08-18

- 新增不可变 `published_scripts` 版本模型、迁移和课程发布 API；每次发布递增版本，不覆盖历史 JSON。
- 新增 `PluginCourseConfig` adapter，从课节 BVID 派生 `courseId`，输出插件契约要求的 camelCase 字段和 UTC 毫秒时间。
- 无课节、无草稿或空草稿统一返回 `DRAFT_NOT_READY`；其他教师发布统一返回 `RESOURCE_NOT_FOUND`。
- 验证：后端测试 31 pass、Node 插件回归 204 pass、Python `compileall` 通过、Alembic 空数据库迁移通过。

### 教师脚本草稿 — 2026-08-18

- 新增四种严格脚本节点 schema：`notice`、`choice`、`blank`、`free_text`；拒绝未知字段、空文案、重复节点 ID、乱序节点和错误答案引用。
- 新增 `script_drafts` 持久化模型、迁移以及按课节替换保存/读取草稿 API。
- 草稿 API 按教师资源归属隔离，草稿保存不创建或覆盖已发布版本；保存、读取和失败动作进入操作日志。
- 真实本地验证通过：后端测试 25 pass、Python `compileall` 通过、Alembic 空数据库迁移创建 `script_drafts` 成功。

### 教师课程与单课节 — 2026-08-18

- 新增每位预建教师唯一工作空间，以及课程、单课节和 B 站视频绑定数据模型与迁移。
- 新增课程创建、课程列表、课程详情、课节创建和课节详情 API；当前每门课程通过服务规则和数据库唯一约束只允许一个课节。
- BVID 按共享插件契约校验；其他教师访问课程或向他人课程添加课节时统一返回 `RESOURCE_NOT_FOUND`，避免资源存在性泄露。
- 课程和课节的创建、读取、失败操作写入持久化操作日志，并通过 request ID 与运行日志关联。
- 真实本地验证通过：登录后创建课程、绑定 `BV1WW4y1e7GL`、读取课程详情和列表，SQLite 数据和操作日志一致。
- 验证：后端测试 16 pass、Node 回归 204 pass、Python compileall 通过、Alembic 迁移通过、`pip-audit` 无已知漏洞、Bandit 无发现。

### 教师测试账号认证 — 2026-08-18

- 新增 FastAPI 教师认证模块：手工 seed 测试账号、登录、会话恢复和退出。
- 密码使用 Argon2 慢哈希；浏览器只保存 HttpOnly、SameSite 会话 cookie，数据库只保存 token 摘要。
- 新增 `teachers`、`teacher_sessions` 迁移和认证操作日志，登录成功、失败、会话恢复和退出可按 request ID 追踪。
- 真实本地验证通过：seed 创建账号，登录返回会话 cookie，`/auth/me` 恢复教师，退出后再次访问返回 401。
- 验证：后端测试 10 pass、Node 回归 204 pass、Python compileall 通过、Alembic 空数据库迁移通过。
- 安全验证：`pip-audit` 无已知漏洞，Bandit 无发现；发现并升级了存在 `PYSEC-2026-1845` 的 pytest 8.4.2，当前锁定 pytest 9.1.1。

### AI Learning Companion 产品功能说明 v0.2 — 2026-08-18

- 基于教师中心需求核对形成 `doc/AI_Learning_Companion_Product_Function_Spec_v0.2.md`，明确教师账号、测试批次、工作空间、课程、课节、授权码、学生和学习数据功能。
- 授权码改为控制课程配置的领取、下载和更新资格，不承诺远程删除学生本地已有版本；教师主动停用授权码后不可恢复。
- 明确多个有效授权码按权限并集合并，课程配置和互动内容下载到本地，但 B 站视频仍由 B 站提供。
- 新增对应决策记录；本次为需求和决策文档更新，不表示相关平台功能已经实现。

### KnownMap 品牌与 Logo — 2026-08-18

- 统一用户可见品牌为 `KnownMap`，域名记录为 `knownmap.com`。
- 新增地图窗口圆形 Logo：统一 SVG 源文件、16/24/48/128 PNG 扩展资源和网页图标。
- 当前页面、manifest、销售文案和权威文档已同步；`lessonpilot.*` 协议、存储和 JavaScript 全局标识保持兼容。
- 已验证：全量测试 `204 pass / 0 fail`；已检查扩展图标尺寸，以及桌面和 375px 移动端页面显示。
- 新增 `docs/knownmap-logo-resources.md`，记录 Logo 的知识空间、学习路径和关键节点含义，以及圆形、方形、透明背景三种资源形态的使用场景。

### 文档事实同步 — 2026-08-18

只校正文档与已合并代码、已发布公网之间的漂移，未改动产品代码：

- 测试数从 135 更新为实测 200 pass / 0 fail（README、`next.md`、1A 人工验证记录）。
- PR #1 已合并、`pages` 工作流已首次发布，因此移除「等待合并」「公网待验证」这两个已失效的前置条件。
- 1A 人工验证记录填入 V7 的发布与路径实测结果：工作台页、销售页与两个共享契约返回 200；`/doc/`、`/src/`、`/teacher-web/index.html`、`/teacher-web/editor.html` 返回 404；站点根返回 404（发布集不含首页文件，1B 迁移销售首页时处理）。该记录的扩展版本由 0.7.0 更正为 0.8.0，分支由 `stage-1a-contract-bridge-deploy` 更正为 `main`。
- 发布集实际为 8 个文件加 `.nojekyll`；原计划文案「只含 5 个文件」写于销售页加入发布集之前，按事实修正并在 D-010 记下当前清单。
- D-007 由「待验证的实施默认」改为已验证可访问，D-010 由「待 Pages 实际发布验证」改为已验证。
- 1B 状态由「未开始」细化为「销售页与试用入口修订已交付、教师工作台未开始」。

## [0.8.0] - 2026-08-16

### Stage 1B 销售页与试用入口修订 — 2026-08-16

对应计划 `doc/plans/stage-1b-sales-page-revision.md`，只改销售页文案、入口和静态示例表达。已验证的变化：

- 销售页从「看完示例并复制一句话」改为明确联系开发者、提交一节真实课程、开始一次可运行试用；品牌主张固定在主标题上方，位置一并被测试锁定。
- 首屏自成一体：身份、承诺、目标视频和协助说明；主 CTA 唯一（`tests/sales-page-copy.test.js` 断言 `.cta-primary` 恰好一个）；协助说明表述为「准备相关资源、配置互动节点」。
- 节点收敛为四种正式类型，去掉「老师补充」；学习结果块明确标注为产品形态示意，不是已上线的报告。
- 补上安全边界说明，同时禁掉「绝对安全」「安全审计」等 6 个夸大说法；不把插件、报告和多学生数据写成已上线。
- 销售演示页时间线右侧改为字幕上下文列，节点属性表单改为弹出式（COURSE-06、COURSE-07）。
- 销售页加 `noindex`；示例字幕副本按原样发布；发布集按 D-010 白名单方式追加销售页及其两个脚本。
- 复制话术在成功与失败两条提示里都说明粘贴位置。
- 飞书表单入口未实现：仓库里还没有真实表单 URL，按计划禁止写占位链接，因此整块入口不显示，并加断言防止页面提到表单却无真实 URL。
- 自动化测试增至 200 pass / 0 fail。浏览器实测：1440 / 900 / 375px 三档无横向溢出，375px 主 CTA 与复制按钮完整可见，字幕栏 8 节点在三档视口均 ≥ 7 行，页面自身无控制台错误。记录见 `tests/manual/sales-page-revision-20260816.md`。
- 未验证因此不计入完成：系统剪贴板真实写入和 CTA 无注册要求这两项需在真实浏览器确认。

### 版本对齐 — 2026-08-16

- `src/manifest.json` 版本 0.7.0 → 0.8.0，与项目版本对齐，不代表功能发布。

### Stage 1A 数据契约、消息桥与部署（代码完成，人工验证待执行）— 2026-08-15

已验证的变化：

- 新增共享课程契约 `src/shared/course-contract.js`，网页与插件复用同一份 schema 与校验逻辑。闭合 schema 拒绝未知字段，`captions`/`sourceUrl` 等工作台字段无法混入插件课程；`normalizeCourse` 只整理表示形式，`validateCourse` 对乱序等语义错误直接拒绝。43 个测试，行覆盖 97.7%。
- 新增版本化消息协议 `src/shared/bridge-protocol.js` 与来源白名单 `src/shared/workspace-origins.js`。陌生 channel 静默丢弃，我方 channel 上的畸形请求才回错误码；origin 与 pathname 成对校验，覆盖前缀、后缀和子域欺骗。21 个测试。
- 新增插件后台存储与五个操作处理器。保存后读取与写入深度相等；`expectedCourseId` 不匹配时返回 `COURSE_MISMATCH` 且原课程不变；读失败返回 `STORAGE_FAILURE` 而非报告课程不存在；每次读取重新校验存量数据。26 个测试。
- 新增白名单工作台消息桥：内容脚本在 JS 层断言精确 origin 与 pathname（Chrome match pattern 无法限定端口），重复注入不产生重复监听，写操作超时不自动重试并标记结果未确认。34 个测试。
- 新增 1A 连接诊断页 `teacher-web/workspace.html`，只验证协议往返，不含字幕、时间线或节点编辑。
- 插件 manifest 补齐 `storage` 权限，版本 0.2.3 → 0.7.0 与项目版本对齐。
- 新增测试门禁与 Pages 发布工作流；发布集为显式白名单，`doc/` 与插件运行时代码不上公网。
- GitHub Pages 已启用（source 为 GitHub Actions），`has_pages` 由 false 变为 true。
- 自动化测试从 5 个套件增至 135 个测试，全部通过（该数字为 1A 收口时的基线；1B 销售页修订后为 200）。
- 本地验证：工作台页面五个资源均返回 200；四个页面脚本在共享全局中按文档顺序加载后，测试课程校验通过、保存信封合法。
- 对抗检查通过：同一 `github.io` origin 下其它仓库路径被拒绝，`__proto__` 类键不污染原型，存储失败不报告已保存，损坏课程仍可用正确 ID 清除。

尚未验证，因此不计入已完成：真实 Chrome 已解压插件的往返、非白名单页面探针实测。公网 Pages 可访问性已于 2026-08-16 首次发布后验证（见 Unreleased 的文档事实同步）。剩余步骤见 `tests/manual/stage-1a-bridge/README.md`。

### 第一阶段文档收口 — 2026-08-15

- 将当前目标收敛为礼宾式真实验证闭环：公网销售首页、真实教师工作台、本机已解压插件和 B 站原页面；明确四种节点、单课程和非目标边界。
- 将第一阶段需求进一步拆为总览和 1A/1B/1C 三份可独立验收的阶段需求；当前 Agent 只需执行 1A，不必从后续页面和运行时需求中猜测范围。
- 完整归档混合 W0/D0/D1 与远期内容的旧 requirements、dev-plan 和 next，建立当前需求、数据规范、决策记录、文档索引和 1A/1B/1C 三份可独立验收的实施计划。
- 统一目标页面职责、消息桥、存储键、协议操作、错误码和预览会话字段；GitHub Pages 保持为待真实验证的实施默认，而非已完成事实。
- 为历史、未来和仅作视觉参考的文档增加权威状态说明，并记录本轮长度、重复、拆分和索引健康审计结果。
- 验证 34 份 Markdown 无失效本地链接、Git diff 无空白错误，现有 5 个 Node 测试套件全部通过；本轮不修改产品代码。

### Player Integration Feasibility Probes — 2026-08-14

- Add an isolated MV3 manual probe under `tests/manual/bilibili-iframe-current-time/` that injects into every permitted frame and reports whether a Bilibili iframe exposes a finite `video.currentTime`; the probe does not change production extension permissions.
- Record the YouTube-compliant interaction layout: pause through the IFrame API, resize the unobscured player, render the learning window beside it, then restore playback after submission.
- Distinguish automatic restoration of the page layout from browser-native fullscreen, which must be requested directly from the learner's submission click and degrade to in-page playback if denied.

### 学生宿主收束为 B 站原页面加插件 — 2026-08-14

方向性变更：**定时自动打断是五类节点的共同前提，不是其中一项能力**，因此学生宿主只能是装了插件的 B 站原页面（仅 PC 浏览器）。此前四份文档里的「学生首用网页优先、不要求装插件」结论作废。

- 排查并记录跨源 iframe 读取播放时间的所有路线，全部封闭：读进度条像素无 API 支持、`getDisplayMedia()` 屏幕共享因权限提示与控制栏自动隐藏不可用、墙上时钟推算在手动暂停时失真、代理转发等于重新托管他人内容。且即使拿到当前秒数也无法暂停跨源 iframe。
- 删除 `student-web/`（`app.js`、`index.html`、`styles.css`）；`course.json` 迁至 `teacher-web/course.json`，课程标识与教学文案继续被 `tests/course-config.test.js` 约束。
- 老师预览真实学生效果改为装插件打开 B 站原页面，与学生同一路径。教师端网页只负责编辑，「教师端全程免安装」不再成立；工作台里的「学生端效果预览」明确降级为静态示意图。
- 修正 `doc/teacher-course-workspace-design.md` 5.2 节与验收标准第 8 条：时间真源是导入的字幕文件，选中节点时播放器带 `t=` 重载定位，不承诺双向同步，不得用动画或进度推移暗示网页在跟踪播放位置。
- 标注 `doc/node-content-standard.md` 第 7 节「不能读时间」降级只适用于教师预览等次要场景，不可作为学生端主形态。
- 记录合规边界：对平台播放器的干预限于暂停加自有 DOM 层，不改倍速、不阻止跳过、不降原声、不改播放器 UI。
- 修正 YouTube 的定位：它是唯一提供官方 IFrame Player API、因而唯一能支撑免安装且可上手机学生形态的平台，属产品形态备用出口而非 `PlayerAdapter` 抽象验证。其政策禁止的是在播放器**前方**叠加，缩小播放器并排显示学习窗口是合规的（视口不低于 200×200，16:9 建议至少 480×270），因此 `dark-player` 覆盖主题变为不再需要，S09 改用 IFrame API 关闭字幕轨（参数待实测）。D0/D1 只做 B 站的排期不变。
- 同步改动：`doc/design.md`、`doc/requirements.md`、`doc/student-runtime.md`、`doc/dev-plan.md`、`doc/lessons.md`、`doc/node-content-standard.md`、`doc/teacher-course-workspace-design.md`、`next.md`、`README.md`、`tests/page-information-architecture.test.js`、`tests/course-config.test.js`。
- 五个测试文件全部通过。

### Teacher Online Sales Page — 2026-08-14

- Add `teacher-web/forsales.html` as the independent first online sales surface. Simple outreach gets a teacher to this page; the page itself explains the problem, value, proof, and next action.
- Keep `teacher-web/index.html` as the separate teacher workspace sample page. Sales copy and conversion stay out of the workspace and W0 editor.
- Use the approved eight-node workspace as specific product evidence inside `forsales`: a target-teacher promise, old-course before/after translation, a four-step transformation story, explicit teaching-value translation for sample evidence, and a low-friction “reply to the sender” course-conversion action.
- Verify `forsales` at desktop and 375px widths with no document-level horizontal overflow; verify that the application-copy action copies the intended request sentence. The only observed console error belongs to the embedded Bilibili player's own fingerprint reporter.

### Teacher Workspace Sample Page — 2026-08-14

- Keep the workspace sample page in three files: `teacher-web/index.html`, `teacher-web/sample.css`, and `teacher-web/sample.js`. Shared chrome stays in `teacher-web/styles.css`.
- Align the timeline to the video column at about 3/4 width, with the add-node rail in the remaining quarter. The add control is not on the axis.
- Draw the timeline as one continuous pale blue-gray bar matching the video progress track. Color changes only mark played versus unplayed; do not segment the bar.
- Summarize the add-node rail as adding interaction in the video. Do not list the four node types there.

### Subtitle Import Fixes — 2026-08-14

- Fix: read an SRT/VTT fractional field as a literal millisecond count instead of padding it to three digits. The supplied interview subtitles vary that width within one file, so padding placed one cue's end before its start and silently dropped it; the real file now imports 177 of 177 cues with no ordering violations or overlaps.
- Fix: render caption text and teacher event labels with `textContent` rather than an interpolated `innerHTML` string, so an unterminated tag in a teacher's subtitle file cannot execute. Markup output is unchanged.
- Add parser coverage for the variable-width fractional format, using the timestamp pair that previously failed.
- Correct the sales-sample timeline description in `doc/design.md`, which still said full-width after the 3/4 timeline plus add-node rail landed.
- Renumber `next.md` steps to a single 1–18 sequence with unique section letters, and record that the node trigger state machine is defined in `doc/requirements.md` S07 but not yet implemented.

### Learning Window Standard — 2026-08-14

- Make the learning window the first-class object every host implements, so any new client reaches the same display and interaction by implementing one contract.
- Split requirements into a mandatory half and an advisory half, recorded in `doc/design.md` section 7: the window's display and interaction must be identical everywhere, while pause, seek, on-picture highlight, caption covering, and audio ducking are platform-dependent recommendations that never affect conformance.
- Require window self-sufficiency, which is what makes the advisory half safe: highlights, caption covers, and audio ducking are enhancements, never the only carrier of a node's content.
- Restate lesson-pack `effects` as teacher intent rather than a host requirement.
- Define window skeleton, size tiers with authored-content limits, mounting rules for fullscreen and picture-in-picture, style isolation, singleton queueing, open-source and close-reason semantics, keyboard and IME handling, and draft recovery.
- Add the course notebook and node-bound AI ask as window applications, with snapshot-plus-reference storage.
- Decide notebook visibility by authorship: teacher- and system-authored content carries no privacy question, while learner-written notes, tags, and AI questions stay private unless the learner shares them. Submitting an answer is itself delivery to the teacher.

### Node Scope Boundary — 2026-08-14

- Define a node as one time point, one teaching point, one window opening, with self-contained, finite, local, and explainable as its hard rules.
- Keep nodes independent: allow content references and grouping, forbid prerequisites, unlocking, branching, nesting, and one node mutating another, because seeking and skipping would otherwise strand learners on a broken chain.
- Separate trigger time, effect range, and recap range; add advisory density and spacing guidance.
- Close the playback intent set and state that pausing alone is not a node: opening the window must always explain why.
- Answer the review-earlier-content question in three layers: in-window recap text is mandatory, seek-and-return with a minimized window is the recommended enhancement, and picture-in-picture is deferred because cross-origin players cannot host it and it has no reliable return path.

### Node Content Standard — 2026-08-14

- Define a host-independent node and display contract so plugin, web, and local-video app runtimes share the same student-facing content.
- Separate pedagogical family, interaction, display payload, evaluation, and playback effects.
- Align the teacher sales-sample add-node fields with that contract, without persisting a fourth node.

## [0.6.0] - 2026-08-14

### Real Subtitle-Grounded Course Version

- Add the supplied subtitle source for the fixed Bilibili interview lesson to the repository.
- Replace placeholder teacher-sample nodes with verified content points at `00:39`, `02:16`, and `05:45`.
- Align the timeline, node copy, classroom actions, student previews, and design documentation to the same course moments.
- Extend the local subtitle parser to accept the compact single-digit timestamp format used by the supplied SRT.
- Record the English-copy review boundary because the checked-in source is a Chinese AI translation, not original English captions.

### Teacher Sales Sample Course Header — 2026-08-13

- Replace prototype status text with the course directory `英语职业课 / 英文面试表达`.
- Remove preview, save, unsaved, and duplicated sample-course controls from the sales-sample header.
- Keep example-data disclosure in the student completion section, where it applies to the displayed records.
- Synchronize README, architecture, UI, current-step, and sales-sample documentation with the finalized three-page roles and course-directory header.

### Teacher Editor Static Reload Fix — 2026-08-13

- Make the shared teacher editor script tolerate controls that exist only on earlier page variants.
- Version the editor script URL so a browser does not keep executing the pre-split cached bundle after pulling the sales-sample changes.
- Add a page contract check covering the optional control binding and cache-busted editor script.

### Teacher Workspace Sales Sample Page — 2026-08-13

- Implement the confirmed sales sample at `teacher-web/index.html`: video 3/4 + intro 1/4, full-width timeline with typed icons, node rows, and labeled sample completion.
- Keep the previous subtitle-driven W0 prototype at `teacher-web/editor.html`.

### Teacher Workspace Timeline Stack — 2026-08-13

- Stack video above a full-width timeline instead of placing them side by side.
- Give a small video about three-quarters of the row width, with course intro in the remaining quarter.
- Mark timeline interaction points with distinct icons and visible labels.

### Teacher Workspace Sales Sample — 2026-08-13

- Define `doc/teacher-course-workspace-design.md` as the teacher-facing sales sample, not the shipped workspace.
- Keep the four-layer picture (course, timeline, node rows with student-effect preview, sample completion) as the target shape of the later real workspace.
- Leave `teacher-web/` functional code unchanged in this round.

### Classroom-Design Teacher Home — 2026-08-13

- Reduce the teacher home from a four-module capability map to one dominant classroom-design task.
- Keep the fixed Bilibili course and manual subtitle import as compact setup inputs beside the design entry.
- Replace home-page student preview and result modules with a small, honest note about the learning process and future evidence.

### Teacher Capability-Guided Home — 2026-08-13

- Replace the assumed current-course dashboard with a first-use workspace that explains existing-course intake, caption-anchored classroom design, student preview, and learning results.
- Keep the fixed Bilibili link confirmation, manual SRT/VTT import, timeline editor, and student preview as direct commands from the new workflow.
- State clearly that W0 displays an expected learning-result structure but does not yet record learning sessions or generate reports.
- Verify desktop and 375px layouts, source import, action editing, and teacher-to-student preview without horizontal overflow.

### Local Web Service Contract — 2026-08-12

- Document one repository-root local server for both teacher and student web pages.
- Establish `/teacher-web/` and `/student-web/` on port `4173` as the canonical local URLs.
- Record that `4174` and per-directory server roots are unsupported because they break the verified relative preview and course-configuration topology.
- Add troubleshooting guidance to distinguish a wrong server root from stale or missing synchronized code.

### W0 Subtitle-Driven Course Authoring — 2026-08-12

- Define W0 as a fixed Bilibili URL plus teacher-provided SRT/VTT subtitle intake, a locally parsed caption timeline, and caption-anchored classroom actions.
- Explicitly exclude Bilibili subtitle scraping, local video, upload, hosting, and fabricated learning-completion data.
- Refocus the learner shell around learning goals, the source video, and expected learning results.
- Add local SRT/VTT parser coverage and browser verification that imported captions replace the teacher timeline and accept a classroom action.

### W0 Bilibili Course Shell — 2026-08-12

- Re-scope the first web slice to a fixed Bilibili course presentation and teacher/student page validation.
- Remove local-video selection, browser-controlled timed activities, local-session flow, tester playback controls, and their W0 configuration/runtime artifacts from the student webpage.
- Keep timed interaction validation on the Bilibili original-page extension spike until a web-controllable player path is separately specified and proven.
- Verify teacher-to-student preview, direct original-course fallback, and desktop/375px layout behavior without horizontal overflow.

### Role-Specific Course Pages — 2026-08-12

- Rework the teacher home into a task-first workspace with the current course, pending teaching decision, course health, and direct design/preview actions.
- Reframe the student page as a single-course learning shell with lesson context, progress, video, interaction, feedback, and summary.
- Keep Bilibili source and compatibility details outside the ordinary student flow.
- Add page information-architecture checks and verify the teacher design route plus student-preview route in a headless browser.

### Web Runtime First — 2026-08-12

- Shift the next validation slice from plugin-required preview to a student web runtime.
- Keep the Chrome extension as a Bilibili/YouTube overlay adapter and PC enhancement path, not the required first-use path for students.
- Update the D0 plan so save-and-preview first opens a web course link that works across iPad, iPhone, Android, tablets, and desktop browsers.
- Preserve the existing plugin spike for Bilibili demonstration while avoiding plugin installation as a blocker for first teacher tests.

### Bilibili Source Sample and Local Control Proof — 2026-08-12

- Add `student-web/course.json` and a shared runtime contract so the student page validates and loads the single configured Bilibili sample instead of hardcoding course nodes in the UI.
- Render the specified Bilibili lesson as a source iframe with a direct original-page fallback; explicitly limit it to source presentation rather than cross-origin playback control.
- Add a browser-only local HTML5 video path: students can select MP4, WebM, or MOV files without upload or hosting, then complete two timed deterministic interactions and a locally stored summary.
- Add course-config contract tests and browser verification for the full local interaction flow plus desktop and 375px mobile layouts. The Bilibili iframe emits one third-party fingerprint-report console message, but the LessonPilot page has no own console errors.

### Creator Studio Direction — 2026-08-11

- Reframe the teacher prototype from a subtitle/video editor into LessonPilot Studio, an AI-assisted interactive-course workspace.
- Add the five-step course flow: upload, AI analysis, teaching design, student simulation, and publish.
- Promote AI from one event option to a persistent Copilot that explains suggestions and lets teachers accept or ignore them.
- Extend timeline rows with knowledge points, likely mistakes, and visible AI suggestions while keeping teacher approval final.
- Replace event-title entry with natural-language teaching intent and rename preview as classroom simulation.
- Keep real course analysis and simulated student behavior explicitly outside this prototype slice.
- Replace remaining editor-first copy with teacher-first language: AI备课草案、课堂设计、教学重点、互动建议与老师最终决定。
- Keep runtime event types as implementation details while presenting their teaching meaning in the interface.

### Teacher UI Color System — 2026-08-11

- Consolidate the teacher prototype around warm paper surfaces and a forest-green brand hierarchy.
- Add semantic tokens for attention, teacher voice, interaction activity, constrained AI, and connection status.
- Replace the isolated purple AI treatment with muted blue-green so AI remains a secondary teacher-controlled tool.
- Separate focus, status, and attention colors and verify main text/event contrast ratios against a 4.5:1 target.
- Record the shared teacher/student color rules in `doc/ui-design.md`.

### Teacher Timeline Visual Refinement — 2026-08-11

- Refine the teacher timeline against the supplied visual references.
- Add a single course overview block with video preview, course metadata, subtitle count, event count, and event legend.
- Remove duplicated course metadata from the timeline sidebar so the working area focuses on caption selection and event editing.
- Preserve the three-layer information hierarchy: course context → subtitle list → event action panel.

### Student Utility and B2B2C Boundary — 2026-08-11

- Record a productized student-tool direction: manual phrase-range replay, keyboard shortcuts, bookmarks, review notebooks, personal study plans, and optional badges.
- Separate student-owned learning history from teacher-facing evidence; teacher reports only receive explicitly submitted or course-generated evidence.
- Confirm the commercial boundary: student utility remains free, while teachers pay for course authoring, publishing, classroom events, reports, and constrained AI templates.
- Reject dark-pattern lock-in as a product strategy; retention should come from accumulated learning value and a shared cross-course tool.

### Subtitle Timeline Teacher Workspace — 2026-08-11

- Redesign the teacher surface around the actual workflow: choose a recorded video, import timestamped subtitles, and turn them into a course timeline.
- Replace the generic fixed-node editor as the primary story with subtitle paragraphs and four configurable event families: attention burst, teacher voice, interaction activity, and constrained AI template.
- Add a clickable timeline prototype with caption selection, event detail editing, teacher-voice insertion, and honest local-demo states.
- Record the subtitle pipeline decision and open-source evaluation in `doc/subtitle-pipeline.md`.
- Keep video understanding, remote upload, speech recording, extension bridge, and AI generation out of this slice.

### Teacher Web Prototype — 2026-08-11

- Add a zero-dependency `teacher-web/` high-fidelity prototype for the D0 teacher home and restricted node editor.
- Show the two intended teacher scenes: experience the finished lesson, then edit a fixed node template and preview it.
- Add prototype interactions for node switching, type-specific fields, enabled state, dirty state, reset, save, and save-and-preview feedback.
- Keep the extension bridge, local storage, and real Bilibili preview explicitly marked as the next implementation slice.
- Verify desktop and 375px mobile layouts in the in-app browser with no console errors; existing demo and subtitle regression tests pass.

### Doc Sync for Cross-Machine D0 Continuity — 2026-08-11

- Raise requirements to v0.5 with a locked-decision summary covering B2B2C positioning, student-scope freeze, teacher demo shape, D0/D1 milestones, promo video, platform expansion, and AI billing consistency.
- Rewrite `next.md` as an actionable D0 checklist for continuing development on another machine after the technical spike.
- Record the approved expansion order: Bilibili through D1, YouTube as the second `PlayerAdapter` after D1, multilingual and multi-region fully deferred with no locale/region schema work now.
- Keep only the `VideoRef` / `PlayerAdapter` structural boundary in design and platform docs.
- Synchronize teacher-demo, student-runtime, multi-creator plan, development plan, lessons, promo-video references, README, and changelog with the same decisions.

### Teacher Demo Design — 2026-08-11

- Add `doc/teacher-demo.md` as the single entry point for the teacher-facing demonstration.
- Define two consecutive scenes: experience the finished lesson, then modify the fixed template and preview the change.
- Choose a localhost teacher website opened from the extension, while keeping D0 free of accounts, remote backend, and extension reinstallation.
- Define an allowlisted, versioned website-to-extension bridge with double schema validation and five fixed operations.
- Reserve future website modules for auth, lessons, licenses, billing, AI credits, and reports without creating premature APIs or tables.
- Limit editing to three fixed nodes and their authored fields; defer node creation, deletion, sorting, type switching, and multi-video management.
- Split delivery into D0 configurable interaction and D1 complete sales demo, without presenting D0 as AI-complete.
- Resolve preview behavior: every save-and-preview action creates an isolated preview session.
- Add `doc/promo-video.md` with the approved 60–90 second screen-recording script, shot list, claims boundary, and real-course submission call to action.
- Delay public promotion editing until D1 so AI feedback and reports are recorded from verified behavior rather than simulated.
- Lock platform expansion: Bilibili only through D1, YouTube as the next player adapter after D1, and no multilingual or multi-region work in the current phase.
- Keep the Bilibili player adapter isolated so a later YouTube adapter does not rewrite activity cards or session logic.
- Synchronize requirements, design, development plan, next step, and README with the approved teacher-demo boundary.

### Student Runtime Summary — 2026-08-11

- Add `doc/student-runtime.md` as the single entry point for student-side scope before teacher-platform design begins.
- Separate teacher-configured content components from learner-owned study tools, a category that was missing from the earlier component-family list.
- Rank learner tool candidates by whether they produce learning evidence, since that is what teachers actually buy.
- Record why consumer-app retention mechanics transfer poorly to a B2B2C product, to pre-empt copying streaks and leaderboards.
- Add a three-question framework and a priority order for competitor research, so the output is a decision rather than a feature list.
- Define what freezing the student scope does and does not cover.
- Audit the summary against the full decision history and separate current Demo requirements, P2 productization decisions, and research candidates.
- Correct the first-phase boundary: network authorization, remote updates, and report delivery remain P2 rather than joining the local Demo.
- Correct implementation status: activity cards and the reusable timed-node engine are specified but not yet implemented.
- Add the omitted productized learner flow: multi-teacher authorization, indexed delivery, version locking, AI credit types, honest degradation, evidence ownership, and compatibility behavior.
- Freeze the first-phase student scope without making future competitor research a blocker for teacher-platform design.
- Add the implemented timed overlay to `doc/design.md` and reconcile stale role, billing, index, and authorization language in the platform plan.
- Fix the commercial position as small-B-first B2B2C: reserve shared learner capabilities without opening a separate consumer free/Pro product line.
- Separate platform telemetry from teacher-facing learning evidence and adopt staged collection: local voluntary export first, consented anonymous events during productized trials, identity only when later features require it.
- Define a minimal lesson-only event vocabulary and explicitly forbid collecting unrelated viewing history or raw answers in generic analytics.

### Requirements v0.4 — Subtitle Blocker Definition — 2026-08-11

- Add S09 to the P0 function table and write its full definition from the shipped behavior in `src/content/subtitle/`.
- Record the half-open time range, first-match-wins overlap rule, invalid-layout fallback, and teardown requirements.
- Move teacher-side editing of blocker ranges to P1, since the first version only supports editing the config file.
- Inventory the component families in `doc/multi-creator-platform.md` 1.5 and show that most candidate features are attribute differences, not new components.

### Multi-Creator Platform Plan — 2026-08-11

- Add `doc/multi-creator-platform.md` describing how one learner receives customized content from multiple creators.
- Choose server-indexed lesson-pack ownership over page-derived creator identity, and fetch-with-cache over push updates on MV3.
- Define draft/published separation, session-level version locking, and silent degradation when the network fails.
- Record feature tiers, pricing options, deployment shape, open decisions, and unverified technical facts.
- Split video ownership from lesson authorship so one video can carry several interpretations, with self-authored packs as the `ownerId == authorId` special case.
- Add a local video index ahead of the cache and network layers so videos without a lesson pack never reach the server.
- Add revocation behavior, owner takedown control, revenue-split stance, and the limits of selling overlay rights.
- Add the license-code design: exchange a one-time code for an install-bound token instead of validating a static code per request.
- Rule out local content encryption, obfuscation, and self-built DRM as ineffective, and record the four lightweight anti-leak measures used instead.
- Judge identity binding by whether the server can verify it, and reject reading the Chrome account email as an unverifiable client self-report.
- Prefer teacher-issued per-student codes so the platform never stores learner personal data, and require a rebinding path before any anti-sharing measure ships.
- Support several concurrent creator authorizations per learner, keep tokens hidden from the learner, and send only the token for the current video.
- Separate "silent, not our video" from "expired authorization", which must be stated explicitly instead of looking like a failure.
- Require every session to record the pack, author, and version it used so reports reach the correct teacher.
- Add a performance section: the multi-creator fetch path is cheap, but injection into every Bilibili video page, the high-frequency time watcher, and unbounded local storage are the real risks.
- List the performance items that still need measurement, since no baseline exists yet.
- Establish that lesson packs carry data only while the extension owns all behavior, so every creator shares one component implementation.
- Close the component type set to the platform and forbid custom markup, styles, or scripts in lesson packs at any price point.
- Define the downgrade path for unknown node types on older extension versions, which must never be recorded as completed or learner-skipped.
- Group student-side capabilities into local, networked, and AI tiers so the cost boundary matches the pricing boundary.
- Tie AI usage to the free-answer node type so a teacher can estimate cost, and require the student summary and teacher report to share one call.
- Keep prompt templates on the server alongside credentials, and check quota before calling the model rather than after.
- Price AI separately with prepaid credit packs, and degrade honestly when credits run out instead of faking personalized feedback.
- Identify and close the missing numbered requirement for the shipped subtitle blocker.
- Settle on teachers paying only a subscription while AI credits belong to the learner and work across every teacher, which removes credit fragmentation once a learner has several courses.
- Reduce the teacher's barrier to zero: no float, no AI cost, no unsold stock, and the AI decision becomes pedagogical rather than financial.
- Introduce a gift-card style credit account code as the lightest learner-level identity, with recovery binding left optional.
- Grant trial credits on first license-code redemption so the existing code mechanism doubles as abuse protection.
- Let teachers optionally buy course-scoped credits so they can advertise included AI feedback, since course pricing power motivates promotion far more than a top-up commission would.
- Order credit spending as trial, then course-scoped, then learner-purchased, so nobody's paid credits are consumed while free ones sit idle.
- Bar teachers from earning on learner top-ups, and keep a first-top-up referral bonus as an unused fallback tied to conversion rather than consumption.
- Call upstream models through a compatibility layer so providers can be switched or priced against each other.
- Keep the teacher-wholesale and bring-your-own-key models as evaluated alternatives, recording why wholesale was superseded and why BYOK stays outside the quality commitment.
- Plan only. Phase 1 scope, P0 requirements, and the current local-only demo are unchanged.

### Subtitle Blocker — 2026-08-11

- Add a timed horizontal bar that covers the subtitle area between 15–20 seconds on the demo video.
- Move subtitle blocker time, size, position, and style into `src/content/config/demo-lesson.js`.
- Add `tests/subtitle-blocker.test.js` for range timing and layout checks.

- Fix demo-only scope so mascot disappears when navigating away on Bilibili SPA pages.
- Match demo video by exact BV id instead of pathname substring.

### Chinese Requirements v0.3 — 2026-08-07

- Rewrite the complete sales-demo requirements in Chinese.
- Add detailed definitions for 13 P0 student, teacher, and data functions.
- Define triggers, inputs, flows, stored data, exceptions, and acceptance criteria for each function.
- Add one end-to-end acceptance script and separate product-completion and commercial-validation standards.
- Clarify that AI failures must not fabricate personalized feedback and keep teacher previews separate from student sessions.

### Product Requirements v0.2 — 2026-08-07

- Reposition the demo around upgrading an existing paid recorded course rather than improving video quality.
- Define a three-node student flow: comprehension choice, recall fill-in, and applied free answer.
- Add minimum teacher-side requirements for node editing, preview, and an evidence-based individual report.
- Replace the general side-panel-first design with a timed interaction engine and shared local session data.

### Bilibili Mascot Controls — 2026-08-07

- Restrict mascot and playback control to demo video `BV1WW4y1e7GL` only.
- Add three mascot controls: pause, seek to 30s, seek to 35s with dialog.
- Auto-show interaction dialog when playback reaches 35 seconds.
- Add `tests/demo-config.test.js` for URL gating checks.

### Bilibili Mascot Spike — 2026-08-07

- Researched open-source Bilibili playback extensions and 2D mascot overlay projects.
- Added technical spike notes in `doc/bili-mascot-spike.md`.
- Scaffolded MV3 extension under `src/` with Bilibili video play/pause control and a canvas-based 2D mascot.

### Project Scaffold — 2026-08-07

- Created independent project structure for the English video course AI assistant Chrome extension.
- Added first requirements document, design note, development plan, lessons, and current next step.
### Teacher Timeline Visual Pass — 2026-08-14

- Rebuild the teacher sales timeline as a media timeline with elapsed/total time, playback progress, a playhead, and minute ticks matched to the real 08:33 source duration.
- Align every classroom node marker to one baseline with stable icon sizing across active and inactive states.
- Remove layout-explainer copy from the sales page and simplify mobile labels to prevent crowding.
- Separate course-video selection from within-video navigation: use a video dropdown for multi-video courses and paginate long timelines in 15-minute segments.
- Keep the current 08:33 sample on one `1 / 1` segment with disabled paging controls, and remove the subtitle-snapping control from the sales example.
- Align the embedded sample player with the selected `06:19` node so the player time, timeline progress, playhead, and inspector all describe the same course state.
- Replace the selected key-node row's left accent line with a full-row soft highlight, subtle outline, and explicit `正在编辑` badge.
- Replace the four generic timeline chapter bands with eight position-aligned node summaries, staggered across two rows and color-matched to each node type.
- Reduce the node inspector's save action to a compact right-aligned primary button instead of a full-width bar.
- Synchronize the workspace design, UI color system, node component mapping, README, and current-step documentation with the approved eight-node teacher sample page.
- Replace the timeline's functional heading with the course name and rename the video selector to lesson-based labels such as `第一节`.
- Move node summaries to alternating positions above and below the timeline, with type-colored connector lines linking every summary to its marker.
- Remove the redundant vertical playhead from node 06; the active state now relies on the shared progress endpoint, filled marker, and selected summary.
- Center the compact save button and define autosave for node creation and edits, with explicit saving, saved, and failure states plus manual retry.
- Add compact timeline boundary markers: `开始 / 结束` for a single segment, with previous/next segment labels defined for paged videos.
- Rename the component-bar heading from `拖入节点` to `交互节点` while keeping drag instructions in the helper text.
- Remove the component-bar drag helper text to keep the editor header compact.
- Resynchronize the workspace design, UI rules, architecture notes, node contract, and current plan with the latest timeline boundaries, connectors, autosave, naming, and compact component-bar decisions.
- Replace the static autosave-success text with a checked-by-default `自动保存` checkbox below the save button; it controls autosave for subsequent node edits.
- Simplify the timeline header controls to only the centered segment label with previous/next paging; remove the duplicated elapsed/total time and zoom minus/plus controls.

### Teacher Sales Page Copy Boundary — 2026-08-14

- Remove Bilibili/player implementation caveats from the teacher-facing sales page.
- Keep the page focused on course design, student effects, and learning outcomes; implementation boundaries remain in internal documentation.
- Replace prototype-only wording around node editing with product-oriented classroom-design language.
### Subtitle-Grounded Teacher Nodes — 2026-08-14

- Read the supplied interview SRT and replace placeholder node content with three real teaching moments at `00:39`, `02:16`, and `05:45`.
- Align each node's title, English classroom copy, student preview, and timeline position with the subtitle meaning.
- Record the remaining source-language caveat: the supplied file is Chinese AI translation, so final English wording needs teacher review before publishing.
