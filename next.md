# KnownMap 当前下一步

更新时间：2026-08-20

当前阶段：教师平台公网发布与插件授权下载闭环

当前版本：插件 `0.9.1`

当前状态：节点 1–7 已实现并验证；节点 8 已完成代码、自动化测试和用户基本可行性确认，
完整真实 Chrome 边界验收待收口；节点 9 尚未开始。

2026-08-20 教师平台已发布到阿里云 ECS：生产工作台、FastAPI、SQLite、systemd 和
Nginx 同源反代均已验证。当前 release ID 为 `20260820T162253Z-220dffbd4cfd`，对应
GitHub SHA `220dffbd4cfd5a0b3f34ffebed147289cf7aa617`。生产 API 已完成登录、创建课程
和课节、保存四节点草稿、发布 `v1`、创建短期授权码和公开下载的完整探针；生产安全审计、
登录限速、锁定依赖、systemd 沙箱和每日 SQLite 备份也已部署并验证。`/admin.html`
集中提供销售首页、教师工作台和服务状态入口，并保持无账号、服务器信息或管理操作。

2026-08-20 教师编辑器收尾切片已完成：时间线按真实 `08:33` 显示，右下快捷操作可用，
授权码支持短期/长期分类、历史记录和到期校验。该切片不改变节点 8 的唯一下一目标。

## 下一步唯一目标

完成 `tests/manual/teacher-platform-local/README.md` 的节点 8 边界验收，然后执行节点 9 的公网完整闭环：

> 让学生在 B 站原页面通过 KnownMap 解压版 Chrome 插件输入授权码，下载、校验并保存最新课程配置，然后只在匹配的 BVID 页面运行课程。

`0.9.1` 已实现工具栏学生入口、页面书包、单课程保存、匹配 BVID 运行，以及空消息、非对象、runtime rejection 和 10 秒超时的可恢复错误。用户已确认当前核心功能基本可行；无效码、不同课程、跨 BVID、SPA 和日志仍需逐项留证。

产品设计入口：`doc/student-plugin-course-delivery-design.md`

决策入口：`doc/decisions/2026-08-18-student-plugin-single-course-delivery.md`

总计划入口：`doc/teacher-platform-dev-plan.md`

已完成执行记录：`doc/archive/2026-08-18-teacher-platform-nodes-1-7/next.md`

## 节点 8 当前执行切片

### 已确认边界

- 沿用已验证的本地 API：`POST /api/v1/public/course-download`，请求仅含
  `access_code`，成功响应为 `{ "course": PluginCourseConfig }`；本节点不凭设计草案
  臆造尚未实现的 content hash envelope。
- 插件后台把 HTTP 响应视为不可信输入，写入前再次使用
  `src/shared/course-contract.js` 校验；失败默认拒绝且不覆盖旧数据。
- 学生安装课程使用独立的 `installedCourse` / `learningState` 键，不复用教师工作台
  预览使用的 `currentCourse` / `activePreviewSession`。
- 不同课程只在学生明确确认后替换；确认和第二次下载之间仍以当前课程 ID 做并发保护。
- B 站运行时从 `installedCourse` 读取课程，只在当前 pathname 的 BVID 与
  `course.videoRef.videoId` 完全相等时挂载；SPA 离开时销毁旧 UI 和监听器。
- 本节点做四种现有节点的最小线性运行适配；不扩展字幕书包、学习报表、学生账号、
  多课程或公网部署。
- 授权码领取成功后，书包的“课程”区域新增一条当前课程记录；记录显示经过校验的完整
  B 站课程 URL，并保留“打开课程视频”操作。未领取课程时只显示空状态，不生成空记录。

### 测试先行

1. `tests/access-code-panel.test.js`：授权码标准化、请求不携带课程 ID、错误文案、
   覆盖确认取消路径、标准 B 站 URL，以及成功领取后单条课程记录的可见渲染。
2. `tests/plugin-download-flow.test.js`：网络错误、401/404、畸形 JSON、课程契约失败、
   同课程更新、不同课程确认、单次原子写入、旧课程和学习状态不被失败路径破坏。
3. `tests/course-runtime.test.js`：BVID 精确匹配、时间跨越触发、SPA 进入/离开销毁、
   重复初始化保护。
4. `tests/manual/teacher-platform-local/README.md`：真实 Chrome 加载、有效/无效授权码、
   刷新持久化、其它 BVID 静默、至少一个真实互动节点、控制台和后端日志脱敏。

### 日志与安全证据

