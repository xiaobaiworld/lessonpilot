# Web 生产发布记录

这里一份 JSON 对应一次成功的 `knownmap.com` 生产发布。当前阶段的发布步骤见
[`doc/decisions/2026-08-26-early-stage-release-process.md`](../../doc/decisions/2026-08-26-early-stage-release-process.md)
（`D-V1-013`）。版本化方案不变。

- 文件名等于发布 ID：`<UTC 时间>-<commit 前 12 位>`；
- `gitCommit` 是实际部署的 GitHub 完整提交 SHA；
- `gitTag` 是指向该提交的 `web-prod/<release-id>` 标签；
- 文件内的 `status` 表示记录已验证；当前是否在线以服务器 `current` 链接为准；
- 记录由 `tools/release.sh deploy <git-ref>` 在验证成功后生成；
- 记录生成后单独提交，不能反过来修改所记录的源码提交。

不要在这里保存密码、SSH 私钥、Cookie、授权码或环境变量。
