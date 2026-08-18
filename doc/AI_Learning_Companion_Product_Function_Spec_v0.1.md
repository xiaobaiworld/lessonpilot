# AI Learning Companion 产品功能说明 v0.1

> 文档用途：交给后续 Agent、产品设计人员和开发人员继续设计与实现。
>
> 版本日期：2026-08-18
>
> 当前主线：把已完成第一阶段的 B 站 Chrome 插件，与教师后台、学生身份、课程授权和学习数据连接起来。

---

## 1. 文档目标

v0.1 需要形成以下闭环：

```text
教师创建课程与互动脚本
→ 绑定 B 站视频
→ 创建授权码
→ 学生通过插件领取授权
→ 插件加载对应互动脚本
→ 学生观看、回答和回看
→ 学习记录上传后台
→ 教师查看学生进度与作答结果
```

本文件同时规定：

1. 当前必须完成的功能。
2. 后续功能需要预留的数据结构和接口。
3. 暂缓开发的功能。
4. 交给其他 Agent 时必须遵守的业务规则。
5. 各模块的建议开发顺序和验收标准。

---

## 2. 当前状态

根据项目当前进展：

- B 站 Chrome 插件第一阶段功能已经基本完成。
- 插件已经围绕视频播放和互动节点开展开发。
- 下一阶段重点是后端连接、学生身份、课程授权、学习记录和教师后台。
- 现有插件的真实代码能力需要后续开发 Agent 在仓库中确认，不应仅依据本文件重新实现已有功能。

后续 Agent 开始开发前，需要先完成：

1. 检查当前插件代码结构。
2. 列出已实现和未实现功能。
3. 确认 Manifest 版本、B 站视频识别方式、互动脚本格式和本地存储方式。
4. 尽量复用现有代码。
5. 对接口和数据结构不一致的部分提出迁移方案。

---

## 3. v0.1 产品边界

### 3.1 当前需要实现

- 教师工作空间基础模型
- 教师账号
- 学生 Learning Identity
- 插件临时身份
- Google 登录绑定
- 课程、课节和 B 站视频绑定
- 互动脚本发布与加载
- 授权码创建、领取和撤销
- 一个学生领取多个授权码
- 一个授权码允许一个或多个学生领取
- 学生最终课程权限计算
- 插件上传学习进度和作答记录
- 教师查看学生学习情况
- 基础操作日志

### 3.2 只做结构预留，暂缓完整开发

- 教师助手账号
- 细粒度角色权限
- 课程合集
- 教师全部课程通行证
- 外部系统 API
- Webhook
- 外部订单编号关联
- 匿名身份与正式账号合并
- 多设备同步冲突处理
- 条件学习节点
- 跨视频复习
- AI 动态生成练习

其中教师助手、教师通行证、外部接口属于确定的后续方向。v0.1 数据模型必须允许未来扩展。

### 3.3 当前明确暂缓

- 学生向教师付款
- 平台收款
- 分账与提现
- 退款
- 发票
- 价格和优惠系统
- 复杂班级管理
- 多学校和多机构体系
- 手机端
- 多视频平台同时适配
- 完整知识图谱
- 动态个性化学习路径

---

## 4. 核心设计原则

### 4.1 Learning Identity 是长期身份

系统内部使用稳定的 `user_id` 或 `learner_id` 保存学习记录。

以下对象都只是身份入口：

- Google 账号
- 系统用户名
- 插件设备 ID
- 授权码
- 未来的手机号、邮箱、学校账号和企业账号

推荐关系：

```text
Google Account
System Username
Device Identity
Anonymous Identity
        ↓
Internal User ID
        ↓
Learning Identity
        ↓
Learning Profile
```

授权码负责产生课程权限。学习记录归属于 Learning Identity。

### 4.2 课程归属于教师工作空间

课程、学生、授权码和学习数据归属于 `Workspace`。

```text
Teacher Workspace
├── Owner
├── Members
├── Courses
├── Students
├── Access Codes
├── Learning Records
└── Audit Logs
```

教师本人是 Workspace Owner。后续教师助手通过独立账号加入同一个工作空间。

