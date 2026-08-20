# KnownMap 教师平台当前 API 说明

版本：0.4

更新时间：2026-08-20

状态：当前工作区 API 实现说明；健康检查、教师认证、课程、多课节持久化、脚本草稿、
第一课节兼容发布、授权码、公开单课程下载和 CORS 已实现。插件 `0.9.1` 已接入 v1 公开
下载协议，但当前插件 Base URL 仍固定为本机 `127.0.0.1:8000`。v2 课程包契约已实现，
API 尚未输出；多课节改动尚未部署生产。

## 1. 通用约定

Base path：

```text
/api/v1
```

环境入口：

| 环境 | Base URL |
| --- | --- |
| 本地教师网页 | `http://localhost:8000/api/v1` 或同主机 `127.0.0.1` |
| 生产教师网页和人工 API 探针 | `https://knownmap.com/api/v1` |
| 当前学生插件课程下载 | `http://127.0.0.1:8000/api/v1` |

生产公开下载端点已经验证可用，但当前插件尚未自动选择生产 API。

请求和响应使用 JSON。成功响应统一使用业务数据对象，失败响应统一为：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求未通过校验。",
    "request_id": "uuid"
  }
}
```

服务端不得把内部异常、SQL、路径、密码哈希或授权码摘要返回给客户端。

## 2. 认证端点

### `GET /health`

用途：检查本地 API 服务是否可用。

成功：

```json
{
  "service": "knownmap-teacher-platform",
  "status": "ok",
  "api_version": "v1"
}
```

响应包含 `X-Request-Id`。健康检查会产生运行日志，并写入一条 `health.check` 操作日志。

### `POST /auth/login`

用途：教师测试账号登录。

请求：

```json
{
  "login_name": "teacher-test-01",
  "password": "provided-out-of-band"
}
```

成功：

- HTTP 200；
- 设置 HttpOnly、SameSite 会话 cookie；
- 返回教师公开信息；
- 当前工作空间在课程模块接入后由课程 API 返回。

失败：

- `AUTH_INVALID_CREDENTIALS`；
- 不区分登录名不存在和密码错误；
- 用户可见消息统一为“用户名或密码错误”；
- 失败日志不得记录密码。

### `POST /auth/logout`

用途：销毁当前会话。

成功：

```json
{
  "logged_out": true
}
```

### `GET /auth/me`

用途：恢复教师页面登录态，返回当前教师公开信息。

未登录返回 `AUTH_REQUIRED`。

## 3. 教师课程端点

所有 `/teacher/*` 端点都需要教师会话，并由服务端从会话取得教师和工作空间。

### `GET /teacher/courses`

返回当前教师工作空间的课程摘要。

### `POST /teacher/courses`

请求：

```json
{
  "title": "面试英语第一课",
  "description": "课程描述"
}
```

成功返回课程 ID、标题、状态和时间。

### `GET /teacher/courses/{course_id}`

返回课程、`lessons[]`、当前发布状态和授权码创建入口所需信息。课节按
`sort_order, created_at` 排序。

资源不属于当前教师时统一返回 `RESOURCE_NOT_FOUND`。

### `POST /teacher/courses/{course_id}/publish`

用途：发布当前课程的可下载配置。

前置条件：

- 课程存在且归属于当前教师；
- 至少存在一个课节；当前发布服务选择排序后的第一课节；
- 被选择课节的视频定位合法；
- 被选择课节的草稿通过四种节点 schema；
- 节点数量至少为 1；
- 课程和课节标题非空。

成功返回发布版本、发布时间和完整 `PluginCourseConfig`。响应不返回授权码。

失败：

- `RESOURCE_NOT_FOUND`：课程不存在或不属于当前教师；
- `DRAFT_NOT_READY`：没有课节、没有草稿或草稿节点为空。

## 4. 教师课节和脚本端点

### `POST /teacher/courses/{course_id}/lessons`

请求：

```json
{
  "title": "第一课",
  "video_ref": {
    "platform": "bilibili",
    "video_id": "BV1WW4y1e7GL"
  }
}
```

同一课程可以重复调用创建多个课节。服务端按当前最大 `sort_order + 1` 分配顺序；BVID
错误或课程越权时拒绝，不再返回 `LESSON_LIMIT_REACHED`。

### `GET /teacher/lessons/{lesson_id}`

返回课节基础信息、草稿版本和当前已发布版本摘要。

### `PUT /teacher/lessons/{lesson_id}/draft`

请求：

```json
{
  "schema_version": 1,
  "config": {
    "nodes": []
  }
}
```

成功条件：

- 课节属于当前教师；
- JSON 通过服务端 schema；
- 草稿写入成功；
- 已发布版本不改变。

### `GET /teacher/lessons/{lesson_id}/draft`

返回当前教师可访问课节的最新脚本草稿。没有草稿时返回 `DRAFT_NOT_FOUND`。

响应包含 `schema_version`、`config`、`lesson_id`、`node_count` 和 `updated_at`；不返回数据库内部字段。

## 5. 授权码端点

### `POST /teacher/courses/{course_id}/access-codes`

用途：创建一个绑定课程的短期或长期授权码。请求体可选；缺省保持兼容并创建长期授权码。

```json
{
  "code_type": "short_term"
}
```

前置条件：

- 课程属于当前教师；
- 课程已有已发布配置。

成功响应只返回一次授权码原文：

```json
{
  "access_code": "KM-ABC123-DEF456",
  "course_id": "uuid",
  "course_title": "面试英语第一课",
  "code_type": "short_term",
  "created_at": "2026-08-20T10:00:00Z",
  "expires_at": "2026-08-27T10:00:00Z"
}
```

服务端存储 `code_digest`，不存储 `access_code` 原文。

短期授权码在创建 7 天后失效；长期授权码的 `expires_at` 为 `null`。当前阶段不提供停用、人数限制和领取统计端点。

授权码使用高熵 Base32 随机值，数据库只保存基于服务端 secret 的 HMAC-SHA256 摘要和
末五位提示。授权码原文只在创建响应中出现一次。

### `GET /teacher/courses/{course_id}/access-codes`

用途：读取当前教师所属课程的授权码统计和历史记录。

返回总数、`short_term` / `long_term` 分类计数，以及只包含尾号提示、类型、创建时间、到期时间和状态的记录。不得返回授权码原文或摘要。

## 6. 插件课程下载端点

### `POST /public/course-download`

用途：插件使用授权码获取已发布课程配置。

请求：

```json
{
  "access_code": "KM-ABC123-DEF456"
}
```

成功：

```json
{
  "course": {
    "schemaVersion": 1,
    "courseId": "bilibili:BV1WW4y1e7GL",
    "videoRef": {
      "platform": "bilibili",
      "videoId": "BV1WW4y1e7GL"
    },
    "nodes": [
      {
        "id": "node-1",
        "enabled": true,
        "family": "attention",
        "interaction": "notice",
        "trigger": {
          "kind": "time_cross",
          "timeSeconds": 39,
          "captionId": null
        },
        "display": {
          "title": "回答要具体",
          "body": "用一个真实例子支撑你的回答。"
        },
        "evaluation": null,
        "effects": {
          "pause": true
        }
      }
    ],
    "updatedAt": "2026-08-18T00:00:00.000Z"
  }
}
```

失败：

| 错误码 | HTTP | 语义 |
| --- | ---: | --- |
| `INVALID_ACCESS_CODE` | 401 | 授权码不存在、格式不合法或已经过期 |
| `COURSE_NOT_AVAILABLE` | 404 | 授权码对应课程当前没有可下载的已发布配置 |

下载接口不接收 `course_id` 作为授权依据，不创建学生账号或领取记录。

同一授权码始终读取对应课程的最新发布版本；课程重新发布不需要重新创建授权码。

当前实现没有单独返回 `CONFIG_INVALID` 或 `RATE_LIMITED`。配置合法性由发布前 schema 和适配器保证；限流属于未来公网部署阶段，不得作为当前已实现 API 宣称。

当前响应中的 `course.courseId` 仍由 `platform:videoId` 派生，不等于后端 `Course.id` UUID；
下载响应也只返回一门课程。独立的 v2 JavaScript 契约已经支持 UUID 和 `lessons[]`，但
后端发布/下载、`AccessGrant` 和多范围响应尚未实施。

## 7. API 节点工作单元

| 节点 | 所属模块 | 输入 | 输出 | 失败条件 | 验证 |
| --- | --- | --- | --- | --- | --- |
| `POST /auth/login` | Auth | 登录名、密码 | 会话、教师摘要 | 密码错误、账号停用 | API 集成测试 |
| `GET /teacher/courses` | Course | 教师会话 | 课程摘要列表 | 未登录 | API 集成测试 |
| `POST /teacher/courses` | Course | 课程标题、描述 | 课程 | 空标题、未登录 | 服务/数据库测试 |
| `POST /teacher/courses/{id}/lessons` | Lesson | 标题、BVID | 有序课节 | 越权、BVID 错误 | 服务/数据库/migration 测试 |
| `PUT /teacher/lessons/{id}/draft` | Script | 节点配置 | 草稿摘要 | schema 错误、越权 | schema/服务测试 |
| `POST /teacher/courses/{id}/publish` | Publish | 课程 ID | 课程和课节发布版本 | 无草稿、配置错误 | 事务集成测试 |
| `POST /teacher/courses/{id}/access-codes` | AccessCode | 课程 ID | 一次性授权码 | 未发布、越权 | 安全/服务测试 |
| `GET /teacher/courses/{id}/access-codes` | AccessCode | 课程 ID | 分类统计、脱敏历史 | 越权 | API 集成测试 |
| `POST /public/course-download` | Download | 授权码 | 插件课程配置 | 无效码、未发布 | API/E2E 测试 |

## 8. 文档和联调要求

- FastAPI 自动生成 Swagger/OpenAPI；
- 每个端点同步维护 Pydantic request/response model；
- 前端只使用 API 响应，不读取 SQLite；
- 插件只使用下载响应，不访问教师端 API；
- API 错误码和 `src/shared/course-contract.js` 的节点错误必须在测试中固定；
- Base URL 通过前端和插件配置注入，不写死在业务模块。
- 教师网页已按 origin 选择本地/生产 API；插件 Base URL 当前仍是固定常量，完成公网学生
  闭环前必须补齐环境策略和真实 Chrome 验收。
- 数据字段、当前/目标模型和本地存储结构见 `doc/data-spec.md`。
