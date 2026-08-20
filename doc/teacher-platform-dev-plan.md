# KnownMap 教师平台本地阶段开发计划

版本：0.2

更新时间：2026-08-18

状态：实施中。节点 1–7 已实现并验证；节点 8–9 尚未开始。

## 1. 当前目标

完成本地教师发布到学生插件运行的真实闭环：

```text
教师登录并发布课程
→ 教师创建授权码
→ 学生在 B 站页面通过插件输入授权码
→ 插件下载并校验 PluginCourseConfig
→ 插件保存当前课程
→ 匹配 BVID 的页面运行四种互动节点
```

节点 1–7 的完整计划和验证历史已经归档：

- `doc/archive/2026-08-18-teacher-platform-nodes-1-7/dev-plan.md`
- `doc/archive/2026-08-18-teacher-platform-nodes-1-7/next.md`

## 2. 权威输入

- 当前需求：`doc/requirements/teacher-platform-local-stage.md`
- 产品规格：`doc/AI_Learning_Companion_Product_Function_Spec_v0.2.md`
- 学生插件设计：`doc/student-plugin-course-delivery-design.md`
- 学生插件决策：`doc/decisions/2026-08-18-student-plugin-single-course-delivery.md`
- 当前架构：`doc/teacher-platform-architecture.md`
- 当前数据规范：`doc/teacher-platform-data-spec.md`
- 当前 API：`doc/teacher-platform-api-spec.md`
- 当前执行步骤：`next.md`

解释冲突时以当前阶段需求和 D-018 为先。本计划只规定实施顺序，不能扩大需求。

## 3. 已完成基线

节点 1–7 已验证：

- FastAPI、SQLite、Alembic、结构化运行日志和持久化操作日志；
- 手工预建教师账号、Argon2 密码哈希、服务端会话和登录退出；
- 工作空间、课程、单课节和 B 站视频绑定；
- 四种节点草稿 schema、保存和读取；
- 不可变发布版本和 `PluginCourseConfig` 适配器；
- 高熵授权码、摘要存储和公开课程下载 API；
- “KnownMap 互动课程工具”教师页面、可视化时间轴、发布和授权码创建。

当前明确未完成：

- 插件授权码输入和网络下载；
- 下载响应写入前的插件侧契约校验；
- 不同课程覆盖确认和本地学习状态迁移；
- 已下载课程替换现有固定 Demo 运行配置；
- 教师发布到 B 站学生运行的完整本地人工验收。

## 4. 工程规则

每个节点按以下顺序执行：

```text
更新 next.md
→ 写失败测试或固定人工验收
→ 最小实现
→ 自动化与安全验证
→ 同步文档
→ 小提交并推送
```

约束：

- 插件、教师端和后端继续共享 `src/shared/course-contract.js` 的课程语义；
- 授权码、密码、Cookie、会话 token、字幕正文和节点正文不得进入日志；
- 下载失败或校验失败不得覆盖已有课程；
- 当前不创建学生账号、领取记录或学习数据；
- 当前只在本地联调，不新增公网 API 部署配置；
- 节点 9 通过前，不宣称完整本地闭环已完成。

## 5. 节点 8：插件授权码下载与课程运行

### 目标

让学生在 B 站原页面通过 KnownMap 解压版插件输入授权码，下载、校验并保存最新课程，然后在匹配视频页面运行课程。

实现状态（2026-08-20）：插件 `0.9.1` 已完成代码、284 项 Node 自动化测试和基本可行性确认；工具栏首页与页面书包共用单课程存储。完整真实 Chrome 边界矩阵仍按本节“人工验收”执行，未完成前不进入节点 9 收口。

### 预期文件范围

- 创建：`src/content/access-code/access-panel.js`
- 创建：`src/content/access-code/access-panel.css`
- 创建：`src/shared/api-config.js`
- 创建：`src/popup/popup.html`
- 创建：`src/popup/popup.css`
- 创建：`src/popup/popup.js`
- 修改：`src/manifest.json`
- 修改：`src/content/index.js`
- 修改：`src/background/storage.js`
- 修改：`src/background/operations.js`
- 创建：`tests/access-code-panel.test.js`
- 创建：`tests/plugin-download-flow.test.js`
- 创建：`tests/access-code-runtime-regression.test.js`
- 创建：`tests/extension-popup.test.js`
- 创建或更新：`tests/manual/teacher-platform-local/README.md`

实际实现前必须重新审计现有插件文件；文件名可以按现有模块边界调整，但不能另建第二份课程契约。

### 自动化验收

- 授权码输入会标准化，但不记录原文；
- 下载请求只提交授权码，不提交客户端指定的课程 ID；
- 成功响应先通过共享课程契约校验，再原子写入 `chrome.storage.local`；
- 网络失败、401、404、畸形 JSON 和契约失败均不覆盖当前课程；
- 相同课程的新版本可以更新；
- 不同课程必须经过明确覆盖确认；
- 保存后的课程只在匹配 BVID 页面启动；
- 刷新和 SPA 切换不产生重复监听器或残留 UI。

验证命令：

```bash
node --test \
  tests/access-code-panel.test.js \
  tests/plugin-download-flow.test.js \
  tests/course-contract.test.js \
  tests/background-operations.test.js
```

### 人工验收

1. 启动本地 FastAPI，并准备一个已发布课程和有效授权码；
2. 加载 `src/` 解压版插件；
3. 打开目标 B 站视频并输入有效授权码；
4. 确认课程保存，刷新后仍可读取；
5. 完成至少一个真实互动节点；
6. 输入无效授权码，确认已有课程不变；
7. 打开其他 BVID，确认课程不启动；
8. 检查控制台和后端日志，确认没有授权码原文和敏感内容。

提交边界：`feat: download courses from plugin access code`

## 6. 节点 9：完整本地闭环与阶段收口

### 目标

从空数据库和新加载的插件开始，验证一次完整业务路径，并同步全部权威文档。

### 自动化验收

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
cd ..
node --test tests/*.test.js
```

至少覆盖：

- 登录、课程和课节创建；
- 四种节点保存、发布和版本读取；
- 授权码创建和下载；
- 无效授权码、越权和配置错误默认拒绝；
- 下载失败不破坏插件已有课程；
- 空数据库迁移和 seed 可重复执行。

### 手动验收

```text
启动 FastAPI + SQLite
→ 启动教师页面
→ 使用 teacher-test-01 / password 登录
→ 创建并发布一门课程
→ 创建授权码
→ 在 B 站页面输入授权码
→ 下载课程并完成一次互动
```

人工证据写入 `tests/manual/teacher-platform-local/README.md`。不得记录密码、完整授权码或 Cookie。

### 阶段收口

1. 把当前需求、架构、数据和 API 状态改为“本地阶段已验证”；
2. 更新 D-015、D-018 及索引状态；
3. 清空或转写 `next.md`；
4. 更新 README 和 changelog，只陈述实际验证结果；
5. 运行完整文档链接、测试、安全和 Git 检查；
6. 创建阶段收口提交并推送；
7. 是否创建 PR/MR、合并或进入公网部署，由用户确认。

## 7. 当前阶段外

以下内容需要另立需求、决策和开发计划：

- 多课节教师操作；
- 授权码停用、领取记录和权限并集；短期 7 天与长期不过期已在教师编辑器收尾切片实现；
- 学生身份、学习事件上传和教师报表；
- 管理员后台；
- 教师 API 和编辑器公网部署；
- Chrome Web Store 发布；
- 新节点类型和 AI 教学能力。
