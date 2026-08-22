# 06 v1 接口与集成契约设计

文档版本：`1.0.0`

状态：已于 2026-08-22 通过人工审核；本文件把已接受接口需求落为可实现的跨边界契约，不替代业务需求、数据模型或安全运维设计

需求真源：[`../../requirements/v1/README.md`](../../requirements/v1/README.md)

前置设计：[`03-system-architecture.md`](03-system-architecture.md)、[`04-domain-data-model.md`](04-domain-data-model.md)、[`05-data-flow-lifecycle.md`](05-data-flow-lifecycle.md)

## 1. 目的与边界

本文件冻结 KnownMap v1 各边界之间“传什么、谁负责校验、失败如何表达、版本如何兼容”的最小契约：

1. Web 应用与 FastAPI 的 HTTP API；
2. 插件页面、后台和内容脚本之间的内部消息；
3. 兑换服务与插件之间的课程发布包；
4. 教师字幕和课程导入/导出文件；
5. 插件与哔哩哔哩页面/播放器的宿主适配边界；
6. 公开销售页、飞书表单和人工运营之间的外部集成。

本文件不展开通用密码策略、日志保留、备份、发布命令和页面视觉；这些内容由 08、09、开发规范和交互
设计承接。接口契约不等于数据库模型：外部响应不得直接暴露 SQL 表或服务端内部字段。

## 2. 契约真源与共同规则

### 2.1 真源分工

| 边界 | 机器可检查真源 | 适配层 |
| --- | --- | --- |
| HTTP API | FastAPI/Pydantic 生成的 OpenAPI | TypeScript 客户端、服务端路由和契约测试 |
| 课程包 | 仓库内版本化 JSON Schema | Python 生成/校验层、插件 TypeScript 校验层 |
| 插件消息 | 仓库内版本化 JSON Schema | popup/background/content 的消息适配器 |
| 教师文件 | 版本化 JSON Schema 与字幕格式测试夹具 | 浏览器解析器、导入导出器 |
| 发布清单 | 构建产物清单 Schema | 构建脚本、部署脚本、回滚检查 |

同一字段只能有一个协议真源。数据库迁移、页面表单对象和旧 `course.json` 不能直接充当公开契约。

### 2.2 所有契约的共同约束

- 顶层包含协议名称和 `schemaVersion`；未知主版本安全拒绝，已知主版本只按明确兼容规则处理；
- 字段默认封闭，禁止客户端向未知字段注入任意对象；
- 身份使用稳定 ID，显示名称只用于展示，不能作为权限或关联主键；
- 时间使用带时区的 ISO 8601，服务端持久化 UTC，过期边界按需求定义为明确的包含/不包含；
- 响应包含 `requestId` 或等价关联标识，错误包含稳定 `errorCode`，不得只返回可变人类文案；
- 请求、响应和日志均执行大小上限、字段白名单和敏感字段脱敏；
- 网络重试不能制造重复业务事实；需要幂等的动作必须携带业务幂等键；
- 认证、授权、完整性和业务状态都由权威一侧重新校验，客户端展示字段不构成授权证明。

## 3. 参与方与信任方向

```text
公开销售页 ──批准的 HTTPS 表单链接──> 飞书公开表单 ──人工读取──> 管理员/运营

教师 Web ──教师会话 HTTP──> FastAPI ──事务──> SQLite

插件 popup/content ──版本化内部消息──> 插件 background
                                      ├─HTTPS──> FastAPI 兑换/课程服务
                                      └─本机存储──> Chrome extension storage

插件 content ──最小适配调用──> 当前 B 站主播放器
```

页面、内容脚本、课程包和本机已有存储都是不可信输入；后台服务和 FastAPI 业务层不能因输入来自“自己的
另一个组件”而跳过校验。学生插件不携带教师会话，也不通过授权码获得工作空间成员身份。

## 4. HTTP API 契约

### 4.1 统一请求/响应信封

