# KnownMap 当前下一步

## 临时插入：品牌与 Logo 统一

目标：按 D-014 和 `docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md` 生成正式 Logo 资源，把用户可见品牌和当前权威文档统一为 `KnownMap` / `knownmap.com`。

涉及文件：`src/assets/`、`src/manifest.json`、`teacher-web/` 用户可见页面、当前权威文档、品牌与页面测试。

验证：`node --test tests/*.test.js`；检查 16/24/48/128 PNG 尺寸；桌面与 375px 浏览器视觉检查；`rg` 审计残留旧品牌。

兼容边界：不改 `lessonpilot.*` 协议 channel、存储键、JavaScript 全局名、GitHub Pages 路径和历史归档。

下方 1A 人工验证任务保持不变，品牌统一完成后继续执行。

更新时间：2026-08-18

当前阶段：1A 数据契约、消息桥与公网部署
状态：代码已合并到 `main`，公网路径已验证，等待真实 Chrome 人工验证

## 本轮唯一目标

执行 `tests/manual/stage-1a-bridge/README.md` 的 V2–V6，以及 V7 中依赖真实 Chrome 的往返项，填写实际结果。全部通过后 1A 才能标记完成并推进到 1B。

PR：[#1](https://github.com/xiaobaiworld/lessonpilot/pull/1)，已于 2026-08-15 合并到 `main`。

代码部分已完成：共享课程契约、版本化消息协议、来源白名单、插件后台存储、白名单消息桥和 1A 诊断页，200 个自动化测试全部通过。不要继续向 1A 增加功能。

## 待执行

- [x] V1 全量自动化测试基线（200 pass / 0 fail，CI 同步通过）
- [ ] V2 Chrome 加载 `src/` 无 manifest 或 service worker 错误
- [ ] V3 本地 `http://localhost:4173/teacher-web/workspace.html` 完成五个操作往返
- [ ] V4 `expectedCourseId` 不匹配时课程保持不变
- [ ] V5 非白名单探针页无任何响应，且存储未被修改
- [ ] V6 扩展与页面重载后无重复响应
- [x] V7 公网发布与路径：`pages` 工作流成功，工作台页与两个契约文件返回 200，`doc/` 与 `src/` 返回 404
- [ ] V7 剩余项：在公网页面用真实 Chrome 重复 V3 的七步

准备命令：

```bash
node tools/assemble-workspace.js
python3 -m http.server 4173
node --test tests/*.test.js
```

## V7 现状

前置条件已解除：分支已合并到 `main`，`pages` 工作流在 2026-08-16 的 `release: v0.8.0` 推送上运行成功。已实测：

- `teacher-web/workspace.html`、`teacher-web/forsales.html`、`teacher-web/shared/course-contract.js`、`teacher-web/shared/bridge-protocol.js` 均返回 200；
- `/doc/`、`/src/`、`/teacher-web/index.html`、`/teacher-web/editor.html` 均返回 404，与白名单发布集一致；
- 站点根 `/lessonpilot/` 返回 404，因为发布集不含首页文件。1B 把销售页迁为 `/teacher-web/` 默认首页时需一并处理。

仍需真实 Chrome 的部分：在公网页面上完成 V3 的五个操作往返。

若公网变为不可访问：按 D-007 重开条件记录证据，不得默默更换 origin 或加入模糊来源。

## 完成定义

`doc/requirements/stage-1a.md` 第 8 节十二条。当前第 1、10、11、12 条依赖上述人工验证，其余已由自动化测试覆盖。

## 后续顺序

1. 1B：`doc/plans/stage-1b-sales-workspace.md`，含新增 Task 3b 字幕上下文列与弹出式节点属性表单（COURSE-06、COURSE-07）。销售页文案与试用入口修订（`doc/plans/stage-1b-sales-page-revision.md`）已先行交付，记录见 `tests/manual/sales-page-revision-20260816.md`；工作台部分尚未开始
2. 1C：`doc/plans/stage-1c-runtime-e2e.md`
3. 第一位真实老师验证

旧 D0/D1 清单位于 `doc/archive/2026-08-15-pre-stage-one/next.md`，仅用于追溯，不是当前任务。
