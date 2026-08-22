# Stage 1A 数据契约、消息桥与公网路径需求

版本：1.0

更新时间：2026-08-15

状态：当前实施需求权威。

## 1. 本阶段目标

1A 只建立后续教师工作台和 B 站运行时共同依赖的基础通道：

> 一个来自精确白名单路径的教师工作台页面，能够用同一份严格数据契约，把一门当前课程可靠地保存到本机 Chrome 插件，并读取、清除或创建预览会话。

本阶段结束时可以使用最小测试页面或诊断入口验证消息往返；不要求完成 1B 的教师工作台界面，也不要求完成 1C 的 B 站学习窗口。

## 2. 本阶段交付边界

### A-DEPLOY-01 公网路径

- 默认公网 origin 是 `https://xiaobaiworld.github.io`；
- 默认工作台路径是 `/lessonpilot/teacher-web/workspace.html`；
- 当前 GitHub Pages 尚未验证可用，启用并完成真实访问验证是本阶段门禁；
- 本地开发入口是 `http://localhost:4173/teacher-web/workspace.html`；
- 若 GitHub Pages 不可用，必须按 D-007 记录证据并重开部署决策，不能默默加入多个模糊来源。

### A-DEPLOY-02 路径状态

- 公网和本地工作台路径必须能加载执行消息桥所需的共享脚本；
- 本阶段允许页面只提供连接和协议验证所需的最小界面；
- 最小页面不得冒充 1B 已完成的真实教师工作台；
- 生产或本地 origin/path 变化时，必须同步更新插件白名单、自动化测试和部署文档。

## 3. 共享课程契约

### A-DATA-01 唯一契约

- 网页和插件必须复用同一份课程 schema、规范化规则和校验逻辑；
- 不允许网页和插件各自维护字段相似但不完全相同的校验器；
- 精确字段以 `doc/data-spec.md` 为准；
- `schemaVersion` 未知、字段未知、类型错误或枚举非法时整体拒绝。

### A-DATA-02 课程边界

- `PluginCourseConfig` 只包含 `courseId`、`VideoRef`、节点、schema 版本和 `updatedAt`；
- `courseId` 从 `platform:videoId` 派生；
- 插件课程不得包含完整字幕、网页 UI 状态、自定义 HTML、CSS、JavaScript、函数或 DOM；
- 节点至少一个，ID 唯一，并按触发时间和稳定 ID 排序；
- 只接受重点标注、选择题、填空题、问答题对应的四种合法 family/interaction 组合。

### A-DATA-03 节点最低校验

- 所有节点有稳定 ID、有限非负触发时间，并固定要求暂停；
- 重点标注有非空标题和正文；
- 选择题至少两个非空选项，选项 ID 唯一且正确答案存在；
- 填空题至少一个非空可接受答案，规范化固定为 `trim` 和英文 `casefold`；
- 问答题有非空提示和老师预设参考反馈，不包含正确答案判断或 AI 配置。

## 4. 插件本地存储

### A-STORAGE-01 单课程

- 使用 `chrome.storage.local.currentCourse` 保存唯一当前课程；
- 保存是整个对象替换，不做字段 patch；
- 后台完成 schema 校验和真实存储后才返回成功；
- 读取时重新校验存量数据，损坏数据不得继续流入运行时。

### A-STORAGE-02 清除保护

- 清除操作必须携带 `expectedCourseId`；
- 当前课程不存在时可以返回幂等成功；
- 当前课程 ID 与预期不一致时返回 `COURSE_MISMATCH`，不得删除；
- 清除课程时同时清除对应的 active preview session。

### A-STORAGE-03 预览会话

- 使用 `chrome.storage.local.activePreviewSession` 保存唯一当前预览会话；
- 新会话必须绑定当前课程的 `courseId` 和 `updatedAt`；
- 课程不存在或 courseId 不一致时拒绝创建；
- 新会话完整替换旧 active session，不建立历史版本。

## 5. 网页与插件消息桥

### A-BRIDGE-01 固定传输路径

```text
workspace page
  -> window.postMessage
  -> workspace content script
  -> chrome.runtime.sendMessage
  -> background service worker
  -> chrome.storage.local
```

网页不依赖开发者模式扩展的固定 ID。

### A-BRIDGE-02 精确信任边界

