# KnownMap v0.9.1 旧系统归档

归档日期：2026-08-24

冻结基线：`main@c0638c5`

本目录保存 V1 全面接管后退出默认开发、测试和发布链路的旧系统。内容只用于历史
排障、行为对照和整体回退，不应从这里直接启动半套旧系统或参与当前发布。

## 内容

- `teacher-web/`：旧教师端、管理员端、工作台原型和诊断页面；
- `extension-src/`：旧 Chrome 插件、旧 1.x 契约和运行时；
- `tests/`：只验证旧教师端、旧插件和旧契约的自动化与人工验收资料；
- `tools/`：旧 Pages 组装器和旧 1.x 跨语言契约校验器；
- `github/workflows/pages.yml`：已停用的 GitHub Pages 发布流程。

原销售页、学生安装说明、试用入口、字幕上下文脚本和网页图标仍在使用，已迁入
`v1/public-site/`。旧基础样式已迁入 `v1/web/shared/src/styles/base.css`。
仍在使用的品牌 SVG 和扩展图标分别迁入 `v1/brand/` 与 `v1/extension/assets/`。

## 不在归档内

根目录 `backend/` 不是旧后端。它承载当前生产 V1 API、数据库迁移、备份恢复和
部署服务，继续保留在原路径。当前 Web 与插件源码均位于 `v1/`。

## 回退

优先回退整个归档提交，不要从本目录挑文件复制回工作区：

```bash
git revert <旧系统归档提交>
```

如果提交尚未合并，也可删除归档分支并回到原分支；需要临时查看单个旧文件时使用：

```bash
git show c0638c5:<原路径>
git restore --source=c0638c5 -- <原路径>
```

生产回退继续使用已有不可变 release：

```bash
tools/web-release.sh list
tools/web-release.sh rollback <release-id>
```

回退旧代码后仍需按当时的发布脚本和依赖执行完整验证，不能把旧前端与当前 V1 API
随意拼接。
