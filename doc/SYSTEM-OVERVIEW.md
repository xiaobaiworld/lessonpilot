# KnownMap 系统总说明

版本：1.0

更新时间：2026-08-23

这份文件回答「这个系统是什么、由哪些部分组成、它们怎么连起来」。
读完它应当能定位到任何一块代码，并知道它为什么在那里。

细节各有真源，本文只做索引：
需求见 [`doc/requirements/v1/`](requirements/v1/)，
设计见 [`doc/design/v1/`](design/v1/)，
当前进度见 [`next.md`](../next.md)，
文档分类见 [`doc/INDEX.md`](INDEX.md)。

---

## 1. 这个系统做什么

老师已经有一门录播课在 B 站上。KnownMap 让这门课变成会打断、会提问的互动
课程，而**不需要重新录制**，也不把视频搬到别处。

```
老师：导入 B 站链接和字幕 → 在某句话上放一个互动节点 → 发布 → 拿到授权码
学生：在插件里输入授权码 → 回到那条 B 站视频 → 到点暂停、作答、继续播放
```

买的人是老师，用的人是学生。老师买的是「课程能交付出学习结果」，不是「视频
更清晰」。

### 为什么是 Chrome 插件

因为要在别人的视频上按时间打断。网页拿不到跨源 iframe 里的播放时间，也无法
暂停它——这是浏览器安全边界，不是实现努力能改变的。插件的 content script 被
注入进 B 站页面，那里的 `<video>` 就是同一个文档里的普通元素。

代价是学生必须装插件，只能用 PC Chrome。这条约束的完整推导见
[`doc/lessons.md`](lessons.md) 2026-08-14 条。

### 干预边界

只做两件事：读播放时间、暂停与继续。不改倍速、不阻止跳过、不降原声、
不改播放器 UI。把干预面积压到最小是合规基线，不是可选项。

---

## 2. 四个部分

```
                    ┌──────────────────────────┐
   老师用浏览器  →   │  教师应用  v1/web/teacher │
                    │  管理应用  v1/web/admin   │
                    └───────────┬──────────────┘
                                │ HTTP + HttpOnly Cookie
                    ┌───────────▼──────────────┐
                    │   后端  backend/          │
                    │   FastAPI + SQLite        │
                    └───────────┬──────────────┘
                                │ 授权码兑换（公开端点）
                    ┌───────────▼──────────────┐
   学生装插件    →   │  Chrome 扩展 v1/extension │
                    │  ↓ 注入                   │
                    │  B 站原视频页面            │
                    └──────────────────────────┘
```

| 部分 | 位置 | 职责 |
| --- | --- | --- |
| 管理应用 | `v1/web/admin/` | 超级管理员创建教师账号、重置密码 |
| 教师应用 | `v1/web/teacher/` | 课程与课节、导入字幕、编辑节点、发布、发授权码 |
| 后端 | `backend/` | 认证、归属、草稿与发布、授权码、公开下载 |
| 学生插件 | `v1/extension/` | 兑换授权码、本机课程库、在 B 站页面运行 |

共享代码在 `v1/web/shared/`（HTTP 客户端、表单组件、字幕解析、时间轴）。

---

## 3. 数据怎么流动

### 老师这一侧

```
课程 Course
 └─ 课节 Lesson（绑一个 BVID，显式 sort_order）
     └─ 脚本草稿 ScriptDraft（整份保存，四类节点的 JSON）
          ↓ 发布
        课程包（不可变快照，学生下载的就是它）
          ↓
        授权码 AccessCode（只存 HMAC 摘要，明文只在创建那一次响应里）
```

**发布是原子的**：整门课的所有课节一起成为一个版本，全有或全无。半发布会让
老师说的「这个码给你三门课」变成学生看到一门，而学生无法自查缺了什么。

**授权码不可再次获取**：数据库只有摘要。所以界面上它只显示一次，关闭即清空，
且未关闭前禁止发下一个——覆盖掉就永久丢了。

### 学生这一侧

```
授权码 → 公开下载端点 → 课程包
          ↓ 落盘前完整复验
        本机课程库 chrome.storage.local['knownmapV1']
          ├─ installedCourses     已安装课程，锁定到某一次发布
          ├─ localLearningState   按 courseId + lessonId 隔离
          ├─ authorizationSourceCache  只存授权码尾段
          └─ quarantine           读不懂的数据隔离在这里，不静默丢弃
```

