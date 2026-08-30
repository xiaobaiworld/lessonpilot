# KnownMap

KnownMap 把老师已有的 B 站录播课变成可在原视频页面运行的互动课程。老师创建
课程和课节、编辑四类互动节点、发布课程并生成课程级授权码；授权码按 `course_id` 自动解析最新可交付版本，学生在 PC Chrome 插件中领取
课程，回到匹配的 B 站页面学习。

## 当前实现

- 后端：`v1/backend/`，FastAPI + SQLite，唯一当前后端；
- 管理端：`v1/web/admin/`；
- 教师端：`v1/web/teacher/`；
- 学生插件：`v1/extension/`；
- 销售与说明页：`v1/site/`；
- 品牌资源：`v1/assets/brand/`；
- 机器契约：`v1/contracts/`。

根目录旧 `backend/`、`teacher-web/` 和根契约副本均已删除。旧实现仍可从 Git
历史查看，工作树只保留 v1 当前实现。

## 本地运行

```bash
cd v1/backend
uv sync --frozen
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8001
```

API 文档：`http://127.0.0.1:8001/docs`；健康检查：
`http://127.0.0.1:8001/health`。

前端：

```bash
cd v1
npm ci
npm run dev:admin    # http://localhost:5173
npm run dev:teacher  # http://localhost:5174
```

插件：

```bash
cd v1/extension
npm run build:local
```

然后在 `chrome://extensions/` 选择“加载已解压的扩展程序”，加载
`v1/extension/dist/local`。

当前正式版本为 `1.1.1`。重新构建后，在扩展管理页点击该本机插件的“重新加载”，
再刷新 KnownMap 页面；打开插件弹窗后，品牌栏右上角的齿轮图标会打开紧凑的“学习伙伴”设置页。
第一版只开放“神秘猫精灵”；其余角色卡显示“下一版本完成”。当前猫咪的大图和六个状态缩略图来自角色包资源，鼠标悬停缩略图可查看对应状态的大图。

## 发布到网站

当前是初期开发与运行阶段。流程是：本机测完 → 提交并 push 到 GitHub → 用
`web-prod/<时间-commit>` 标签和 `deploy/releases/` 做版本记录 → 把本机编好的产物
拷到阿里云切换。完整约定见
[`doc/decisions/2026-08-26-early-stage-release-process.md`](doc/decisions/2026-08-26-early-stage-release-process.md)
（`D-V1-013`）。发布不阻塞在 GitHub CI。

```bash
KNOWNMAP_SSH_HOST=aliyun-us \
  tools/release.sh deploy <git-ref>
```

发布记录在 `deploy/releases/`。检查或回滚：

```bash
tools/release.sh verify <release-id>
tools/release.sh rollback <release-id>
```

## 验证

```bash
cd v1/backend
uv run ruff check .
uv run ruff format --check .
uv run pytest

cd ../..
npm test
npm run check
npm --prefix v1 run type-check
npm --prefix v1 run build
```

后端测试包含从空数据库执行管理员初始化、创建教师、教师登录、课程与课节、草稿、
预览结果、权利确认、原子发布、授权码和插件兑换的完整闭环。

## 文档入口

- [系统总说明](doc/SYSTEM-OVERVIEW.md)
- [文档索引](doc/INDEX.md)
- [当前下一步](next.md)
- [开发规则](doc/dev-rules.md)
- [需求真源](doc/requirements/v1/README.md)
- [设计真源](doc/design/v1/README.md)
- [后端迁移执行记录](doc/tem_%E8%BF%81%E7%A7%BB%20backend%20%E8%AE%A1%E5%88%92.md)

开始开发前先读 `doc/lessons.md`。字幕全文留在教师浏览器；服务端不保存学生回答
或学习进度；密码、会话令牌和授权码原文不得进入数据库或日志。
