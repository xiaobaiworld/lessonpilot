# Changelog — KnownMap

Only record verified changes.

## [Unreleased]

### v1 旧资料 SRC-001 提取 — 2026-08-21

- 人工确认根 README 没有需要新增或修改的 v1 需求，现阶段继续保留为旧实现运行入口。
- 将产品行为回链到现有 v1 要求，将域名、页面、脚本、存储键、release 和本地命令分类为现状或迁移证据。
- 保留生产数据、实际插件分发物和当前生产版本三个待验证冲突；否决“更换视频引用时清除旧课程”的单课程旧规则。
- SRC-001 更新为“已提取待切换”；根 README 未修改，等待 v1 具备可验证运行说明后原位更新。

### v1 旧资料来源登记 — 2026-08-21

- 人工确认旧资料必须逐文件区分当前需求、未来候选、设计或实现证据、历史事实和已否决内容。
- 登记 82 个候选来源，覆盖产品、需求、决策、架构、数据、接口、体验、计划、验收及 8 个既有归档快照。
- 明确“部分提取”不等于可以归档，“已归档”不等于独有信息已核对；本轮未移动、删除或改写旧资料。
- 验证：来源 ID 连续且唯一，登记路径与实际文件清单一一对应，Markdown 差异检查通过。

### v1 验收追踪与发布门禁 — 2026-08-21

- 人工确认需求状态必须由可定位、可重复且与当前版本及环境匹配的证据支撑。
- 建立 8 条 `ACC-*` 要求，覆盖 236 个稳定编号的矩阵覆盖、双向链接、证据、变更失效和发布门禁。
- 明确旧原型、历史测试、同名功能和单次演示不能冒充 v1 实现或发布证据。
- 当前设计、实现、测试与发布证据如实标记为待建立；验证：编号库存、重复编号、关联引用和 Markdown 差异检查通过。

### v1 迁移与兼容需求 — 2026-08-21

- 人工确认 v1 必须分开处理真实服务端数据、已分发插件与本机状态、以及已否决的历史原型契约。
- 建立 9 条 `MIG-*` 要求，覆盖迁移源清点、服务端归属与凭证、本机课程与学习状态、契约升级、切换及弃用。
- 明确历史 `{ "course": ... }`、`installedCourse` 和 `learningState` 不建立长期兼容层，也不在用户确认前自动删除原数据。
- 验证：需求编号、关联需求、索引状态及 Markdown 差异检查通过。

### v1 部署与运维需求 — 2026-08-21

- 人工确认第一阶段必须能从确定版本安全发布，识别当前运行状态，并在不破坏权威数据的前提下回退或恢复。
- 建立 9 条 `OPS-*` 要求，覆盖环境隔离、最小暴露、可追溯发布、原子切换、迁移、备份、恢复、健康诊断和故障处理。
- 保留 `OPEN-02`、`OPEN-04`、`OPEN-05` 和 `OPEN-08`；不把当前域名、阿里云 ECS、SQLite 或具体运维工具默认为 v1 目标架构。
- 验证：需求编号、关联需求、索引状态及 Markdown 差异检查通过。

### v1 开发质量需求 — 2026-08-21

- 人工确认第一阶段的工程目标是已接受需求可准确实现、可重复验证、可安全修改并可追溯。
- 建立 12 条 `DEV-*` 要求，覆盖共享契约、依赖、配置、编码、错误处理、测试、日志、文档和变更门禁。
- 明确不设置没有项目基线的统一覆盖率数字，不提前建设集中日志、复杂质量平台或全量设备实验室。
- 验证：需求编号、关联需求、索引状态及 Markdown 差异检查通过。

### v1 安全、隐私与合规需求 — 2026-08-21

- 人工确认第一阶段只建立访问隔离、秘密保护、不可信输入和学生本机数据四类安全底线。
- 建立 11 条 `SEC-*` 要求，覆盖角色与工作空间、密码与会话、授权码与密钥、插件消息、课程文件、日志及测试数据。
- 明确暂缓企业级风控、专业安全认证、集中事件平台、完整内容权利处置和规模化合规建设。
- 验证：需求编号、关联需求、索引状态及 Markdown 差异检查通过。

### v1 第一阶段非功能需求结论 — 2026-08-21

- 人工确认第一阶段不单独制定 `NFR-*`，不虚构响应、容量、并发、可用率或兼容时限指标。
- 已接受功能、数据和接口需求中的恢复、数据保护及宿主边界继续有效，不在非功能文档重复编号。
- 记录规模化交付前需要重开的质量域，并保留 `OPEN-03`、`OPEN-05`、`OPEN-08` 跟踪入口。
- 安全、开发质量和部署运维专项仍进入第一阶段审核，不随非功能指标一起暂缓。
- 验证：索引、阶段状态和 Markdown 差异检查通过。

### v1 接口与集成需求 — 2026-08-21

- 建立并人工审核 5 类边界、10 条 `INT-*` 要求。
- 明确 Web 角色业务边界、插件后台职责、内部消息配对及教师真实预览隔离。
- 约束插件只在匹配的 B 站视频页使用可信主播放器，并以最小控制适应页面生命周期变化。
- 定义课程发布包的最小兑换响应、独立校验及原子安装，以及字幕和教师课程文件的本地处理边界。
- 通用校验、安全、超时和日志规则不重复编号，由后续专项需求和设计文档统一承接。
- 验证：10 条需求字段完整、编号唯一，正式功能与数据需求引用存在，Markdown 差异检查通过。

### v1 数据需求 — 2026-08-21

- 建立并人工审核 8 个数据域、28 条 `DATA-*` 要求。
- 明确服务端与学生本机数据边界，以及身份、内容、发布、授权、资格、安装和学习状态的独立生命周期。
- 定义教师课程文件、运营审计、数据分类、删除、备份、完整性、幂等和故障恢复边界。
- 保留具体数据期限、学生学习状态导出、后续教师学习证据模型和 v0.9.1 数据迁移为显式开放项。
- 验证：28 条需求字段完整、编号唯一、正式功能需求引用存在，Markdown 差异检查通过。

### v1 课程配置导入导出与功能需求收口 — 2026-08-21

- 新增并人工审核 `SCN-TCH-08` 及 4 条 `FR-PORT-*`。
- 教师可导出自己的已保存课程配置，并在校验后导入为新的课程草稿；导入不覆盖、不发布、不创建授权。
- 课程文件不包含视频、凭证和学生数据；无效文件或写入失败不改变现有课程。
- 修正已审核 `FR-AUTH-*` 与 `FR-COURSE-*` 的单条状态，使其与文件索引一致，不改变需求语义。
- 当前阶段功能需求域全部完成；`FR-REPORT-*` 与学生课程文件继续保留为后续候选。
- 验证：全部正式 `FR-*` 状态与功能域索引一致，Markdown 差异检查通过。

### v1 平台管理、支持与审计需求 — 2026-08-21

- 精简并人工审核 6 条 `FR-ADMIN-*`，不重复认证、数据、安全和部署运维专项内容。
- 管理员能够查看必要教师运营状态，并在高风险账号操作前确认对象和影响。
- 账号、发布、授权与恢复操作可追溯；支持人员能够查看版本、健康状态并使用安全错误标识定位问题。
- 支持和恢复只作用于批准范围，不默认读取课程正文，也不能远程读取学生本机回答和进度。
- 验证：6 条需求均包含完整字段；Markdown 差异检查通过。

### v1 本机学习状态需求 — 2026-08-21

- 按管理员、教师、学生和系统边界整理并人工审核 13 条 `FR-LEARN-*`。
- 学习会话、继续位置、输入草稿、正式尝试、节点状态和聚合进度分别保存，不用播放事实替代完成事实。
- 重点内容、选择题、填空题和问答题具有明确完成规则；错误、跳过、关闭和不支持均不伪造完成。
- 课节及课程进度只表示当前机器、当前安装授权范围和整门课程发布版本，不解释为成绩或教师已收到反馈。
- 学生可以重置课节或课程的本机学习状态，但不会删除课程包、授权来源或领取记录。
- 当前阶段学习数据只保存在本机，不上传、不跨设备合并、不进入教师报表。
- 课程更新只迁移稳定身份和完成语义均可证明兼容的状态；局部不兼容不会清空其它合法状态。
- 验证：13 条需求均包含状态、优先级、来源、异常结果和验收条件；Markdown 差异检查通过。

### v1 视频运行时与互动执行需求 — 2026-08-21

- 按管理员、教师、学生和系统边界整理并人工审核 14 条 `FR-RUNTIME-*`。
- 运行时使用完整视频引用精确匹配课节，未匹配页面不干预；多个课程匹配同一视频时由学生明确选择。
- 每次学习会话锁定课程、课节和整门课程发布版本，课程更新不会在会话中热切换节点。
- 播放位置只取自可信主播放器；正常播放、时间抖动、前后跳转及多个到期节点都有确定且不重复的行为。
- 同一时刻只执行一个互动窗口，四种基线节点按已发布规则完成输入、判断、反馈和继续。
- 保存失败不伪造完成或自动放行；未知类型显式降级，不白屏、不猜测、不静默跳过。
- 全屏、刷新、分 P、单页导航和播放器重建会清理旧 UI、监听、队列和播放器控制。
- 同步修正 `TERM-029`：发布版本统一指整门课程原子发布版本，不沿用旧逐课节版本语义。
- 验证：14 条需求均包含状态、优先级、来源、异常结果和验收条件；Markdown 差异检查通过。

