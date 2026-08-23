# 阶段 6D — 生产备份恢复演练留证

日期：2026-08-23

主机：`aliyun-us`（43.110.33.202），生产环境

## 执行方式

把 `deploy/teacher-platform/knownmap-restore-check.py` 传到生产的 `/tmp`，
对真实备份执行恢复演练，跑完即删除。

演练全程只读：把备份复制到临时目录后以 `mode=ro` 打开，从不改动生产库，
也不改动被检查的备份文件。未安装任何东西，未改动服务与配置。

## 结果

### 最新备份

```
备份：/var/backups/knownmap/knownmap-20260822T160640Z.db（233472 字节）
迁移版本：0011_fix_admin_auth_schema
  access_codes: 1     admins: 1        courses: 1
  lessons: 1          published_scripts: 1
  script_drafts: 1    teachers: 1      workspaces: 1

恢复演练通过：结构完整，归属关系一致。   退出码 0
```

### 更早的一份（第 4 新）

```
备份：/var/backups/knownmap/knownmap-20260821T015017Z.db
恢复演练通过：结构完整，归属关系一致。
```

特意验第二份，是为了确认可恢复性不是只属于最新那一份。

## 核对了什么

- `PRAGMA integrity_check` 通过；
- 9 张必需表齐全；
- `alembic_version` 可读且非空，与生产运行的迁移一致；
- 外键归属对账：`workspaces→teachers`、`courses→workspaces`、
  `lessons→courses`、`script_drafts→lessons`、`access_codes→courses`
  全部无孤儿；
- 每个教师恰好一个工作空间。

行数统计看不出断裂的归属——课程指向不存在的工作空间时，数量、字节数和
完整性检查全都正常。这正是演练要覆盖的部分。

## 生产现状（同次只读核对）

| 项 | 值 |
| --- | --- |
| 当前发布 | `20260821T020224Z-97cd83806550` |
| 后端服务 | `knownmap-teacher-api.service` running，`/health` 200 |
| 迁移版本 | `0011_fix_admin_auth_schema`（与本机一致） |
| 备份份数 | 8 |
| 备份定时器 | active |
| `/admin/`、`/teacher/` | 空闲，v1 切换不会覆盖既有路径 |
| `/api/v1/meta/version` | 404 —— 版本探针随本次发布才上线 |
| 备份保留期 | 仍是 14 天 —— 30 天随本次发布生效 |

后两项如实说明：这些改动尚未部署到生产。

## 未完成的部分

- **保留期改为 30 天**：代码已改，需部署后生效；
- **恢复演练接进部署流程**：`install_backup_service` 已改为安装并执行它，
  失败则回滚后端，同样需部署才生效；
- **启动校验（6C）在生产实际生效**：需部署，且生产 `.env` 需满足新规则
  （非占位符、≥32 字符密钥、CORS 不含本机来源、日志非 DEBUG）。

部署本身未执行：用户在本次工作中明确要求「检查只在本机做，部署的事情后面
再完成」。切换会改变 `knownmap.com` 的对外行为，需要明确指示才执行。
