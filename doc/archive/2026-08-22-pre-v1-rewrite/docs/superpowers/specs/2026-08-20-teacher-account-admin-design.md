# 教师账号管理后台设计

状态：已接受，待实现  
日期：2026-08-20  
范围：KnownMap 生产教师平台

## 1. 目标

在现有 `admin.html` 站点入口页上增加一个受超级管理员保护的教师账号管理工作台。未登录时继续显示并保留现有销售首页、教师工作台和服务状态链接；超级管理员登录后，页面切换到教师账号管理界面。

第一版支持：

- 超级管理员登录、退出和会话恢复；
- 创建教师账号；
- 重置教师密码；
- 查询教师账号状态、昵称、创建时间、更新时间和已发布课程数量；
- 执行数据库迁移并通过现有发布脚本部署到远程服务器。

第一版不支持：

- 多级管理员或权限角色；
- 管理员自助创建其他管理员；
- 教师账号删除；
- 教师账号密码查看；
- 课程内容编辑、删除或发布操作；
- 学生账号和学习数据管理。

## 2. 已确认约束

### 2.1 页面入口

`admin.html` 是现有站点入口页，不替换为新的独立入口。原有链接必须继续保留：

- 销售首页 `/`
- 教师工作台 `/teacher-web/editor.html`
- 服务状态 `/health`

未登录访问 `admin.html` 时显示这些入口，并可进入超级管理员登录状态。

### 2.2 权限

教师会话和超级管理员会话完全分开：

- 教师继续使用现有教师 Cookie、教师会话表和教师 API；
- 管理员使用独立 Cookie、独立管理员会话表和管理员 API；
- 教师 Cookie 不能访问管理员 API；
- 未登录和教师登录状态都不能执行教师账号管理操作。

### 2.3 密码

密码字段只保存 Argon2 等慢哈希，不保存可解密密文或明文。

创建教师或重置教师密码时：

1. 后端使用系统安全随机源生成一次性密码；
2. 数据库只写入密码哈希；
3. HTTPS 响应短暂返回一次性密码；
4. 页面只在当前内存中展示，并提供复制操作；
5. 页面不把密码写入 `localStorage`、`sessionStorage`、URL、日志、操作记录、发布记录或 HTML；
6. 页面刷新、关闭或离开管理工作台后不再显示；
7. 后端不提供旧密码查询接口，只能再次重置。

临时密码响应属于明确允许的短暂凭证交付路径。除响应期间外，系统不保存该密码。

### 2.4 超级管理员初始化

新增超级管理员表。首次生产部署时：

- 默认登录名为 `admin`；
- 发布脚本通过环境变量或一次性随机生成值初始化密码；
- 初始密码只在部署命令的终端输出一次，不能写入仓库、发布记录、远程长期环境文件或数据库明文；
- 后续发布不得重置已有管理员密码；
- 如果生产数据库已经有管理员记录，部署脚本只执行迁移，不重新 seed 管理员。

如果首次部署未提供管理员密码，部署脚本可以使用 `openssl rand` 生成一次性初始化密码，并在本次部署结果中输出。密码输出不进入任何 JSON 发布记录。

## 3. 数据模型

### 3.1 `admins`

