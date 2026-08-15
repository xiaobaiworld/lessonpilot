# Stage 1A 数据契约、消息桥与部署实施计划

目标：建立后续页面和运行时共同依赖的唯一数据契约，并在真实公网工作台路径与本机 Chrome 插件之间完成安全消息往返。

前置阅读：`doc/requirements.md` 的 COURSE、BRIDGE、ERR、SEC 条目，`doc/data-spec.md` 全文，`doc/DECISIONS.md` 的 D-004、D-006、D-007。

## Task 1：记录基线并验证部署目标

文件：

- 检查：`.github/workflows/`、仓库 Pages 配置、`teacher-web/`
- 修改：仅在需要时新增 Pages 工作流或静态部署配置
- 记录：`doc/DECISIONS.md`、`changelog.md`（阶段完成时）

步骤：

1. 运行 `node --test tests/*.test.js`，保存基线结果。
2. 检查仓库默认分支和 GitHub Pages 当前状态。
3. 选择最小静态发布方式，使仓库根目录资源路径可用。
4. 验证 `https://xiaobaiworld.github.io/lessonpilot/teacher-web/workspace.html` 可访问。
5. 若 Pages 不可用，按 D-007 重开条件记录事实，再选择替代 origin；不要在代码中同时保留模糊通配来源。

验收：实际公网 URL 返回页面资源，最终 origin 和 path 被写入插件白名单测试用例。

## Task 2：先用测试锁定课程数据契约

文件：

- 新增：`tests/course-contract.test.js`
- 新增：`src/shared/course-contract.js`

测试至少覆盖：

- 合法 `PluginCourseConfig` 深度克隆后通过；
- 未知 `schemaVersion`、未知 node type、重复 node ID、非有限时间、节点乱序均拒绝；
- 选择题少于两个选项或没有唯一正确答案时拒绝；
- 填空题无答案、问答题无参考反馈、重点标注无内容时拒绝；
- URL、BVID 和节点字段有空白或错误格式时拒绝；
- 转换函数从 `WorkspaceDraft` 只提取运行所需字段，不带 `captions`、`sourceUrl` 或额外字段。

实现要求：

- 使用当前项目可被 Node 测试和浏览器脚本共同加载的零依赖模块形式；
- 提供显式构造/规范化/校验函数，不静默修复语义错误；
- 错误包含稳定错误码和可定位字段，不包含完整课程正文。

命令：`node --test tests/course-contract.test.js`

## Task 3：先用测试锁定消息协议

文件：

- 新增：`tests/bridge-protocol.test.js`
- 新增：`src/shared/bridge-protocol.js`

测试至少覆盖：

- `PING`、`GET_CURRENT_COURSE`、`SAVE_CURRENT_COURSE`、`CLEAR_CURRENT_COURSE`、`START_PREVIEW_SESSION` 的合法请求；
- requestId 格式、channel、protocolVersion、operation 和 payload 白名单；
- 未知字段和未知操作默认拒绝；
- response 的 success/data/error 互斥；
- 写操作超时不自动重试；
- requestId 能把响应只交给对应请求。

实现要求：严格按照 `doc/data-spec.md`，协议常量只有一处定义。

命令：`node --test tests/bridge-protocol.test.js`

## Task 4：实现并测试后台存储服务

文件：

- 新增：`tests/background-storage.test.js`
- 新增或修改：`src/background/service-worker.js`
- 修改：`src/manifest.json`

步骤：

1. 用可替换的 storage adapter 测试操作处理器，不在单元测试中依赖真实 Chrome。
2. 测试保存后读取深度相等，且输入对象后续修改不污染存储值。
3. 测试 `CLEAR_CURRENT_COURSE.expectedCourseId` 不匹配时返回 `COURSE_MISMATCH`，不删除现有课程。
4. 测试创建预览会话会替换旧会话，并绑定 courseId/courseUpdatedAt。
5. 测试每次读取也重新校验存量数据；损坏数据返回明确错误。
6. 接入 `chrome.storage.local` 的 `currentCourse` 和 `activePreviewSession` 键。

命令：`node --test tests/background-storage.test.js`

## Task 5：实现白名单工作台消息桥

文件：

- 新增：`tests/workspace-bridge.test.js`
- 新增：`src/content/workspace-bridge.js`
- 修改：`src/background/service-worker.js`
- 修改：`src/manifest.json`

测试至少覆盖：

- 只接受 `event.source === window`；
- 只接受精确允许的 origin 和 `/lessonpilot/teacher-web/workspace.html`（本地开发路径另列）；
- 非工作台页面、子路径欺骗、协议或 schema 错误不转发；
- 后台再次校验全部请求，不信任 content script；
- 每个请求只产生一次响应，监听器重复初始化不会重复转发；
- 超时、插件异常和版本不兼容返回规定错误码；
- 日志不包含字幕、题目正文或回答。

实现顺序：页面 `window.postMessage` -> workspace content script -> `chrome.runtime.sendMessage` -> background -> 原路响应。

命令：`node --test tests/workspace-bridge.test.js`

## Task 6：真实浏览器验证和收口

1. 运行 `node --test tests/*.test.js`。
2. 在 Chrome 开发者模式加载 `src/`。
3. 分别从 localhost 和最终公网 workspace 路径执行 PING、保存、读取、清除、创建预览会话。
4. 从非白名单页面伪造同结构消息，确认没有成功响应或存储变化。
5. 重载扩展和页面，确认不会重复监听。
6. 将人工验证步骤和结果写入 `tests/manual/` 下的 Stage 1A 记录。
7. 更新 `next.md` 到 1B；只有已验证变化才写入 `changelog.md`。

阶段提交建议：契约测试与实现、存储服务、消息桥与部署验证分别形成小提交；不要夹带页面 UI 或学生运行时。
