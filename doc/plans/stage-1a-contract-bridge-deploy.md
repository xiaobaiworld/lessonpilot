# Stage 1A 数据契约、消息桥与部署实施计划

版本：2.0

更新时间：2026-08-15

状态：T0–T7 代码与文档已完成，PR #1 已于 2026-08-15 合并到 `main`，`pages` 工作流已成功发布；剩余真实 Chrome 人工验证见 `tests/manual/stage-1a-bridge/README.md`。Q1 已由用户选定「发布期组装」（D-010）。取代本文件 1.0 版（见 Git 提交 `cfdce87`）。

目标：建立后续页面和运行时共同依赖的唯一数据契约，并在真实公网工作台路径与本机 Chrome 插件之间完成安全消息往返。

前置阅读：`doc/requirements.md` 总览、`doc/requirements/stage-1a.md` 全文、`doc/data-spec.md` 全文，以及 `doc/DECISIONS.md` 的 D-004、D-006、D-007、D-009。

## 1. 规范加载声明

本轮按全局「分层按需加载」实际读取：

| 层 | 已读取 | 理由 |
| --- | --- | --- |
| 入口层 | `CLAUDE.md`、`GLOBAL_DEV_WORKFLOW.md` | 复杂开发，必读 |
| 专项层 | `DATA_MODELING_AND_FLOW_STANDARD.md` | 1A 本体就是 schema、数据分层和结构化校验 |
| 专项层 | `SECURITY_CODING_STANDARD.md` | 消息桥是跨源信任边界，处理不可信外部输入 |
| 专项层 | `TESTING_STANDARD.md` | 计划必须写明测试分层与门禁 |
| 专项层 | `ERROR_HANDLING_AND_LESSONS_STANDARD.md` | 1A 有封闭错误码集合与日志证据要求 |
| 能力层 | `agent/tools/SYSTEM_CAPABILITY_INDEX.md` | 已确认目录仅含微信/NotebookLM 能力，与 1A 无关；GitHub 操作用本机 `gh` |

暂不适用：`PYTHON_FASTAPI_DEV_STANDARD.md`（无 Python 后端）、`AI_LLM_INTEGRATION_STANDARD.md`（D-005 明确 1A/第一阶段不调用 AI）、`OBSERVABILITY_STANDARD.md` 完整指标/追踪层（无服务端，只按其安全边界约束日志字段）。触发条件：一旦引入后端、LLM 或远程遥测，先立决策再读取对应规范。

## 2. 基线事实（2026-08-15 实测）

- `node --test tests/*.test.js` → 5 套件通过，0 失败，耗时 46ms。这是回归基线。
- 现有 5 个测试文件是手写 `checks[]` + `process.exit(1)` 风格，不使用 `node:test`。1A 新增测试统一用 `node:test` + `node:assert/strict`，与旧文件共存（`node --test` 同时支持两种）。不在 1A 顺手重写旧测试。
- `gh api repos/xiaobaiworld/lessonpilot` → `has_pages: false`、`private: false`、`default_branch: main`；`GET /pages` → 404。D-007 的「尚未启用」在本轮仍然成立。
- Node v22.22.1，可用 `node --test` 与 `--experimental-test-coverage`。
- 本机无 `gitleaks` / `semgrep`。1A 不引入密钥，密钥扫描以人工核对代替，并在 T7 留证。
- 工作区已有用户改动：`.gitignore` 新增 `.gstack/`。本阶段所有提交只 `git add` 明确列出的文件，不夹带该改动。

## 3. 合理性分析：计划成立的部分

以下判断不需要改动，已核对到需求或代码依据：

1. 测试先行顺序（契约 → 协议 → 存储 → 桥 → 真实浏览器）正确：后一层的失败路径全部依赖前一层的错误码集合，顺序颠倒会导致错误码在两处定义。
2. 三层校验（页面、content script、background）符合 D-006 的安全边界，且 A-BRIDGE-02 明确要求 background 不因为消息来自扩展内部就跳过校验，这一条不能以「从简」为由省略。
3. 1A 只做诊断页、不做课程编辑 UI，与 A-DEPLOY-02 和 1B 门禁一致。
4. 零依赖、Chrome MV3、静态页面结构可以在 1A 全程保持，不需要新增运行时依赖。
5. `src/shared/` 的双加载 IIFE 形式已有先例（`teacher-web/subtitle-parser.js`），Node 测试与浏览器脚本可共用同一份文件，无需构建工具。