### v1 学生课程库与更新需求 — 2026-08-21

- 按管理员、教师、学生和系统边界整理并人工审核 13 条 `FR-LIB-*`。
- 当前机器维护可恢复的多课程库，使用稳定课程身份区分同名课程和复用同一视频的课程。
- 新课程包在完整校验和学生确认后原子安装，多课程批次不会产生部分结果或覆盖其它课程。
- 同一课程只保留一个当前安装版本，拒绝降级、同版本异内容和无法安全迁移的不兼容更新。
- 更新前展示版本、范围、课节、节点和本机学习状态影响，只迁移稳定身份与完成语义都兼容的状态。
- 新课程包和迁移状态原子写入；离线、并发、空间不足和单门课程损坏不清空整个课程库。
- 学生可明确删除一门本机课程及其进度；示例课程与真实授权课程保持隔离。
- 后续允许把课程、课节和互动节点配置导出为版本化本地文件，学生回答和学习进度是否导出另行审核。
- 验证：13 条需求均包含状态、优先级、来源、异常结果和验收条件；Markdown 差异检查通过。

### v1 授权、领取与有效资格需求 — 2026-08-21

- 按管理员、教师、学生和系统边界整理并人工审核 12 条 `FR-GRANT-*`。
- 教师可用稳定课程、课节和节点标识建立多课程分层授权；课程级范围跟随后续发布，窄范围不会静默扩大。
- 授权码领取窗口、授权项有效时间和本机已安装课程相互独立；授权码原文只在创建成功当次显示。
- 学生通过本机学习标识建立幂等领取记录，不需要注册登录，也不使用授权码充当学习身份。
- 同一机器的多个有效授权来源按范围求并集，最后输入的授权码不能覆盖此前资格。
- 已领取且授权项仍有效时无需再次提供原授权码即可重新下载或更新。
- 终止一个授权来源只停止未来领取、重新下载和更新，不删除本机已有课程或学习状态。
- 验证：12 条需求均包含状态、优先级、来源、异常结果和验收条件；Markdown 差异检查通过。

### v1 真实预览、发布与版本需求 — 2026-08-21

- 按管理员、教师、学生和系统边界整理并人工审核 11 条 `FR-PUBLISH-*`。
- 真实预览锁定指定的已保存草稿，并通过学生正式交付路径执行；静态示意不能冒充真实预览。
- 预览会话具有独立身份和初始状态，不写入学生学习状态、领取结果或未来教师真实学习证据。
- 所有未归档课节完成制作、校验和真实预览后，教师才能显式发布整门课程。
- 发布以整门课程为原子快照，失败时不产生部分发布课节，也不改变学生当前可取得的成功版本。
- 课程发布版本唯一、不可变且可追溯；草稿修改、重复请求和并发发布不会覆盖或倒退已有版本。
- 课程包只包含运行必需的版本化数据，发布审计不记录课程正文、完整字幕、凭证或学生回答。
- 验证：11 条需求均包含状态、优先级、来源、异常结果和验收条件；Markdown 差异检查通过。

### v1 字幕与互动脚本制作需求 — 2026-08-21

- 按管理员、教师、学生和系统边界整理并人工审核 11 条 `FR-AUTHOR-*`。
- 教师可使用 SRT、VTT 或已确认视频时间制作节点；字幕全文默认在教师本机处理，不因导入自动上传。
- 明确每个课节具有独立当前草稿，支持节点新增、编辑、移动、复制和删除，并保留稳定节点身份。
- 重点内容、选择题、填空题和问答题是 v1 基线类型，不是永久封闭清单；所有现有和新增类型遵守统一管理契约。
- 草稿校验不静默改变教学语义，保存失败、重复请求和并发冲突不得覆盖最近一次有效草稿。
- 教师查看学习反馈及课程、课节完成情况继续作为后续阶段能力，不重新打开 `D-026` 的当前单机边界。
- 验证：11 条需求均包含状态、优先级、来源、异常结果和验收条件；Markdown 差异检查通过。

### v1 课程、课节与视频引用需求 — 2026-08-21

- 按教师、学生和系统边界整理并人工审核 10 条 `FR-COURSE-*`。
- 教师可以管理多门独立课程和多个有序课节；同名课程允许存在，但课程和课节使用独立稳定标识。
- 课程草稿可以暂时没有课节，发布和授权前必须至少有一个未归档且视频引用有效的课节。
- 同一课程内禁止重复 BVID，不同课程可以复用同一视频，避免把视频标识误作课程身份。
- 课程归档停止新的领取、重新下载和更新，但保留历史结构、授权历史和学生本机已有版本。
- 外部视频不可用不会删除课程结构；课程包必须保留可理解的课程、课节名称和确定顺序。
- 验证：10 条需求均包含状态、优先级、来源、异常结果和验收条件；文档 577 行；`git diff --check` 通过。

### v1 工作空间与权限边界需求 — 2026-08-21

- 按平台管理员、教师、学生和系统共同边界整理并人工审核 8 条 `FR-WS-*`。
- 当前阶段每名教师只有一个工作空间且教师是唯一 Owner，不提供成员、助手或工作空间切换。
- 管理员负责建立和维护教师与工作空间的关联，但普通管理操作不默认读取课程正文。
- 教师只能管理自己工作空间内的对象；权限由服务端可信身份和归属关系推导，不信任客户端角色字段。
- 学生不加入工作空间，只能通过有效授权取得允许的已发布课程包。
- 教师账号停用不删除工作空间数据；越权、归属损坏和跨空间引用失败时不得产生部分写入。
- 验证：8 条需求均包含状态、优先级、来源、异常结果和验收条件；文档 414 行；`git diff --check` 通过。

### v1 身份认证与会话需求 — 2026-08-21

- 按平台管理员、教师、学生和系统共同边界整理并人工审核 11 条 `FR-AUTH-*`。
- 明确管理员负责教师用户名和密码的创建、重置及登录资格控制；教师不开放自行注册。
- 明确认证会话只控制访问，退出、过期、密码重置或账号停用不得删除已保存课程等业务数据。
- 当前阶段学生只使用本机学习标识，课程和学习状态保存在单台机器；换机重新下载，不恢复原机器数据。
- 学习数据上传、教师学习证据和跨设备同步推迟到后续阶段，并由 `D-026` 记录范围变化。
- 验证：11 条需求均包含状态、优先级、来源、异常结果和验收条件；`git diff --check` 通过。

### v1 用户场景骨架 — 2026-08-21

- 建立并人工审核覆盖九项产品范围的用户场景骨架，包括真实课程闭环、管理员、教师、学生和跨角色异常恢复场景。
- 每个场景统一包含前置条件、触发、主流程、异常分支和可观察结果，并回链到对应 `SCOPE-*`。
- 明确该文件不是穷尽清单；后续功能、数据、接口、安全、部署或迁移需求发现新业务分支时，必须先补充 `SCN-*`。
- 验证：Markdown 引用目标存在，文档 277 行，低于 500 行软阈值；`git diff --check` 通过。

### v1 领域术语基线 — 2026-08-21

- 建立并人工审核 55 个 v1 领域术语，统一角色、课程内容、发布、授权交付和学习证据的业务含义。
- 明确授权码、授权项、领取记录、有效资格和学习身份是不同对象；已安装课程不代表在线授权仍有效。
- 区分产品、文档、课程包 Schema、课程发布、插件和生产部署六种版本，禁止继续使用无对象的“当前版本”。
- 记录用户、课程配置、授权、学习数据、预览、删除等模糊说法的强制改写规则，以及 5 项待确认界面命名。
- 验证：Markdown 引用目标存在，文档 185 行，低于 500 行软阈值；`git diff --check` 通过。

### v1 产品范围需求基线 — 2026-08-21

- 建立 `doc/requirements/v1/` 版本化需求入口，固定带序号的需求文件索引、稳定需求编号、逐段人工审核和旧文档无损归档规则。
- 完成并人工审核 v1 产品目标、成功标准、利益相关者、功能范围、长期边界、非目标、已知约束、待验证假设和开放问题。
- 明确 v1 的教师制作、课程授权、学生运行、学习证据和平台运营闭环；B 站桌面 Chrome 是首个交付范围，不被表述为永久产品定位。
- 区分产品闭环、市场价值和工程验收，禁止用固定演示、假数据或仅部署成功替代真实用户证据。
- 验证：Markdown 引用目标存在，文档 376 行，低于 600 行软阈值；`git diff --check` 通过。

### 超级管理员与教师账号管理 — 2026-08-21

- 现有 `admin.html` 保留销售首页、教师工作台和服务状态入口，并新增受超级管理员会话保护的教师账号管理工作区。
- 新增独立管理员认证、教师列表、已发布课程数聚合、教师创建和密码重置 API；管理员与教师使用不同 Cookie、会话表和权限边界。
- 管理员与教师密码只保存 Argon2 哈希，会话只保存 HMAC 摘要；教师临时密码只在创建或重置响应及当前页面内存中出现一次。
- 生产发布只在管理员表为空时创建首位 `admin`，已有管理员时跳过且不重置；初始密码不写入长期环境文件、发布记录或日志。
- 教师登录和超级管理员登录共用生产 Nginx 登录限速；管理员连续错误登录第 7 次返回 429。
- 当前生产版本：`20260821T020224Z-97cd83806550`，GitHub SHA `97cd838065504ea2e9a50ad7f8668be504a94bcc`。
- 线上验证：管理员登录、会话恢复、教师列表和退出均返回 200；当前教师列表为 1 条，已发布课程数为 1；未登录管理接口返回 401。
- 安全验证：生产管理员密码字段为 Argon2 哈希，seed 环境变量和临时文件均不存在，服务日志无密码标记。
- 验证：Node 331 pass / 0 fail；FastAPI 96 pass / 0 fail；GitHub `node-test`、`backend-test`、Pages 构建和部署通过；390px 页面无整体横向溢出。