### 4.3 授权码和课程权限分开

授权码是权限来源。学生当前可访问哪些课程，由所有有效授权合并计算。

```text
Access Code
→ Redemption
→ Grant
→ Effective Entitlement
```

### 4.4 一个学生可以拥有多个授权码

这是强制业务规则：

```text
一个学生
→ 多条 Redemption
→ 多条 Grant
→ 合并形成最终课程权限
```

同一个学生可以同时拥有：

- 某个课节的授权码
- 一门课程的授权码
- 一个课程合集的授权码
- 某位教师全部课程的通行证
- 来自不同教师的授权码

### 4.5 一个授权码可以有多个领取者

授权码需要支持：

- 仅一人领取
- 限定人数领取
- 不限人数领取

领取人数由 `seat_limit` 控制。单人授权码表示最多绑定一个 Learning Identity，不要求教师提前知道学生用户名。

### 4.6 撤销后必须重新计算权限

同一课程可能来自多个授权码。撤销其中一条 Grant 时：

```text
撤销指定 Grant
→ 查询该学生的全部有效 Grant
→ 重新计算 Effective Entitlement
→ 仍有其他有效来源时继续开放
→ 所有授权来源失效后关闭课程
```

禁止因为撤销一条授权记录而直接删除学生的课程权限。

### 4.7 支付系统保持外部化

前期系统只接收外部业务系统的授权结果。

```text
外部系统完成交易或审批
→ 调用授权接口或人工创建授权码
→ 本系统发放课程权限
```

v0.1 不处理资金。

---

## 5. 用户和角色

### 5.1 系统管理员

后续职责：

- 管理系统用户
- 管理教师资格
- 冻结或恢复账号
- 查看异常记录
- 处理工作空间归属问题

v0.1 可以只保留数据库角色和后台接口，不要求完成完整管理界面。

### 5.2 教师所有者

v0.1 权限：

- 创建和管理教师工作空间
- 创建、编辑和发布课程
- 绑定 B 站视频
- 创建、查看、停用授权码
- 查看学生及其授权记录
- 查看学习进度和作答结果
- 查看基础操作日志

### 5.3 教师助手

后续确定功能：

- 上传和编辑课程
- 审核互动节点
- 发布课节
- 管理普通授权码
- 管理学生
- 查看学习数据
- 回复学生消息

v0.1 要求：

- 预留 `WorkspaceMember`、`Role`、`Permission`。
- 所有课程和授权码绑定 Workspace，不能只绑定教师个人账号。
- 所有关键记录保留 `created_by` 和 `updated_by`。

### 5.4 学生

学生可以：

- 通过插件生成临时身份
- 使用 Google 登录
- 输入一个或多个授权码
- 查看已经获得的课程
- 在 B 站视频中运行互动课程
- 保存观看进度和作答记录
- 后续把匿名记录合并到正式账号

---

## 6. 学生身份设计

### 6.1 支持的身份状态

|状态|说明|
|---|---|
|临时学生|插件自动生成设备身份，学生尚未登录|
|匿名学生|已领取授权码，拥有后台 Learner ID，但没有正式登录方式|
|Google 登录学生|Google 外部身份绑定内部 User ID|
|系统账号学生|后续拥有用户名、邮箱或手机号|

### 6.2 推荐流程

#### 流程 A：先使用授权码

```text
安装插件
→ 生成 Device Identity
→ 输入授权码
→ 后台创建或关联 Learner ID
→ 获得课程权限
→ 开始学习
→ 后续绑定 Google 账号
```

#### 流程 B：先使用 Google 登录

```text
安装插件
→ 用户主动点击 Google 登录
→ 创建或找到内部 User ID
→ 输入一个或多个授权码
→ 获得对应课程权限
→ 跨设备同步学习数据
```

### 6.3 Google 登录规则

- Google 账号作为外部身份提供方。
- 数据库使用内部 `user_id` 作为主键。
- Gmail 地址不能作为数据库主键。
- 保存 Google 提供的稳定外部账户标识。
- 登录授权必须由学生主动触发。
- 插件端令牌只保存在安全存储区域。
- 后端必须验证登录凭证并签发自己的会话令牌。