## 4. 合理性分析：必须先处置的问题

### P1（阻塞，架构级）共享契约无法同时到达网页与插件

`A-DATA-01` 要求网页和插件复用同一份 schema 与校验逻辑，且明确禁止两份相似校验器。但网页与插件是两个不同分发单元：网页部署到 GitHub Pages，插件从本机 `src/` 以已解压方式加载。若契约文件只存在 `src/shared/`，公网页面必须能取到 `../src/shared/course-contract.js`，这要求把仓库根目录（含 `doc/` 商业与定价资料、竞品研究、销售话术）整体发布到公网。这是本阶段唯一需要你拍板的问题，见 §5 Q1。

### P2（阻塞已解决，需写入 data-spec）`captionId` 引用完整性在插件侧不可校验

`doc/data-spec.md` §8 要求 `trigger.captionId` 非空时必须引用当前草稿字幕；但 `PluginCourseConfig` 按 A-DATA-02 不含 `captions`。同一份共享校验器在插件侧没有字幕可比对，这条规则物理上无法执行。

处置：把校验拆成两级，写入 data-spec 并记录决策。共享契约层只校验 `captionId` 为 `null` 或合法 ID 格式（非空、ASCII、≤80）；「必须引用现有字幕」属于 `WorkspaceDraft` 层规则，由 1B 的草稿校验器执行。共享契约不因插件侧缺字幕而放弃该规则，而是明确它的归属层。

### P3（阻塞已解决，需写入 data-spec）`INVALID_CHANNEL` 会变成探测信号

A-BRIDGE-02 要求任一层失败默认拒绝，但 data-spec 把 `INVALID_CHANNEL` 列入封闭错误码。若 channel 不匹配时 content script 回一个错误响应，任意白名单页面上的第三方脚本就能用错误码探测插件是否安装。

处置：channel 不匹配 → content script 静默丢弃，不产生任何响应（该消息在语义上不是发给本桥的）。channel 匹配但 `protocolVersion` 不支持 → 返回 `UNSUPPORTED_VERSION`。`INVALID_CHANNEL` 保留给 background：它校验 content script 转发的信封，属于内部一致性检查，异常说明扩展自身出错。测试同时断言「静默丢弃」和「background 仍拒绝错误 channel」。

### P4（阻塞已解决）`updatedAt` 由页面产生，后台不重写

1A 完成定义第 4 条要求「保存后读取的课程与写入课程深度相等」。若 background 在保存时重写 `updatedAt`，该条永远失败。

处置：`updatedAt` 由页面在构造课程时产生并通过校验，background 原样存储、原样在 `SAVE_CURRENT_COURSE.data.updatedAt` 回显。background 只负责校验它是合法 UTC ISO 串，不负责生成。`PreviewSession.courseUpdatedAt` 从存量课程读取，不重新取时间。

### P5（阻塞已解决）Chrome match pattern 不接受端口，"精确 origin" 必须在 JS 层落地

A-BRIDGE-02 要求精确 origin，但 Chrome content script 的 `matches` 主机部分不支持端口号，`http://localhost/...` 会匹配任意端口。

处置：`matches` 用 `http://localhost/teacher-web/workspace.html` 作为粗粒度注入条件，content script 初始化时再断言 `location.origin` 精确等于白名单常量之一（`https://xiaobaiworld.github.io` 或 `http://localhost:4173`）且 `location.pathname` 精确相等，不满足立即返回、不注册任何监听。白名单常量只定义一处并被测试引用。T5 加载 manifest 时若 Chrome 报 match pattern 非法，即为该约束的直接证据，记入验证记录。

### P6（非阻塞，需写明分工）"节点乱序拒绝" 与 "规范化排序" 的边界

data-spec 说 nodes 按 `timeSeconds` 再按 `id` 升序，1.0 版计划说乱序拒绝，A-DATA-01 又说不静默修复语义错误。三者不矛盾，但必须分工明确，否则 1B 会调用错误的函数。

处置：`normalizeCourse()` 负责排序等表示形式整理并返回新对象；`validateCourse()` 对乱序输入直接拒绝，不排序。写入侧（1B 工作台）先 normalize 再 validate；background 只 validate，不 normalize——插件不替网页修数据。

### P7（非阻塞）`enabled: false` 的节点语义在 1A 未定义

data-spec 要求 `enabled` 为布尔，但未说明 `enabled: false` 是否计入「至少一个节点」，其运行时行为属 1C。

