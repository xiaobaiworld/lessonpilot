# KnownMap 生产安全审计

审计日期：2026-08-20

生产站点：`https://knownmap.com`

生产发布：`20260820T153701Z-130b5ac22581`

GitHub 提交：`130b5ac225817dcb124bae89257da4efd1444e99`

## 结论

本轮检查覆盖仓库、GitHub Actions、发布脚本、阿里云 ECS、SSH、Nginx、FastAPI、
SQLite、TLS、主机防火墙、Fail2ban、系统更新和生产验证。

发现的高风险发布链路问题已经修复并部署。当前 FastAPI 只监听本机，
生产登录具有限速，密码不会出现在发布参数或输出中，依赖由锁文件固定，
数据库有每日在线备份，生产版本可由 release ID、Git commit 和 Git tag 追溯。

本报告不是专业渗透测试的替代品。尚未解决的风险列在“残余风险与后续动作”。

## 生产边界

- 公网入口仅为 TCP `22`、`80`、`443`。
- FastAPI 以 `knownmap` 用户监听 `127.0.0.1:8000`，不直接暴露公网。
- UFW 默认拒绝入站，只允许 SSH 与 Nginx Full。
- SSH 禁止密码和键盘交互认证，禁用 X11 与 TCP 转发，最大认证次数为 3。
- Nginx 终止 TLS，并向同源 FastAPI 反代 `/health` 与 `/api/`。
- 数据库位于 `/var/lib/knownmap/knownmap.db`。
- 在线备份位于 `/var/backups/knownmap/`，权限 `0600`，每日执行并保留 14 天。

## 已修复发现

| 严重度 | 发现 | 风险 | 修复与验证 |
| --- | --- | --- | --- |
| 高 | 教师生产密码曾进入终端/对话输出 | 凭据可能被日志或历史记录保留 | 已立即轮换；新密码只进入本机剪贴板，未输出；生产登录和会话恢复返回 200 |
| 高 | 登录接口无请求限速，页面预填固定用户名 | 便于撞库和暴力猜测 | 删除预填用户名；Nginx 设置 `5r/m`、`burst=5`；实测第 7 次连续错误请求开始返回 429 |
| 高 | 发布时以 root 执行远程安装脚本 | 上游脚本被篡改会直接取得 root | 固定 `uv 0.11.12` 下载地址和 SHA-256，校验通过后才安装 |
| 高 | 后端依赖由版本范围重新解析 | 同一 Git commit 可能安装不同依赖 | 每个 release 使用独立 `.venv`，执行 `uv sync --frozen --no-dev --no-editable` |
| 高 | 密码曾通过 SSH 参数和标准输出传递 | 可能进入进程列表、Shell 历史或发布日志 | 仅在明确轮换时经 SSH 标准输入写入 root `0600` 临时文件，seed 后删除；普通发布不生成、不重置、不输出密码 |
| 高 | 任意 `origin/*` 分支中的提交可被发布 | 未审查分支可能直接运行测试并以 root 部署 | 默认只允许 `origin/main`；例外必须显式指定；目标提交必须位于允许分支且 GitHub `node-test`、`backend-test` 成功 |
| 中 | Nginx 缺少主要浏览器安全响应头 | 增加点击劫持、资源注入和降级访问风险 | 已启用 HSTS、CSP、X-Frame-Options、Permissions-Policy 与 nosniff；线上响应头已验证 |
| 中 | SQLite 没有生产备份 | 数据误删或迁移失败后恢复能力不足 | 新增 SQLite 在线备份、完整性检查、每日 systemd timer 和 14 天保留；首份备份 `integrity_check=ok` |
| 中 | systemd 服务权限边界较宽 | 服务进程被利用后可访问更多主机资源 | 清空 capability，启用 PrivateDevices、ProtectKernel、RestrictAddressFamilies、RestrictSUIDSGID 等限制 |
| 中 | GitHub Actions 使用浮动主版本标签 | Action 上游标签变动会改变 CI 行为 | 所有 Actions 固定到完整 commit SHA；Dependabot 每周检查 Actions 与 Python 依赖 |
| 中 | 发布配置取自本地工作区 | 未提交配置可能与目标 Git commit 不一致 | systemd、Nginx 和备份文件均从目标提交归档中部署；Nginx 先暂存、验证，失败恢复旧配置 |
| 中 | 旧发布共享 Python 环境，回滚依赖不完整 | 回滚代码后仍可能运行新依赖 | 新 release 自带 `.venv`；旧生产 release 建立兼容链接；回滚前验证 `uvicorn` 可执行 |