### 6.4 匿名身份合并

学生匿名学习后绑定 Google 账号，需要迁移：

- 已领取的全部授权码
- 全部 Grant
- 有效课程权限
- 视频观看进度
- 节点作答记录
- 课程完成状态

合并操作需要防止：

- 同一授权码重复领取
- 两个身份的进度相互覆盖
- 已撤销授权重新生效
- 一个单人码被合并到两个正式用户

---

## 7. 课程结构

推荐层级：

```text
Workspace
→ Course
→ Lesson
→ Video Binding
→ Interaction Script Version
→ Interaction Nodes
```

### 7.1 Course

基础字段：

- `course_id`
- `workspace_id`
- `title`
- `description`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### 7.2 Lesson

基础字段：

- `lesson_id`
- `course_id`
- `title`
- `sequence`
- `status`
- `published_at`

### 7.3 B 站视频绑定

基础字段：

- `video_binding_id`
- `lesson_id`
- `platform`
- `bvid`
- `cid`
- `page_number`
- `canonical_url`
- `video_title`
- `duration`

一个 B 站视频可以包含多个分P，需要使用 `bvid + cid` 或等价稳定组合定位。

### 7.4 互动脚本版本

互动脚本需要版本化：

- 草稿版本
- 已发布版本
- 历史版本

学生开始一次学习时，应记录所使用的脚本版本，防止教师修改脚本后历史作答失去对应关系。

### 7.5 互动节点基础字段

- `node_id`
- `script_version_id`
- `trigger_time`
- `node_type`
- `knowledge_point`
- `content`
- `answer_schema`
- `correct_answer`
- `correct_feedback`
- `wrong_feedback`
- `correct_action`
- `wrong_action`
- `sequence`

v0.1 延续现有插件支持的节点类型。若当前代码只支持信息节点和单选题，后端先按照现有能力发布。

---

## 8. 授权码系统

### 8.1 授权范围

|范围类型|说明|v0.1 状态|
|---|---|---|
|Lesson|指定一个或多个课节|实现|
|Course|指定一门课程|实现|
|Course Set|指定课程合集|预留|
|Workspace Pass|教师当前全部课程|预留|
|Future Workspace Pass|教师当前及未来课程|预留|

### 8.2 领取规则

教师创建授权码时设置：

- 授权范围
- 可领取人数
- 每个学生可领取次数
- 生效时间
- 到期时间
- 领取后授权期限
- 是否允许匿名领取
- 是否自动加入教师学生列表
- 是否需要教师审批
- 外部来源
- 外部订单编号

v0.1 最低实现项：

- 课节码
- 整课码
- 单人领取
- 限定人数领取
- 生效时间
- 到期时间
- 手动停用

### 8.3 授权码状态

- Draft
- Active
- Paused
- Exhausted
- Expired
- Revoked

### 8.4 学生领取过程

```text
学生输入授权码
→ 标准化字符和大小写
→ 检查授权码状态
→ 检查时间范围
→ 检查剩余名额
→ 检查当前学生是否已经领取
→ 创建 Redemption
→ 创建 Grant
→ 重新计算 Entitlement
→ 返回新增权限和当前全部权限
```

### 8.5 重复领取规则

- 同一学生重复输入同一授权码时返回原有领取结果。
- 接口必须支持幂等处理。
- 同一学生可以领取不同授权码。
- 不同授权码可以授权同一门课程。
- 相同课程的多个有效 Grant 同时保留来源记录。
- 到期时间按照全部有效 Grant 计算。
- 永久 Grant 存在时课程继续有效。

### 8.6 教师后台授权码页面

显示：

- 授权码
- 授权范围
- 可领取人数
- 已领取人数
- 生效和到期时间
- 状态
- 创建人
- 外部来源
- 领取记录

支持：

- 创建
- 复制
- 暂停
- 恢复
- 作废
- 延长有效期
- 查看领取者
- 查看由该码产生的课程权限

---

## 9. 插件与后端连接

### 9.1 插件职责