- 内容脚本只允许配置的公网和本地工作台页面；
- 必须校验 `event.source === window`、精确 origin、精确 pathname、channel、protocolVersion、requestId、operation 和 payload；
- 页面发送前校验，内容脚本转发前校验，后台处理前再次校验；
- 任一层失败都默认拒绝，不修改存储；
- 后台不能因为请求来自扩展内部消息就跳过 schema 校验。

### A-BRIDGE-03 固定操作

本阶段只开放：

- `PING`
- `GET_CURRENT_COURSE`
- `SAVE_CURRENT_COURSE`
- `CLEAR_CURRENT_COURSE`
- `START_PREVIEW_SESSION`

未知操作拒绝。payload、成功响应和错误码的封闭集合见 `doc/data-spec.md`。

### A-BRIDGE-04 请求与响应

- 每个请求具有唯一 requestId，响应必须原样带回；
- 页面只处理 channel、协议版本和 requestId 都匹配的响应；
- 同一个请求最多产生一个响应；
- 页面等待 3000ms 后以 `EXTENSION_UNAVAILABLE` 结束请求并显示重试入口；
- 保存、清除等写操作超时后不得自动重试，避免重复副作用；
- 页面只有收到后台成功响应后才能展示操作成功。

## 6. 错误与安全要求

### A-ERR-01 必须区分的错误

- 插件未安装或 content script 未连接；
- 协议版本不兼容；
- 来源或页面路径不允许；
- operation、requestId 或 payload 非法；
- 课程 schema 非法或课程不匹配；
- 本地存储读写失败；
- 请求超时。

用户状态不得显示堆栈、内部路径或敏感数据。调试日志可以记录 operation、requestId、courseId、节点数量、结果和错误码。

### A-SEC-01 禁止记录和传输

- 不通过消息桥传输完整字幕；
- 不在通用日志记录题目正文、字幕全文、学生原始回答或 B 站浏览历史；
- 不引入账号、cookie、token、密钥、后端或远程数据库；
- 动态字符串进入诊断页面时使用 `textContent` 或等价安全 API。

### A-NFR-01 可测试性与兼容性

- 课程校验、消息校验和存储操作处理器必须可在 Node 中独立测试；
- Chrome API 通过薄适配层接入，纯逻辑测试不依赖真实 Chrome；
- 重复初始化 content script 不得产生重复监听或重复转发；
- 保持当前零依赖和 Chrome MV3 结构，除非另立决策。

## 7. 本阶段非目标

- 销售首页内容迁移和完整视觉验收；
- 字幕导入、时间线和节点编辑 UI；
- B 站播放器识别、节点调度和学习窗口；
- 老师实际端到端制作课程；
- 第一阶段总览中列出的全部共同非目标。

## 8. 1A 完成定义

以下条件必须全部满足：

1. GitHub Pages 工作台路径真实可访问，或 D-007 已按证据重开并确定唯一替代 origin；
2. 网页和插件使用同一课程契约，合法四种节点通过，非法 schema 和未知字段拒绝；
3. `PING`、读取、保存、清除和创建预览会话均按固定协议工作；
4. 保存后读取的课程与写入课程深度相等；
5. `expectedCourseId` 不匹配时旧课程保持不变；
6. 来源、pathname、协议、requestId、operation 或 payload 错误时存储不变化；
7. 写操作只有后台真实成功后才显示成功，超时不自动重试；
8. 重载页面和插件后没有重复监听或重复响应；
9. 自动化测试覆盖数据契约、协议、存储和消息桥的成功与失败路径；
10. 在真实 PC Chrome 已解压插件环境，从 localhost 和最终公网路径各完成一次消息往返；
11. 从非白名单页面发送同结构消息不能读取或修改插件存储；
12. 人工验证步骤、环境和实际结果已记录，`next.md` 推进到 1B。

满足以上条件后，1A 结束；不能因为 1B 页面尚未完成而继续向 1A 增加 UI 功能。

## 9. 相关文档

- 总体范围：`doc/requirements.md`
- 数据字段：`doc/data-spec.md`
- 当前计划：`doc/plans/stage-1a-contract-bridge-deploy.md`
- 相关决策：`doc/DECISIONS.md` 的 D-004、D-006、D-007、D-009
