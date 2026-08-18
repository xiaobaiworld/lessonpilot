# KnownMap 当前下一步

更新时间：2026-08-18

当前阶段：教师平台本地发布与插件授权下载闭环

当前状态：本轮会话已收口。节点 1–7 已实现并验证；节点 8–9 尚未开始。

## 下一步唯一目标

执行 `doc/teacher-platform-dev-plan.md` 的节点 8：

> 让学生在 B 站原页面通过 KnownMap 解压版 Chrome 插件输入授权码，下载、校验并保存最新课程配置，然后只在匹配的 BVID 页面运行课程。

产品设计入口：`doc/student-plugin-course-delivery-design.md`

决策入口：`doc/decisions/2026-08-18-student-plugin-single-course-delivery.md`

总计划入口：`doc/teacher-platform-dev-plan.md`

已完成执行记录：`doc/archive/2026-08-18-teacher-platform-nodes-1-7/next.md`

## 开始前检查

- [ ] 读取全局规范、`doc/INDEX.md`、当前需求、D-018 和学生插件设计；
- [ ] 核对 `src/shared/course-contract.js`、`src/background/storage.js`、`src/background/operations.js` 和现有 B 站运行时；
- [ ] 确认本地 FastAPI `/api/v1/public/course-download` 可用；
- [ ] 先写节点 8 的失败测试和真实 Chrome 人工验收步骤；
- [ ] 不改教师端节点 1–7 已验证的 API 与页面行为，除非失败测试证明存在必要依赖。

## 节点 8 完成门禁

- [ ] 插件提供授权码输入入口，授权码不进入日志或长期明文存储；
- [ ] 插件调用下载 API，并在写入前使用共享课程契约校验响应；
- [ ] 无效响应、网络失败和配置错误不覆盖已有课程；
- [ ] 新授权码对应其他课程时先确认覆盖，取消后保留原课程和本地学习状态；
- [ ] 下载后的课程只在匹配 BVID 页面启动；
- [ ] 刷新和 B 站 SPA 切换后不重复初始化或残留旧课程 UI；
- [ ] 自动化测试与真实 Chrome 人工验收通过；
- [ ] 验证后同步 README、需求、架构、数据、API、计划、索引和 changelog。

## 后续节点 9

节点 8 完成后，再执行本地完整闭环验收：

```text
教师登录
→ 创建课程和课节
→ 编辑四种节点
→ 保存草稿并发布
→ 创建授权码
→ 插件下载课程
→ B 站页面完成一次互动
```

节点 9 通过前，不得把“教师发布到学生运行的完整本地闭环”写成已完成。