处置：1A 只校验类型，不赋予过滤语义；「至少一个节点」按数组长度判断，不看 `enabled`。该假设写入 data-spec，1C 定义运行时行为时复查。

### P8（非阻塞）manifest 版本与 changelog 不一致

`src/manifest.json` 为 `0.2.3`，`changelog.md` 已有 `v0.6.0` 发布记录。`PING` 要返回 `extensionVersion`，版本号会第一次成为对外可见数据。

处置：T4 把 manifest 版本提到 `0.7.0`，在 changelog 说明这是把插件版本与项目版本对齐，不代表功能发布。

## 5. Q1 已决：Pages 发布范围与契约分发方式

**用户于 2026-08-15 确认采用方案 C（发布期组装）。** 该结论将在 T1 写入 `doc/DECISIONS.md` 作为 D-010，并在 D-007 中标注为其部署细节的补充记录（不构成替代，D-007 的 origin 选择本身仍待 T6 真实访问验证）。

确认后的发布边界：

| 上公网 | 不上公网 |
| --- | --- |
| `teacher-web/workspace.html` | `doc/**`（竞品定价研究、销售话术、多创作者商业预案） |
| `teacher-web/workspace-bridge-client.js` | `src/background/**`、`src/content/**` |
| `teacher-web/shared/course-contract.js` | `tests/**`、`changelog.md`、`next.md` |
| `teacher-web/shared/bridge-protocol.js` | `README.md`（不主动发布，非敏感） |
| `teacher-web/shared/workspace-origins.js` | 其余仓库文件 |

执行约束：

1. 契约源文件唯一存放 `src/shared/`，仓库中不得出现第二份副本；`teacher-web/shared/` 只在 Actions artifact 中存在，加入 `.gitignore` 防止误提交组装产物。
2. Pages 源设为 GitHub Actions（不是分支根目录），workflow 显式列举要复制的文件，采用白名单而非排除法——新增 `doc/` 文件时不会因为忘记加排除规则而泄漏。
3. 页面对契约的引用路径本地为 `../src/shared/`、公网为 `./shared/`。该差异集中在 `workspace.html` 的一处脚本路径解析，并由 T6 的 workflow 测试锁定；不允许在 JS 逻辑里按 hostname 分支。
4. T6 启用 Pages 前，先把 workflow 实际会发布的文件清单打印给你确认，再执行启用。

以下为决策时比较过的三个候选，保留以备重开：

| 方案 | 做法 | 收益 | 成本与风险 |
| --- | --- | --- | --- |
| A 整仓发布 | Pages 直接以 `main` 分支根目录为源，页面用 `../src/shared/course-contract.js` | 改动最小，无发布期组装，单一契约文件 | `doc/` 下竞品定价研究、销售话术、多创作者商业预案和全部插件源码进入公网可索引范围；不可逆（已被抓取即无法收回） |
| B 顶层 shared 目录 | 契约移到仓库根 `shared/`，Pages 发布 `teacher-web/` + `shared/`，插件通过 manifest 引用 `../shared/` | 公网只暴露必要文件 | 插件根目录不再是 `src/`，需改 README 与加载说明；MV3 不允许引用扩展根之外的文件，实际需把 `src/` 提到仓库根或复制，改动面偏大 |
| C 发布期组装（推荐） | 契约源文件唯一存放 `src/shared/`；Actions workflow 构造 artifact，把 `teacher-web/` 与 `src/shared/` 组装为 `teacher-web/` + `teacher-web/shared/` 后发布 | 唯一契约源文件，公网只暴露页面与契约，`doc/` 与插件运行时代码不上公网 | 新增一个 workflow；页面引用路径在本地（`../src/shared/`）与公网（`./shared/`）不同，需要一处显式的路径解析并由测试锁定 |

放弃 A 的原因：`doc/` 下的竞品定价研究、销售话术和多创作者商业预案进入公网可索引范围，且被抓取后不可逆；换取的只是省掉一个 workflow。放弃 B 的原因：MV3 不允许扩展引用其根目录之外的文件，实际需要把 `src/` 全部提到仓库根或做副本，改动面大于 C 且副本会破坏「唯一契约」。

重开条件：需要自定义域名、Pages 在目标老师网络不可用（并入 D-007 重开条件），或页面与插件之外出现第三个契约消费方。

启用 Pages 是外部可见且不易回退的操作，按 §7 T6 第 1 步先出清单再执行。

