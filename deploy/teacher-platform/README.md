# KnownMap 教师平台生产部署

当前阶段是**初期开发与运行**。发布流程、版本约定和「当前不做哪些校验」以
[`doc/decisions/2026-08-26-early-stage-release-process.md`](../../doc/decisions/2026-08-26-early-stage-release-process.md)
（`D-V1-013`）为准。后期若收紧或换流程，必须另写决策并改脚本，不能只改习惯。

这套部署把教师工作台和 FastAPI 放到同一台阿里云 ECS：

- 教师工作台：`https://knownmap.com/teacher/`
- 管理员工作台：`https://knownmap.com/admin/`
- 学生插件下载：`https://knownmap.com/downloads/student-plugin/knownmapplugin.zip`
- API：`https://knownmap.com/api/v1/`
- API 进程：仅监听服务器本机 `127.0.0.1:8000`
- 数据库：`/var/lib/knownmap/knownmap.db`
- 数据库备份：`/var/backups/knownmap/knownmap-<UTC 时间>.db`，每日执行，保留 14 天
- systemd：`knownmap-teacher-api.service`
- 备份 timer：`knownmap-backup.timer`

初期发布顺序：本机测完 → 提交并 push 到 GitHub → 打 `web-prod/<时间-commit>` 并写入
`deploy/releases/<release-id>.json` → 本机编好静态产物后 copy 到 ECS 并切换。
SSH 使用 `aliyun-us`。唯一入口是 `tools/release.sh`；旧发布脚本已删除。

```bash
KNOWNMAP_SSH_HOST=aliyun-us \
  tools/release.sh deploy <git-ref>
```

同一次发布用同一个 commit 和同一个 release ID。后端源码放到
`/opt/knownmap/releases/<release-id>/v1/backend`；`uv.lock` 未变则复用 `/opt/knownmap/venv`。

生产账号密码不会在普通发布时生成、重置或输出。只有首次建库或明确轮换密码时才设置
`KNOWNMAP_PRODUCTION_TEACHER_PASSWORD`：

```bash
read -r -s KNOWNMAP_PRODUCTION_TEACHER_PASSWORD
export KNOWNMAP_PRODUCTION_TEACHER_PASSWORD
tools/release.sh deploy <git-ref>
unset KNOWNMAP_PRODUCTION_TEACHER_PASSWORD
```

密码通过 SSH 标准输入写入服务器 `/root` 下的 `0600` 临时文件，seed 完成后立即删除；
不会进入命令参数、标准输出、Git、发布记录或长期环境文件。

## 超级管理员

管理员与教师账号完全分离。生产库若已有管理员，发布不会重置密码。
初期脚本不再每次做管理员 bootstrap；缺管理员时在服务器上按下面显式 seed。

```bash
SEED_ADMIN_LOGIN_NAME=admin \
SEED_ADMIN_PASSWORD="$ONE_TIME_ADMIN_PASSWORD" \
SEED_ADMIN_DISPLAY_NAME='KnownMap 管理员' \
  python -m app.seed admin
```

示例值只说明变量形态，不是生产密码。seed 仅创建缺失账号；再次运行不会覆盖已有管理员。
数据库只保存 Argon2 哈希。

生产边界：

- SSH 仅允许密钥登录；公网只开放 `22/80/443`。
- Nginx 对教师登录和学生课程下载分别限速，超限返回 `429`。
- HSTS、CSP、点击劫持防护、权限策略和 MIME 嗅探防护由 Nginx 统一设置。
- FastAPI 以 `knownmap` 用户运行，systemd 清空 capability 并限制可写目录。
- 初期发布不把 GitHub CI、远端全量测试或每次备份恢复演练当作切换门禁；日常备份 timer 仍启用。
- 依赖若需要在服务器安装，使用仓库锁定的 `uv` 与 `uv sync --frozen`；lockfile 未变则复用已有环境。

同一次网页发布从 `v1/extension/` 组装学生插件压缩包。压缩包固定使用
`knownmapplugin.zip`，放在静态发布目录的
`downloads/student-plugin/knownmapplugin.zip`；学生点击插件内的在线更新按钮或销售页链接
下载后，替换本地解压目录，再在 Chrome 扩展管理页手动刷新。

常用检查：

```bash
tools/release.sh status
curl -fsS https://knownmap.com/health
curl -fsS https://knownmap.com/admin/ >/dev/null
curl -sS -o /dev/null -w '%{http_code}\n' https://knownmap.com/api/v1/admin/auth/me
ssh aliyun-us systemctl status knownmap-backup.timer
```

未登录访问管理员会话接口预期返回 `401`。部署后还需人工验证管理员登录、教师列表、创建测试
教师、重置密码和退出；临时密码只在当前页面显示一次，不写入发布记录或日志。
