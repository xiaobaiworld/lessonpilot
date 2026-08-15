# LessonPilot 当前下一步

更新时间：2026-08-15

当前阶段：1A 数据契约、消息桥与公网部署
状态：等待实施 Agent 开始

## 本轮唯一目标

完成 `doc/plans/stage-1a-contract-bridge-deploy.md`，使公网教师工作台路径与本机已解压 Chrome 插件之间具备安全、可测试的课程配置通道。

不要先做工作台 UI 或学生运行时。没有稳定契约和真实消息桥，后续页面和插件会各自形成不兼容的数据结构。

## 开始前

- [ ] 阅读 `doc/INDEX.md`
- [ ] 阅读 `doc/requirements.md`
- [ ] 阅读 `doc/data-spec.md`
- [ ] 阅读 `doc/DECISIONS.md` 的 D-004、D-006、D-007
- [ ] 阅读并执行全局开发规范及数据、安全、测试、错误处理专项规范
- [ ] 检查工作区已有修改，不覆盖 `.gitignore` 或其他用户改动
- [ ] 运行 `node --test tests/*.test.js`，记录基线

## 本轮交付

- [ ] 验证或启用 GitHub Pages，记录实际 origin 和 workspace 路径
- [ ] 建立共享课程契约和严格校验
- [ ] 建立版本化 bridge request/response 协议
- [ ] 实现白名单工作台 content script 到 background 的消息转发
- [ ] 实现当前课程的读取、保存、清除和预览会话操作
- [ ] 覆盖来源、路径、版本、requestId、operation、payload 和存储保护测试
- [ ] 在真实 Chrome 已解压插件与公网/本地工作台路径完成一次往返验证
- [ ] 更新验证记录、`changelog.md` 和本文件，将当前阶段推进到 1B

## 完成定义

只有详细计划的所有自动化测试通过，并且真实浏览器消息往返成功，1A 才能标记完成。若 GitHub Pages 不可用，不得默默换域名；按 D-007 的重开条件记录证据并更新决策。

## 后续顺序

1. 1B：`doc/plans/stage-1b-sales-workspace.md`
2. 1C：`doc/plans/stage-1c-runtime-e2e.md`
3. 第一位真实老师验证

旧 D0/D1 清单位于 `doc/archive/2026-08-15-pre-stage-one/next.md`，仅用于追溯，不是当前任务。
