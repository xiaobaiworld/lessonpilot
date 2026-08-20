# KnownMap 教师平台生产部署

这套部署把教师工作台和 FastAPI 放到同一台阿里云 ECS：

- 静态工作台：`https://knownmap.com/teacher-web/editor.html`
- API：`https://knownmap.com/api/v1/`
- API 进程：仅监听服务器本机 `127.0.0.1:8000`
- 数据库：`/var/lib/knownmap/knownmap.db`
- systemd：`knownmap-teacher-api.service`

生产部署使用：

```bash
tools/teacher-platform-release.sh deploy <git-ref>
```

该命令要求提交已推送到 GitHub，使用同一个 commit 构建网页和后端，保存网页发布记录，
并将后端代码放入不可变的 `/opt/knownmap/releases/<release-id>/backend`。

生产账号第一次部署时由脚本创建。密码只在部署命令输出中显示一次，不写入 Git、发布记录
或长期环境文件；后续发布不会重置已有账号。

常用检查：

```bash
tools/teacher-platform-release.sh status
curl -fsS https://knownmap.com/api/v1/health
```