### 生产站点索引页 — 2026-08-20

- 新增 `https://knownmap.com/admin.html`，集中提供销售首页、教师工作台和服务状态入口。
- 索引页不包含账号、服务器地址、写操作 API 或管理控制，并通过页面元数据与 Nginx 响应头禁止搜索引擎索引和存档。
- 教师平台精确提交发布白名单、发布包校验和、线上探针和部署说明已包含 `admin.html`。
- 当前生产版本：`20260820T162253Z-220dffbd4cfd`，GitHub SHA `220dffbd4cfd5a0b3f34ffebed147289cf7aa617`。
- 线上验证：首页、索引页、教师工作台、健康检查和 `www` 别名均返回 200；私有路径保持 404；SQLite `integrity_check=ok`。
- 验证：Node 299 pass / 0 fail；FastAPI 40 pass / 0 fail（1 条上游弃用警告）；GitHub `node-test` 与 `backend-test` 通过；浏览器无横向溢出和控制台错误。

### 生产安全加固与可恢复发布 — 2026-08-20

- 生产发布只接受明确允许的远程分支和 GitHub `node-test`、`backend-test` 均成功的精确提交；systemd、Nginx 和备份配置也从同一提交归档部署。
- `uv` 固定版本与 SHA-256，后端按 `uv.lock` 为每个 release 安装独立 `.venv`；旧生产 release 已补齐共享环境回滚兼容。
- 发布不再生成、重置或输出教师密码；明确轮换时密码只通过 SSH 标准输入进入 root `0600` 临时文件，seed 后删除。
- Nginx 新增登录与课程下载限速、HSTS、CSP、点击劫持和权限策略；教师登录页不再预填生产用户名。
- 新增每日 SQLite 在线备份、完整性检查与 14 天保留；systemd 服务清空 capability 并收紧设备、内核和地址族访问。
- GitHub Actions 固定到完整 SHA，Dependabot 安全更新与每周 Python/Actions 检查已启用。
- 安全加固基线版本：`20260820T153701Z-130b5ac22581`，GitHub SHA `130b5ac225817dcb124bae89257da4efd1444e99`；当前生产版本见上方索引页记录。
- 线上验证：真实教师登录与会话恢复 200；连续错误登录第 7 次开始返回 429；私有路径 404；备份权限 `0600` 且 `integrity_check=ok`。
- 验证：Node 298 pass / 0 fail；FastAPI 40 pass / 0 fail（1 条上游弃用警告）；Bandit 无发现；`pip-audit` 无已知漏洞；Nginx 与 Shell 语法通过。

### 教师工作台与 FastAPI 发布到阿里云 ECS — 2026-08-20

- `knownmap.com` 现在同时提供销售首页、教师工作台和同源 FastAPI；教师页面在生产环境自动请求 `https://knownmap.com/api/v1`，本地开发仍使用 8000 端口。
- 新增教师平台生产发布入口、systemd 服务、Nginx 反代、独立 SQLite 数据目录和同一 release ID 的网页/后端/GitHub 标签/仓库记录。
- 初始生产版本：`20260820T142243Z-ec1454ed2f31`，GitHub SHA `ec1454ed2f31512049069122406e8fbd387868b3`；当前版本见上方安全加固记录。
- 生产验收：教师登录、创建课程和课节、保存 4 个节点、发布 `v1`、创建短期授权码、公开下载课程全部通过；`/health`、首页和教师工作台返回 200，私有路径保持 404。
- 发布提交验证：Node 289 pass / 0 fail；FastAPI 40 pass / 0 fail（1 条上游弃用警告）；Shell 语法和 `git diff --check` 通过。

### 教师时间线官网示例对齐 — 2026-08-20

- 修复时间线结束边界被课程时长覆盖的问题：“结束”保持为轴线右端边界，`08:33` 独立显示为真实课节时长和末刻度。
- 固定测试课程默认加载仓库中已验证的 177 条匹配字幕，选中节点后右栏可以显示对应字幕上下文；老师导入合法 SRT/VTT 时仍可覆盖默认字幕。
- 组件栏和时间线 marker 改用与官网完整课程示例一致的四种 SVG 小图标；节点摘要上下交错，连接线连续接到同一主轴上的节点图标。
- 验证：Node `288 pass / 0 fail`；后端 `40 pass`，覆盖率 `87%`。修改后浏览器视觉复核因应用内浏览器拒绝自动刷新本地 URL，保留为手动刷新检查项。

## [0.9.1] - 2026-08-20

### 学生插件工具栏首页与下载恢复

- Chrome 工具栏左键点击 KnownMap 现在打开独立课程首页：学生可以直接输入授权码、查看唯一当前课程和完整 B 站链接；教师可进入已有教师登录页。
- 当前阶段明确不伪造学生账号能力，学生入口说明“使用授权码，无需注册”；学生账号和跨设备身份仍为非目标。
- 修复旧 service worker 或异常消息通道返回空值时访问 `result.error` 抛错、表单永久停在“正在下载并校验课程”的问题。
- `sendMessage` 拒绝、空值、非对象和 10 秒无响应统一转为 `EXTENSION_UNAVAILABLE`，页面书包与工具栏表单都会恢复可操作状态。
- 插件版本由 `0.9.0` 升至 `0.9.1`；核心功能由用户确认基本可行，完整真实 Chrome 边界矩阵仍保留在节点 8 人工验收中。
- 验证：Node 284 pass / 0 fail；后端 40 pass，覆盖率 87%；弹窗 380×560 视觉检查通过；JS 语法与 `git diff --check` 通过。

### 教师编辑器时间线、快捷操作与授权记录 — 2026-08-20

- 固定课程时间轴由错误的 `03:42` 更正为课程规范中的真实 `08:33`；最后刻度、结束文案与轴线右端使用同一位置。
- 编辑器右下新增持续可见的“打开视频”“发布课程”“完成”快捷操作；完成会先保存草稿，失败不离开编辑器，成功返回“我的课程”。
- 授权码新增短期（7 天）和长期（不过期）类型、到期校验、课程历史列表 API、总数与分类统计；编辑器可点击类型查看尾号、创建时间、有效期和状态。
- 授权码历史仍不返回原文或摘要；已过期授权码与未知授权码对公开下载统一返回 `INVALID_ACCESS_CODE`。
- 新增 Alembic `0007_access_code_types` 迁移；本机旧库已保留数据完成升级，并建立 Git 忽略的稳定开发环境配置。
- 验证：Node 280 pass / 0 fail；后端 40 pass，覆盖率 87%；浏览器确认轴线右端与结束标记中心同为 845px、短期/长期最终各 1 条、两条有效码下载返回 200、“完成”保存后返回课程页。旧临时密钥下无法再验证的 1 条测试记录已在完整数据库备份后移除。

### 学生书包课程记录展示 — 2026-08-20

- 授权码领取成功后，KnownMap 书包的“课程”区域会从空状态变为一条当前课程记录；记录显示由已校验 BVID 生成的完整可点击 B 站课程 URL，并保留“打开课程视频”操作。
- 未安装课程或视频标识未通过校验时只展示空状态，不生成空记录，也不把内部课程 ID 冒充成课程地址；测试版仍维持单课程覆盖语义。
- 验证：Node 276 pass / 0 fail；后端 37 pass，覆盖率 87%；JS 语法与 `git diff --check` 通过。真实 Chrome 兑换展示仍纳入节点 8 人工验收。

## [0.9.0] - 2026-08-19

### 飞书真实课程试用表单 — 2026-08-19

- 老师现在可以通过 `KnownMap 真实课程互动改造申请` 提交一节真实课程，并说明最想解决的教学问题；表单同时保留 D-013 的两个未来方向验证问题。
- 不方便直接私信的老师可以从销售页进入 1 分钟表单；入口只打开飞书/Lark 官方公开表单，链接失效时会自动隐藏。
- GitHub Pages 和可追踪生产发布包都已包含该入口模块，站点根路径与兼容路径不会漏载脚本。
- 字段、权限、数据边界、后续维护和匿名访问验收均有文档与自动化测试覆盖。

### 教师平台节点 1–7 文档收口 — 2026-08-18

- 已完成的节点 1–7 执行记录和完整开发计划移入 `doc/archive/2026-08-18-teacher-platform-nodes-1-7/`，保留历史证据。
- 根 `next.md` 和当前开发计划只保留尚未完成的节点 8–9，下一步明确为插件授权码下载、课程保存和 B 站运行。
- README、产品规格、当前需求、架构、数据、API、决策和索引统一为同一状态：教师端与公开下载 API 已验证，插件客户端和完整本地闭环未完成。
- 纠正旧第一阶段需求总览的“当前实施 1A”状态，以及架构中把插件授权码入口写成已存在的表述。
- API 文档删除尚未实现的 `CONFIG_INVALID` 和 `RATE_LIMITED` 响应声明，并补充登录失败的统一用户提示。
- 验证：70 份 Markdown 相对链接全部有效；Node 240 pass；后端 37 pass，覆盖率 87%；Bandit 无发现；`pip-audit` 无已知漏洞；`git diff --check` 通过。

