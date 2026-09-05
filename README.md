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

### 人工验收启动约定

当用户要求启动本地服务准备人工验收时，不能只启动上面的进程。启动服务的 Agent 必须：

本地教师验收账号固定为：用户名 `teacher`，密码 `teacher`。只允许用于本地开发/人工验收，
不得带入生产环境。

- 先确认并说明当前 API 使用的 `DATABASE_URL`；
- 确保当前数据库存在专用教师验收账号、至少一门课程和一个课节；
- 固定验收账号 `teacher` 允许在本地启动时修复为密码 `teacher`；不得重置其它已有教师账号，生产环境严禁使用这组凭据；
- 在回复中给出教师端地址、验收账号、密码和预置课程位置；
- 使用临时数据库时，验收结束后停止对应服务并说明临时数据清理情况。

本地教师验收账号不是生产账号，密码不得写入 Git、生产配置、长期日志或截图。完整规则见
[`doc/dev-rules.md` 第 6.1 节](doc/dev-rules.md#61-本地服务启动与教师人工验收账号)。

本地服务默认使用 `v1/backend/knownmap-v1.db` 持久数据库，不得每次启动都新建空的临时库。
如果本地没有课程数据，应先备份本地库，再从阿里云创建并校验数据库副本后导入；导入后
只在本地副本上准备 `teacher` / `teacher` 验收登录，不能修改云端数据库。具体同步边界见
[`doc/dev-rules.md` 第 6.2 节](doc/dev-rules.md#62-本地持久数据库与云端数据同步)。

插件：

```bash
cd v1/extension
npm run build:local
```

然后在 `chrome://extensions/` 选择“加载已解压的扩展程序”，加载
`v1/extension/dist/local`。

当前学生插件版本为 `1.2.3`；产品正式版本与代码、数据库和插件的对应关系见
[`docs/RELEASE_VERSION_AND_DATA_CONTINUITY.md`](docs/RELEASE_VERSION_AND_DATA_CONTINUITY.md)。重新构建后，在扩展管理页点击该本机插件的“重新加载”，
再刷新 KnownMap 页面；打开插件弹窗后，品牌栏右上角的齿轮图标会打开紧凑的“插件设置”中心，学习伙伴设置在同一 popup 内展示角色类别、主头像、状态缩略图和声音试听。
第一版只开放“神秘猫精灵”；其余角色卡显示“下一版本完成”。当前猫咪的主头像和六个状态缩略图来自角色包资源，鼠标悬停或键盘聚焦缩略图时，顶部主头像会切换为对应状态的大图。后续角色不会默认全部打进插件：已接受的方向是由 KnownMap 网站提供角色目录，学生按需下载自己选择的图片、音频和清单；插件代码与权限仍通过正式插件版本更新，详见 [`D-V1-026`](doc/decisions/2026-08-30-companion-pack-online-delivery.md)。

### 插件版本定义

学生插件只要发生改动，就必须自动更新版本号，不需要再次等待提醒。插件代码、弹窗、设置页、权限、清单、内置图片/音频、资源清单、构建配置或打包内容发生变化，都属于插件改动；版本唯一真源是 `v1/extension/manifest/targets.ts` 的 `EXTENSION_VERSION`。版本按功能规模自动递增：小功能 `0.0.1`，大一些的功能 `0.1`，大版本 `1.x`。只有纯文档、设计草稿或不进入插件包的测试改动可以不升级插件版本。发布前必须核对 local/production manifest、最终 ZIP 和线上下载包使用同一新版本。

## 发布到网站

默认发布约定：以后说“发布到 GitHub”或“发版”，只要本机测试已经通过，就同时继续发布到阿里云并完成线上健康检查，
不需要再单独提醒“发布到阿里云”。只有明确说“只推 GitHub”时，才不执行云端发布。

当前是初期开发与运行阶段。流程是：本机测完 → 提交并 push 到 GitHub → 用
`web-prod/<时间-commit>` 标签和 `deploy/releases/` 做版本记录 → 把本机编好的产物
拷到阿里云切换。完整约定见
[`doc/decisions/2026-08-26-early-stage-release-process.md`](doc/decisions/2026-08-26-early-stage-release-process.md)
（`D-V1-013`）。发布不阻塞在 GitHub CI，但必须先通过本机发布前测试。

正式版本、Git commit、插件版本、Alembic 数据库版本、契约版本和生产数据保留规则见
[`正式发布版本与数据连续性说明`](docs/RELEASE_VERSION_AND_DATA_CONTINUITY.md)。

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

## 版本治理

产品版本真源是根目录 [`VERSION`](VERSION)，组件分类、版本来源和审计规则见
[`versioning/components.json`](versioning/components.json)，每次代码改动的范围记录见
`versioning/records/*.json`。版本治理检查会根据改动路径区分页面、应用模块、插件、共享模块、契约、数据库和生产发布审计：

```bash
npm run check:version
```

代码精确版本仍以 Git commit 为准；插件、契约和数据库继续使用各自的独立版本真源，不把所有版本强行合并成一个数字。

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
