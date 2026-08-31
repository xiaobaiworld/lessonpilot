# D-V1-027：正式发布版本与数据连续性基线

- 日期：2026-09-01
- 状态：提议中，待下一次正式发布前冻结
- 决策编号：`D-V1-027`

## 要解决的问题

KnownMap 即将从频繁迭代的初期系统进入需要长期保留业务数据的正式阶段。当前已经存在 Git release-id、插件版本、Alembic
migration head 和契约版本，但它们的职责容易被混成一个“版本号”；生产数据库又独立于代码发布，不能通过删库重建解决不一致。

## 已确认事实

1. Web、API 和插件由同一个已 push 的 Git commit 构建，生产发布用 `web-prod/<release-id>` 和 `deploy/releases/*.json` 追踪。
2. 插件版本真源是 `v1/extension/manifest/targets.ts` 的 `EXTENSION_VERSION`，插件一改就必须升级。
3. 数据库结构真源是 Alembic，生产数据库的 `alembic_version` 必须和已验证 migration 对应。
4. 生产数据库和课程资源不随代码发布覆盖；代码回滚与数据库恢复不是同一个动作。
5. 课程、账号、发布快照、授权、资源和审计数据进入生产后默认需要保留；学生插件本机学习数据仍在服务端备份边界之外。

## 决定

1. 下一次正式发布前建立一个唯一的产品正式版本真源，使用 SemVer；它只表示交付兼容基线，不替代 Git commit、插件版本、数据库 migration 或契约版本。
2. 每次发布记录必须同时保存产品版本、完整 Git commit、插件版本、契约版本、数据库迁移前后 head 和数据快照/备份身份。
3. 数据库只允许执行经过空库和生产副本验证的向前 migration；正式发布前必须有可识别、可核验的数据库和资源快照。
4. 普通发布不得清空、覆盖、重建或静默删除生产业务数据；删除、归档、停用和作废必须由明确业务动作表达。
5. 回滚默认先回滚代码 release；数据库不自动 downgrade。若旧代码不兼容新结构，使用兼容修复或经过演练的数据恢复方案。
6. 正式发布门禁必须能区分“代码已提交”“产物已构建”“已切换生产”“数据已备份”“线上已验证”，不能用其中一个结论冒充其它结论。

## 未决事项与重开条件

以下内容在下一次正式发布前必须补齐，而不是由发布人员临时决定：

- 产品正式版本真源的具体文件和 `tools/release.sh` 读取方式；
- `deploy/releases/*.json` 的版本、迁移和备份字段；
- 生产数据库与课程资源快照的实际备份命令、存储位置、保留期和恢复演练证据；
- 生产副本迁移后的关键数据对账范围；
- 后端运行时 `0.1.0`、契约清单构建版本和正式产品版本之间的展示关系。

如果出现跨大版本数据不兼容、真实用户要求旧版无感升级、学生本机数据必须服务端恢复，或现有聚合 JSON 无法安全迁移，
必须重新审核本决策并另写迁移设计；不能通过改版本号绕过。

## 关联文档

- [`../../docs/RELEASE_VERSION_AND_DATA_CONTINUITY.md`](../../docs/RELEASE_VERSION_AND_DATA_CONTINUITY.md)
- [`2026-08-26-early-stage-release-process.md`](2026-08-26-early-stage-release-process.md)
- [`2026-08-22-v1-data-retention.md`](2026-08-22-v1-data-retention.md)
- [`2026-08-22-v1-data-persistence-strategy.md`](2026-08-22-v1-data-persistence-strategy.md)
- [`2026-08-22-v1-no-legacy-data-migration.md`](2026-08-22-v1-no-legacy-data-migration.md)