### Web 生产发布可追踪与回滚 — 2026-08-18

- `knownmap.com` 的销售页发布改为绑定已推送到 GitHub 的精确 commit SHA，从 Git 对象白名单构建，不读取未提交工作区。
- 每个版本保存不可变发布目录、`release.json`、`SHA256SUMS`、服务器追加历史、GitHub `web-prod/<release-id>` 标签和仓库 JSON 记录。
- 新增 `build`、`deploy`、`status`、`list`、`verify`、`history` 和 `rollback` 命令；切换后验证失败会自动恢复前一版本。
- 当前生产版本：`20260818T153530Z-f8e09e172bd3`，GitHub SHA `f8e09e172bd3be980b664c81f9e1c7535819ae77`。
- 可回滚版本：`20260818T153346Z-7cab05f6ff46`，GitHub SHA `7cab05f6ff46394b86cf4bdcb8b380eb41cd3b78`。
- 验证：全量 Node 240 pass；两个发布目录各 9 个公开文件哈希通过；线上首页哈希与 GitHub 源文件一致；健康检查通过；6 个私有路径均返回 404。

### 教师登录便捷性修正 — 2026-08-18

- 本地预建测试账号 `teacher-test-01` 的 seed 密码统一为 `password`，页面继续保持密码输入为空。
- 登录页删除“使用教师账号继续设计和发布课程”，字段名由“登录账号”调整为“用户名”。
- 错误用户名和错误密码统一显示“用户名或密码错误”，不泄露账号是否存在。
- 本地页面和 API 使用一致的 `localhost` 或 `127.0.0.1` 主机名，修复正确登录后会话 Cookie 未回传的问题。

### KnownMap 品牌组合标识修正 — 2026-08-18

- 教师应用产品类别由“课程设计平台”调整为“互动课程工具”，同步页面标题、登录文案、运行时标题、课程创建说明和当前权威文档。
- Logo 外部圆形和方形容器尺寸保持不变，内部地图、路径、折页线和节点围绕中心缩小至 82%，并重新导出全部插件与网页 PNG。
- 页眉字标中的 K 使用暖金节点色 `#D9A51E`，M 使用陶土节点色 `#A9654E`，其余字母保持深墨色。
- 验证：品牌与教师页面聚焦测试 11 pass，页面信息架构测试通过；1440 x 900 和 375 x 812 无横向溢出或控制台错误。

### KnownMap 互动课程工具体验校正 — 2026-08-18

- 教师应用统一命名为“KnownMap 互动课程工具”，登录、我的课程和课程设计页移除原型、W0、开发账号、本地 API 和未来能力说明。
- 登录密码不再写入页面源码，支持显示或隐藏；登录成功和退出后立即清空，未登录顶栏不显示课程导航和退出操作。
- 新课程改为空表单；已有课程读取真实数据。未导入字幕时不再显示内置示例字幕，固定视频保留完整 3:42 时间轴。
- 字幕导入后的节点重绑会进入最终草稿 payload；发布期间锁定保存、节点组件和时间轴，退出后清空课程、字幕、版本和授权码状态。
- 新增键盘课程设计路径：节点组件可聚焦选择，时间轴支持方向键、Home、End 和回车放置。
- 验证：Node 234 pass、后端 37 pass、Bandit 无发现、`pip-audit` 无已知漏洞；1440、900、375 三档浏览器无页面级横向溢出或脚本错误。

### 教师可视化节点编辑器 — 2026-08-18

- 教师工作台改为组件注册驱动的横向时间轴，字幕只提供时间定位和选中节点上下文。
- 重点标注、选择题、填空题和问答题均支持点击放置与原生拖放，两种入口共用同一创建动作。
- 节点支持类型化弹窗编辑、时间拖动、删除确认、临近节点分轨、缩放、草稿保存和刷新恢复。
- 新增前端结构化日志：本地默认 DEBUG，正常 origin 默认 INFO，并丢弃正文、密码、会话凭证和授权码字段。
- Playwright 验收通过：桌面与 375px 页面无页面级横向溢出，移动弹窗位于视口内，发布和授权码创建闭环可用。
- 验证：后端 37 pass、总覆盖率 87%，Node 229 pass，Python 编译、前端语法和差异检查通过。

### 教师工作台 API 联调 — 2026-08-18

- 现有 `teacher-web/editor.html` 接入登录、会话恢复、课程/课节初始化、四种节点表单、草稿保存、发布和授权码创建。
- 新增浏览器 API client、教师会话封装和本地 CORS；页面可显示发布版本和一次性授权码。
- 保留字幕只在教师浏览器解析的边界，节点 JSON 通过后端严格 schema 校验后保存。
- Playwright 本地验收通过：桌面和 375px 移动视口无横向溢出，登录到授权码创建无页面脚本错误。
- 验证：后端测试 37 pass、Node 回归 207 pass、脚本语法检查通过。

### 课程授权码与下载 — 2026-08-18

- 新增课程授权码创建和公开课程下载 API；同一授权码始终返回课程最新发布版本。
- 授权码使用高熵 Base32 格式，数据库只保存 HMAC-SHA256 摘要和末五位提示，原文仅在创建响应中返回一次。
- 未发布课程不能创建授权码；畸形码和未知码统一返回 `INVALID_ACCESS_CODE`，接口不创建学生账号、领取记录或学习数据。
- 验证：后端测试 36 pass、Node 插件回归 204 pass、Python `compileall` 通过、Alembic 空数据库迁移通过。

### 课程发布与插件配置 — 2026-08-18

- 新增不可变 `published_scripts` 版本模型、迁移和课程发布 API；每次发布递增版本，不覆盖历史 JSON。
- 新增 `PluginCourseConfig` adapter，从课节 BVID 派生 `courseId`，输出插件契约要求的 camelCase 字段和 UTC 毫秒时间。
- 无课节、无草稿或空草稿统一返回 `DRAFT_NOT_READY`；其他教师发布统一返回 `RESOURCE_NOT_FOUND`。
- 验证：后端测试 31 pass、Node 插件回归 204 pass、Python `compileall` 通过、Alembic 空数据库迁移通过。

### 教师脚本草稿 — 2026-08-18

- 新增四种严格脚本节点 schema：`notice`、`choice`、`blank`、`free_text`；拒绝未知字段、空文案、重复节点 ID、乱序节点和错误答案引用。
- 新增 `script_drafts` 持久化模型、迁移以及按课节替换保存/读取草稿 API。
- 草稿 API 按教师资源归属隔离，草稿保存不创建或覆盖已发布版本；保存、读取和失败动作进入操作日志。
- 真实本地验证通过：后端测试 25 pass、Python `compileall` 通过、Alembic 空数据库迁移创建 `script_drafts` 成功。

### 教师课程与单课节 — 2026-08-18

- 新增每位预建教师唯一工作空间，以及课程、单课节和 B 站视频绑定数据模型与迁移。
- 新增课程创建、课程列表、课程详情、课节创建和课节详情 API；当前每门课程通过服务规则和数据库唯一约束只允许一个课节。
- BVID 按共享插件契约校验；其他教师访问课程或向他人课程添加课节时统一返回 `RESOURCE_NOT_FOUND`，避免资源存在性泄露。
- 课程和课节的创建、读取、失败操作写入持久化操作日志，并通过 request ID 与运行日志关联。
- 真实本地验证通过：登录后创建课程、绑定 `BV1WW4y1e7GL`、读取课程详情和列表，SQLite 数据和操作日志一致。
- 验证：后端测试 16 pass、Node 回归 204 pass、Python compileall 通过、Alembic 迁移通过、`pip-audit` 无已知漏洞、Bandit 无发现。

### 教师测试账号认证 — 2026-08-18

- 新增 FastAPI 教师认证模块：手工 seed 测试账号、登录、会话恢复和退出。
- 密码使用 Argon2 慢哈希；浏览器只保存 HttpOnly、SameSite 会话 cookie，数据库只保存 token 摘要。
- 新增 `teachers`、`teacher_sessions` 迁移和认证操作日志，登录成功、失败、会话恢复和退出可按 request ID 追踪。
- 真实本地验证通过：seed 创建账号，登录返回会话 cookie，`/auth/me` 恢复教师，退出后再次访问返回 401。
- 验证：后端测试 10 pass、Node 回归 204 pass、Python compileall 通过、Alembic 空数据库迁移通过。
- 安全验证：`pip-audit` 无已知漏洞，Bandit 无发现；发现并升级了存在 `PYSEC-2026-1845` 的 pytest 8.4.2，当前锁定 pytest 9.1.1。

### AI Learning Companion 产品功能说明 v0.2 — 2026-08-18

- 基于教师中心需求核对形成 `doc/AI_Learning_Companion_Product_Function_Spec_v0.2.md`，明确教师账号、测试批次、工作空间、课程、课节、授权码、学生和学习数据功能。
- 授权码改为控制课程配置的领取、下载和更新资格，不承诺远程删除学生本地已有版本；教师主动停用授权码后不可恢复。
- 明确多个有效授权码按权限并集合并，课程配置和互动内容下载到本地，但 B 站视频仍由 B 站提供。
- 新增对应决策记录；本次为需求和决策文档更新，不表示相关平台功能已经实现。

### KnownMap 品牌与 Logo — 2026-08-18

