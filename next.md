# KnownMap 当前下一步

更新时间：2026-08-25

## 当前阶段

根目录旧后端已迁入 `v1/backend/`。当前唯一后端具备独立依赖、单一空库迁移、
41 个设计端点和从管理员初始化到学生兑换的自动化闭环。

本次验收按产品负责人要求只以测试结果为准，不设置 7 日观察期，不迁移生产数据，
也不等待真实用户交付。

## 下一步

迁移提交后进入常规功能开发。新增能力直接修改 `v1/`，不得恢复根 `backend/` 或
复制第二套后端。

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
