# KnownMap 品牌组合标识修正实施计划

版本：0.1

更新时间：2026-08-18

状态：已完成

设计入口：`doc/knownmap-brand-lockup-refinement-design.md`

## 1. 修改范围

### 品牌资源

- 修改 `src/assets/knownmap-logo.svg`
- 修改 `src/assets/knownmap/knownmap-circle.svg`
- 修改 `src/assets/knownmap/knownmap-square.svg`
- 修改 `src/assets/knownmap/knownmap-transparent.svg`
- 重新导出 `src/assets/icon-16.png`
- 重新导出 `src/assets/icon-24.png`
- 重新导出 `src/assets/icon-48.png`
- 重新导出 `src/assets/icon-128.png`
- 重新导出 `teacher-web/assets/knownmap-icon.png`

### 教师应用与文档

- 修改 `teacher-web/editor.html`
- 修改 `teacher-web/app.js`
- 修改 `teacher-web/styles.css`
- 修改品牌和页面契约测试
- 同步 `README.md`、`doc/DECISIONS.md`、`doc/INDEX.md`、`next.md` 和 `changelog.md`

## 2. 执行顺序

1. 先写失败测试，锁定 82% 内部几何、K/M 色值和“互动课程工具”称呼。
2. 修改四份 SVG，重新导出所有 PNG。
3. 修改教师页品牌字标、标题和运行时文案。
4. 运行聚焦测试、Node 全量测试和 SVG/PNG 资源检查。
5. 使用浏览器检查 1440px 与 375px 页眉、Logo 留白和文字颜色。
6. 同步权威文档和验收结果，形成小提交。

## 3. 提交边界

```text
docs: plan KnownMap brand lockup refinement
feat: refine KnownMap brand lockup
docs: verify KnownMap brand lockup refinement
```

本任务属于节点 7 后的品牌小修，不改变节点 8 的业务范围，不单独创建或合并主分支 PR。

## 4. 完成门禁

- 文档先于产品代码提交；
- 所有 Logo 资源由同一几何导出；
- 教师应用完整名称统一为“KnownMap 互动课程工具”；
- K/M 色值与 Logo 节点色完全一致；
- 页面和资源自动化测试通过；
- 桌面与移动端浏览器验收通过。