- 识别当前 B 站视频和分P
- 获取当前学生会话或临时身份
- 查询当前视频是否存在互动课程
- 查询学生是否拥有访问权限
- 下载已发布的互动脚本
- 按时间触发互动节点
- 记录观看、回答、回看和完成状态
- 缓存网络失败期间的数据
- 恢复连接后上传

### 9.2 后端职责

- 验证身份
- 验证课程权限
- 根据 `bvid + cid` 定位课节
- 返回正确的已发布脚本版本
- 保存学习事件和最终进度
- 为教师端聚合学生数据
- 防止学生越权读取其他课程脚本

### 9.3 插件加载流程

```text
打开 B 站视频
→ 插件取得 bvid、cid 和当前时间
→ 读取本地会话令牌
→ 请求视频课程信息
→ 后端检查身份和权限
→ 返回课程、课节、脚本版本和历史进度
→ 插件启动互动执行器
```

### 9.4 学习事件

建议记录：

- `video_opened`
- `video_started`
- `video_paused`
- `video_seeked`
- `node_triggered`
- `answer_submitted`
- `answer_correct`
- `answer_wrong`
- `segment_replayed`
- `lesson_completed`

v0.1 可以同时保存原始事件和聚合结果。原始事件便于后续重新计算分析指标。

### 9.5 作答记录示例

```json
{
  "learner_id": "usr_1024",
  "course_id": "course_203",
  "lesson_id": "lesson_04",
  "video_binding_id": "video_11",
  "script_version_id": "script_v3",
  "node_id": "node_18",
  "answer": "B",
  "result": "wrong",
  "attempt": 1,
  "video_time": 325.4,
  "device_id": "device_81",
  "occurred_at": "2026-08-18T03:15:00Z"
}
```

---

## 10. 教师后台 v0.1

### 10.1 首页

最低展示：

- 课程数量
- 已发布课节数量
- 学生数量
- 最近领取授权码的学生
- 最近学习活动

### 10.2 课程管理

支持：

- 创建课程
- 创建课节
- 绑定 B 站视频
- 上传或编辑互动脚本
- 发布脚本版本
- 查看学生模式预览

### 10.3 学生管理

学生列表显示：

- 学生显示名称
- 学生身份状态
- 已获得课程数量
- 授权码数量
- 最近学习时间
- 当前学习进度

学生详情显示：

- 全部授权码领取记录
- 每个授权码产生的 Grant
- 当前有效课程权限
- 课程进度
- 节点作答记录
- 错题和回看情况

### 10.4 学习数据

v0.1 只需要基础数据：

- 是否开始课程
- 视频观看进度
- 已触发节点数
- 已回答节点数
- 正确和错误次数
- 课程是否完成
- 最后学习时间

复杂统计、知识掌握度和学习效果分析后续开发。

---

## 11. 教师助手和权限预留

### 11.1 基础角色

|角色|后续权限方向|
|---|---|
|Owner|工作空间全部权限|
|Course Editor|编辑课程和互动脚本|
|Teaching Assistant|查看学生、批改和反馈|
|Operations Assistant|管理授权码、学生加入和消息|
|Data Viewer|只查看和导出数据|

### 11.2 权限范围

未来需要支持：

- 整个工作空间
- 指定课程合集
- 指定课程
- 指定班级
- 指定学生
- 指定时间段

### 11.3 v0.1 数据要求

所有重要业务表保留：