业务请求的协议字段由 API 具体模型定义，统一元数据至少包括：

```json
{
  "requestId": "req-uuid",
  "schemaVersion": 1,
  "data": {}
}
```

错误响应使用同样的关联标识：

```json
{
  "requestId": "req-uuid",
  "schemaVersion": 1,
  "error": {
    "errorCode": "GRANT_CODE_INVALID",
    "retryable": false,
    "messageKey": "grant.code.invalid"
  }
}
```

`messageKey` 只用于客户端本地化，不把异常堆栈、SQL 信息、授权码摘要、本机身份或内部路径返回给用户。
同一个 `requestId` 不是幂等键；会改变业务状态的请求必须另带 `idempotencyKey`。

### 4.2 Web 业务 API

管理员和教师 API 遵循以下边界：

- 浏览器只提交业务输入，不提交“我是哪个角色/工作空间”的可信声明；
- FastAPI 根据当前会话重算角色、教师身份和工作空间归属；
- 读操作返回当前允许的最小字段；写操作返回新修订、状态和稳定 ID；
- 草稿保存、发布、授权码创建、终止来源等动作分别使用明确操作，不通过一个任意 PATCH 改写多个领域；
- 写请求失败时返回固定错误码和可重试性，原草稿、发布或授权状态保持不变。

最小公共错误码集合：

| 错误码 | 语义 | 默认恢复 |
| --- | --- | --- |
| `AUTH_REQUIRED` / `AUTH_ROLE_FORBIDDEN` | 会话缺失或角色不允许 | 重新登录或返回所属页面 |
| `WORKSPACE_SCOPE_FORBIDDEN` | 不属于当前工作空间 | 不重试同一对象，修正来源 |
| `REVISION_CONFLICT` | 草稿修订落后 | 重新读取并人工合并 |
| `RELEASE_NOT_DELIVERABLE` | 发布不可交付或被暂停 | 修正内容/权利状态后重试 |
| `VALIDATION_FAILED` | 输入或结构不符合契约 | 按字段错误修正 |
| `IDEMPOTENCY_REPLAY` | 已有相同业务结果 | 返回原结果或查询当前状态 |
| `TEMPORARY_UNAVAILABLE` | 服务或依赖暂时不可用 | 退避后重试，不改变本机旧状态 |
| `INTERNAL_ERROR` | 未能安全确定结果 | 显示失败，依赖 requestId 排查 |

错误码可以增加，但不能改变既有错误的含义；详细字段错误只在授权用户的业务响应中返回，普通日志记录
固定原因码和关联标识。

### 4.3 首次课程兑换

兑换请求由插件后台发送，示意结构如下：

```json
{
  "schemaVersion": 1,
  "idempotencyKey": "redeem-attempt-uuid",
  "accessCode": "KM-EXAMPLE-ONLY",
  "localIdentityId": "local-id",
  "localProof": "high-entropy-device-proof",
  "client": {
    "extensionVersion": "1.0.0",
    "browserFamily": "chrome"
  }
}
```

原始授权码只在 TLS 请求中短暂出现，服务端不得回显、日志记录或保存。`localIdentityId` 用于建立领取关系；
`localProof` 是当前机器后续更新/重新下载的最小证明，服务端只保存不可反推摘要。丢失本机证明时必须重新
输入仍可领取的授权码，不能用一个可猜测的普通 ID 恢复资格。

成功响应包含安全的兑换引用、学生可读摘要和完整课程包：

```json
{
  "schemaVersion": 1,
  "requestId": "req-uuid",
  "data": {
    "redemption": {
      "sourceRef": "safe-source-reference",
      "status": "accepted"
    },
    "courses": [
      {
        "courseId": "course-uuid",
        "title": "课程名称",
        "releaseId": "release-uuid",
        "releaseNumber": 3,
        "installKind": "new",
        "authorizedScope": {"type": "course"},
        "packageDigest": "sha256:...",
        "package": {}
      }
    ]
  }
}
```