- 统一用户可见品牌为 `KnownMap`，域名记录为 `knownmap.com`。
- 新增地图窗口圆形 Logo：统一 SVG 源文件、16/24/48/128 PNG 扩展资源和网页图标。
- 当前页面、manifest、销售文案和权威文档已同步；`lessonpilot.*` 协议、存储和 JavaScript 全局标识保持兼容。
- 已验证：全量测试 `204 pass / 0 fail`；已检查扩展图标尺寸，以及桌面和 375px 移动端页面显示。
- 新增 `docs/knownmap-logo-resources.md`，记录 Logo 的知识空间、学习路径和关键节点含义，以及圆形、方形、透明背景三种资源形态的使用场景。

### 文档事实同步 — 2026-08-18

只校正文档与已合并代码、已发布公网之间的漂移，未改动产品代码：

- 测试数从 135 更新为实测 200 pass / 0 fail（README、`next.md`、1A 人工验证记录）。
- PR #1 已合并、`pages` 工作流已首次发布，因此移除「等待合并」「公网待验证」这两个已失效的前置条件。
- 1A 人工验证记录填入 V7 的发布与路径实测结果：工作台页、销售页与两个共享契约返回 200；`/doc/`、`/src/`、`/teacher-web/index.html`、`/teacher-web/editor.html` 返回 404；站点根返回 404（发布集不含首页文件，1B 迁移销售首页时处理）。该记录的扩展版本由 0.7.0 更正为 0.8.0，分支由 `stage-1a-contract-bridge-deploy` 更正为 `main`。
- 发布集实际为 8 个文件加 `.nojekyll`；原计划文案「只含 5 个文件」写于销售页加入发布集之前，按事实修正并在 D-010 记下当前清单。
- D-007 由「待验证的实施默认」改为已验证可访问，D-010 由「待 Pages 实际发布验证」改为已验证。
- 1B 状态由「未开始」细化为「销售页与试用入口修订已交付、教师工作台未开始」。

## [0.8.0] - 2026-08-16

### Stage 1B 销售页与试用入口修订 — 2026-08-16

对应计划 `doc/plans/stage-1b-sales-page-revision.md`，只改销售页文案、入口和静态示例表达。已验证的变化：

- 销售页从「看完示例并复制一句话」改为明确联系开发者、提交一节真实课程、开始一次可运行试用；品牌主张固定在主标题上方，位置一并被测试锁定。
- 首屏自成一体：身份、承诺、目标视频和协助说明；主 CTA 唯一（`tests/sales-page-copy.test.js` 断言 `.cta-primary` 恰好一个）；协助说明表述为「准备相关资源、配置互动节点」。
- 节点收敛为四种正式类型，去掉「老师补充」；学习结果块明确标注为产品形态示意，不是已上线的报告。
- 补上安全边界说明，同时禁掉「绝对安全」「安全审计」等 6 个夸大说法；不把插件、报告和多学生数据写成已上线。
- 销售演示页时间线右侧改为字幕上下文列，节点属性表单改为弹出式（COURSE-06、COURSE-07）。
- 销售页加 `noindex`；示例字幕副本按原样发布；发布集按 D-010 白名单方式追加销售页及其两个脚本。
- 复制话术在成功与失败两条提示里都说明粘贴位置。
- 飞书表单入口未实现：仓库里还没有真实表单 URL，按计划禁止写占位链接，因此整块入口不显示，并加断言防止页面提到表单却无真实 URL。
- 自动化测试增至 200 pass / 0 fail。浏览器实测：1440 / 900 / 375px 三档无横向溢出，375px 主 CTA 与复制按钮完整可见，字幕栏 8 节点在三档视口均 ≥ 7 行，页面自身无控制台错误。记录见 `tests/manual/sales-page-revision-20260816.md`。
- 未验证因此不计入完成：系统剪贴板真实写入和 CTA 无注册要求这两项需在真实浏览器确认。

### 版本对齐 — 2026-08-16

- `src/manifest.json` 版本 0.7.0 → 0.8.0，与项目版本对齐，不代表功能发布。

### Stage 1A 数据契约、消息桥与部署（代码完成，人工验证待执行）— 2026-08-15

已验证的变化：

- 新增共享课程契约 `src/shared/course-contract.js`，网页与插件复用同一份 schema 与校验逻辑。闭合 schema 拒绝未知字段，`captions`/`sourceUrl` 等工作台字段无法混入插件课程；`normalizeCourse` 只整理表示形式，`validateCourse` 对乱序等语义错误直接拒绝。43 个测试，行覆盖 97.7%。
- 新增版本化消息协议 `src/shared/bridge-protocol.js` 与来源白名单 `src/shared/workspace-origins.js`。陌生 channel 静默丢弃，我方 channel 上的畸形请求才回错误码；origin 与 pathname 成对校验，覆盖前缀、后缀和子域欺骗。21 个测试。
- 新增插件后台存储与五个操作处理器。保存后读取与写入深度相等；`expectedCourseId` 不匹配时返回 `COURSE_MISMATCH` 且原课程不变；读失败返回 `STORAGE_FAILURE` 而非报告课程不存在；每次读取重新校验存量数据。26 个测试。
- 新增白名单工作台消息桥：内容脚本在 JS 层断言精确 origin 与 pathname（Chrome match pattern 无法限定端口），重复注入不产生重复监听，写操作超时不自动重试并标记结果未确认。34 个测试。
- 新增 1A 连接诊断页 `teacher-web/workspace.html`，只验证协议往返，不含字幕、时间线或节点编辑。
- 插件 manifest 补齐 `storage` 权限，版本 0.2.3 → 0.7.0 与项目版本对齐。
- 新增测试门禁与 Pages 发布工作流；发布集为显式白名单，`doc/` 与插件运行时代码不上公网。
- GitHub Pages 已启用（source 为 GitHub Actions），`has_pages` 由 false 变为 true。
- 自动化测试从 5 个套件增至 135 个测试，全部通过（该数字为 1A 收口时的基线；1B 销售页修订后为 200）。
- 本地验证：工作台页面五个资源均返回 200；四个页面脚本在共享全局中按文档顺序加载后，测试课程校验通过、保存信封合法。
- 对抗检查通过：同一 `github.io` origin 下其它仓库路径被拒绝，`__proto__` 类键不污染原型，存储失败不报告已保存，损坏课程仍可用正确 ID 清除。

尚未验证，因此不计入已完成：真实 Chrome 已解压插件的往返、非白名单页面探针实测。公网 Pages 可访问性已于 2026-08-16 首次发布后验证（见 Unreleased 的文档事实同步）。剩余步骤见 `tests/manual/stage-1a-bridge/README.md`。

### 第一阶段文档收口 — 2026-08-15

- 将当前目标收敛为礼宾式真实验证闭环：公网销售首页、真实教师工作台、本机已解压插件和 B 站原页面；明确四种节点、单课程和非目标边界。
- 将第一阶段需求进一步拆为总览和 1A/1B/1C 三份可独立验收的阶段需求；当前 Agent 只需执行 1A，不必从后续页面和运行时需求中猜测范围。
- 完整归档混合 W0/D0/D1 与远期内容的旧 requirements、dev-plan 和 next，建立当前需求、数据规范、决策记录、文档索引和 1A/1B/1C 三份可独立验收的实施计划。
- 统一目标页面职责、消息桥、存储键、协议操作、错误码和预览会话字段；GitHub Pages 保持为待真实验证的实施默认，而非已完成事实。
- 为历史、未来和仅作视觉参考的文档增加权威状态说明，并记录本轮长度、重复、拆分和索引健康审计结果。
- 验证 34 份 Markdown 无失效本地链接、Git diff 无空白错误，现有 5 个 Node 测试套件全部通过；本轮不修改产品代码。

### Player Integration Feasibility Probes — 2026-08-14

- Add an isolated MV3 manual probe under `tests/manual/bilibili-iframe-current-time/` that injects into every permitted frame and reports whether a Bilibili iframe exposes a finite `video.currentTime`; the probe does not change production extension permissions.
- Record the YouTube-compliant interaction layout: pause through the IFrame API, resize the unobscured player, render the learning window beside it, then restore playback after submission.
- Distinguish automatic restoration of the page layout from browser-native fullscreen, which must be requested directly from the learner's submission click and degrade to in-page playback if denied.

### 学生宿主收束为 B 站原页面加插件 — 2026-08-14

方向性变更：**定时自动打断是五类节点的共同前提，不是其中一项能力**，因此学生宿主只能是装了插件的 B 站原页面（仅 PC 浏览器）。此前四份文档里的「学生首用网页优先、不要求装插件」结论作废。