- `workspace_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

所有重要操作进入 `AuditLog`。

---

## 12. 外部系统接口预留

### 12.1 后续接口能力

- 创建授权码
- 直接授予课程权限
- 查询权限
- 撤销权限
- 延长权限
- 查询学习进度
- 接收学习事件 Webhook

### 12.2 外部关联字段

v0.1 数据表需要预留：

- `external_source`
- `external_customer_id`
- `external_order_id`
- `external_product_id`
- `external_reference`
- `metadata`

### 12.3 后续 Webhook 事件

- `access_code.created`
- `access_code.redeemed`
- `course.access_granted`
- `course.started`
- `lesson.completed`
- `course.completed`
- `course.access_revoked`

---

## 13. 建议数据模型

### 13.1 身份与工作空间

- `User`
- `ExternalIdentity`
- `DeviceIdentity`
- `LearningIdentity`
- `Workspace`
- `WorkspaceMember`
- `Role`
- `Permission`

### 13.2 课程内容

- `Course`
- `Lesson`
- `VideoBinding`
- `InteractionScript`
- `InteractionScriptVersion`
- `InteractionNode`

### 13.3 授权

- `AccessCode`
- `AccessCodeScope`
- `Redemption`
- `Grant`
- `Entitlement`

### 13.4 学习记录

- `LearningSession`
- `LearningEvent`
- `LessonProgress`
- `NodeAttempt`

### 13.5 系统连接

- `ApiClient`
- `WebhookEndpoint`
- `WebhookDelivery`
- `AuditLog`

### 13.6 关键关系

```text
Workspace 1 ── N Course
Course 1 ── N Lesson
Lesson 1 ── N VideoBinding
Lesson 1 ── N InteractionScriptVersion

LearningIdentity N ── N AccessCode
通过 Redemption 建立关系

Redemption 1 ── N Grant
LearningIdentity 1 ── N Entitlement
Grant N ── N Entitlement Source

