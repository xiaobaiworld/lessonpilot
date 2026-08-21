# SRC-004 Stage 1A 契约、消息桥与公网路径提取记录

文档版本：`1.0.0`

状态：提取完成；无人工决策项；源文件保持不变

登记入口：[13 旧资料来源登记](../13-legacy-source-register.md)

源文件：[`doc/requirements/stage-1a.md`](../../../requirements/stage-1a.md)

源快照：文件 blob `451b0a380cb21e23239989d4fed0430dba955275`；最近一次变更提交为 `c39dd23e6dde1c91e5e9b2cfdbb989a8258a187e`（2026-08-15，`docs: split stage-one requirements by phase`）

## 1. 提取结论

该文件定义旧单课程原型的共享契约、插件存储、网页消息桥和 GitHub Pages 诊断门禁。核对结果如下：

- 共享契约唯一真源、精确来源与消息校验、不可信输入默认拒绝、后台真实成功后才展示成功等原则已进入 v1 接口、安全和开发质量要求；
- GitHub Pages 地址、诊断页路径、固定消息操作、具体错误码、3000ms 超时和 Chrome 存储键属于旧接口及实现证据；
- 视频派生课程 ID、唯一当前课程和唯一预览会话已被稳定 UUID、多课程、多课节和隔离预览要求替代；
- “无账号、无后端、零依赖”只适用于旧 1A，不限制 v1；
- 未发现新增需求或人工决策项。

## 2. 保留的要求原则

| 源内容 | v1 去向 |
| --- | --- |
| 网页和插件共用一份契约、规范化和校验逻辑 | `DEV-STRUCT-001`、`DEV-STRUCT-002` |
| 页面、内容脚本和插件后台分别校验消息及课程数据 | `INT-EXT-001`、`INT-EXT-002`、`SEC-TRUST-001` |
| 未知版本、类型、操作或字段默认拒绝且不改变存储 | `SEC-TRUST-003`、`INT-PACKAGE-002`、`DEV-CODE-002` |
| 完整字幕、可执行内容、凭证和无关浏览数据不进入插件课程消息 | `FR-AUTHOR-002`、`INT-FILE-001`、`SEC-TRUST-002`、`SEC-PRIV-001` |
| 页面必须等待后台真实写入结果，不显示假成功 | `FR-AUTHOR-008`、`DEV-CODE-002` |
| 重复初始化不产生重复监听、响应或副作用 | `FR-RUNTIME-013`、`DEV-TEST-003` |
| 自动化测试与真实 Chrome 白名单/非白名单验收并用 | `DEV-TEST-002`、`ACC-EVIDENCE-002` |

## 3. 被替代的旧数据与产品语义

| 旧规则 | v1 处理 |
| --- | --- |
| `courseId` 由 `platform:videoId` 派生 | 由系统建立稳定课程和课节身份；视频引用独立，见 `FR-COURSE-002`、`FR-COURSE-006`、`DATA-CONTENT-002` |
| `currentCourse` 只保存唯一课程 | 由 `FR-LIB-001`、`FR-LIB-006` 的多课程库和原子合并替代 |
| 清除课程同时清除唯一预览会话 | 删除、预览和学习状态按明确对象及范围处理，不用全局单课程副作用替代 |
| `activePreviewSession` 只有一个且不保留历史 | 预览按教师、课程、课节和草稿版本隔离，具体会话模型留给设计 |
| 发布课程至少一个节点、所有节点固定暂停 | 发布完整性和各节点行为以 `FR-PUBLISH-005`、`FR-RUNTIME-010`、`FR-RUNTIME-011` 为准，不从旧 schema 反推通用规则 |
| 填空固定使用英文 `casefold` | v1 要求使用已发布的明确判断规则；语言归一化由内容与契约设计决定 |
| 不引入账号、后端或远程数据库 | 已由 v1 教师身份、工作空间、发布和授权范围替代 |
| 保持零依赖 | 改由 `DEV-DEP-001` 要求依赖最小、锁定且可追溯，不预设必须为零 |

## 4. 设计、迁移与证据去向

- `PluginCourseConfig`、`currentCourse`、`activePreviewSession`、五个固定 operation、错误码和 payload 属于旧契约，进入 `MIG-CONTRACT-001`、`MIG-LOCAL-002` 对照；
- `window.postMessage → content script → service worker → chrome.storage.local` 是已验证候选路径，后续接口设计可复用，但必须重新回链 `INT-EXT-*`；
- 精确 origin、pathname、channel、protocolVersion、requestId 与一次响应约束进入消息协议设计，不在需求层固定旧字段名；
- GitHub Pages 和 localhost 4173 路径是历史环境证据，由 `OPS-ENV-001` 和 `MIG-CUTOVER-002` 判断保留、替代或弃用；
- 3000ms 超时和禁止写操作自动重试是旧实现参数及副作用保护证据，后续按真实失败行为重新设计和测试；
- 1A 完成定义只证明旧版本门禁意图，实际通过状态须由测试记录和 `ACC-LINK-002` 复核。

## 5. 原文件处置

- 建议登记状态：`已提取待归档`；
- 新增 v1 需求：无；
- 需修改已接受需求：无；
- 人工决策项：无；
- 归档动作：等待旧接口消费者搜索、证据回链和需求冻结后另行执行，本次不移动或删除源文件。

下一来源为 SRC-005 `doc/requirements/stage-1b.md`。
