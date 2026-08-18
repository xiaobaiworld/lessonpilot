# Web 生产发布可追踪实施计划

日期：2026-08-18

目标：把 `knownmap.com` 的销售页发布变成 GitHub 提交可定位、文件可校验、历史可查询、
版本可回滚的标准流程。

## 任务

- [x] 核对当前 GitHub 提交、线上文件哈希和服务器目录；
- [x] 明确只发布销售页白名单，教师编辑器和源码继续拒绝访问；
- [x] 先写发布包白名单、元数据和原子切换失败测试；
- [x] 实现 `build`、`deploy`、`status`、`list`、`verify`、`history` 和 `rollback`；
- [x] 更新 README、决策和索引；
- [ ] 在生产验证后更新 changelog；
- [ ] 提交并推送发布机制；
- [ ] 使用精确 GitHub SHA 重新发布当前销售页；
- [ ] 创建 GitHub 生产标签并提交发布记录；
- [ ] 验证线上首页、健康检查、拒绝路径、状态查询和回滚目标。

## 文件范围

- 发布工具：`tools/web-release.sh`
- GitHub 发布记录：`deploy/releases/`
- 自动化测试：`tests/web-release.test.js`
- 文档：`README.md`、`doc/DECISIONS.md`、`doc/INDEX.md`、`changelog.md`、`next.md`

## 验收命令

```bash
bash -n tools/web-release.sh
node --test tests/web-release.test.js
node --test tests/*.test.js
tools/web-release.sh status
tools/web-release.sh list
tools/web-release.sh verify <release-id>
tools/web-release.sh history
curl -fsS https://knownmap.com/ >/dev/null
curl -fsS https://knownmap.com/healthz
```

## 回滚验收

不为测试而切换生产流量。先验证目标发布存在、元数据和文件哈希有效，再通过
`status`、`list` 和脚本静态测试确认回滚命令会使用同一原子链接切换函数。真实回滚只在
线上版本需要恢复时执行。