- 排查并记录跨源 iframe 读取播放时间的所有路线，全部封闭：读进度条像素无 API 支持、`getDisplayMedia()` 屏幕共享因权限提示与控制栏自动隐藏不可用、墙上时钟推算在手动暂停时失真、代理转发等于重新托管他人内容。且即使拿到当前秒数也无法暂停跨源 iframe。
- 删除 `student-web/`（`app.js`、`index.html`、`styles.css`）；`course.json` 迁至 `teacher-web/course.json`，课程标识与教学文案继续被 `tests/course-config.test.js` 约束。
- 老师预览真实学生效果改为装插件打开 B 站原页面，与学生同一路径。教师端网页只负责编辑，「教师端全程免安装」不再成立；工作台里的「学生端效果预览」明确降级为静态示意图。
- 修正 `doc/teacher-course-workspace-design.md` 5.2 节与验收标准第 8 条：时间真源是导入的字幕文件，选中节点时播放器带 `t=` 重载定位，不承诺双向同步，不得用动画或进度推移暗示网页在跟踪播放位置。
- 标注 `doc/node-content-standard.md` 第 7 节「不能读时间」降级只适用于教师预览等次要场景，不可作为学生端主形态。
- 记录合规边界：对平台播放器的干预限于暂停加自有 DOM 层，不改倍速、不阻止跳过、不降原声、不改播放器 UI。
- 修正 YouTube 的定位：它是唯一提供官方 IFrame Player API、因而唯一能支撑免安装且可上手机学生形态的平台，属产品形态备用出口而非 `PlayerAdapter` 抽象验证。其政策禁止的是在播放器**前方**叠加，缩小播放器并排显示学习窗口是合规的（视口不低于 200×200，16:9 建议至少 480×270），因此 `dark-player` 覆盖主题变为不再需要，S09 改用 IFrame API 关闭字幕轨（参数待实测）。D0/D1 只做 B 站的排期不变。
- 同步改动：`doc/design.md`、`doc/requirements.md`、`doc/student-runtime.md`、`doc/dev-plan.md`、`doc/lessons.md`、`doc/node-content-standard.md`、`doc/teacher-course-workspace-design.md`、`next.md`、`README.md`、`tests/page-information-architecture.test.js`、`tests/course-config.test.js`。
- 五个测试文件全部通过。

### Teacher Online Sales Page — 2026-08-14

- Add `teacher-web/forsales.html` as the independent first online sales surface. Simple outreach gets a teacher to this page; the page itself explains the problem, value, proof, and next action.
- Keep `teacher-web/index.html` as the separate teacher workspace sample page. Sales copy and conversion stay out of the workspace and W0 editor.
- Use the approved eight-node workspace as specific product evidence inside `forsales`: a target-teacher promise, old-course before/after translation, a four-step transformation story, explicit teaching-value translation for sample evidence, and a low-friction “reply to the sender” course-conversion action.
- Verify `forsales` at desktop and 375px widths with no document-level horizontal overflow; verify that the application-copy action copies the intended request sentence. The only observed console error belongs to the embedded Bilibili player's own fingerprint reporter.

### Teacher Workspace Sample Page — 2026-08-14

- Keep the workspace sample page in three files: `teacher-web/index.html`, `teacher-web/sample.css`, and `teacher-web/sample.js`. Shared chrome stays in `teacher-web/styles.css`.
- Align the timeline to the video column at about 3/4 width, with the add-node rail in the remaining quarter. The add control is not on the axis.
- Draw the timeline as one continuous pale blue-gray bar matching the video progress track. Color changes only mark played versus unplayed; do not segment the bar.
- Summarize the add-node rail as adding interaction in the video. Do not list the four node types there.

### Subtitle Import Fixes — 2026-08-14

- Fix: read an SRT/VTT fractional field as a literal millisecond count instead of padding it to three digits. The supplied interview subtitles vary that width within one file, so padding placed one cue's end before its start and silently dropped it; the real file now imports 177 of 177 cues with no ordering violations or overlaps.
- Fix: render caption text and teacher event labels with `textContent` rather than an interpolated `innerHTML` string, so an unterminated tag in a teacher's subtitle file cannot execute. Markup output is unchanged.
- Add parser coverage for the variable-width fractional format, using the timestamp pair that previously failed.
- Correct the sales-sample timeline description in `doc/design.md`, which still said full-width after the 3/4 timeline plus add-node rail landed.
- Renumber `next.md` steps to a single 1–18 sequence with unique section letters, and record that the node trigger state machine is defined in `doc/requirements.md` S07 but not yet implemented.

### Learning Window Standard — 2026-08-14

- Make the learning window the first-class object every host implements, so any new client reaches the same display and interaction by implementing one contract.
- Split requirements into a mandatory half and an advisory half, recorded in `doc/design.md` section 7: the window's display and interaction must be identical everywhere, while pause, seek, on-picture highlight, caption covering, and audio ducking are platform-dependent recommendations that never affect conformance.
- Require window self-sufficiency, which is what makes the advisory half safe: highlights, caption covers, and audio ducking are enhancements, never the only carrier of a node's content.
- Restate lesson-pack `effects` as teacher intent rather than a host requirement.
- Define window skeleton, size tiers with authored-content limits, mounting rules for fullscreen and picture-in-picture, style isolation, singleton queueing, open-source and close-reason semantics, keyboard and IME handling, and draft recovery.
- Add the course notebook and node-bound AI ask as window applications, with snapshot-plus-reference storage.
- Decide notebook visibility by authorship: teacher- and system-authored content carries no privacy question, while learner-written notes, tags, and AI questions stay private unless the learner shares them. Submitting an answer is itself delivery to the teacher.

### Node Scope Boundary — 2026-08-14

- Define a node as one time point, one teaching point, one window opening, with self-contained, finite, local, and explainable as its hard rules.
- Keep nodes independent: allow content references and grouping, forbid prerequisites, unlocking, branching, nesting, and one node mutating another, because seeking and skipping would otherwise strand learners on a broken chain.
- Separate trigger time, effect range, and recap range; add advisory density and spacing guidance.
- Close the playback intent set and state that pausing alone is not a node: opening the window must always explain why.
- Answer the review-earlier-content question in three layers: in-window recap text is mandatory, seek-and-return with a minimized window is the recommended enhancement, and picture-in-picture is deferred because cross-origin players cannot host it and it has no reliable return path.

### Node Content Standard — 2026-08-14

- Define a host-independent node and display contract so plugin, web, and local-video app runtimes share the same student-facing content.
- Separate pedagogical family, interaction, display payload, evaluation, and playback effects.
- Align the teacher sales-sample add-node fields with that contract, without persisting a fourth node.

## [0.6.0] - 2026-08-14

### Real Subtitle-Grounded Course Version

- Add the supplied subtitle source for the fixed Bilibili interview lesson to the repository.
- Replace placeholder teacher-sample nodes with verified content points at `00:39`, `02:16`, and `05:45`.
- Align the timeline, node copy, classroom actions, student previews, and design documentation to the same course moments.
- Extend the local subtitle parser to accept the compact single-digit timestamp format used by the supplied SRT.
- Record the English-copy review boundary because the checked-in source is a Chinese AI translation, not original English captions.

### Teacher Sales Sample Course Header — 2026-08-13

- Replace prototype status text with the course directory `英语职业课 / 英文面试表达`.
- Remove preview, save, unsaved, and duplicated sample-course controls from the sales-sample header.
- Keep example-data disclosure in the student completion section, where it applies to the displayed records.
- Synchronize README, architecture, UI, current-step, and sales-sample documentation with the finalized three-page roles and course-directory header.

### Teacher Editor Static Reload Fix — 2026-08-13

- Make the shared teacher editor script tolerate controls that exist only on earlier page variants.
- Version the editor script URL so a browser does not keep executing the pre-split cached bundle after pulling the sales-sample changes.
- Add a page contract check covering the optional control binding and cache-busted editor script.

### Teacher Workspace Sales Sample Page — 2026-08-13

- Implement the confirmed sales sample at `teacher-web/index.html`: video 3/4 + intro 1/4, full-width timeline with typed icons, node rows, and labeled sample completion.
- Keep the previous subtitle-driven W0 prototype at `teacher-web/editor.html`.

### Teacher Workspace Timeline Stack — 2026-08-13

- Stack video above a full-width timeline instead of placing them side by side.
- Give a small video about three-quarters of the row width, with course intro in the remaining quarter.
- Mark timeline interaction points with distinct icons and visible labels.

### Teacher Workspace Sales Sample — 2026-08-13

- Define `doc/teacher-course-workspace-design.md` as the teacher-facing sales sample, not the shipped workspace.
- Keep the four-layer picture (course, timeline, node rows with student-effect preview, sample completion) as the target shape of the later real workspace.
- Leave `teacher-web/` functional code unchanged in this round.

### Classroom-Design Teacher Home — 2026-08-13

- Reduce the teacher home from a four-module capability map to one dominant classroom-design task.
- Keep the fixed Bilibili course and manual subtitle import as compact setup inputs beside the design entry.
- Replace home-page student preview and result modules with a small, honest note about the learning process and future evidence.

### Teacher Capability-Guided Home — 2026-08-13

- Replace the assumed current-course dashboard with a first-use workspace that explains existing-course intake, caption-anchored classroom design, student preview, and learning results.
- Keep the fixed Bilibili link confirmation, manual SRT/VTT import, timeline editor, and student preview as direct commands from the new workflow.
- State clearly that W0 displays an expected learning-result structure but does not yet record learning sessions or generate reports.
- Verify desktop and 375px layouts, source import, action editing, and teacher-to-student preview without horizontal overflow.

### Local Web Service Contract — 2026-08-12

- Document one repository-root local server for both teacher and student web pages.
- Establish `/teacher-web/` and `/student-web/` on port `4173` as the canonical local URLs.
- Record that `4174` and per-directory server roots are unsupported because they break the verified relative preview and course-configuration topology.
- Add troubleshooting guidance to distinguish a wrong server root from stale or missing synchronized code.

### W0 Subtitle-Driven Course Authoring — 2026-08-12

- Define W0 as a fixed Bilibili URL plus teacher-provided SRT/VTT subtitle intake, a locally parsed caption timeline, and caption-anchored classroom actions.
- Explicitly exclude Bilibili subtitle scraping, local video, upload, hosting, and fabricated learning-completion data.
- Refocus the learner shell around learning goals, the source video, and expected learning results.
- Add local SRT/VTT parser coverage and browser verification that imported captions replace the teacher timeline and accept a classroom action.

