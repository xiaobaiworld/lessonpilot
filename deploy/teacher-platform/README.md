# KnownMap 教师平台生产部署

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

默认只允许发布 `origin/main` 中、且 GitHub `node-test` 与 `backend-test` 均成功的提交：

```bash
tools/teacher-platform-release.sh deploy <git-ref>
```

当前唯一发布 profile 是 `v1-apps`：

```bash
KNOWNMAP_PUBLISH_PROFILE=v1-apps \
  tools/teacher-platform-release.sh deploy <git-ref>
```

该入口用同一提交和 release ID 发布 FastAPI、执行数据库迁移、备份恢复演练并发布
静态应用；不要直接调用 `web-release.sh deploy` 代替整套生产切换。

需要从尚未合并的受控发布分支部署时，必须明确写出该远程分支：

```bash
KNOWNMAP_ALLOWED_REMOTE_BRANCH=origin/codex/security-hardening \
  tools/teacher-platform-release.sh deploy <git-ref>
```

该命令要求提交已推送到 GitHub，使用同一个 commit 构建网页和后端，保存网页发布记录，
并将后端代码和按 `uv.lock` 安装的独立虚拟环境放入不可变的
`/opt/knownmap/releases/<release-id>/v1/backend`。回滚会同时恢复代码和依赖。

生产账号密码不会在普通发布时生成、重置或输出。只有首次建库或明确轮换密码时才设置
`KNOWNMAP_PRODUCTION_TEACHER_PASSWORD`：

```bash
read -r -s KNOWNMAP_PRODUCTION_TEACHER_PASSWORD
export KNOWNMAP_PRODUCTION_TEACHER_PASSWORD
tools/teacher-platform-release.sh deploy <git-ref>
unset KNOWNMAP_PRODUCTION_TEACHER_PASSWORD
```

密码通过 SSH 标准输入写入服务器 `/root` 下的 `0600` 临时文件，seed 完成后立即删除；
不会进入命令参数、标准输出、Git、发布记录或长期环境文件。

## 超级管理员首次初始化

管理员与教师账号完全分离。首次发布管理员功能时，发布脚本在迁移后检查 `admins`：

- 已存在管理员：只运行 migration，不重置密码、昵称或状态；
- 尚无管理员：使用默认登录名 `admin` 和一次性初始密码执行显式管理员 seed；
- 提供 `KNOWNMAP_PRODUCTION_ADMIN_PASSWORD` 时使用该值；
- 未提供时由本机 `openssl rand` 生成高熵密码，并只在当前部署终端输出一次；
- 初始密码不得进入 Git、release JSON、服务器长期环境文件、命令参数或数据库明文。

可显式提供初始密码：

```bash
read -r -s KNOWNMAP_PRODUCTION_ADMIN_PASSWORD
export KNOWNMAP_PRODUCTION_ADMIN_PASSWORD
tools/teacher-platform-release.sh deploy <git-ref>
unset KNOWNMAP_PRODUCTION_ADMIN_PASSWORD
```

底层 seed 只在明确调用管理员路径时读取临时变量：

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
- `uv` 下载固定为仓库声明的版本和 SHA-256；依赖安装必须通过 `uv sync --frozen`。
- 每次部署都会立即执行一次 SQLite 在线备份，并启用每日备份 timer。

同一次网页发布也会从 `src/` 组装学生插件压缩包。压缩包固定使用
`knownmapplugin.zip`，放在静态发布目录的
`downloads/student-plugin/knownmapplugin.zip`；学生点击插件内的在线更新按钮或销售页链接
下载后，替换本地解压目录，再在 Chrome 扩展管理页手动刷新。

常用检查：

```bash
tools/teacher-platform-release.sh status
curl -fsS https://knownmap.com/health
curl -fsS https://knownmap.com/admin/ >/dev/null
curl -sS -o /dev/null -w '%{http_code}\n' https://knownmap.com/api/v1/admin/auth/me
ssh aliyun systemctl status knownmap-backup.timer
```

未登录访问管理员会话接口预期返回 `401`。部署后还需人工验证管理员登录、教师列表、创建测试
教师、重置密码和退出；临时密码只在当前页面显示一次，不写入发布记录或日志。
