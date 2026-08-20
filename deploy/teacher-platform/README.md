# KnownMap 教师平台生产部署

这套部署把教师工作台和 FastAPI 放到同一台阿里云 ECS：

- 静态工作台：`https://knownmap.com/teacher-web/editor.html`
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

需要从尚未合并的受控发布分支部署时，必须明确写出该远程分支：

```bash
KNOWNMAP_ALLOWED_REMOTE_BRANCH=origin/codex/security-hardening \
  tools/teacher-platform-release.sh deploy <git-ref>
```

该命令要求提交已推送到 GitHub，使用同一个 commit 构建网页和后端，保存网页发布记录，
并将后端代码和按 `uv.lock` 安装的独立虚拟环境放入不可变的
`/opt/knownmap/releases/<release-id>/backend`。回滚会同时恢复代码和依赖。

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

生产边界：

- SSH 仅允许密钥登录；公网只开放 `22/80/443`。
- Nginx 对教师登录和学生课程下载分别限速，超限返回 `429`。
- HSTS、CSP、点击劫持防护、权限策略和 MIME 嗅探防护由 Nginx 统一设置。
- FastAPI 以 `knownmap` 用户运行，systemd 清空 capability 并限制可写目录。
- `uv` 下载固定为仓库声明的版本和 SHA-256；依赖安装必须通过 `uv sync --frozen`。
- 每次部署都会立即执行一次 SQLite 在线备份，并启用每日备份 timer。

常用检查：

```bash
tools/teacher-platform-release.sh status
curl -fsS https://knownmap.com/health
ssh aliyun systemctl status knownmap-backup.timer
```
