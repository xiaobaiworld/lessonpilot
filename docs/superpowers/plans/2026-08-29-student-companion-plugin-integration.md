# Student Companion Plugin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将第一版小猫 6 状态图片、5 个小猫风格声音、小鱼干奖励和完成提示接入学生 MV3 插件，并保留后续多猫种/自定义上传的扩展边界。

**Architecture:** 内置角色包与课程媒体分离。Vite 将 `v1/extension/assets/companion/cat/v1/` 复制到构建产物，MV3 通过 `web_accessible_resources` 暴露静态文件；content 通过 background 的白名单消息获取资源 URL。`CourseRuntime` 只发送类型化的陪伴状态事件，`StudentCompanion` 负责图片、声音、气泡、小鱼干和失败降级。

**Tech Stack:** TypeScript、Vite、Chrome MV3、Vitest、Shadow DOM、PNG/WAV。

---

## 1. 当前状态与修改资源

- [x] 确认当前 `v1/extension/content/companion.ts` 的 Canvas `standard` 实现、`CourseRuntime` 节点生命周期和 `v1/extension/vite.config.ts` 构建复制逻辑。
- [x] 将设计结论写入 `docs/superpowers/specs/2026-08-29-student-companion-plugin-integration-design.md`。
- [x] 代码资源：`v1/extension/content/companion.ts`、`companion.css`、`runtime.ts`、`index.ts`、`background/service-worker.ts`、`manifest/targets.ts`、`vite.config.ts`。
- [x] 测试资源：新增资源解析/状态映射测试，并扩展 runtime、background、manifest 和构建门禁测试。
- [x] 二进制资源：复制 `v1/extension/assets/companion/cat/v1/`，不得移动或覆盖源文件和课程资源。

## 2. 资源解析与构建接入

### 2.1 先写失败测试

- [x] 新增 `v1/extension/content/companion-assets.test.ts`：覆盖状态白名单、默认小猫包、缺失资源回退和固定完成提示；先运行该测试确认它因模块缺失失败。
- [x] 扩展 `v1/extension/manifest/targets.test.ts`：先断言角色资源目录进入 `web_accessible_resources` 和 `BUILD_ARTIFACTS`，确认当前实现失败。
- [x] 扩展 `v1/extension/background/messages.test.ts`：先断言 worker 有 `companionAsset` 分支和拒绝未知角色/状态的错误路径。

### 2.2 实现

- [x] 新增 `v1/extension/content/companion-assets.ts`，集中定义 `CompanionVisualState`、当前小猫包、状态到文件的白名单映射、默认图片和完成提示。
- [x] 在 `v1/extension/background/service-worker.ts` 增加 `companionAsset` 消息，只返回受控的扩展 URL，不返回任意文件路径。
- [x] 在 `v1/contracts/schemas/extension-messages.schema.json` 增加消息字段和类型契约，并保持 worker 分支与 schema 双向一致。
- [x] 在 `v1/extension/manifest/targets.ts` 增加 `web_accessible_resources`，只暴露 `assets/companion/**`。
- [x] 在 `v1/extension/vite.config.ts` 复制角色运行资源，并对 manifest 所有资源引用做构建自检；必要时更新 `BUILD_ARTIFACTS`。
- [x] 运行资源摘要/格式/尺寸校验，确保当前 512×512 状态图、64×64 小鱼干和 48kHz WAV 都进入产物。

## 3. 陪伴组件与状态事件

### 3.1 先写失败测试

- [x] 扩展 `v1/extension/content/runtime.test.ts`：断言会话启动触发 `focus`，节点打开触发 `prompt`，提交后根据结果触发 `correct`/`wrong`，完成时触发 `complete`，切回普通播放为 `idle`。
- [x] 新增或扩展 `v1/extension/content/companion.test.ts`：断言主图按状态切换、`idle` 不播放、声音拒绝被捕获、完成态小鱼和固定提示只显示一次、销毁清理播放资源。
- [x] 先运行新增测试并记录失败，再编写实现。

### 3.2 实现

- [x] 给 `RuntimeDeps` 增加可选的陪伴状态 sink，保持判分、课程 schema 和 `WindowView` API 不变。
- [x] 在 `CourseRuntime` 的启动、`tick`、`commit`、`close`、模式切换和 `stop` 边界发出状态事件；用节点 ID 防止完成庆祝重复触发。
- [x] 重构 `StudentCompanion`：用资源驱动的 `<img>` 替换 Canvas 主图，保留书包、A1 位置和视频播放控制。
- [x] 增加状态提示、完成小鱼干、完成文案、音频播放和声音关闭开关；所有用户可见文案用 `textContent`。
- [x] 更新 `v1/extension/content/companion.css`，保留 Shadow DOM 隔离、A1 定位和小鱼约 32px 的显示约束。
- [x] 在 `v1/extension/content/index.ts` 接入资源消息、状态 sink 和当前第一版小猫包。

## 4. 设置、降级与边界

- [x] 第一版固定使用当前 `cat-v1` 小猫包；增加声音开关的本机设置读取/保存，默认开启。
- [x] 音频加载、解码、自动播放限制和 background 失效时静音或回退，不影响节点窗口、作答上报、位置保存和视频恢复。
- [x] 不在本轮实现自定义头像上传、多猫种、外观变体或自定义声音；在代码注释和开发文档中明确后续入口。
- [x] 复核课程 `asset` 消息与角色 `companionAsset` 消息的边界，禁止通过角色消息读取课程二进制或任意外部 URL。

## 5. 验证与交付

- [x] 运行新增的资源、状态、消息和 manifest 测试。
- [x] 运行 `npm test` 和 `npm run check:doc`，确认既有课程/文档契约不回归。
- [x] 运行 `npm run build:all`，检查 local/production 两个产物的角色资源、manifest、service worker 和 content bundle。
- [x] 运行资源 hash、PNG alpha、WAV 可解码和构建引用完整性检查。
- [ ] 在真实 Chrome 或现有本地 harness 验收：匹配视频、节点打开、答对、答错、完成、小鱼尺寸、静音、刷新、全屏、SPA 切换和资源失败。
- [ ] 只有自动化与人工验收都通过后，才在 `changelog.md` 记录用户可见变更；本次不自动推送或合并。

## 6. 后续升级检查

下一次扩大角色系统前必须先回看 `D-V1-023`，显式确认以下旧构想是否仍然需要：

- 波斯猫、黑猫、英短等完整角色包；
- 毛色/肤色/发色变体；
- 默认角色选择页和自定义头像上传；
- 自定义头像是否需要完整 6 状态图和独立声音；
- 远程角色包下载、版本、授权、缓存与离线策略；
- 是否增加跳过、加载失败、连续完成或学习结束等状态。