LearningIdentity 1 ── N LearningSession
LearningSession 1 ── N LearningEvent
LearningSession 1 ── N NodeAttempt
```

---

## 14. 建议 API v0.1

接口命名可以根据现有技术栈调整，业务语义必须保留。

### 14.1 身份

```text
POST /api/v1/auth/google
POST /api/v1/auth/anonymous
POST /api/v1/auth/merge
GET  /api/v1/me
```

### 14.2 学生授权

```text
POST /api/v1/access-codes/redeem
GET  /api/v1/me/redemptions
GET  /api/v1/me/entitlements
```

### 14.3 插件内容

```text
GET /api/v1/video-courses/bilibili/{bvid}/{cid}
GET /api/v1/lessons/{lesson_id}/runtime
```

### 14.4 学习记录

```text
POST /api/v1/learning/sessions
POST /api/v1/learning/events/batch
POST /api/v1/learning/node-attempts
PUT  /api/v1/learning/lesson-progress/{lesson_id}
```

### 14.5 教师端

```text
POST /api/v1/workspaces/{workspace_id}/courses
POST /api/v1/courses/{course_id}/lessons
POST /api/v1/lessons/{lesson_id}/video-bindings
POST /api/v1/lessons/{lesson_id}/script-versions
POST /api/v1/workspaces/{workspace_id}/access-codes
GET  /api/v1/workspaces/{workspace_id}/students
GET  /api/v1/workspaces/{workspace_id}/students/{learner_id}
```

---

## 15. 安全和一致性要求

- 授权码在数据库中保存哈希或安全等价形式。
- 授权码比较需要标准化大小写和分隔符。
- 领取接口必须幂等。
- 学习事件批量上传需要事件唯一 ID，防止重复写入。
- 后端不能信任插件提交的 `learner_id`，必须从会话令牌推导。
- 后端每次返回互动脚本前检查课程权限。
- 单人码首次领取后锁定 Learning Identity。
- 身份合并必须使用事务。
- 撤销 Grant 后必须重新计算 Entitlement。
- 教师只能查看自己工作空间内的学生和课程。
- 关键操作写入 AuditLog。
- 外部接口后续需要 API Key、签名、幂等键和调用日志。

---

## 16. v0.1 开发任务拆分

### Task A：现有插件审计

输出：

- 当前功能清单
- 当前脚本格式
- 当前存储结构
- 当前 B 站视频定位方式
- 当前播放控制和节点触发方式
- 与本文件之间的差距清单

### Task B：数据模型和迁移

实现：

- User、LearningIdentity、DeviceIdentity
- Workspace、WorkspaceMember
- Course、Lesson、VideoBinding
- ScriptVersion、InteractionNode
- AccessCode、Redemption、Grant、Entitlement
- LearningSession、LearningEvent、NodeAttempt

输出数据库迁移、实体关系说明和种子数据。

### Task C：身份服务

实现：

- 匿名身份创建
- 插件设备绑定
- Google 登录
- 后端会话令牌
- 匿名身份合并的基础接口

### Task D：授权服务

实现：

- 创建课节码和课程码
- 单人和限定人数领取
- 一个学生领取多个授权码
- 幂等领取
- Grant 生成
- Entitlement 计算
- 撤销和重新计算

### Task E：插件后端接入

实现：

- 插件登录状态
- 授权码输入
- 当前课程权限检查
- 按 BVID 和 CID 加载脚本
- 上传学习事件
- 恢复历史进度

### Task F：教师后台基础页面

实现：

- 课程和课节管理
- B 站视频绑定
- 脚本发布
- 授权码管理
- 学生列表
- 学生详情和作答记录

### Task G：端到端测试

覆盖：

- 匿名学生领取单人码
- Google 学生领取多个授权码
- 两个授权码授权同一课程
- 撤销其中一个授权后仍可学习
- 撤销最后一个授权后失去访问权限
- 同一个视频根据权限返回脚本
- 插件上传作答后教师端可见
- 刷新和换设备后的进度恢复

---

## 17. v0.1 验收标准

### 17.1 学生端闭环

1. 学生安装插件。
2. 插件创建临时身份或完成 Google 登录。
3. 学生可以连续领取至少两个不同授权码。
4. 系统正确合并课程权限。
5. 学生打开已授权的 B 站视频时，插件加载正确脚本。
6. 学生完成互动后，数据上传成功。
7. 学生再次打开视频时，恢复历史进度。

### 17.2 教师端闭环

1. 教师创建课程和课节。
2. 教师绑定 B 站视频。
3. 教师发布互动脚本版本。
4. 教师创建课节码和课程码。
5. 教师查看授权码领取记录。
6. 教师查看学生的多个授权来源。
7. 教师查看学生进度和作答结果。

### 17.3 权限一致性

1. 未授权学生不能加载课程脚本。
2. 一个学生可以拥有多个有效授权码。
3. 一个授权码可以按 seat limit 被多个学生领取。
4. 多个授权码授权同一课程时不会创建冲突权限。
5. 撤销单个 Grant 不影响其他有效 Grant。
6. 所有 Grant 失效后课程访问权限立即失效。

---

## 18. 后续版本方向

### v0.2

- 教师助手账号和权限界面
- 课程合集
- 教师全部课程通行证
- 外部授权 API
- Webhook
- 更完整的身份合并
- 多设备同步
- 课程数据分析

### v0.3

- 条件学习节点
- 根据学生状态动态触发互动
- 错题后的变式练习
- 知识点掌握度
- 跨视频和跨课程复习
- Learning Profile

### 长期方向

- AI 动态生成课程和练习
- 音频、PDF、书籍和离线播放器
- 人类助手与 AI 助手共同管理教师工作空间
- Learning Team
- Knowledge OS

---

## 19. 交给后续 Agent 的执行要求

1. 先审计现有代码，再决定新增或修改方案。
2. 不重复实现已经稳定工作的 B 站播放控制功能。
3. 先完成数据模型和 API 合约，再连接教师端与插件端。
4. 所有授权功能按多对多关系设计。
5. 不把授权码直接当作学生主身份。
6. 不把 Gmail 地址直接当作系统主键。
7. 不把课程直接绑定到教师个人账号，课程绑定 Workspace。
8. 不在 v0.1 引入支付、退款和分账。
9. 新功能必须附带迁移、测试和回滚说明。
10. 任何偏离本文件核心业务规则的设计，需要先记录原因和影响。

---

## 20. 当前最优先的下一步

按以下顺序推进：

```text
现有插件代码审计
→ 确定互动脚本现有格式
→ 设计数据库和 API 合约
→ 实现 Learning Identity
→ 实现多个授权码领取与权限计算
→ 插件加载后台脚本并上传记录
→ 教师后台查看学生数据
→ 完成端到端验收
```

第一阶段成功标准：

> 教师能够给学生发放一个或多个授权码，学生通过插件在 B 站学习对应课程，教师能够看到真实的学习过程和作答结果。
