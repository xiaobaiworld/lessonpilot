# KnownMap 教师可视化节点编辑器实施计划

版本：0.1

更新时间：2026-08-18

状态：已完成

## 1. 阶段目标

把节点 7 已接入真实 API 的教师编辑器，改造成由组件注册表驱动的横向时间轴编辑器。
老师可以点击组件后点击时间轴，也可以拖放组件到时间轴；两种入口完成相同的节点创建流程。

设计权威：`doc/teacher-visual-node-editor-design.md`

## 2. 规范加载范围

本任务已读取并适用：

- `GLOBAL_DEV_WORKFLOW.md`
- `PYTHON_FASTAPI_DEV_STANDARD.md`
- `DATA_MODELING_AND_FLOW_STANDARD.md`
- `OBSERVABILITY_STANDARD.md`
- `TESTING_STANDARD.md`
- `SECURITY_CODING_STANDARD.md`
- `ERROR_HANDLING_AND_LESSONS_STANDARD.md`

本任务不新增 FastAPI 端点、数据库表和外部依赖，但会继续遵守已有 API、日志、输入校验和
授权边界。`AI_LLM_INTEGRATION_STANDARD.md` 暂不适用，因为本阶段不调用 AI；如加入节点自动
生成或模型评价，必须先重开需求和计划。

工具能力检查已完成：当前机器有 Node、Python/uv、GitHub CLI 和浏览器自动化能力。实现阶段
复用现有静态页面、Node test 和浏览器验证，不引入前端框架或拖放依赖。

## 3. Git 和收口策略

- 仓库：`git@github-2:xiaobaiworld/lessonpilot.git`
- 当前分支：`codex/student-plugin-discovery`
- 目标基线：`main`
- 文档先形成独立小提交，再开始产品代码。
- 后续每个任务按 `next.md -> 失败测试 -> 最小实现 -> 验证 -> 文档同步 -> 小提交` 推进。
- 本改造属于节点 7 修正；完成后再继续节点 8。
- 节点 7 修正完成是当前大阶段内的小里程碑，不单独合并主分支。
- 节点 8、9 完成后，按总计划创建 PR/MR、执行完整文档审计，并等待用户确认后合并。

## 4. 文件结构

### 新建

- `teacher-web/node-plugin-registry.js`
- `teacher-web/timeline-model.js`
- `teacher-web/visual-node-editor.js`
- `teacher-web/editor-logger.js`
- `tests/node-plugin-registry.test.js`
- `tests/timeline-model.test.js`
- `tests/visual-node-editor.test.js`
- `tests/editor-logger.test.js`
- `tests/manual/teacher-visual-node-editor/README.md`

### 修改

- `teacher-web/editor.html`
- `teacher-web/app.js`
- `teacher-web/styles.css`
- `tests/teacher-api-client.test.js`
- `doc/requirements/teacher-platform-local-stage.md`
- `doc/teacher-platform-architecture.md`
- `doc/teacher-platform-data-spec.md`
- `doc/teacher-platform-dev-plan.md`
- `doc/DECISIONS.md`
- `doc/INDEX.md`
- `next.md`
- `changelog.md`（仅最终验证通过后）

## 5. 任务拆分

### 任务 V7.0：文档和决策先行

目标：把用户确认的双入口添加、模块边界、数据流、日志和验收标准写成当前权威文档。

验证：

```bash
rg -n "点击|拖放|组件注册|时间轴|D-016" \
  doc/requirements/teacher-platform-local-stage.md \
  doc/teacher-visual-node-editor-design.md \
  doc/plans/teacher-visual-node-editor.md \
  doc/DECISIONS.md
git diff --check
```

提交：

```text
docs: plan visual node editor correction
```

### 任务 V7.1：建立节点组件注册表

先写失败测试：

- 注册表只有四个当前组件；
- 每个组件具备 ID、显示信息、默认值和字段定义；
- 点击入口和拖放入口调用同一个 `createNode(pluginId, placement)`；
- 四种节点输出符合现有后端字段组合；
- 未知组件、非法时间和缺失字幕引用被拒绝；
- 类型转换不会保留旧类型无效字段。

实现：

