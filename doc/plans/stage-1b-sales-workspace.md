# Stage 1B 销售首页与真实教师工作台实施计划

目标：让老师从默认销售首页进入真实工作台，使用一条 B 站 URL 和对应字幕创建四种节点，并通过 1A 消息桥保存到插件。

前置：1A 门禁全部通过；阅读 `doc/requirements.md` 的 WEB、COURSE、NODE、ERR 条目。

## Task 1：迁移页面职责并锁定路由

文件：

- 修改：`teacher-web/index.html` 及其销售页资源
- 新增：`teacher-web/workspace.html`、`teacher-web/workspace.js`
- 修改：`teacher-web/forsales.html`
- 测试：新增或更新页面结构测试

步骤：

1. 先写测试断言默认入口包含销售主张和主要 CTA，且不包含编辑表单。
2. 先写测试断言 workspace 有课程输入、字幕导入、时间线、节点编辑、保存和预览入口。
3. 将现有销售页内容迁入 `index.html`，保持已确认销售叙事，不虚构未实现能力。
4. 让 `forsales.html` 做可访问的兼容跳转，并提供无脚本回退链接。
5. 新建真实 workspace；复用当前工作台的视觉结构，不复制旧 W0 编辑器架构。

验收：`/teacher-web/` 是销售页，`/teacher-web/workspace.html` 是编辑页，旧链接不直接 404。

## Task 2：课程 URL 与字幕导入

文件：

- 新增：`tests/workspace-input.test.js`
- 修改：`teacher-web/workspace.js`
- 复用或提取：现有 SRT/VTT 解析代码

测试至少覆盖：

- 只接受标准 B 站视频页并提取 BVID；
- 非 B 站、缺 BVID、空 URL 给出字段错误；
- SRT/VTT 成功解析为按时间排序的 `ParsedCaption`；
- 空文件、错误扩展、时间倒置和无法解析文件明确失败；
- 页面提示字幕与视频匹配需人工确认；
- 字幕全文不进入插件 payload。

实现后在目标中文 AI 翻译字幕样本上运行解析回归。

## Task 3：四种节点编辑与本地草稿

文件：

- 新增：`tests/workspace-nodes.test.js`
- 修改：`teacher-web/workspace.html`、`teacher-web/workspace.js` 和对应样式

步骤：

1. 用纯函数测试新增、修改、删除、按 triggerTime 排序和唯一 ID。
2. 分别测试重点标注、选择题、填空题、问答题的必要字段和错误展示。
3. 让字幕段落可作为节点触发时间来源，同时允许合法时间修正。
4. 使用明确的题型选择控件；只显示当前题型字段。
5. 每次有效变化写入 `lessonpilot.workspaceDraft.v1`，刷新后恢复。
6. 动态课程文本用 `textContent`/属性 API 渲染，不拼接 HTML。

验收：老师能仅凭页面完成四种节点的创建和修改，错误字段在保存前被拦截。

## Task 4：单课程覆盖和桥接状态

文件：

- 新增：`tests/workspace-save-flow.test.js`
- 修改：`teacher-web/workspace.js`

测试至少覆盖：

- 页面初始化执行 PING 并展示未安装、版本不兼容、连接成功三种状态；
- 保存前把草稿转换为严格 `PluginCourseConfig`；
- 保存成功后读取确认，只有确认成功才显示已保存；
- 超时/失败保留页面草稿，提供重试但不自动重复写入；
- 已有字幕或节点时更换 URL 必须确认；
- 取消完整保留旧 URL、字幕、节点和插件课程；
- 确认时先用 expectedCourseId 清除插件，成功后才清空网页草稿；
- 创建预览会话成功后才打开对应 B 站原页面。

## Task 5：响应式与可访问性回归

1. 启动仓库根目录静态服务：`python3 -m http.server 4173`。
2. 检查桌面目标宽度和窄屏下无文字重叠、横向不可达控件或布局跳动。
3. 检查表单 label、键盘焦点、错误关联、确认对话框和按钮状态。
4. 检查销售页 CTA 指向 workspace，销售承诺与当前功能一致。
5. 运行 `node --test tests/*.test.js`。
6. 将关键浏览器流程写入 `tests/manual/` Stage 1B 记录。
7. 更新 `next.md` 到 1C 和已验证 changelog。

阶段范围禁止：课程列表、账号、自动字幕抓取、AI 生成题目、云保存、学生报告。
