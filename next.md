# KnownMap 当前下一步

更新时间：2026-08-25

## 当前阶段

旧后端、旧教师 Web 和根契约副本均已删除。当前代码、静态站点、品牌资源与契约
统一位于 `v1/`；后端具备独立依赖、单一空库迁移、41 个设计端点和完整自动化闭环。

本次验收按产品负责人要求只以测试结果为准，不设置 7 日观察期，不迁移生产数据，
也不等待真实用户交付。

## 下一步

进入常规功能开发。新增能力直接修改 `v1/`，不得恢复根 `backend/`、`teacher-web/`
或复制第二套契约与发布 profile。

开发前：

1. 读 `doc/lessons.md`；
2. 在 v1 需求与设计中确认需求和边界；
3. 把本轮可检查交付物写在本文件；
4. 实现并测试后更新 `changelog.md` 与必要文档。

## 当前验证入口

```bash
cd v1/backend
uv sync --frozen
uv run ruff check .
uv run ruff format --check .
uv run pytest

cd ../..
npm test
npm run check
npm --prefix v1 run type-check
npm --prefix v1 run build
```