## 6. 模块边界（1A 范围）

```text
teacher-web/workspace.html          1A 诊断页，仅证明协议能力
teacher-web/workspace-bridge-client.js   页面侧客户端：构造、发送、超时、响应配对
src/shared/course-contract.js       唯一课程契约：normalize / validate / 错误码
src/shared/bridge-protocol.js       唯一协议常量与请求响应校验
src/shared/workspace-origins.js     唯一 origin/pathname 白名单常量
src/content/workspace-bridge.js     content script：来源校验 + 转发，不含业务逻辑
src/background/service-worker.js    操作处理器 + storage adapter，再次全量校验
```

数据流（新增段落，`doc/data-spec.md` §2 已有分层图，本处只补 1A 传输路径）：

```text
page (validate) -> window.postMessage -> content script (validate origin+path+envelope)
  -> chrome.runtime.sendMessage -> background (validate envelope + course schema)
  -> chrome.storage.local -> 原路响应，requestId 配对
```

## 7. 任务分解

每个任务的验收标准即为其停止条件。任务内测试先写、先运行确认失败，再写实现。

### T0 建分支并锁定基线

- 分支：`stage-1a-contract-bridge-deploy`（不在 main 上直接提交）
- 动作：记录 `node --test tests/*.test.js` 基线输出到本任务验证记录
- 验收：分支已创建并 push，基线输出已留存
- 提交：无（无文件变更）

### T1 数据规范补齐（先文档，后代码）

- 修改：`doc/data-spec.md` —— 写入 P2 两级校验归属、P3 错误码语义、P4 `updatedAt` 归属、P6 normalize/validate 分工、P7 `enabled` 假设、`requestId` 正则、`sessionId` 生成方式
- 修改：`doc/DECISIONS.md` —— 新增 D-010（Pages 发布期组装与公网暴露边界，见 §5，在 D-007 中补充交叉引用而非替代）、D-011（契约分层与错误码语义，覆盖 P2/P3/P4/P6/P7）
- 新增：`.gitignore` 增加 `teacher-web/shared/`，防止发布期组装产物被误提交成第二份契约副本
- 修改：`doc/INDEX.md` 审计日期
- 验收：data-spec 中每条 1A 校验规则都能指到唯一执行层；`rg` 搜索 `captionId`、`updatedAt`、`INVALID_CHANNEL` 不再出现两种解释
- 提交：`docs: 补齐 1A 契约分层与协议语义`

### T2 课程契约（测试先行）

- 新增：`tests/course-contract.test.js`、`src/shared/course-contract.js`
- 测试（单元，无外部依赖）至少覆盖：合法四种节点组合各一例通过；深度克隆后仍通过；未知 `schemaVersion`、未知顶层字段、`captions`/`sourceUrl` 混入、未知 family/interaction 组合、重复 node ID、非有限 `timeSeconds`、负 `timeSeconds`、乱序节点、空节点数组、`courseId` 与 `videoRef` 不一致、BVID 格式错误、纯空白文案、选项少于两个、选项 ID 重复、`answer` 指向不存在选项、填空题空答案数组、`normalize` 非固定值、问答题缺 `referenceFeedback`、重点标注缺 `title`/`body`、`effects.pause` 非 `true`、非法 `updatedAt` 格式 —— 全部拒绝
- 测试还需覆盖：`normalizeCourse()` 对乱序输入排序且不修改入参；`validateCourse()` 对乱序输入拒绝；错误对象含稳定 `code` 与字段路径，且不含课程正文
- 验收：`node --test tests/course-contract.test.js` 通过；测试先于实现运行并确认失败
- 提交：`feat: 共享课程契约与严格校验`

### T3 消息协议（测试先行）

- 新增：`tests/bridge-protocol.test.js`、`src/shared/bridge-protocol.js`、`src/shared/workspace-origins.js`
- 测试至少覆盖：五个操作的合法请求通过；channel 不匹配返回「静默丢弃」判定而非错误；`protocolVersion` 不支持返回 `UNSUPPORTED_VERSION`；未知 operation 返回 `UNKNOWN_OPERATION`；`requestId` 缺失/格式错误/非字符串返回 `INVALID_REQUEST`；payload 含未知字段、operation 与 payload 形状不匹配（如 `PING` 带 course、`CLEAR` 缺 `expectedCourseId`）均拒绝；响应 `ok:true` 与 `error` 互斥、`ok:false` 与 `data` 互斥；白名单常量与 manifest matches 的 origin/pathname 一致
- 验收：`node --test tests/bridge-protocol.test.js` 通过；协议常量在仓库内只有一处定义（用 `rg` 断言）
- 提交：`feat: 版本化 bridge 协议与来源白名单`

