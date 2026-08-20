# KnownMap Web 生产发布可追踪设计

日期：2026-08-18

状态：已实现并完成生产验证

## 目标

当用户说“发布到网站”“发布到 Web 网站”或同义指令时，生产发布必须回答四个问题：

1. 线上正在运行 GitHub 的哪个精确提交；
2. 这次发布包含哪些公开文件；
3. 上一个可回滚版本是什么；
4. 如何查询历史并原子回滚。

## 当前事实

- 生产域名是 `https://knownmap.com`，`www.knownmap.com` 跳转到同一站点；
- 服务器通过本机 SSH 别名 `aliyun` 连接；
- 当前公网首页是 `teacher-web/forsales.html`；
- 静态公网目录允许销售页、教师编辑器及其白名单资源、网页图标和 `robots.txt`；
- 静态公网目录同时允许固定学生插件包
  `downloads/student-plugin/knownmapplugin.zip`；
- FastAPI 由 systemd 在 `127.0.0.1:8000` 运行，Nginx 只代理 `/api/` 和 `/health`；
- 后端源码不进入静态目录，测试、文档、插件源码和仓库元数据不得进入公网目录。

## 发布模型

每次生产发布绑定一个已经推送到 GitHub 的完整 commit SHA。发布工具先从该 SHA 使用
`git archive` 组装白名单文件，不读取未提交的工作区内容。

同一 commit 的 `src/` 会被组装为学生插件 ZIP，解压后第一层直接包含 `manifest.json`。
销售页和插件工具栏首页共用固定 ZIP 地址，学生下载后手动替换解压目录并刷新扩展。

发布目录采用不可变结构：

```text
/var/www/knownmap/releases/<release-id>/
├── public/
├── release.json
└── SHA256SUMS
```

`/var/www/knownmap/current` 只作为指向某个 `public/` 的符号链接。发布和回滚都先创建新
链接，再使用同文件系统重命名完成原子切换。

教师平台后端采用对应的不可变目录：

```text
/opt/knownmap/releases/<release-id>/backend
/opt/knownmap/current -> /opt/knownmap/releases/<release-id>
```

持久化数据库独立存放在 `/var/lib/knownmap/knownmap.db`，不会随代码回滚被替换。

发布 ID 使用 UTC 时间和提交短 SHA：

```text
20260818T153000Z-7cab05f6ff46
```

## 三层记录

### GitHub

成功发布后创建并推送注释标签：

```text
web-prod/<release-id>
```

标签直接指向被部署的源码提交，是 GitHub 上的不可变版本入口。

### 服务器

每个发布目录保存 `release.json` 和 `SHA256SUMS`。此外，
`/var/www/knownmap/release-history.jsonl` 以追加方式记录发布、回滚和失败恢复事件。

### 仓库

成功发布后把同一份 `release.json` 写入：

```text
deploy/releases/<release-id>.json
```

该文件在发布完成后单独提交，因此不会改变它所记录的源码 SHA。

## 门禁与失败恢复

发布前：

- 拉取远端引用，并确认目标提交存在于 GitHub 远端分支历史；
- 从目标提交构建白名单目录；
- 运行销售页发布测试；
- 校验每个文件的 SHA-256。

切换后：

- 检查 `/healthz` 和首页；
- 检查 `/downloads/student-plugin/knownmapplugin.zip` 返回 200；
- 教师平台发布额外检查 `/health`、`/teacher-web/editor.html` 和 FastAPI 服务状态；
- 检查首页内容哈希；
- 检查 `/doc/`、`/src/`、`/tests/`、`/.git/config` 和 `/.env` 返回 404；
- 任一线上检查失败时，自动切回上一个发布目录并记录失败事件。

## 操作入口

```bash
tools/web-release.sh deploy <git-ref>
tools/web-release.sh status
tools/web-release.sh list
tools/web-release.sh verify <release-id>
tools/web-release.sh history
tools/web-release.sh rollback <release-id>
tools/teacher-platform-release.sh deploy <git-ref>
tools/teacher-platform-release.sh status
```

默认 SSH 主机是 `aliyun`。可通过 `KNOWNMAP_SSH_HOST`、`KNOWNMAP_DEPLOY_ROOT` 和
`KNOWNMAP_SITE_URL` 覆盖，但生产发布记录中始终保存最终使用的站点和提交。

## 2026-08-20 当前生产版本

- release ID：`20260820T142243Z-ec1454ed2f31`；
- GitHub SHA：`ec1454ed2f31512049069122406e8fbd387868b3`；
- GitHub 标签：`web-prod/20260820T142243Z-ec1454ed2f31`；
- 仓库记录：`deploy/releases/20260820T142243Z-ec1454ed2f31.json`；
- 已验证教师登录、创建课程和课节、保存四节点草稿、发布 `v1`、创建短期授权码和公开下载。

## 边界

- 不自动删除旧发布；
- 不从未提交工作区发布；
- 不把密码、SSH 私钥、Cookie、授权码或环境变量写入发布记录；
- SQLite 数据是持久化生产数据，代码回滚不自动回滚数据库；
- DNS、证书和 Nginx 站点配置不属于普通版本回滚。