服务端已经校验过一遍，插件仍在落盘前再验一遍：**一旦写进本机，运行时就无条件
相信它**。网络截断、扩展被换、存储串位产生的畸形数据必须在落盘前挡住。

---

## 4. 四类互动节点

| 类型 | family / interaction | 学生看到 | 是否判分 |
| --- | --- | --- | --- |
| 重点标注 | `attention` / `notice` | 一段提示，读完继续 | 否 |
| 选择题 | `practice` / `choice` | 选项，选中后看解析 | 是 |
| 填空题 | `practice` / `blank` | 输入框，与可接受答案比对 | 是 |
| 问答题 | `practice` / `free_text` | 自由作答，随后看参考答案 | 否 |

`family` 与 `interaction` 的组合被后端用 `const` 钉死，写错整份草稿被拒。
所以它们集中在 `v1/web/teacher/src/nodes.ts` 一个工厂里，不在每个表单里重打。

节点的五种结局是**互不冒充的独立状态**：答对、答错、已确认、已跳过、出错。
合成一个「完成了」会让跳过被记成答对、渲染失败被记成完成。

---

## 5. 关键设计决定

### 会话走 HttpOnly Cookie

登录响应体里没有 token，前端持有不了也读不到。所以前端不需要 token 管理、
不需要状态库存放它——两个 Zustand store 因此被删掉。

### 节点定位的真源是字幕

字幕文件自带精确时间戳，播放器只是确认内容的取景器。老师从字幕里挑一句，
节点就落在那句话的起点。

课程时长也取自字幕（最后一句的结束时刻）。**没有字幕就不显示时间轴**——
随手填一个兜底时长会让刻度、末端标记和节点百分比一致地指向错误位置。

### 同一 BVID 可能命中多个课节

老师可以把同一个视频用在不同课程里。这时插件让学生**显式选择**，不静默取
第一个：取错了学生会在一门课里做另一门课的题，而界面上看不出发生了什么。

### 存储写入串行

两次并发兑换如果各自读-改-写，后完成的那次会带着过期快照把前一次装的课程
抹掉。所有写入排队执行。

### 损坏按课程隔离

读到不认识的结构时把那一条挪进 `quarantine` 并继续，不整库重置——那会连带
删掉其它课程的学习记录。只有存储版本号不认识时才整根隔离，因为结构未知时
读任何字段都是猜测。

---

## 6. 目录

```
backend/            FastAPI + SQLite。认证、课程、发布、授权码
  app/api/v1/         路由：协议、权限、错误映射
  app/services/       业务逻辑与事务
  app/repositories/   数据访问，不决定权限
  alembic/            迁移

v1/                 v1 系统（阶段 0 起在同仓库独立建立）
  contracts/          JSON Schema 真源、版本清单、发布闸门
  web/shared/         HTTP 客户端、表单组件、字幕解析、时间轴
  web/admin/          管理应用
  web/teacher/        教师应用
  extension/          Chrome MV3 扩展
    storage/            本机课程库
    background/         唯一的网络与持久化边界
    runtime/            学习会话状态机（纯逻辑，无 DOM）
    host/bilibili/      唯一允许出现 B 站选择器的地方
    content/            页面接线与学习窗口
    popup/              工具栏首页

teacher-web/        v0.9.1 旧教师 Web，冻结。styles.css 是 v1 复用的视觉真源
contracts/          阶段 0 JSON Schema 门禁（课程包、插件消息）

tools/              发布、检查、扫描
tests/              旧系统测试；tests/manual/v1/ 是真实浏览器验收
doc/                需求、设计、决策、经验、状态
deploy/             生产脚本、备份与恢复演练、发布记录
```

### 为什么旧系统还在

`D-V1-012` 定了 v1 从干净初始化开始，不在原目录逐文件改造。旧系统冻结但保持
可运行，直到 v1 完成真实切换与观察期。旧学生插件源码 `src/` 已删除，生产插件只从 `v1/extension/` 构建。

`v1/web/*/src/index.css` 通过 `@import` 引用 `teacher-web/styles.css`——那是
已上线验证的视觉真源，抄一份出来会立刻变成负债。阶段 8 时把它移进 `v1/`。

---

## 7. 跑起来

