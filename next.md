# LessonPilot 当前下一步

更新时间：2026-08-15

当前阶段：1A 数据契约、消息桥与公网部署
状态：代码完成，等待真实浏览器与公网人工验证

## 本轮唯一目标

执行 `tests/manual/stage-1a-bridge/README.md` 的 V1–V7，填写实际结果。全部通过后 1A 才能标记完成并推进到 1B。

代码部分已完成：共享课程契约、版本化消息协议、来源白名单、插件后台存储、白名单消息桥和 1A 诊断页，135 个自动化测试全部通过。不要继续向 1A 增加功能。

## 待执行

- [ ] V1 全量自动化测试基线
- [ ] V2 Chrome 加载 `src/` 无 manifest 或 service worker 错误
- [ ] V3 本地 `http://localhost:4173/teacher-web/workspace.html` 完成五个操作往返
- [ ] V4 `expectedCourseId` 不匹配时课程保持不变
- [ ] V5 非白名单探针页无任何响应，且存储未被修改
- [ ] V6 扩展与页面重载后无重复响应
- [ ] V7 合并到 `main` 后 `pages.yml` 首次发布，验证公网路径与发布集

准备命令：

```bash
node tools/assemble-workspace.js
python3 -m http.server 4173
node --test tests/*.test.js
```

## V7 的前置条件

Pages 已启用（`build_type: workflow`），但 `workflow_dispatch` 要求工作流存在于默认分支，因此公网验证必须在 `stage-1a-contract-bridge-deploy` 合并到 `main` 之后执行。合并需用户确认。

若公网不可访问：按 D-007 重开条件记录证据，不得默默更换 origin 或加入模糊来源。

## 完成定义

`doc/requirements/stage-1a.md` 第 8 节十二条。当前第 1、10、11、12 条依赖上述人工验证，其余已由自动化测试覆盖。

## 后续顺序

1. 1B：`doc/plans/stage-1b-sales-workspace.md`，含新增 Task 3b 字幕上下文列与弹出式节点属性表单（COURSE-06、COURSE-07）
2. 1C：`doc/plans/stage-1c-runtime-e2e.md`
3. 第一位真实老师验证

旧 D0/D1 清单位于 `doc/archive/2026-08-15-pre-stage-one/next.md`，仅用于追溯，不是当前任务。
