# LessonPilot

LessonPilot 把老师已有的 B 站录播课变成可在原视频页面运行的互动课程。老师在公网工作台导入一条 B 站视频链接和对应字幕，配置互动节点；学生在 PC Chrome 安装本机插件后，于 B 站原页面到点暂停、作答、查看反馈并继续播放。

当前不是成熟平台，而是第一阶段真实验证闭环。第一目标是验证老师是否愿意提供真实课程、安装插件并亲手配置，而不是继续补齐账号、AI、报告或规模化交付能力。

## 当前范围

- 公网静态销售首页；
- 公网真实教师工作台；
- 一门当前课程，一条标准 B 站视频 URL；
- 老师提供字幕，或 LessonPilot 人工协助取得字幕；
- 重点标注、选择题、填空题、问答题四种节点；
- 本机 Chrome 已解压插件；
- B 站原页面学习运行时；
- 本地保存，无账号、后端或云同步。

问答题只保存学生原始回答，并展示老师预设的参考反馈；第一阶段不评分、不调用 AI。

## 当前状态

技术 spike 已证明插件可以在指定 B 站页面定位播放器、监听时间、暂停、seek 和卸载注入 UI，但完整产品闭环尚未实现。

当前开发阶段是 **1A：数据契约、消息桥与公网部署**。代码已完成并通过 135 个自动化测试：共享课程契约、版本化消息协议、来源白名单、插件后台存储和白名单消息桥。真实 Chrome 与公网往返的人工验证记录在 [`tests/manual/stage-1a-bridge/README.md`](tests/manual/stage-1a-bridge/README.md)，尚待执行；1A 只有该记录填写完毕后才算完成。

从 [`next.md`](next.md) 开始，完整计划见 [`doc/dev-plan.md`](doc/dev-plan.md)。旧 W0/D0/D1 计划已经归档，不再是当前排期。

## 目标页面

| 路径 | 第一阶段职责 | 当前实现状态 |
| --- | --- | --- |
| `/teacher-web/` | 默认公网销售首页 | 待由现有销售页迁入（1B） |
| `/teacher-web/workspace.html` | 真实教师工作台 | 当前是 1A 连接诊断页；真实工作台在 1B 实现 |
| `/teacher-web/forsales.html` | 旧销售链接兼容跳转 | 待迁移（1B） |
| `/teacher-web/editor.html` | 旧原型，仅供迁移参考 | 停止扩展 |

第一阶段默认部署目标是 [GitHub Pages](https://xiaobaiworld.github.io/lessonpilot/)。Pages 已于 2026-08-15 启用（source 为 GitHub Actions），公网可访问性待首次发布后验证。

公网只发布工作台页面和共享课程契约，`doc/` 与插件运行时代码不上公网，发布集在 `.github/workflows/pages.yml` 中以白名单方式列举（见 D-010）。

## 本地运行

从仓库根目录启动唯一静态服务：

```bash
cd /Users/bai/code/lessonpilot
python3 -m http.server 4173
```

当前页面可以从 [http://localhost:4173/teacher-web/](http://localhost:4173/teacher-web/) 访问。不要把 `teacher-web/` 作为独立 server root，也不要另开第二个端口；资源和测试夹具均按仓库根目录解析。端口 4173 写入了插件来源白名单，换端口会使消息桥拒绝该页面。

首次运行或拉取新代码后，先组装共享契约：

```bash
node tools/assemble-workspace.js
```

它把 `src/shared/` 复制到 `teacher-web/shared/`，使工作台页面在本地和公网加载同一路径。该目录不入版本库：提交副本会形成第二份契约定义并可能与源文件脱节（D-010）。

运行自动化测试：

```bash
node --test tests/*.test.js
```

加载当前插件 spike：

1. 打开 `chrome://extensions/`，启用开发者模式；
2. 选择“加载已解压的扩展程序”，目录为仓库的 `src/`；
3. 打开 `https://www.bilibili.com/video/BV1WW4y1e7GL/` 验证现有 spike。

固定视频和固定节点只用于 spike 回归，1C 必须改为读取教师工作台保存的当前课程。

## 文档入口

开始任何跨文件实现前先读 [`doc/INDEX.md`](doc/INDEX.md)。当前事实源为：

| 文档 | 职责 |
| --- | --- |
| [`doc/requirements.md`](doc/requirements.md) | 第一阶段总目标、共同边界和阶段导航 |
| [`doc/requirements/stage-1a.md`](doc/requirements/stage-1a.md) | 当前初期阶段：公网路径、数据契约、存储和消息桥 |
| [`doc/data-spec.md`](doc/data-spec.md) | 数据结构、消息协议和本地存储 |
| [`doc/stage-one-validation-loop-design.md`](doc/stage-one-validation-loop-design.md) | 已确认的产品与架构设计 |
| [`doc/DECISIONS.md`](doc/DECISIONS.md) | 决策、假设、证据和重开条件 |
| [`doc/dev-plan.md`](doc/dev-plan.md) | 三阶段实施顺序和门禁 |
| [`next.md`](next.md) | 唯一当前执行步骤 |

解释冲突时按：当前阶段需求 -> 需求总览 -> 数据规范 -> 已确认设计 -> 内容/窗口标准 -> 计划。远期平台、推广视频和旧 Demo 文档不得覆盖第一阶段范围。

## 核心边界

- 学生宿主只使用 B 站原页面加 PC Chrome 插件；跨源网页无法稳定控制 B 站播放器。
- 教师工作台通过版本化 `window.postMessage` 与白名单 content script 通信，再由插件后台严格校验和存储。
- 完整字幕只留在教师浏览器，不发送给插件；插件只接收运行所需课程配置。
- 更换课程 URL 时必须提醒；确认后清除旧课程，取消则完整保留。
- 第一阶段允许礼宾式协助，不以自动抓字幕、自助安装或应用商店发布为完成条件。
