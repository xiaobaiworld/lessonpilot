# KnownMap Web 生产发布可追踪设计

日期：2026-08-18

状态：已确认，待实现验证

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
- 公网只允许销售页、两个页面脚本、网页图标和 `robots.txt`；
- 教师编辑器、后端、测试、文档、插件源码和仓库元数据不得进入公网目录。

## 发布模型

每次生产发布绑定一个已经推送到 GitHub 的完整 commit SHA。发布工具先从该 SHA 使用
`git archive` 组装白名单文件，不读取未提交的工作区内容。

发布目录采用不可变结构：

```text
/var/www/knownmap/releases/<release-id>/
├── public/
├── release.json
└── SHA256SUMS
```

`/var/www/knownmap/current` 只作为指向某个 `public/` 的符号链接。发布和回滚都先创建新
链接，再使用同文件系统重命名完成原子切换。

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
- 检查首页内容哈希；
- 检查 `/doc/`、`/src/`、`/tests/`、`/teacher-web/editor.html` 返回 404；
- 任一线上检查失败时，自动切回上一个发布目录并记录失败事件。

## 操作入口

```bash
tools/web-release.sh deploy <git-ref>
tools/web-release.sh status
tools/web-release.sh list
tools/web-release.sh verify <release-id>
tools/web-release.sh history
tools/web-release.sh rollback <release-id>
```

默认 SSH 主机是 `aliyun`。可通过 `KNOWNMAP_SSH_HOST`、`KNOWNMAP_DEPLOY_ROOT` 和
`KNOWNMAP_SITE_URL` 覆盖，但生产发布记录中始终保存最终使用的站点和提交。

## 边界

- 本机制当前只发布销售静态站，不发布教师 API 或教师编辑器；
- 不自动删除旧发布；
- 不从未提交工作区发布；
- 不把密码、SSH 私钥、Cookie、授权码或环境变量写入发布记录；
- 回滚只切换静态文件版本，不修改 DNS、证书或 Nginx 配置。