服务端只返回当前机器全部有效来源合并后的允许内容，不接收客户端自选课程 ID 来扩大范围。授权无效、过期、
无可交付发布或跨工作空间时，不返回任何课程正文；响应可以返回稳定错误码和安全的重试建议。

### 4.4 免输授权码的重新下载/更新

更新请求不携带原始授权码，至少包含：

```json
{
  "schemaVersion": 1,
  "idempotencyKey": "update-attempt-uuid",
  "localIdentityId": "local-id",
  "localProof": "high-entropy-device-proof",
  "courseIds": ["course-uuid"],
  "knownReleases": [{"courseId": "course-uuid", "releaseId": "release-uuid"}]
}
```

`courseIds` 和 `knownReleases` 只表达查询意图，不能授予范围。服务端重新计算全部有效资格，返回每门课程的
当前发布版本、范围变化和完整包，或返回 `UP_TO_DATE`。如果某课程不再具备在线资格，响应只说明该课程不能
更新，不删除本机已安装内容。

## 5. 课程发布包契约

### 5.1 包的结构

课程包是 `CourseRelease` 按授权范围形成的只读投影，示意结构如下：

```json
{
  "schemaVersion": 1,
  "packageType": "course-release",
  "courseId": "course-uuid",
  "releaseId": "release-uuid",
  "releaseNumber": 3,
  "title": "课程名称",
  "packageDigest": "sha256:...",
  "authorizedScope": {
    "type": "course",
    "lessonIds": [],
    "nodeIds": []
  },
  "lessons": [
    {
      "lessonId": "lesson-uuid",
      "releaseLessonId": "release-lesson-uuid",
      "order": 1,
      "title": "课节名称",
      "videoRef": {
        "platform": "bilibili",
        "videoId": "BV...",
        "partId": null
      },
      "nodes": []
    }
  ]
}
```

必须保留课程、发布、课节和节点稳定标识及课节显式顺序。内容相同的多个课节也必须作为不同实例返回，不能
通过标题、视频或脚本去重。节点类型、内容、触发规则和运行所需配置遵循 04 的聚合 JSON 契约。

### 5.2 禁止出现在包中的字段

课程包不得包含：密码、会话令牌、授权码原文或摘要、教师私有账号字段、完整字幕文件、学生回答、学生学习
状态、服务端数据库主键以外的内部调试字段、任意 HTML/脚本执行内容和第三方视频文件。

包中允许包含教师确认纳入发布的必要教学语义和节点内容；第三方视频仍由受支持宿主页面播放，插件只保存
精确视频引用。

### 5.3 插件校验最低顺序

插件后台收到包后，必须先在内存或临时区完成：

1. 包大小、JSON 解析和 Schema 校验；
2. `courseId`、`releaseId`、版本和授权范围一致性校验；
3. 课节顺序、课节归属、节点唯一性和节点类型校验；
4. 视频引用格式和允许平台校验；
5. 包摘要/完整性校验；
6. 安装摘要生成和学生确认；
7. 原子写入本机课程库。

任一步失败都不写入当前课程，不覆盖其它课程，也不把错误响应当作空课程安装。

## 6. 插件内部消息契约

### 6.1 消息信封

popup、content script 和 background 之间统一使用：

```json
{
  "schemaVersion": 1,
  "messageId": "msg-uuid",
  "operation": "course.redeem",
  "source": "popup",
  "payload": {}
}
```

响应必须包含原 `messageId`、`operation`、`ok` 和 `data` 或 `error`：

```json
{
  "schemaVersion": 1,
  "messageId": "msg-uuid",
  "operation": "course.redeem",
  "ok": true,
  "data": {}
}
```

接收方只执行白名单操作。空响应、非对象、未知版本、未知操作、旧上下文响应、超时和重复消息均进入可恢
复错误路径；不能直接读取 `result.error` 或把消息数据当作任意存储路径。

### 6.2 最小操作集合