### T4 后台存储服务

- 新增：`tests/background-storage.test.js`
- 新增/修改：`src/background/service-worker.js`、`src/background/storage.js`、`src/manifest.json`
- 测试（单元 + 内存 storage adapter，不依赖真实 Chrome）至少覆盖：保存后读取深度相等；保存后修改入参不污染存储值（结构化克隆边界）；读取时重新校验存量数据，注入损坏数据返回 `INVALID_COURSE` 且不返回该数据；`CLEAR` 无当前课程时幂等成功；`CLEAR` 的 `expectedCourseId` 不匹配返回 `COURSE_MISMATCH` 且原课程不变；`CLEAR` 成功同时清除 `activePreviewSession`；`START_PREVIEW_SESSION` 在无课程或 courseId 不一致时拒绝；新会话完整替换旧会话且绑定 `courseId` + `courseUpdatedAt`；storage adapter 抛错时返回 `STORAGE_FAILURE` 而非崩溃；`nodeStates` 为每个节点初始化 `pending`
- 同时：manifest 版本提到 `0.7.0`（P8），service worker 通过 `importScripts` 加载 `shared/`，listener 只在模块顶层注册一次
- 验收：`node --test tests/background-storage.test.js` 通过
- 提交：`feat: 插件后台课程与预览会话存储`

### T5 白名单消息桥

- 新增：`tests/workspace-bridge.test.js`、`tests/workspace-bridge-client.test.js`
- 新增：`teacher-web/workspace-bridge-client.js`、`src/content/workspace-bridge.js`、`teacher-web/workspace.html`
- 修改：`src/manifest.json`（新增 workspace content script 与最小 host 权限）
- content script 测试至少覆盖：`event.source !== window` 丢弃；`window.top !== window` 不初始化；origin 或 pathname 不精确匹配不初始化、不转发；子路径与前缀欺骗（如 `.../workspace.html.evil`、`.../teacher-web/workspace.htmlx`）不匹配；channel 不匹配静默丢弃；schema 错误不转发；重复初始化不产生第二个监听器；一个请求只产生一个响应
- 客户端测试至少覆盖：只接受 channel、`protocolVersion`、`requestId` 三者全匹配的响应；无关响应不解析；3000ms 超时后以 `EXTENSION_UNAVAILABLE` 结束并清理监听状态；写操作超时不自动重试；同一 requestId 的第二个响应被忽略；成功状态只在收到 `ok:true` 后出现
- 诊断页：五个操作各一个按钮 + 状态区；所有动态文本用 `textContent`；不含字幕、时间线或节点编辑 UI；页头明示「1A 连接诊断页，课程编辑在 1B 提供」
- 日志断言：断言日志载荷字段集合为 `{operation, requestId, courseId, nodeCount, result, errorCode}`，不含题目正文、字幕或回答
- 验收：`node --test tests/workspace-bridge-client.test.js tests/workspace-bridge.test.js` 通过
- 提交：`feat: 白名单工作台消息桥与 1A 诊断页`

### T6 公网部署与真实浏览器验证

- 新增：`.github/workflows/pages.yml`（按 Q1 结论）、`.github/workflows/test.yml`（`node --test tests/*.test.js`，本阶段起 PR 门禁）
- 新增：`tests/manual/stage-1a-bridge/`（记录 + 非白名单页面探针）
- 人工验证（外部依赖，自动化不可覆盖，按全局「外部依赖批量任务验证规则」留证）：
  1. `node --test tests/*.test.js` 全量通过
  2. Chrome 开发者模式加载 `src/`，确认无 manifest 报错（同时验证 P5 的 match pattern 约束）
  3. 从 `http://localhost:4173/teacher-web/workspace.html` 依次执行 PING、SAVE、GET、START_PREVIEW_SESSION、CLEAR，逐条记录预期与实际
  4. 从公网 `https://xiaobaiworld.github.io/lessonpilot/teacher-web/workspace.html` 重复同一组操作
  5. 从非白名单页面（探针页）伪造同结构消息，用 `chrome://extensions` 的 storage 查看确认无响应且存储未变
  6. 重载扩展与页面各一次，确认无重复响应