- 使用 UMD 形式，同时支持浏览器全局对象和 Node `require`；
- 注册表为冻结对象；
- ID 生成器由调用方注入，测试不依赖当前时间；
- 文案使用默认值，但不记录到日志。

验证：

```bash
node --test tests/node-plugin-registry.test.js
node --check teacher-web/node-plugin-registry.js
```

提交：

```text
feat: register teacher timeline node plugins
```

### 任务 V7.2：建立纯时间轴模型

先写失败测试：

- 从字幕计算有效课节时长；
- 客户端坐标换算成范围内秒数；
- 秒数换算成百分比；
- 找到最近字幕并生成合法 `captionId`；
- 多节点按时间和 ID 排序；
- 临近节点分配不同摘要轨道；
- 移动节点更新 `timeSeconds` 和 `captionId`，不修改其他字段。

实现：

- 所有函数为纯函数；
- 坐标换算接收显式 `left`、`width` 和 `clientX`；
- 时间保留到 0.1 秒；
- 不在模型层访问 DOM 或 API。

验证：

```bash
node --test tests/timeline-model.test.js
node --check teacher-web/timeline-model.js
```

提交：

```text
feat: add visual timeline placement model
```

### 任务 V7.3：建立编辑器页面骨架

先修改页面结构测试，使其要求：

- 节点组件栏；
- 横向时间轴轨道；
- marker 容器；
- 字幕上下文栏；
- 节点编辑 dialog；
- 四个新模块脚本；
- 不再存在旧 `caption-list` 和右侧 `event-options` 主编辑结构。

实现：

- 保留登录、课程准备、保存、发布和授权码区域；
- 将时间线主区域替换为销售页参照的编辑结构；
- 图标优先复用页面现有符号和 CSS，不引入新依赖；
- 小屏时间轴局部横向滚动。

验证：

```bash
node --test tests/teacher-api-client.test.js
```

提交：

```text
feat: add visual node editor workspace shell
```

### 任务 V7.4：实现点击放置

先写失败测试：

- 点击组件进入 armed 状态；
- 点击时间轴计算时间并调用统一创建动作；
- 新节点弹窗保存后才进入 `nodes`；
- 取消新建不改变 `nodes`；
- Escape 退出 armed 状态；
- 添加后草稿状态变为未保存。

实现：

- `visual-node-editor.js` 只管理编辑器交互；
- 通过 `onChange(nodes, metadata)` 通知 `app.js`；
- 创建来源写为 `click`，只用于诊断日志，不进入后端 schema。

验证：

```bash
node --test tests/visual-node-editor.test.js
```

提交：

```text
feat: add click placement for lesson nodes
```

### 任务 V7.5：实现拖放创建和节点移动

先写失败测试：

- 组件 dragstart 携带已知组件 ID；
- drop 调用与点击入口相同的创建动作；
- 未知拖放数据默认拒绝；
- marker 拖动更新节点时间和字幕关联；
- 轻微指针移动仍视为选择，不误改时间；
- 移动后节点重新排序。

实现：

- 原生 HTML Drag and Drop 用于组件创建；
- Pointer Events 用于 marker 移动；
- drop 和 click 都调用 `createAtClientX(pluginId, clientX, source)`；
- 拖动期间只显示时间预览，pointerup 后提交一次状态变化。

验证：

```bash
node --test tests/visual-node-editor.test.js tests/timeline-model.test.js
```

提交：

```text
feat: add drag placement and node timing
```

### 任务 V7.6：实现类型化弹窗、删除和字幕同步

先写失败测试：

- 四种组件渲染各自字段；
- 编辑保存保留节点 ID；
- 改类型后输出目标类型合法结构；
- 删除只删除当前节点；
- 有未保存字段时取消触发确认；
- 选中节点更新字幕上下文；
- 同时刻多个节点仍可分别选择。

实现：

- 表单字段由注册表定义，不在控制器写四份重复分支；
- 动态文本统一使用 `textContent`；
- 删除要求一次明确确认；
- 关闭弹窗恢复焦点。

验证：

```bash
node --test tests/node-plugin-registry.test.js tests/visual-node-editor.test.js
```

提交：

```text
feat: edit visual lesson nodes in dialog
```