## 仓库与供应链检查

- Git 历史未发现 AWS、GitHub、OpenAI、Slack token 或私钥模式。
- GitHub secret scanning 与 push protection 已启用。
- Dependabot security updates 已启用。
- `pip-audit`：未发现已知 Python 依赖漏洞。
- Bandit：`backend/app` 未发现问题。
- GitHub PR #4 的 `node-test` 与 `backend-test` 均通过。
- 发布脚本只接受已经推送、位于允许远程分支、且 CI 成功的精确提交。

## 主机检查

- UFW：active，默认 deny incoming。
- Fail2ban：active，`sshd` jail 正常；审计时累计 3552 次失败、253 次封禁。
- unattended-upgrades：active。
- TLS：只接受 TLS 1.2/1.3；证书覆盖 `knownmap.com` 与 `www.knownmap.com`。
- Certbot timer：active。
- `/etc/knownmap/teacher-platform.env` 为 `root:knownmap`、`0640`。
- 数据目录为 `knownmap` 所有，数据库权限 `0660`。
- `/docs`、`/openapi.json`、`/.git/config`、`/.env`、`/tests/` 均返回 404。
- CORS：恶意来源预检返回 400，`https://knownmap.com` 返回 200。

## 生产验证

- 首页、教师工作台、`/health` 返回 200。
- 当前 release ID、Git commit 和服务器元数据一致。
- 教师账号登录返回 200，`/api/v1/auth/me` 会话恢复返回 200。
- 连续错误登录第 7 次开始返回 429。
- FastAPI 仅监听 `127.0.0.1:8000`。
- `knownmap-teacher-api.service`、`knownmap-backup.timer`、Nginx、Fail2ban、
  unattended-upgrades 均为 active。
- 首份生产备份权限为 `0600`，所有者为 `knownmap:knownmap`，
  `PRAGMA integrity_check` 返回 `ok`。
- Node 自动化测试 298/298 通过。
- FastAPI 测试 40/40 通过，保留 1 条 Starlette 上游弃用警告。
- 候选及生产 Nginx 配置均通过 `nginx -t`。

## 发布事故记录

第一次安全发布尝试 `20260820T153208Z-d89c41b423f6` 在切换服务前停止：
SSH 传输会丢弃空字符串参数，导致“不轮换密码”的空参数没有占位。线上 `current`
保持旧 release，API 与 Nginx 未受影响。

后续提交 `130b5ac` 使用明确占位符，并为早期失败增加旧共享虚拟环境回滚兼容。
CI 重新通过后，生产发布 `20260820T153701Z-130b5ac22581` 成功。

## 残余风险与后续动作

1. **审查 root SSH 公钥。** root 当前保留 3 把授权公钥。确认 Mac、Termius 和当前
   `id_ed25519` 的归属后，删除不再使用的公钥；在确认前不自动移除，避免锁死远程入口。
2. **建立异地备份。** 当前每日备份与数据库位于同一 ECS，只能防误操作，不能防磁盘或
   实例整体丢失。应增加阿里云快照或加密对象存储，并定期做恢复演练。
3. **处理被 hold 的 cloud-init。** 系统将 `cloud-init` 固定在 `23.2.2-8`；
   Ubuntu 仓库提供更新版本。先创建 ECS 快照并确认阿里云镜像兼容，再在维护窗口解除 hold、
   升级并验证网络与 SSH，不在本轮强行越过该保护。
4. **评估 Ubuntu Pro。** 主机未附加 Ubuntu Pro，Universe/Multiverse 有 2 个
   ESM Apps 安全更新不可用；当前涉及系统 Python 的 `pip` 与 `wheel`。
5. **启用主分支保护。** 当前 `main` 未配置必需 PR 和 CI 规则。应在 PR #3/#4 合并后，
   要求 `node-test`、`backend-test` 通过并禁止直接推送。
6. **逐步移除 CSP 的 `unsafe-inline`。** 当前单文件页面仍依赖内联脚本和样式。
   后续可迁移到外部文件或 nonce/hash，再收紧 CSP。
7. **处理测试弃用警告。** Starlette TestClient 提示迁移 `httpx2`，不是当前漏洞，
   但应在依赖升级切片中处理。