- 自动化：Node 测试输出；后端 pytest 输出。
- 人工：Chrome 扩展 service worker 控制台、B 站页面控制台、FastAPI 结构化日志。
- 预期日志只包含操作名、课程 ID、节点数、结果和错误码；不得出现授权码原文、节点正文、
  字幕正文、Cookie 或学生答案。
- 若实际日志不足以定位失败，只补充固定字段的脱敏诊断日志，不打印请求体或响应正文。

### 2026-08-19 当前验证证据

- `node --test tests/*.test.js`：276 pass / 0 fail。
- `cd backend && uv run pytest --cov=app --cov-report=term-missing`：37 pass，总代码覆盖率 87%。
- JS 语法、`git diff --check` 和敏感原文扫描通过；扫描仅命中公开授权码占位符。
- 真实 Chrome 已确认新书包入口注入、教师端创建四种节点、发布 v1 并创建授权码；课程下载
  仍由浏览器中未重载的旧 service worker 持有，未产生下载 API 请求。必须在
  `chrome://extensions` 手工重新加载 KnownMap 后，从有效授权码下载步骤继续；本记录不把该
  环境阻塞写成功能验收通过。

### 2026-08-20 教师编辑器补充验证

- `node --test tests/*.test.js`：280 pass / 0 fail。
- `cd backend && uv run pytest --cov=app --cov-report=term-missing`：40 pass，总代码覆盖率 87%。
- 本机数据库从未标记的既有 0006 结构安全标记并升级至 `0007_access_code_types`；原课程和授权码记录保留。
- 内置浏览器确认无字幕时间线为 `08:33`，轴线右端与结束标记中心像素一致；清理 1 条旧临时密钥下无法验证的测试记录后，授权码历史最终为总计 2、短期 1、长期 1，分类点击明细正确。
- 通过教师界面创建的短期码调用公开下载端点返回 200；“完成”先保存草稿，再返回“我的课程”。
- 本切片浏览器验收通过，但节点 8 仍需在真实 Chrome 重载解压版扩展后完成学生端领取与 B 站运行验收。

### 2026-08-20 插件 `0.9.1` 验证

- 真实 Chrome 复现旧 service worker 返回空值，页面脚本读取 `result.error` 抛错并永久 loading；现已统一校验消息响应并提供 10 秒超时恢复。
- 新增工具栏课程首页，展示学生授权码、唯一当前课程、完整 B 站链接和教师登录入口；不伪造学生账号能力。
- `node --test tests/*.test.js`：284 pass / 0 fail；后端 40 pass，覆盖率 87%；380×560 弹窗视觉检查通过。
- 用户确认“当前功能基本可行”。该确认不替代无效码、覆盖取消、其它 BVID、SPA 和日志的完整边界验收。

## 开始前检查

- [x] 读取全局规范、`doc/INDEX.md`、当前需求、D-018 和学生插件设计；
- [x] 核对 `src/shared/course-contract.js`、`src/background/storage.js`、`src/background/operations.js` 和现有 B 站运行时；
- [x] 确认本地 FastAPI `/api/v1/public/course-download` 可用；
- [x] 先写节点 8 的失败测试和真实 Chrome 人工验收步骤；
- [x] 不改教师端节点 1–7 已验证的 API 与页面行为，除非失败测试证明存在必要依赖。

## 节点 8 完成门禁

- [x] 插件提供授权码输入入口，授权码不进入日志或长期明文存储；
- [x] 插件调用下载 API，并在写入前使用共享课程契约校验响应；
- [x] 自动化确认无效响应、网络失败和配置错误不覆盖已有课程；
- [x] 自动化确认新授权码对应其他课程时先确认覆盖，取消后保留原课程和本地学习状态；
- [x] 自动化确认下载后的课程只在匹配 BVID 页面启动；
- [x] 自动化确认刷新和 B 站 SPA 切换后不重复初始化或残留旧课程 UI；
- [x] 工具栏首页显示学生授权码、当前课程和教师登录入口；
- [ ] 自动化测试与真实 Chrome 人工验收通过；
- [x] README、需求、架构、数据、API、计划、索引和 changelog 已同步到 `0.9.1` 状态。

## 后续节点 9

节点 8 完成后，再执行本地完整闭环验收：

```text
教师登录
→ 创建课程和课节
→ 编辑四种节点
→ 保存草稿并发布
→ 创建授权码
→ 插件下载课程
→ B 站页面完成一次互动
```

节点 9 通过前，不得把“教师发布到学生运行的完整本地闭环”写成已完成。
