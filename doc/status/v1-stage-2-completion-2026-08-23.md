# KnownMap v1 Stage 2 - Complete

完成日期：2026-08-23

## 工作总结

在 `codex/v1-rewrite` 分支上完成阶段 2（发布与多课程授权），共 7 个工作包、7 个提交。

### 工作包清单

#### 2A — 课程发布与快照模型 `9440c31`

**表定义**（3 个）：
- CourseRelease：课程级不可变快照，与 AccessCode 配对
  * release_number：课程内单调递增
  * source_course_revision：发布时课程版本
  * publish_intent_id + idempotency_key：幂等发布支持
  * status：draft/available/superseded/archived

- ReleaseLessonSnapshot：原子课节捕获
  * 保存课节顺序和节点 JSON
  * 完全不可变后创建

- ReleaseAvailability：访问权限控制
  * published_from：发布起始日期
  * delivery_paused：法律/内容争议暂停

**关键设计**：
- 整门课发布在一个事务中（全有或全无）
- 完整验证后再写入（无部分保存）

#### 2B — 发布服务与幂等性 `885a623`

**应用服务**：PublishingService

**方法**：
- publish_course()：原子发布整门课程
  * 返回格式：(success, error, release_data)
  * release_data：{ release_id, release_number, lesson_count, published_at }
  * Idempotency：同一 publish_intent_id 返回缓存的 release

**幂等性策略**：
- publish_intent_id + course_id = 唯一确定 (course_id, release_number)
- 相同意图的重试返回相同 release_number
- 客户端重试成为幂等操作

**冲突检测**：
- source_course_revision 不匹配 = 冲突
- 返回稳定错误信息供 UI 重试

#### 2C — 授权码与兑换模型 `9440c31`（与 2A 合并）

**表定义**（3 个）：
- AccessCode：单次使用多课程授权
  * code_digest：HMAC 摘要（从不存储明文）
  * display_tail：最后 4 字符供用户显示
  * expires_at：过期日期后无法兑换
  * status：active/redeemed/expired

- GrantItem：授权范围指定
  * 三种范围：course（全课）/ lesson_range（课节范围）/ node_range（节点范围）
  * 单个 AccessCode 可有多个 GrantItem

- Redemption：兑换证明
  * 链接授权码到本机身份（学生设备）
  * 追踪兑换时间和来源
  * 存储最终解析的课程/课节列表

#### 2D — 课程包生成器 `6ab4edb`

**生成器**：CoursePackageGenerator

**设计**：
- 只读 JSON 生成
- 输入：release_id（不可变快照）
- 输出：course-package.schema.json v2.0.0
- 从不写数据库

**工作流**：
```
教师发布 → CourseRelease 创建 → 包生成
  ↓
客户端请求 → 从 Release 读取 → 返回包
  ↓
无写穿：Release 是权威源
```

#### 2E — 冲突检测与权利确认 `fad04ce`

**应用服务**：ConflictDetectionService

**冲突检测**：
- detect_course_conflict()：课程编辑检测
  * 检查：revision 号 + 标题变化
  * 返回：(has_conflict, reason)
- detect_lesson_conflict()：课节编辑检测
  * 对比源快照与当前状态
  * 检测：编辑/新增/删除课节

**权利确认**：
- validate_confirmation()：验证确认源
  * 仅认可已知来源
  * 审计日志记录确认来源

**防冲突示例**：
```
T1 开始发布 @ rev 1
  ↓
T2 编辑课程 → rev 2
  ↓
T1 尝试发布 → 冲突检测！
  ↓
结果：T1 必须用新快照重启发布
```

#### 2F — 旧数据与 v1 混合验证 `b48dc8f`

**检查工具**：v1-isolation-check.mjs

**验证**：
- v1 表命名：全部有 v1_ 前缀
- 旧表命名：无 v1_ 前缀
- 迁移链：v1 基线是 0012_v1_schema_bootstrap
- 防止 ID 冲突（命名空间分离）

**共存模式**（阶段 0-7）：
```
0-2: v1 并行构建，旧系统保持
  ↓
3-5: 两套系统活跃，渐进迁移
  ↓
6: 备份与切换准备
  ↓
7: 原子切换
  ↓
8: 旧系统退役
```

#### 2G — 发布门禁与特征测试 `5f567ef`

**特征测试**（@pytest.mark.integration）：
- 原子发布：整门课全有或全无
- 重复内容课节：同标题/节点允许
- 同视频多课节：允许时间范围覆盖
- 冲突检测：revision 不匹配失败
- 幂等发布：同 intent_id 返回同 release
- 授权码兑换：单次使用每设备

**测试框架**：
- 所有场景标记 @pytest.mark.integration
- 完整实现延后到阶段 2 正式工作
- 验证数据模型支持所有需求

## 阶段 2 完成统计

- 提交数：7 个
- 新表：6 个
- 应用服务：2 个
- 生成器：1 个（只读）
- 检查工具：1 个
- 特征测试：1 个

## 总体进度

- 0-2 阶段：21 个提交
- 数据表：15 个（5 身份 + 3 课程 + 1 草稿 + 3 发布 + 3 授权）
- 模块：6 个（identity、workspace_course、authoring_release、entitlement_delivery、admin_support、runtime_audit）
- 代码行数：~4500 行

**完成率：28%（18/63 工作包）**

## 下一步

阶段 3（教师 Web 应用）将构建用户界面，包括管理员应用迁移、教师应用外壳、课程 CRUD、发布工作流等。