| 操作 | 发起方 | 处理方 | 结果 |
| --- | --- | --- | --- |
| `course.redeem` | popup | background | 兑换摘要和候选课程包 |
| `course.install` | popup | background | 校验并原子安装结果 |
| `course.list` | popup/content | background | 本机课程摘要 |
| `course.update.check` | popup | background | 当前资格和版本差异 |
| `course.update.apply` | popup | background | 学生确认后的原子更新 |
| `learning.load` | content | background | 当前会话锁定的课节/节点 |
| `learning.save` | content | background | 本机学习状态写入结果 |
| `preview.start` | teacher preview | background | 绑定的临时预览会话 |
| `preview.end` | teacher preview | background | 释放预览绑定和临时状态 |

网络访问、本机持久化和课程包安装只能由 background 执行。content script 不取得服务端凭证，不直接写课程
库；popup 关闭或 background 重启后，未提交的候选结果必须可丢弃或从恢复点继续。

## 7. 教师文件契约

### 7.1 字幕输入

SRT/VTT 是教师浏览器内的输入格式，不是服务端上传接口。解析器须：

- 限制文件大小、编码和总字幕句数；
- 严格解析真实时间戳，保留毫秒精度和句子顺序；
- 对无效、重叠或零时长 cue 返回可解释问题，不静默丢失；
- 不把原始字幕文件、HTML 或脚本发送到网络；
- 只有教师确认纳入节点的最小文本才进入草稿/发布聚合。

### 7.2 课程导入/导出

`TeacherCourseFile` 是版本化、封闭字段、自描述的 JSON 文件。导出只包含课程结构、课节、视频引用、节点教学
语义和来源版本提示；不包含视频文件、完整字幕、凭证、会话、教师页面状态或学生数据。

导入流程必须是“读取 staging → 解析 → Schema/大小/内容安全校验 → 预览 → 教师确认 → 创建新课程/草稿”，
不能覆盖现有对象、改变线上发布、生成授权码或执行文件中的代码。来源 ID 仅作追溯提示，不能直接成为目标主键。

## 8. 哔哩哔哩宿主适配契约

课程运行时只依赖抽象的 `PlayerAdapter` 能力：识别可信主播放器、读取当前播放状态、在节点需要时暂停/恢复、
监听播放器替换和页面生命周期。B 站 DOM 选择器、frame 探测和重绑细节留在适配器内部，不能扩散到课程业务、
课程包或通用节点代码。

适配器必须遵守：

- 只在完整视频引用匹配时激活；
- 同一视频对应多个课节时交给课程/会话选择，不在适配器静默选择；
- 只做课程运行所需的最小暂停/恢复，不改倍速、不阻止跳过、不下载或重新托管视频；
- 播放器重建、单页切换、全屏变化或主播放器不可信时清理旧绑定并安全停止；
- 适配器失败不破坏本机课程库和学习状态。

## 9. 公开表单与外部集成契约

公开销售页只保存经过批准的 HTTPS 飞书/Lark 公开表单地址和人工联系兜底信息。它不读取、缓存、转发或解析
表单正文，不调用内部教师/管理员 API，不把表单提交显示成已开户或已创建课程。

飞书是试用申请正文的权威来源。获准运营人员人工读取最小申请内容，再按管理员流程创建教师和工作空间；
外部表单会话、申请正文和内部教师会话之间不共享令牌。地址不可达、未公开、域名不符或提交结果未知时，页面
必须显示真实失败状态和人工入口。

## 10. 版本、兼容与迁移

### 10.1 版本规则

- 主版本变化表示字段语义、身份或安全边界不兼容；客户端安全拒绝并显示升级提示；
- 次版本增加可选字段时，接收方忽略已声明可忽略字段，发送方不得依赖旧客户端理解它；
- 删除字段、改变单位、改变 ID 语义或把可选字段改为必填必须升级主版本；
- 同一 `releaseId + authorizedScope + packageSchemaVersion` 必须产生语义一致的课程包；
- 协议版本和内容版本分开：插件升级不自动改变已安装课程的 `releaseId`。

