# Stage 1B 销售首页与真实教师工作台实施计划

目标：让老师从默认销售首页进入真实工作台，使用一条 B 站 URL 和对应字幕创建四种节点，并通过 1A 消息桥保存到插件。

前置：1A 门禁全部通过；阅读 `doc/requirements.md` 总览和 `doc/requirements/stage-1b.md` 全文。

## Task 1：迁移页面职责并锁定路由

文件：

- 修改：`teacher-web/index.html` 及其销售页资源
- 修改：`teacher-web/workspace.html`，把 1A 诊断页扩展为真实工作台
- 新增：`teacher-web/workspace.js`
- 复用：`teacher-web/workspace-bridge-client.js`
- 修改：`teacher-web/forsales.html`
- 测试：新增或更新页面结构测试

步骤：

1. 先写测试断言默认入口包含销售主张和主要 CTA，且不包含编辑表单。
2. 先写测试断言 workspace 有课程输入、字幕导入、时间线、节点编辑、保存和预览入口。
3. 将现有销售页内容迁入 `index.html`，保持已确认销售叙事，不虚构未实现能力。
4. 让 `forsales.html` 做可访问的兼容跳转，并提供无脚本回退链接。
5. 将 1A 诊断 workspace 扩展为真实工作台；保留桥接客户端，复用当前工作台的视觉结构，不复制旧 W0 编辑器架构。

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

## Task 3b：字幕上下文列与弹出式节点属性表单

对应需求 COURSE-06、COURSE-07。时间线右侧从「常驻节点属性表单」改为「以选中节点为中心的字幕上下文列」，属性表单改为右键或双击节点弹出。

文件：

- 新增：`tests/subtitle-context.test.js`
- 新增：`teacher-web/subtitle-context.js`（纯选段函数，可在 Node 独立测试）
- 修改：`teacher-web/workspace.html`、`teacher-web/index.html`（销售页演示同步）、对应样式

选段函数先写测试，至少覆盖：

1. 时间落在某条字幕 `startSeconds`–`endSeconds` 内时，该条为中心；
2. 没有命中时取与 `startSeconds` 差值最小的一条；差值相等时取更早的一条（结果需确定，不依赖数组顺序偶然性）；
3. 中心句上方固定 2 条，不因补行而增加；
4. 默认 5 条已满 7 行时不额外补；
5. 短句只占 1 行导致不足 7 行时，只向后补足；
6. 后方字幕耗尽仍不足 7 行时返回现有条数，不向前扩展、不补空行；
7. 中心句是第一条时上方 0 条，是最后一条时下方 0 条，均不报错；
8. 字幕总数少于 5 条时全部返回；
9. 空字幕数组返回空结果，由页面显示空状态。

行数计算需与渲染一致：每条默认最多 2 行、超出缩写截断，因此选段函数需要知道每条实际占几行。行数由字符数与栏宽估算，估算规则与 CSS 的 `-webkit-line-clamp: 2` 必须对应；若两者无法可靠对齐，改为按渲染后实测高度补足，并在测试中固定估算函数的输入输出，不让"7 行"变成无法验证的口头约束。

属性表单：

1. `contextmenu` 与 `dblclick` 均打开当前节点表单，`contextmenu` 需 `preventDefault()` 抑制浏览器菜单；
2. 提供键盘可达的等价入口（节点可聚焦，`Enter` 或专用按钮打开），右键和双击不作为唯一操作方式；
3. 表单打开时不遮挡该节点的字幕上下文列，或提供同时可见的替代布局；
4. 关闭前有未保存修改时需确认，不静默丢弃。

验收：选中 6 分钟处的节点时，右侧列以该时间命中的字幕为中心，上方 2 条、下方补足至不少于 7 行，中心句底色明显区别于上下文；右键和双击节点均能打开属性表单，键盘入口等效可用。

命令：`node --test tests/subtitle-context.test.js`

## Task 4：单课程覆盖和桥接状态

文件：

- 新增：`tests/workspace-save-flow.test.js`
- 修改：`teacher-web/workspace.js`

测试至少覆盖：

- 页面初始化执行 PING 并展示未安装、版本不兼容、连接成功三种状态；
- 保存前把草稿转换为严格 `PluginCourseConfig`；
- 转换结果不包含 `captions`、`sourceUrl` 或工作台 UI 状态；
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
