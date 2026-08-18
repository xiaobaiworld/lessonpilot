# KnownMap 课程设计平台体验校正实施计划

更新时间：2026-08-18

状态：已完成

关联设计：`doc/teacher-platform-experience-polish-design.md`

## 1. 目标和可观察事实

目标：把已接入真实 API 的教师端从内部原型界面校正为可持续使用的课程设计平台。

完成后可观察到：

- 浏览器标题和顶栏使用“KnownMap 课程设计平台”；
- 登录页密码为空且可以显示或隐藏；
- 未登录页面不显示课程导航；
- 首页只保留当前课程准备和进入设计的真实任务；
- 编辑页显示真实课程名、课节、节点、保存、发布和授权；
- 页面没有“原型”“W0”“开发测试账号”“本地 API”等内部语言；
- 异步操作不会因重复点击发送重复请求。

## 2. 规范加载

本任务已读取：

- 全局入口和 `GLOBAL_DEV_WORKFLOW.md`；
- `SECURITY_CODING_STANDARD.md`；
- `TESTING_STANDARD.md`；
- 项目 `CLAUDE.md`、`doc/INDEX.md`、当前需求、决策、架构、编辑器设计和计划；
- 系统能力索引中的 Git、浏览器和本地工具入口。

暂不适用：

- 数据建模规范：本轮不改数据结构和数据流；
- FastAPI 专项规范：本轮不改后端；
- LLM 集成规范：本轮不涉及 AI 调用。

触发条件：若实现中必须修改 API、认证协议或数据 schema，再补读对应专项规范并更新本计划。

## 3. 分步执行

### P1 页面契约和安全回归测试

修改：

- `tests/teacher-api-client.test.js`
- `tests/page-information-architecture.test.js`

先写失败断言：

- 新产品名称存在，原型口吻不存在；
- 密码没有 `value`，显示/隐藏控制存在；
- 登录页导航默认隐藏；
- 工作台没有 W0、未来报告或本地 API 说明；
- 假播放器结构不存在；
- 应用脚本包含密码切换和异步按钮状态。

验证：

```bash
node --test tests/teacher-api-client.test.js tests/page-information-architecture.test.js
```

### P2 登录页和全局应用外壳

修改：

- `teacher-web/editor.html`
- `teacher-web/styles.css`
- `teacher-web/app.js`

实现：

- KnownMap 课程设计平台命名；
- 未登录顶栏简化；
- 密码显示/隐藏；
- 删除密码预填和开发说明；
- 登录中、失败和退出重置状态。

验证：

- P1 自动化测试；
- 浏览器键盘和点击切换密码；
- 错误登录后密码不进入日志。

提交边界：

`fix: make teacher login production-like`

### P3 我的课程和课程设计工作面

修改：

- `teacher-web/editor.html`
- `teacher-web/styles.css`
- `teacher-web/app.js`

实现：

- 首页改为课程信息、课程素材和主操作；
- 已有课程与新课程按钮文案同步；
- 编辑页以真实课程名和课节为主；
- 删除假播放器、未来能力说明和长期教程文案；
- 保存、发布、授权码操作增加进行中与重复提交保护。

验证：

- 页面契约测试；
- Node 全量回归；
- 后端测试确保 API 闭环未受影响。

提交边界：

`feat: refine course design platform workspace`

### P4 浏览器验收和文档收口

浏览器：

- 1440 x 1000 登录和课程设计；
- 900 x 900 中等宽度；
- 375 x 900 登录、首页和编辑页；
- 正确登录、显示或隐藏密码、继续课程、保存、发布、授权码；
- 控制台 error/warning；
- 页面级横向溢出和文字重叠。

安全：

- 搜索源码确认无测试密码；
- 检查日志不含密码；
- 不新增依赖。

文档：

- 更新 `next.md`、`doc/INDEX.md`、当前需求和 `changelog.md`；
- D-017 验证后改为已验证；
- 记录浏览器截图和验证结果。

提交边界：

`docs: verify course design platform polish`

## 4. 收口方式

本任务按 `next.md -> 测试 -> 实现 -> 浏览器验收 -> 文档同步 -> 小提交` 执行。

本轮是节点 7 的用户体验校正，不替代节点 8；完成后 `next.md` 回到插件授权码下载。

当前分支：`codex/course-design-platform-polish`

实施提交：

- `0ebc521 docs: plan course design platform polish`
- `d34d8a0 feat: polish course design platform workspace`

验证结果：

- Node 234 pass；
- 后端 37 pass；
- Bandit 无发现，`pip-audit` 无已知漏洞；
- JavaScript 语法与 `git diff --check` 通过；
- 1440、900、375 三档浏览器无页面级横向溢出、console error 或 page error；
- 独立对抗审查提出的有效问题已修复并专项复测。

合并到 `main` 前等待用户看过界面并确认。