```bash
# 后端
cd backend && uv sync && cp .env.example .env
uv run alembic upgrade head
uv run uvicorn app.main:app --port 8000

# 账号（密码只经环境变量，不入仓库）
SEED_ADMIN_LOGIN_NAME=admin SEED_ADMIN_PASSWORD=<密码> \
  SEED_ADMIN_DISPLAY_NAME=超级管理员 uv run python -m app.seed admin

# 两个应用
cd v1 && npm install
npm run dev:admin      # http://localhost:5173
npm run dev:teacher    # http://localhost:5174

# 插件
cd v1/extension && npm run build:local
# chrome://extensions 开发者模式加载 dist/local
```

`backend/.env` 的 `CORS_ORIGINS` 需包含 5173 和 5174，否则 Cookie 会话的跨源
请求全部失败。该文件被 Git 忽略。

---

## 8. 验证

```bash
cd v1 && npm test          # v1 单元与集成
cd backend && uv run pytest
npm test                   # 旧系统回归
npm run check              # 契约、模块边界、端点、密钥、依赖
```

真实浏览器验收（需要后端运行并先在教师端生成授权码）：

```bash
node tests/manual/v1/verify-extension.mjs <授权码>   # 扩展与课程库
node tests/manual/v1/verify-player.mjs   <授权码>   # 播放器、全屏、SPA
node tests/manual/v1/verify-bilibili-dom.mjs        # 选择器与真实 B 站 DOM
```

这三个脚本把真实扩展装进真实 Chromium 跑，不是 mock。它们找出过四个「构建
成功」掩盖的缺陷：popup 引用 `.ts` 而产物是 `.js`、应用引用站点根绝对路径、
匹配模式带端口被 Chrome 静默拒绝、学习窗口在全屏时不可见。

**绿色的构建日志不是证据，它只说明打包程序没崩。**

---

## 9. 发布

```bash
# 切换前预检生产（只读，不打印任何密钥值）
KNOWNMAP_SSH_HOST=<别名> tools/preflight-check.sh

# 构建候选（在归档的精确提交里跑 npm ci → npm test → 构建）
KNOWNMAP_PUBLISH_PROFILE=v1-apps tools/web-release.sh build <ref> <输出目录>

# 切换前核对版本支持矩阵
cd v1 && npm run gate -- --candidate <输出目录>

# 切换
KNOWNMAP_SSH_HOST=<别名> KNOWNMAP_PUBLISH_PROFILE=v1-apps \
  tools/teacher-platform-release.sh deploy <ref>
```

该统一入口先发布后端、执行迁移和恢复演练，再以同一 release ID 原子发布
`/admin/`、`/teacher/`、旧入口重定向、生产目标插件包和原样销售页；发布后同时验证
Web、API 与版本探针，避免只切静态文件造成组件混用。

旧入口 `/admin.html` 与 `/teacher-web/editor.html` **重定向而非删除**：
收藏了旧地址的人要被带到新位置，不是撞 404。

预检覆盖五项：后端在跑、生产配置能通过 6C 启动校验（不满足会让服务起不来）、
nginx 能把 `/admin/` 这样的目录请求解析到 `index.html`（否则切换后两个应用
都是 404）、目标路径未被占用、备份存在且定时器在跑。

---

## 10. 当前状态

进度表与剩余项见 [`next.md`](../next.md)。

一句话：阶段 0–6 的代码与自动化门禁完成，学生端已在真实 Chrome 验收，
生产切换尚未执行。

---

## 11. 从这里往下读

| 想知道 | 读 |
| --- | --- |
| 现在该做什么 | [`next.md`](../next.md) |
| 文档怎么分类、哪些是权威 | [`doc/INDEX.md`](INDEX.md) |
| 为什么这样设计 | [`doc/design/v1/`](design/v1/) |
| 要做到什么 | [`doc/requirements/v1/`](requirements/v1/) |
| 踩过什么坑 | [`doc/lessons.md`](lessons.md) |
| 已接受的决策 | [`doc/decisions/`](decisions/)（`D-V1-001` 至 `D-V1-012`） |
| 重构分几步走 | [`doc/plans/v1-code-refactor-execution-plan.md`](plans/v1-code-refactor-execution-plan.md) |

**改代码前先读 `doc/lessons.md`**。它记的都是已经付过代价的事，其中好几条
我在这轮重构里又踩了一遍——包括「Chrome 匹配模式不能带端口」，旧插件
manifest 里就写着，我没读到。