### W0 Bilibili Course Shell — 2026-08-12

- Re-scope the first web slice to a fixed Bilibili course presentation and teacher/student page validation.
- Remove local-video selection, browser-controlled timed activities, local-session flow, tester playback controls, and their W0 configuration/runtime artifacts from the student webpage.
- Keep timed interaction validation on the Bilibili original-page extension spike until a web-controllable player path is separately specified and proven.
- Verify teacher-to-student preview, direct original-course fallback, and desktop/375px layout behavior without horizontal overflow.

### Role-Specific Course Pages — 2026-08-12

- Rework the teacher home into a task-first workspace with the current course, pending teaching decision, course health, and direct design/preview actions.
- Reframe the student page as a single-course learning shell with lesson context, progress, video, interaction, feedback, and summary.
- Keep Bilibili source and compatibility details outside the ordinary student flow.
- Add page information-architecture checks and verify the teacher design route plus student-preview route in a headless browser.

### Web Runtime First — 2026-08-12

- Shift the next validation slice from plugin-required preview to a student web runtime.
- Keep the Chrome extension as a Bilibili/YouTube overlay adapter and PC enhancement path, not the required first-use path for students.
- Update the D0 plan so save-and-preview first opens a web course link that works across iPad, iPhone, Android, tablets, and desktop browsers.
- Preserve the existing plugin spike for Bilibili demonstration while avoiding plugin installation as a blocker for first teacher tests.

### Bilibili Source Sample and Local Control Proof — 2026-08-12

- Add `student-web/course.json` and a shared runtime contract so the student page validates and loads the single configured Bilibili sample instead of hardcoding course nodes in the UI.
- Render the specified Bilibili lesson as a source iframe with a direct original-page fallback; explicitly limit it to source presentation rather than cross-origin playback control.
- Add a browser-only local HTML5 video path: students can select MP4, WebM, or MOV files without upload or hosting, then complete two timed deterministic interactions and a locally stored summary.
- Add course-config contract tests and browser verification for the full local interaction flow plus desktop and 375px mobile layouts. The Bilibili iframe emits one third-party fingerprint-report console message, but the LessonPilot page has no own console errors.

### Creator Studio Direction — 2026-08-11

- Reframe the teacher prototype from a subtitle/video editor into LessonPilot Studio, an AI-assisted interactive-course workspace.
- Add the five-step course flow: upload, AI analysis, teaching design, student simulation, and publish.
- Promote AI from one event option to a persistent Copilot that explains suggestions and lets teachers accept or ignore them.
- Extend timeline rows with knowledge points, likely mistakes, and visible AI suggestions while keeping teacher approval final.
- Replace event-title entry with natural-language teaching intent and rename preview as classroom simulation.
- Keep real course analysis and simulated student behavior explicitly outside this prototype slice.
- Replace remaining editor-first copy with teacher-first language: AI备课草案、课堂设计、教学重点、互动建议与老师最终决定。
- Keep runtime event types as implementation details while presenting their teaching meaning in the interface.

### Teacher UI Color System — 2026-08-11

- Consolidate the teacher prototype around warm paper surfaces and a forest-green brand hierarchy.
- Add semantic tokens for attention, teacher voice, interaction activity, constrained AI, and connection status.
- Replace the isolated purple AI treatment with muted blue-green so AI remains a secondary teacher-controlled tool.
- Separate focus, status, and attention colors and verify main text/event contrast ratios against a 4.5:1 target.
- Record the shared teacher/student color rules in `doc/ui-design.md`.

### Teacher Timeline Visual Refinement — 2026-08-11

- Refine the teacher timeline against the supplied visual references.
- Add a single course overview block with video preview, course metadata, subtitle count, event count, and event legend.
- Remove duplicated course metadata from the timeline sidebar so the working area focuses on caption selection and event editing.
- Preserve the three-layer information hierarchy: course context → subtitle list → event action panel.

### Student Utility and B2B2C Boundary — 2026-08-11

- Record a productized student-tool direction: manual phrase-range replay, keyboard shortcuts, bookmarks, review notebooks, personal study plans, and optional badges.
- Separate student-owned learning history from teacher-facing evidence; teacher reports only receive explicitly submitted or course-generated evidence.
- Confirm the commercial boundary: student utility remains free, while teachers pay for course authoring, publishing, classroom events, reports, and constrained AI templates.
- Reject dark-pattern lock-in as a product strategy; retention should come from accumulated learning value and a shared cross-course tool.

### Subtitle Timeline Teacher Workspace — 2026-08-11

- Redesign the teacher surface around the actual workflow: choose a recorded video, import timestamped subtitles, and turn them into a course timeline.
- Replace the generic fixed-node editor as the primary story with subtitle paragraphs and four configurable event families: attention burst, teacher voice, interaction activity, and constrained AI template.
- Add a clickable timeline prototype with caption selection, event detail editing, teacher-voice insertion, and honest local-demo states.
- Record the subtitle pipeline decision and open-source evaluation in `doc/subtitle-pipeline.md`.
- Keep video understanding, remote upload, speech recording, extension bridge, and AI generation out of this slice.

### Teacher Web Prototype — 2026-08-11

- Add a zero-dependency `teacher-web/` high-fidelity prototype for the D0 teacher home and restricted node editor.
- Show the two intended teacher scenes: experience the finished lesson, then edit a fixed node template and preview it.
- Add prototype interactions for node switching, type-specific fields, enabled state, dirty state, reset, save, and save-and-preview feedback.
- Keep the extension bridge, local storage, and real Bilibili preview explicitly marked as the next implementation slice.
- Verify desktop and 375px mobile layouts in the in-app browser with no console errors; existing demo and subtitle regression tests pass.

### Doc Sync for Cross-Machine D0 Continuity — 2026-08-11

- Raise requirements to v0.5 with a locked-decision summary covering B2B2C positioning, student-scope freeze, teacher demo shape, D0/D1 milestones, promo video, platform expansion, and AI billing consistency.
- Rewrite `next.md` as an actionable D0 checklist for continuing development on another machine after the technical spike.
- Record the approved expansion order: Bilibili through D1, YouTube as the second `PlayerAdapter` after D1, multilingual and multi-region fully deferred with no locale/region schema work now.
- Keep only the `VideoRef` / `PlayerAdapter` structural boundary in design and platform docs.
- Synchronize teacher-demo, student-runtime, multi-creator plan, development plan, lessons, promo-video references, README, and changelog with the same decisions.

### Teacher Demo Design — 2026-08-11

- Add `doc/teacher-demo.md` as the single entry point for the teacher-facing demonstration.
- Define two consecutive scenes: experience the finished lesson, then modify the fixed template and preview the change.
- Choose a localhost teacher website opened from the extension, while keeping D0 free of accounts, remote backend, and extension reinstallation.
- Define an allowlisted, versioned website-to-extension bridge with double schema validation and five fixed operations.
- Reserve future website modules for auth, lessons, licenses, billing, AI credits, and reports without creating premature APIs or tables.
- Limit editing to three fixed nodes and their authored fields; defer node creation, deletion, sorting, type switching, and multi-video management.
- Split delivery into D0 configurable interaction and D1 complete sales demo, without presenting D0 as AI-complete.
- Resolve preview behavior: every save-and-preview action creates an isolated preview session.
- Add `doc/promo-video.md` with the approved 60–90 second screen-recording script, shot list, claims boundary, and real-course submission call to action.
- Delay public promotion editing until D1 so AI feedback and reports are recorded from verified behavior rather than simulated.
- Lock platform expansion: Bilibili only through D1, YouTube as the next player adapter after D1, and no multilingual or multi-region work in the current phase.
- Keep the Bilibili player adapter isolated so a later YouTube adapter does not rewrite activity cards or session logic.
- Synchronize requirements, design, development plan, next step, and README with the approved teacher-demo boundary.

### Student Runtime Summary — 2026-08-11

- Add `doc/student-runtime.md` as the single entry point for student-side scope before teacher-platform design begins.
- Separate teacher-configured content components from learner-owned study tools, a category that was missing from the earlier component-family list.
- Rank learner tool candidates by whether they produce learning evidence, since that is what teachers actually buy.
- Record why consumer-app retention mechanics transfer poorly to a B2B2C product, to pre-empt copying streaks and leaderboards.
- Add a three-question framework and a priority order for competitor research, so the output is a decision rather than a feature list.
- Define what freezing the student scope does and does not cover.
- Audit the summary against the full decision history and separate current Demo requirements, P2 productization decisions, and research candidates.
- Correct the first-phase boundary: network authorization, remote updates, and report delivery remain P2 rather than joining the local Demo.
- Correct implementation status: activity cards and the reusable timed-node engine are specified but not yet implemented.
- Add the omitted productized learner flow: multi-teacher authorization, indexed delivery, version locking, AI credit types, honest degradation, evidence ownership, and compatibility behavior.
- Freeze the first-phase student scope without making future competitor research a blocker for teacher-platform design.
- Add the implemented timed overlay to `doc/design.md` and reconcile stale role, billing, index, and authorization language in the platform plan.
- Fix the commercial position as small-B-first B2B2C: reserve shared learner capabilities without opening a separate consumer free/Pro product line.
- Separate platform telemetry from teacher-facing learning evidence and adopt staged collection: local voluntary export first, consented anonymous events during productized trials, identity only when later features require it.
- Define a minimal lesson-only event vocabulary and explicitly forbid collecting unrelated viewing history or raw answers in generic analytics.

