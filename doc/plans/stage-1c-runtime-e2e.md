# Stage 1C B 站学习运行时与端到端实施计划

目标：插件读取 1B 保存的一门课程，只在匹配 BVID 上运行四种节点，并完成真实视频端到端预览。

前置：1A、1B 门禁通过；阅读 `doc/requirements.md` 的 RUNTIME、NODE、ERR 和验收条目。

## Task 1：课程匹配和运行时生命周期

文件：

- 新增：`tests/runtime-lifecycle.test.js`
- 新增或重构：`src/content/runtime/course-runtime.js`
- 修改：`src/content/index.js` 或当前 content script 入口

测试至少覆盖：

- 当前页面 BVID 与存储课程一致才挂载；
- 非匹配视频完全不显示课程 UI、不记录会话；
- B 站 SPA 进入、离开和切换时正确挂载/卸载；
- 重复初始化不增加重复监听器；
- 播放器缺失采用有限重试并最终显示可诊断错误；
- 配置损坏或版本不兼容失败关闭。

保留现有播放器 spike 中已经验证的适配能力，但去除固定课程逻辑。

## Task 2：节点队列与播放状态机

文件：

- 新增：`tests/node-scheduler.test.js`
- 新增：`src/content/runtime/node-scheduler.js`

先测试：

- `pending -> active -> completed|skipped` 是唯一路径；
- 到点只激活一个最早节点；
- seek 跨越多个节点时按时间逐个处理；
- 完成或跳过后恢复播放并允许后续节点；
- 同一会话处理过的节点不再次触发；
- 刷新创建新会话后可以重新触发；
- 暂停/继续失败返回明确错误而不伪造状态。

调度器保持纯逻辑，播放器控制通过 adapter 注入，以便 Node 测试。

## Task 3：唯一学习窗口和四种渲染器

文件：

- 新增：`tests/learning-window.test.js`
- 新增或修改：`src/content/runtime/learning-window.js`
- 新增或修改：运行时样式

共同要求：

- 所有题型使用同一个一级窗口；同时最多一个 active 节点；
- 支持完成/提交和跳过，按钮尺寸稳定，动态文本不改变整体布局；
- 课程内容全部安全渲染；
- 关闭或卸载时移除 DOM、焦点处理和事件监听。

题型断言：

- 重点标注完整显示标题、说明和重点内容，确认后完成；
- 选择题只能提交一个选项，按配置显示确定性正确/错误反馈；
- 填空题比较时忽略首尾空格和英文大小写；
- 问答题保存原始回答，展示老师参考反馈，不产生正确/错误或 AI 文案。

## Task 4：预览会话与本地证据

文件：

- 新增：`tests/preview-session.test.js`
- 新增或修改：`src/content/runtime/preview-session.js`
- 修改：background 存储服务（如需最小会话更新操作）

测试至少覆盖：

- 会话绑定 courseId 和 courseUpdatedAt；
- 每个节点记录 pending/active/completed/skipped；
- 选择和填空只保存必要结果；问答保存原始回答；
- 换课清除旧会话；刷新新建会话；
- 日志不输出原始回答或完整题目。

第一阶段不生成老师报告，不上传证据。

## Task 5：移除固定 Demo 耦合并回归 spike 能力

1. 找出 `demo-lesson.js`、固定 BVID、固定 35 秒对话框和吉祥物控制中的运行时耦合。
2. 保留仍有诊断价值的开发工具时，确保它不在正常课程模式自动出现。
3. 让课程节点完全来自 `currentCourse`，不保留第二套固定配置事实源。
4. 回归视频定位、时间监听、暂停、seek、字幕遮挡卸载和 SPA 清理。
5. 更新 `doc/bili-mascot-spike.md` 状态，明确哪些代码已进入正式 Stage 1 运行时。

## Task 6：真实端到端验收

1. 运行 `node --test tests/*.test.js`。
2. 从公网销售页进入 workspace。
3. 输入一条真实 B 站 URL 并导入匹配字幕。
4. 创建四种节点并保存到插件。
5. 打开对应 B 站页面，逐一验证到点暂停、完成/跳过、反馈和继续。
6. 验证 seek 跨节点、刷新、切换 B 站视频、返回课程视频和播放器暂时缺失。
7. 验证另一条 B 站视频没有课程 UI。
8. 把视频、浏览器/插件版本、步骤、期望、实际结果和遗留问题记录到 `tests/manual/` Stage 1C 文件。
9. 更新 `next.md` 为“邀请第一位真实老师验证”，只把已验证变化写入 changelog。

最终门禁：不是固定演示跑通，而是工作台产生的真实配置在匹配 B 站原页面完成整个闭环。