### 任务 V7.7：接回课程草稿、发布和授权码

先写失败测试：

- 后端草稿可直接载入编辑器；
- 编辑器变化同步回 `app.js` 的 canonical nodes；
- 保存发送排序后的节点；
- 保存成功用后端返回节点替换编辑器状态；
- 保存失败保留 dirty 状态；
- 发布仍先保存再调用 publish；
- 字幕重新导入后重新计算时长和节点位置。

实现：

- 删除 `app.js` 中旧字幕行编辑、事件选择和节点表单逻辑；
- `app.js` 保留 API 编排和课程状态；
- 不修改 FastAPI endpoint 和请求 schema；
- 同一字幕允许多个节点，不再按 `captionId` 覆盖。

验证：

```bash
node --test tests/teacher-api-client.test.js tests/visual-node-editor.test.js
cd backend && uv run pytest -q
```

提交：

```text
feat: connect visual node editor to lesson drafts
```

### 任务 V7.8：日志、可访问性和响应式收口

先写失败测试：

- localhost 默认 `debug`，正常 origin 默认 `info`；
- logger 丢弃正文和凭证字段；
- 组件和 marker 有键盘入口；
- 页面具有明确 aria label；
- 小屏保留时间轴滚动容器。

实现：

- 增加 `editor-logger.js`；
- 记录结构化事件，不记录字幕和节点正文；
- 开发时输出 debug，正常运行过滤 debug；
- 完善 focus、Escape、Enter、Space、Delete 和 reduced-motion。

验证：

```bash
node --test tests/editor-logger.test.js tests/visual-node-editor.test.js
node --test tests/*.test.js
```

提交：

```text
feat: harden visual editor diagnostics and access
```

### 任务 V7.9：浏览器和完整回归

自动化：

```bash
cd backend
uv run pytest --cov=app --cov-report=term-missing
python -m compileall app
cd ..
node --test tests/*.test.js
node --check teacher-web/app.js
node --check teacher-web/visual-node-editor.js
git diff --check
```

浏览器手动验证：

1. 登录预建教师账号；
2. 打开已有课程和课节；
3. 点击“重点标注”，再点击时间轴，编辑并保存；
4. 拖放“选择题”到时间轴，编辑并保存；
5. 再创建填空题和问答题；
6. 拖动一个已有 marker 修改时间；
7. 在同一字幕附近放置两个节点，确认可以分别操作；
8. 删除一个节点；
9. 保存草稿并刷新，确认类型、时间、内容和数量恢复；
10. 发布课程并创建授权码；
11. 使用键盘选择组件、编辑和删除节点；
12. 检查桌面和 375px 视口；
13. 检查浏览器控制台和后端日志，确认无正文、凭证和授权码原文。

证据写入：

```text
tests/manual/teacher-visual-node-editor/README.md
```

### 任务 V7.10：文档同步和阶段状态修正

更新：

- 设计文档状态；
- 总计划节点 7 状态；
- `next.md` 转入节点 8；
- 架构和数据文档与实际模块一致；
- `doc/INDEX.md` 状态；
- `changelog.md` 只记录已验证能力；
- 若出现可复用错误，写入 `docs/LESSONS/` 或当前项目等价入口。

对抗审查：

- 检查是否仍存在第二套节点格式；
- 检查点击和拖放是否真正共用创建动作；
- 检查静态销售页数据是否误进入正式编辑器；
- 检查多节点、边界时间、空字幕、保存失败和刷新恢复；
- 检查日志脱敏、动态文本渲染和既有鉴权；
- 检查是否引入当前需求之外的自动保存、AI 或多课节。

提交：

```text
docs: verify visual node editor correction
```

## 6. 完成门禁

- 文档先于产品代码提交；
- 每个新增纯函数先有失败测试；
- 点击和拖放两种入口均有自动化和浏览器证据；
- 四种节点均完成创建、编辑、移动、删除、保存和恢复；
- 后端全量测试与 Node 全量测试通过；
- 桌面与 375px 小屏无关键重叠；
- 日志级别和脱敏通过验证；
- `changelog.md` 不记录未验证能力；
- 节点 7 修正完成后才能继续节点 8。