### Requirements v0.4 — Subtitle Blocker Definition — 2026-08-11

- Add S09 to the P0 function table and write its full definition from the shipped behavior in `src/content/subtitle/`.
- Record the half-open time range, first-match-wins overlap rule, invalid-layout fallback, and teardown requirements.
- Move teacher-side editing of blocker ranges to P1, since the first version only supports editing the config file.
- Inventory the component families in `doc/multi-creator-platform.md` 1.5 and show that most candidate features are attribute differences, not new components.

### Multi-Creator Platform Plan — 2026-08-11

- Add `doc/multi-creator-platform.md` describing how one learner receives customized content from multiple creators.
- Choose server-indexed lesson-pack ownership over page-derived creator identity, and fetch-with-cache over push updates on MV3.
- Define draft/published separation, session-level version locking, and silent degradation when the network fails.
- Record feature tiers, pricing options, deployment shape, open decisions, and unverified technical facts.
- Split video ownership from lesson authorship so one video can carry several interpretations, with self-authored packs as the `ownerId == authorId` special case.
- Add a local video index ahead of the cache and network layers so videos without a lesson pack never reach the server.
- Add revocation behavior, owner takedown control, revenue-split stance, and the limits of selling overlay rights.
- Add the license-code design: exchange a one-time code for an install-bound token instead of validating a static code per request.
- Rule out local content encryption, obfuscation, and self-built DRM as ineffective, and record the four lightweight anti-leak measures used instead.
- Judge identity binding by whether the server can verify it, and reject reading the Chrome account email as an unverifiable client self-report.
- Prefer teacher-issued per-student codes so the platform never stores learner personal data, and require a rebinding path before any anti-sharing measure ships.
- Support several concurrent creator authorizations per learner, keep tokens hidden from the learner, and send only the token for the current video.
- Separate "silent, not our video" from "expired authorization", which must be stated explicitly instead of looking like a failure.
- Require every session to record the pack, author, and version it used so reports reach the correct teacher.
- Add a performance section: the multi-creator fetch path is cheap, but injection into every Bilibili video page, the high-frequency time watcher, and unbounded local storage are the real risks.
- List the performance items that still need measurement, since no baseline exists yet.
- Establish that lesson packs carry data only while the extension owns all behavior, so every creator shares one component implementation.
- Close the component type set to the platform and forbid custom markup, styles, or scripts in lesson packs at any price point.
- Define the downgrade path for unknown node types on older extension versions, which must never be recorded as completed or learner-skipped.
- Group student-side capabilities into local, networked, and AI tiers so the cost boundary matches the pricing boundary.
- Tie AI usage to the free-answer node type so a teacher can estimate cost, and require the student summary and teacher report to share one call.
- Keep prompt templates on the server alongside credentials, and check quota before calling the model rather than after.
- Price AI separately with prepaid credit packs, and degrade honestly when credits run out instead of faking personalized feedback.
- Identify and close the missing numbered requirement for the shipped subtitle blocker.
- Settle on teachers paying only a subscription while AI credits belong to the learner and work across every teacher, which removes credit fragmentation once a learner has several courses.
- Reduce the teacher's barrier to zero: no float, no AI cost, no unsold stock, and the AI decision becomes pedagogical rather than financial.
- Introduce a gift-card style credit account code as the lightest learner-level identity, with recovery binding left optional.
- Grant trial credits on first license-code redemption so the existing code mechanism doubles as abuse protection.
- Let teachers optionally buy course-scoped credits so they can advertise included AI feedback, since course pricing power motivates promotion far more than a top-up commission would.
- Order credit spending as trial, then course-scoped, then learner-purchased, so nobody's paid credits are consumed while free ones sit idle.
- Bar teachers from earning on learner top-ups, and keep a first-top-up referral bonus as an unused fallback tied to conversion rather than consumption.
- Call upstream models through a compatibility layer so providers can be switched or priced against each other.
- Keep the teacher-wholesale and bring-your-own-key models as evaluated alternatives, recording why wholesale was superseded and why BYOK stays outside the quality commitment.
- Plan only. Phase 1 scope, P0 requirements, and the current local-only demo are unchanged.

### Subtitle Blocker — 2026-08-11

- Add a timed horizontal bar that covers the subtitle area between 15–20 seconds on the demo video.
- Move subtitle blocker time, size, position, and style into `src/content/config/demo-lesson.js`.
- Add `tests/subtitle-blocker.test.js` for range timing and layout checks.

- Fix demo-only scope so mascot disappears when navigating away on Bilibili SPA pages.
- Match demo video by exact BV id instead of pathname substring.

### Chinese Requirements v0.3 — 2026-08-07

- Rewrite the complete sales-demo requirements in Chinese.
- Add detailed definitions for 13 P0 student, teacher, and data functions.
- Define triggers, inputs, flows, stored data, exceptions, and acceptance criteria for each function.
- Add one end-to-end acceptance script and separate product-completion and commercial-validation standards.
- Clarify that AI failures must not fabricate personalized feedback and keep teacher previews separate from student sessions.

### Product Requirements v0.2 — 2026-08-07

- Reposition the demo around upgrading an existing paid recorded course rather than improving video quality.
- Define a three-node student flow: comprehension choice, recall fill-in, and applied free answer.
- Add minimum teacher-side requirements for node editing, preview, and an evidence-based individual report.
- Replace the general side-panel-first design with a timed interaction engine and shared local session data.

### Bilibili Mascot Controls — 2026-08-07

- Restrict mascot and playback control to demo video `BV1WW4y1e7GL` only.
- Add three mascot controls: pause, seek to 30s, seek to 35s with dialog.
- Auto-show interaction dialog when playback reaches 35 seconds.
- Add `tests/demo-config.test.js` for URL gating checks.

### Bilibili Mascot Spike — 2026-08-07

- Researched open-source Bilibili playback extensions and 2D mascot overlay projects.
- Added technical spike notes in `doc/bili-mascot-spike.md`.
- Scaffolded MV3 extension under `src/` with Bilibili video play/pause control and a canvas-based 2D mascot.

### Project Scaffold — 2026-08-07

- Created independent project structure for the English video course AI assistant Chrome extension.
- Added first requirements document, design note, development plan, lessons, and current next step.
### Teacher Timeline Visual Pass — 2026-08-14

- Rebuild the teacher sales timeline as a media timeline with elapsed/total time, playback progress, a playhead, and minute ticks matched to the real 08:33 source duration.
- Align every classroom node marker to one baseline with stable icon sizing across active and inactive states.
- Remove layout-explainer copy from the sales page and simplify mobile labels to prevent crowding.
- Separate course-video selection from within-video navigation: use a video dropdown for multi-video courses and paginate long timelines in 15-minute segments.
- Keep the current 08:33 sample on one `1 / 1` segment with disabled paging controls, and remove the subtitle-snapping control from the sales example.
- Align the embedded sample player with the selected `06:19` node so the player time, timeline progress, playhead, and inspector all describe the same course state.
- Replace the selected key-node row's left accent line with a full-row soft highlight, subtle outline, and explicit `正在编辑` badge.
- Replace the four generic timeline chapter bands with eight position-aligned node summaries, staggered across two rows and color-matched to each node type.
- Reduce the node inspector's save action to a compact right-aligned primary button instead of a full-width bar.
- Synchronize the workspace design, UI color system, node component mapping, README, and current-step documentation with the approved eight-node teacher sample page.
- Replace the timeline's functional heading with the course name and rename the video selector to lesson-based labels such as `第一节`.
- Move node summaries to alternating positions above and below the timeline, with type-colored connector lines linking every summary to its marker.
- Remove the redundant vertical playhead from node 06; the active state now relies on the shared progress endpoint, filled marker, and selected summary.
- Center the compact save button and define autosave for node creation and edits, with explicit saving, saved, and failure states plus manual retry.
- Add compact timeline boundary markers: `开始 / 结束` for a single segment, with previous/next segment labels defined for paged videos.
- Rename the component-bar heading from `拖入节点` to `交互节点` while keeping drag instructions in the helper text.
- Remove the component-bar drag helper text to keep the editor header compact.
- Resynchronize the workspace design, UI rules, architecture notes, node contract, and current plan with the latest timeline boundaries, connectors, autosave, naming, and compact component-bar decisions.
- Replace the static autosave-success text with a checked-by-default `自动保存` checkbox below the save button; it controls autosave for subsequent node edits.
- Simplify the timeline header controls to only the centered segment label with previous/next paging; remove the duplicated elapsed/total time and zoom minus/plus controls.

### Teacher Sales Page Copy Boundary — 2026-08-14

- Remove Bilibili/player implementation caveats from the teacher-facing sales page.
- Keep the page focused on course design, student effects, and learning outcomes; implementation boundaries remain in internal documentation.
- Replace prototype-only wording around node editing with product-oriented classroom-design language.
### Subtitle-Grounded Teacher Nodes — 2026-08-14

- Read the supplied interview SRT and replace placeholder node content with three real teaching moments at `00:39`, `02:16`, and `05:45`.
- Align each node's title, English classroom copy, student preview, and timeline position with the subtitle meaning.
- Record the remaining source-language caveat: the supplied file is Chinese AI translation, so final English wording needs teacher review before publishing.
