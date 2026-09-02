# KnownMap 版本治理

## 目标

版本号不是散落在每个源文件里的标签，而是用来回答四个问题：这次发布交付了什么、哪些边界发生了变化、需要做什么审计、出现问题如何恢复。

每个源文件的精确身份由 Git commit 记录；每个可交付组件使用组件版本；API、课程包、插件消息和插件存储使用契约版本；数据库使用 Alembic revision；一次生产发布使用 release-id。它们不能互相替代。

## 当前真源

| 对象 | 真源 |
| --- | --- |
| 产品版本 | 根目录 `VERSION` |
| 组件类别、路径和审计规则 | `versioning/components.json` |
| 变更范围记录 | `versioning/records/*.json` |
| 插件版本 | `v1/extension/manifest/targets.ts` 的 `EXTENSION_VERSION` |
| 契约版本 | `v1/contracts/versions.json` |
| 数据库版本 | `v1/backend/alembic/versions/` 的 Alembic head |
| 代码精确版本 | Git commit SHA |
| 生产版本 | `deploy/releases/<release-id>.json` |

## 代码类别

- `application`：页面、组件、后端用例和业务规则。优先在本层完成小功能。
- `integration`：B 站适配器、插件运行时和外部边界。需要外部行为和失败恢复验证。
- `architecture`：契约、数据库、基础设施、共享模块、模块边界和构建发布链。修改量小也不能按普通页面处理。
- `documentation`：文档和计划，不改变运行时版本。
- `governance`：版本登记和审计工具，只改变开发治理，不改变业务行为。

后端一个业务目录并不意味着里面所有代码都是应用层：`application_service.py` 通常是应用逻辑，`routes.py`、`schemas.py`、`models.py` 和 `repository.py` 属于边界、契约或持久化层，按更高审计等级处理。

## 版本变化规则

- 兼容修复或局部应用改动：产品/组件 `PATCH`。
- 向后兼容的新流程或完整功能：`MINOR`。
- 删除既有能力、改变数据含义、破坏 API 或插件兼容性：`MAJOR`，并必须有迁移和回滚说明。
- 插件只要进入插件包或改变插件行为，就必须升级 `EXTENSION_VERSION`。
- 契约版本只在对应数据形状或兼容边界变化时升级；页面文案不升级契约。
- 数据库不用 SemVer 替代，使用新的 Alembic revision，并遵守 expand → migrate → contract。
- 只改文档或测试，不要求产品/组件版本变化，但仍需通过文档和测试门禁。

## 变更记录

涉及 `versionRequired: true` 的代码改动，必须在同一次变更中增加一个 `versioning/records/*.json`，至少写明：

1. 受影响组件和旧/新版本；
2. 变更类别和最高审计等级；
3. 是否改变兼容性和业务行为；
4. 必须保留的旧能力和明确移除项；
5. 执行的测试、构建、人工验收和未执行项目；
6. 数据迁移、发布和回滚方式。

运行 `npm run check:version` 会检查组件来源、路径分类、审计等级和变更记录是否覆盖受影响组件。

## 审计等级

| 最高等级 | 典型改动 | 必须验证 |
| --- | --- | --- |
| 页面 | 教师端/管理端局部页面 | 相关测试、页面构建、关键交互或截图 |
| 后端模块 | 单个用例或业务规则 | 模块测试、API 集成、权限和失败路径 |
| 插件 | 插件运行时、弹窗、设置或资源 | 插件测试、local/production 构建、最终 ZIP 和关键路径 |
| 共享模块 | shared、公共类型或构建共享入口 | 所有直接消费者、构建和兼容性检查 |
| 契约 | API、课程包、消息、存储 schema | 生产者/消费者、旧版本兼容、支持矩阵和发布闸门 |
| 数据库/生产 | migration、发布脚本、systemd、Nginx | 数据副本迁移、备份恢复、发布切换、健康检查和回滚 |

审计等级由实际触碰的最高边界决定，不由文件数量决定。小功能如果触碰契约或数据库，仍然必须按高等级审计；普通页面功能不得为了“顺手整理”修改架构层。