- 验收：上述 6 项均有实际结果记录（含失败项）；任一项失败按 `ERROR_HANDLING_AND_LESSONS_STANDARD.md` 走系统化调试，不叠加猜测性修复
- 提交：`test: Stage 1A 真实浏览器验证记录` + `ci: Pages 发布与测试门禁`

### T7 阶段收口

- 安全人工核对（无 gitleaks/semgrep，代替方案并留证）：确认无硬编码密钥、无新增依赖、无 `innerHTML`/`eval`/`Function` 用法（`rg` 断言）、错误响应不含堆栈或内部路径、日志字段集合符合 A-SEC-01
- 对抗审查：由未参与实现的独立子 Agent 按固定清单反查（错误假设、失败关闭是否真的关闭、测试是否假通过、白名单是否可绕过、`INVALID_COURSE` 是否泄露正文、超时后写操作是否可能二次生效）。委派通过交易成本门禁：边界清晰、输入是已提交代码与测试、输出是问题清单、与实现职责分离
- 文档同步：`README.md`（页面状态表、插件版本、Pages 状态）、`doc/data-spec.md`、`doc/DECISIONS.md`、`doc/INDEX.md`、`doc/dev-plan.md` 1A 状态、`changelog.md`（只写已验证项）、`next.md` 推进到 1B
- 收口方式：创建 PR → 运行 `document-release` 或等价文档审计 → 独立 docs commit → 更新 PR 描述（含测试结果、人工验证结果、安全核对结论、风险）→ **等你确认后才合并**，我不自动合入 main

## 8. 测试策略与门禁

| 层次 | 覆盖对象 | 工具 | 门禁 |
| --- | --- | --- | --- |
| 单元 | 契约、协议、白名单常量、存储处理器、客户端超时与配对 | `node:test` + 内存 adapter | 每个提交前必过 |
| 集成 | content script ↔ background 转发链（用可注入的 chrome API 桩） | `node:test` | T5 完成必过 |
| 人工 | 真实 Chrome、真实 Pages、非白名单探针、重载去重 | `tests/manual/stage-1a-bridge/` | T6 逐条留证 |

覆盖率：数据校验与转换逻辑按 `TESTING_STANDARD.md` 目标 90%。零依赖项目用 `node --test --experimental-test-coverage` 报告 `src/shared/` 与 `src/background/`，未达标说明原因，不引入覆盖率依赖。

不做的事：不为旧 5 个测试文件补写 `node:test`；不测 1B/1C 行为；不做 UI 视觉回归。

## 9. 提交与收口方式

- T1–T5 属小步骤：`next.md` 写目标 → 实现 → 运行该任务测试 + 全量回归 → 轻量文档同步 → 小提交 → push 到功能分支
- T6–T7 属大阶段收口：PR + `document-release` + docs commit + 更新 PR + 等你确认合并
- 每个提交只 `git add` 该任务列出的文件；不夹带 `.gitignore` 的用户改动
- 任一任务发现需求或数据规范需要改动时，先改 `doc/` 再改代码，不用实现反推需求

## 10. 风险与回退

| 风险 | 触发信号 | 处置 |
| --- | --- | --- |
| Pages 启用后公网不可访问或被阻断 | T6 第 4 步失败 | 按 D-007 重开条件记录证据，不默默换域名、不加通配来源；停下来问你 |
| Chrome 拒绝 match pattern | 加载扩展报错 | 已在 P5 预置 JS 层精确校验，manifest 降为粗粒度，测试锁定精确常量 |
| 结构化克隆丢失字段导致「深度相等」失败 | T4 深度相等测试失败 | 契约禁止函数/DOM/循环引用，测试直接断言克隆边界，不用 `JSON.parse(JSON.stringify)` 掩盖 |
| 契约在网页与插件产生两份 | `rg` 发现重复校验逻辑 | T3 起用 `rg` 断言协议常量与校验入口唯一 |
| 1A 顺手长成 1B | 出现字幕、时间线或节点编辑代码 | 诊断页只保留五个按钮；PR 自检该项 |

## 11. 关联文档

- 需求：`doc/requirements/stage-1a.md`（权威）、`doc/requirements.md`
- 数据：`doc/data-spec.md`（T1 会补齐）
- 决策：D-004、D-006、D-007、D-009；本轮新增 D-010、D-011（已确认）
- 后续：`doc/plans/stage-1b-sales-workspace.md`、`doc/plans/stage-1c-runtime-e2e.md`