### 10.2 当前实现迁移映射

| 当前实现 | v1 契约位置 | 处理方式 |
| --- | --- | --- |
| `POST /api/v1/public/course-download` 只收 `access_code` | 4.3 兑换 API | 保留兼容适配期；新增本机标识、幂等和正式兑换关系 |
| 响应顶层只有 `courses` | 4.1/4.3 结果信封 | 迁移为版本化信封，课程包增加发布身份、范围和摘要 |
| 插件收到后立即写 `studentCourseStore` | 5.3、6.2 | 增加独立校验、学生确认、临时区和原子提交 |
| 后端按课节 `PublishedScript` 组装 | 5.1 | 改由 `CourseRelease + ReleaseLessonSnapshot` 投影，不生成混合发布 |
| popup/content 可能旁路旧消息 | 6.1 | 统一由 background 处理，未知/空响应安全失败 |
| 旧预览桥字段 | `preview.start/end` | 仅在受信任握手和临时会话内兼容，禁止产生学生数据 |

迁移适配器必须能识别旧响应并阻止其绕过 v1 校验。旧课程包不能直接被当作 v1 发布包，除非完成明确的版本
转换、完整性校验和人工/自动迁移验收。

## 11. 需求与旧资料承接

### 11.1 冻结需求承接

本文件主要承接：

- `INT-WEB-*`：角色、工作空间和 HTTP 业务边界；
- `INT-EXT-*`：插件后台、popup、content 和预览消息边界；
- `INT-BILI-*`：视频匹配、播放器最小控制和页面生命周期；
- `INT-PACKAGE-*`：兑换、课程包、版本、校验和原子安装；
- `INT-FILE-*`：字幕及教师课程文件；
- `INT-TRIAL-*`：销售页、飞书公开表单和人工运营；
- `FR-GRANT-*`、`FR-LIB-*`、`FR-PORT-*`、`FR-RUNTIME-*` 及 `DATA-PACKAGE-*`、`DATA-LOCAL-*`。

### 11.2 旧资料承接

| 来源 | 吸收内容 | 不继承内容 |
| --- | --- | --- |
| `SRC-004`、`SRC-025` | 共享契约、双端校验、超时和失败不假成功经验 | 旧网页—本机桥作为生产主路径 |
| `SRC-028`、`SRC-031` | 当前 API、release JSON 和安全禁入事实 | 当前字段直接成为 v1 外部契约 |
| `SRC-033`、`SRC-063` | ZIP、SHA-256、固定提交和回滚证据 | 旧发布目录替代课程级发布包 |
| `SRC-034`、`SRC-049` | 课程校验、一次显示授权码、查询脱敏和失败保护 | 单课程优先级、静默安装、旧两类授权码 |
| `SRC-056`、`SRC-065`、`SRC-071` | 插件消息、课程包、多课程本机库和人工验证经验 | 未执行的公网/真实 Chrome 结论 |

完整来源去向以 [`02-legacy-document-register.md`](02-legacy-document-register.md) 为准。

## 12. 本文件完成条件

本文件通过人工审核前，至少应确认：

1. HTTP、课程包、插件消息、教师文件、宿主适配和外部表单分别有唯一责任方；
2. 首次兑换、免输码更新、学生确认安装和失败恢复的字段边界可直接进入 Schema/OpenAPI；
3. 原始授权码、本机证明、课程正文、学生数据和教师私有数据不会通过接口或日志泄露；
4. 版本兼容、未知字段、未知版本、幂等、超时和旧响应处理均有明确行为；
5. 当前代码的兼容适配点与必须重写的旧行为已经区分；
6. `SRC-*` 承接与 02 的登记一致，且不重复复制通用安全规范。

通过后，下一份文档为 [`07-product-interaction-state.md`](07-product-interaction-state.md)，具体冻结页面职责、
学生兑换/安装确认、教师工作流、学习窗口和交互状态恢复。
