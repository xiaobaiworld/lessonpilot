# Web 生产发布记录

这里一份 JSON 对应一次成功的 `knownmap.com` 生产发布。

- 文件名等于发布 ID；
- `gitCommit` 是实际部署的 GitHub 完整提交 SHA；
- `gitTag` 是指向该提交的 `web-prod/<release-id>` 标签；
- 文件内的 `status` 表示记录已验证；当前是否在线以服务器 `current` 链接为准；
- 记录在部署成功后单独提交，不能反过来修改所记录的源码提交；
- 服务器上的追加历史位于 `/var/www/knownmap/release-history.jsonl`。

不要在这里保存密码、SSH 私钥、Cookie、授权码或环境变量。
