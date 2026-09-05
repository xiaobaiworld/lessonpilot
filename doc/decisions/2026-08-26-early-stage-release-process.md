# D-V1-013：初期开发与运行阶段的发布流程

- 日期：2026-08-26
- 状态：已接受；适用于当前初期开发与运行阶段
- 决策编号：`D-V1-013`
- 替代关系：不废止 `D-V1-007` 的基础设施目标，也不改写冻结的 `OPS-*` 需求条文。本决策是当前阶段的**显式运行约定**。离开初期阶段时必须另写决策，并同步改发布脚本与本文；不得静默加回旧门禁，也不得静默继续用初期流程冒充正式发布。

## 阶段声明

当前系统处于**初期开发与运行**：人少、发布频繁、机器是单节点阿里云 ECS，目标是尽快把已测过的确定版本拷到线上。

后期（更严的生产纪律、规模化、合规审计）**也许会改**。改的时候要：

1. 新写一份已接受决策，写明新阶段名称、生效日期、以及本决策哪些条款被替代；
2. 同步修改 `tools/release.sh` 和部署说明；
3. 更新 `changelog.md`。

在那之前，以本文为发布流程真源。冻结需求里更严的发布门禁视为**后期目标**，不是当前每次发布的执行清单。

## 默认触发约定

项目中说“发布到 GitHub”或“发版”时，默认包含阿里云发布：本机发布前测试通过后，提交并 push 到 GitHub，
再用同一个 commit 执行阿里云发布和线上健康检查。这个约定不需要每次在任务里重复说明。
只有明确说“只推 GitHub”时，才跳过阿里云发布；测试未通过时不能进入发布步骤。

## 版本化（不变）

继续用现有方案，不另起一套版本号：

- Git 标签：`web-prod/<release-id>`
- `release-id` 形态：`<UTC 时间>-<commit 前 12 位>`，例如 `20260826T021037Z-6064e3e8c6c7`
- 仓库记录：`deploy/releases/<release-id>.json`
- 同一次发布的 Web 与 API 使用**同一个** `release-id` 和同一个 Git commit

记录里保留 `gitCommit`、`gitTag`、时间和验证状态。密码、SSH 私钥、Cookie、授权码和环境变量不得写入这些 JSON。

## 当前阶段流程

顺序固定为四步。不要在阿里云上再做一遍本机已经做过的测试，也不要为了「更安全」在发布脚本里叠 CI 等待、远端全量测试、每次新建虚拟环境、备份恢复演练或逐文件 SHA 对账。

### 1. 本机测试

在开发机跑与改动相关的测试和构建，确认能过再继续。常用入口：

```bash
cd v1/backend && uv run pytest
cd ../..
npm test
npm --prefix v1 run type-check
npm --prefix v1 run build
```

本机测试是当前阶段的质量门。GitHub Actions 仍可作参考，**发布不阻塞在 CI 全绿**。

### 2. 提交到 GitHub 并打版本

- 提交并 push 到 GitHub，使线上对应一个完整 commit SHA
- 不发布未 push 的本地脏工作区
- 发布时生成 `release-id`，打 `web-prod/<release-id>` 标签
- 成功后把 `deploy/releases/<release-id>.json` 单独提交进仓库（记录不能改它所记录的那个源码提交）

完成本步骤后，按“默认触发约定”继续执行第 3、4 步，不等待额外的阿里云发布指令。

### 3. 本机构建产物

静态站、教师端、管理端、学生插件 zip 在**本机（或本机对应该 commit 的 worktree）编好**，再上传。阿里云上不再 `npm ci`、不再跑前端测试、不再现场打包插件。

后端是 Python 源码：开发机是 macOS、ECS 是 Linux，**不要拷本机 `.venv`**。拷 `v1/backend` 源码和 lockfile；服务器**复用已有虚拟环境**。只有 `uv.lock` 相对当前线上发生变化时，才在服务器执行一次 `uv sync --frozen`。

### 4. 拷到阿里云并切换

把编好的静态产物和后端源码 copy 到不可变 release 目录，改 `current` 符号链接，必要时重启 `knownmap-teacher-api`、跑已有库上的 Alembic 迁移。唯一入口：

```bash
KNOWNMAP_SSH_HOST=aliyun-us \
  tools/release.sh deploy <git-ref>
```

本机 SSH 别名是 `aliyun-us`（洛杉矶 `us-west-1`）。不要用会走到本机代理假 IP 的 `aliyun`。

```bash
tools/release.sh status
tools/release.sh verify <release-id>
tools/release.sh rollback <release-id>
```

旧的 `tools/teacher-platform-release.sh` 与 `tools/web-release.sh` 已删除，不保留第二入口。

## 当前阶段明确不做

这些曾经写在发布脚本里，**当前阶段视为无效或过重的安全/校验**，发布路径不应依赖它们：

- 等待 GitHub `node-test` / `backend-test` 成功才允许发布
- 强制提交必须已在 `origin/main`（仍要求已 push 到 GitHub，以便追溯）
- 发布脚本再开 worktree 跑一遍全量 pytest / `npm test`（本机构建仍会 `npm ci` 以便编译）
- 每次发布在 ECS 上新建一份完整 Python 虚拟环境并对整棵树 `chmod`
- 每次发布做 SQLite 备份恢复演练（日常 `knownmap-backup.timer` 仍保留）
- 发布过程中逐文件核 SHA、扫私有路径、叠多层生产探针当作门禁

## 当前阶段仍要保留的底线

初期不是「没有安全」，是**不把安全测试堆进发布热路径**：

- SSH 密钥登录；不把生产密码写进 Git、release JSON、命令行参数或长期环境文件
- 生产库与账号 seed 只在首次建库或显式轮换密码时触发
- HTTPS 对外；数据库文件仍只在服务器本机
- 发布失败不把半成品标成 `verified`
- 回滚仍切回上一个已有 `release-id` 目录

## 环境事实（当前）

- 站点：`https://knownmap.com`
- 主机：阿里云 ECS `us-west-1`，SSH 别名 `aliyun-us`
- API：`127.0.0.1:8000`，Nginx 反代 `/api/` 与 `/health`
- 代码 release：`/opt/knownmap/releases/<release-id>/`
- Web release：`/var/www/knownmap/releases/<release-id>/`
- 数据库：`/var/lib/knownmap/knownmap.db`（不随代码发布覆盖）

## 实现

唯一脚本：`tools/release.sh`。旧的 `tools/teacher-platform-release.sh` 与
`tools/web-release.sh` 已删除，不存在兼容入口或第二套流程。