管理员账号与 `teachers` 分离。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String(36)` | 主键 | UUID |
| `login_name` | `String(80)` | 非空、唯一、索引 | 管理员登录名 |
| `password_hash` | `String(255)` | 非空 | Argon2 密码哈希 |
| `display_name` | `String(120)` | 非空 | 管理员显示名 |
| `status` | `String(20)` | 非空 | 第一版使用 `active` / `disabled` |
| `created_at` | `DateTime` | 非空 | 创建时间 |
| `updated_at` | `DateTime` | 非空 | 更新时间 |

### 3.2 `admin_sessions`

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `String(36)` | 主键 | UUID |
| `admin_id` | `String(36)` | 外键、索引 | 所属管理员 |
| `token_digest` | `String(64)` | 非空、唯一、索引 | HMAC-SHA256 会话摘要 |
| `expires_at` | `DateTime` | 非空 | 过期时间 |
| `revoked_at` | `DateTime` | 可空 | 撤销时间 |
| `created_at` | `DateTime` | 非空 | 创建时间 |

### 3.3 现有 `teachers`

沿用现有教师表，不修改密码存储方式：

- `id`
- `login_name`
- `password_hash`
- `display_name`
- `status`
- `created_at`
- `updated_at`

教师课程数量通过 `workspaces.owner_teacher_id -> courses.workspace_id` 查询。接口统计“已发布课程数量”时只计入 `courses.status = 'published'` 的课程，不把草稿计入发布数。

### 3.4 操作日志

使用现有 `operation_logs` 记录管理员操作，但只记录：

- `actor_type = "admin"`
- 管理员 ID
- 模块、动作、目标教师 ID
- 成功或失败
- 错误代码、请求 ID、耗时

不得记录管理员密码、教师临时密码、教师密码哈希、Cookie、会话 token 或完整请求体。

## 4. 后端架构

新增模块沿用现有 FastAPI 分层：

```text
app/models/admin.py
app/models/admin_session.py
app/repositories/admin_repository.py
app/repositories/admin_session_repository.py
app/services/admin_auth_service.py
app/services/admin_teacher_service.py
app/api/v1/admin_auth.py
app/api/v1/admin_teachers.py
app/schemas/admin.py
app/migrations/versions/0009_admin_auth.py
```

职责边界：

- `admin_auth_service`：密码哈希校验、管理员会话创建/摘要/撤销；
- `admin_teacher_service`：创建教师、生成临时密码、重置密码、课程统计；
- `admin` API：请求校验、权限依赖、响应映射、操作日志；
- repository：数据库读写和聚合查询；
- `admin.py` / `admin_session.py`：SQLAlchemy 模型；
- migration：只负责表结构和索引。

新增 `require_admin` 依赖，从独立的管理员 Cookie 中读取 token，计算摘要，检查会话有效期、撤销状态和管理员 `active` 状态。

## 5. API

管理员 API 前缀为 `/api/v1/admin`。

### 5.1 管理员认证

```text
POST /api/v1/admin/auth/login
POST /api/v1/admin/auth/logout
GET  /api/v1/admin/auth/me
```

登录请求包含：

```json
{
  "login_name": "admin",
  "password": "..."
}
```

成功响应只返回管理员公开信息和会话状态，不返回密码。

### 5.2 教师列表

```text
GET /api/v1/admin/teachers
```

响应中的每个教师项目包含：

```json
{
  "id": "uuid",
  "login_name": "teacher-test-01",
  "display_name": "KnownMap 教师",
  "status": "active",
  "published_course_count": 2,
  "created_at": "2026-08-20T00:00:00Z",
  "updated_at": "2026-08-20T00:00:00Z"
}
```

不得包含 `password_hash` 或其他内部认证字段。

### 5.3 创建教师

```text
POST /api/v1/admin/teachers
```

请求包含登录名和显示名：

```json
{
  "login_name": "teacher-02",
  "display_name": "新教师"
}
```

成功响应返回教师公开信息和一次性密码：

```json
{
  "teacher": {
    "id": "uuid",
    "login_name": "teacher-02",
    "display_name": "新教师",
    "status": "active",
    "published_course_count": 0
  },
  "temporary_password": "one-time-value"
}
```

`temporary_password` 仅用于当前响应，不写入任何持久化数据或日志。

如果登录名已存在，返回统一冲突错误，不覆盖现有账号。

### 5.4 重置教师密码

```text
POST /api/v1/admin/teachers/{teacher_id}/reset-password
```

请求体为空。成功响应返回更新后的教师公开信息和新的一次性密码。旧密码立即失效。

如果教师不存在，返回统一资源不存在错误；如果账号已停用，第一版仍允许管理员重置密码，但不自动恢复账号状态。

## 6. 前端工作台

### 6.1 未登录状态

保留现有 `admin.html` 入口页，继续显示销售首页、教师工作台和服务状态。页面新增一个内部工具入口，文案明确为“教师账号管理”或“管理员登录”，不在公开销售内容中展示教师账号数据。

### 6.2 登录状态

登录成功后，页面切换为管理工作台：

- 顶部显示 KnownMap、当前管理员名和退出按钮；
- 主区域显示教师账号表格；
- 表格显示登录名、昵称、状态、已发布课程数、更新时间；
- 页面提供“新建教师”按钮；
- 每行提供“重置密码”按钮；
- 操作完成后在当前页面显示一次性密码和复制按钮；
- 页面不把一次性密码写入任何浏览器存储；
- 退出后清空内存中的教师列表、临时密码和管理员状态。

### 6.3 操作状态

必须覆盖：

- 登录中；
- 登录失败；
- 教师列表加载中；
- 列表加载失败；
- 创建提交中；
- 创建成功；
- 重置提交中；
- 重置成功；
- 复制成功；
- 未登录或会话过期；
- 重复点击防护。

危险操作使用确认步骤，重置密码按钮需明确说明旧密码会立即失效。

## 7. 部署

更新现有发布链路：

1. `tools/web-release.sh` 将 `teacher-web/admin.html` 和其依赖文件加入 `teacher-platform-v1` 白名单；
2. `tools/teacher-platform-release.sh` 先部署代码和迁移；
3. 远程执行 Alembic migration；
4. 如果数据库不存在管理员记录，初始化 `admin` 管理员；
5. 不修改已经存在的教师密码或管理员密码；
6. 重启 systemd 服务并验证健康检查；
7. 验证 `admin.html` 返回 200；
8. 验证未登录管理员 API 返回 401；
9. 使用首次部署产生的管理员凭证验证登录、教师列表和受保护操作；
10. 发布验证结果不得记录临时密码。

生产环境长期环境文件只保存会话和授权码密钥等运行时 secret，不保存管理员或教师 seed 密码。

## 8. 测试

### 8.1 后端单元测试

- 管理员 seed 幂等，且不保存明文密码；
- 管理员正确密码可以认证，错误密码被拒绝；
- 管理员会话只保存 token 摘要；
- 临时密码生成满足长度和随机性要求；
- 创建教师生成工作空间并保存密码哈希；
- 重置密码替换旧哈希；
- 课程统计只计入已发布课程；
- 管理员不能读取教师密码哈希。

### 8.2 后端集成测试

- 管理员登录、会话恢复和退出；
- 未登录访问管理员 API 返回 `AUTH_REQUIRED`；
- 教师会话不能访问管理员 API；
- 创建教师返回一次性密码但响应外的日志和操作记录不包含密码；
- 重置密码后旧密码不能登录，新密码可以登录；
- 重复登录名返回冲突；
- 管理员列表返回课程数量和公开字段。

### 8.3 前端测试

- 现有三个入口仍然存在；
- 未登录时管理数据不显示；
- 登录成功后切换到工作台；
- 创建和重置成功后显示一次性密码；
- 刷新或退出后临时密码被清空；
- 管理操作重复提交被锁定；
- 小屏页面无横向溢出。

### 8.4 发布验证

- 运行现有 Node 和 FastAPI 测试；
- 运行 Alembic migration；
- 运行 shell 语法检查；
- 运行发布构建白名单检查；
- 远程健康检查、管理员页面检查和管理员 API 权限检查；
- 不在测试输出、发布记录或文档中写入任何真实密码。

## 9. 后续可重开条件

以下需求出现时再扩展设计：

- 需要多个管理员或不同权限；
- 需要管理员修改自己的密码；
- 需要停用、恢复或删除教师账号；
- 需要查看完整操作审计；
- 需要给教师增加邮箱、手机号或批次字段；
- 需要把管理员后台拆成独立域名或独立服务。
