# Stage 1A 人工验证记录

自动化测试无法覆盖真实 Chrome 扩展加载、真实 GitHub Pages 访问和跨文档 `postMessage`，这些必须人工执行并留证。

状态：**待执行**。执行者填写「实际结果」列后，1A 才可标记完成。

## 环境

| 项 | 值 |
| --- | --- |
| 日期 | 待填 |
| 浏览器与版本 | 待填 |
| 扩展版本 | 0.7.0（`src/manifest.json`） |
| 本地入口 | `http://localhost:4173/teacher-web/workspace.html` |
| 公网入口 | `https://xiaobaiworld.github.io/lessonpilot/teacher-web/workspace.html` |
| 分支 | `stage-1a-contract-bridge-deploy` |

## 准备

```bash
# 1. 组装共享契约（teacher-web/shared/ 不入版本库，见 D-010）
node tools/assemble-workspace.js

# 2. 从仓库根启动唯一静态服务
python3 -m http.server 4173

# 3. 全量自动化测试，记录结果
node --test tests/*.test.js
```

加载扩展：打开 `chrome://extensions/` → 启用开发者模式 → 「加载已解压的扩展程序」→ 选择仓库的 `src/`。

## 验证步骤

### V1 自动化基线

| 预期 | 实际结果 |
| --- | --- |
| `node --test tests/*.test.js` 全部通过，无失败 | 待填 |

### V2 扩展加载无错误

| 预期 | 实际结果 |
| --- | --- |
| `chrome://extensions/` 上 LessonPilot 无红色错误 | 待填 |
| 特别确认 manifest 的 `matches` 未被拒绝。这是 P5 的直接证据：Chrome match pattern 不接受端口，若报非法则说明粗粒度模式写法需要调整 | 待填 |
| service worker 状态正常，控制台无 `importScripts` 报错 | 待填 |

### V3 本地工作台往返

在 `http://localhost:4173/teacher-web/workspace.html` 依次执行，逐条记录：

| 操作 | 预期 | 实际结果 |
| --- | --- | --- |
| PING | 显示插件已连接和版本 `0.7.0` | 待填 |
| 读取当前课程 | 首次为「插件中当前没有课程」 | 待填 |
| 保存测试课程 | 显示已保存和 `bilibili:BV1WW4y1e7GL` | 待填 |
| 读取当前课程 | 显示该课程、节点数 1、更新时间与保存时一致 | 待填 |
| 创建预览会话 | 显示会话 ID 和开始时间 | 待填 |
| 清除当前课程 | 显示已清除课程和预览会话 | 待填 |
| 再次读取 | 回到「当前没有课程」 | 待填 |

深度相等抽查（`chrome://extensions/` → service worker → Console）：

```js
chrome.storage.local.get(['currentCourse', 'activePreviewSession']).then(console.log)
```

| 预期 | 实际结果 |
| --- | --- |
| 保存后 `currentCourse.updatedAt` 与页面显示的更新时间完全一致（后台不重写，D-011） | 待填 |
| `activePreviewSession.courseUpdatedAt` 等于当时课程的 `updatedAt` | 待填 |
| 只有 `currentCourse` 和 `activePreviewSession` 两个键 | 待填 |

### V4 清除保护

| 操作 | 预期 | 实际结果 |
| --- | --- | --- |
| 先保存测试课程，再在 Console 执行下方片段，用错误的 `expectedCourseId` 清除 | 返回 `COURSE_MISMATCH`，课程仍在 | 待填 |

在 **诊断页** 的 Console（不是 service worker）执行：

```js
window.postMessage({
  channel: 'lessonpilot.workspace.v1', protocolVersion: 1,
  requestId: 'req-' + crypto.randomUUID(),
  type: 'CLEAR_CURRENT_COURSE',
  payload: { expectedCourseId: 'bilibili:BV1Wrong00000' }
}, window.location.origin);
```

随后在页面点「读取当前课程」，确认课程未被删除。

### V5 非白名单来源探针

打开 `http://localhost:4173/tests/manual/stage-1a-bridge/probe.html`（同一 origin，但路径不在白名单内），先在诊断页保存测试课程，再运行探针。

| 预期 | 实际结果 |
| --- | --- |
| 探针判定 PASS：5 个操作均无任何响应 | 待填 |
| 回到诊断页读取课程，内容与探针运行前一致（未被覆盖、未被清除） | 待填 |

这条对应 1A 完成定义第 11 条。收到任何响应即为失败，必须停止收口并修复。

### V6 重复加载不产生重复响应

| 操作 | 预期 | 实际结果 |
| --- | --- | --- |
| 在 `chrome://extensions/` 点「重新加载」扩展，然后刷新诊断页，执行 PING | 只出现一条记录，不重复 | 待填 |
| 连续刷新诊断页 3 次后执行 PING | 仍只有一条记录 | 待填 |
| 扩展重载后**不刷新**页面直接 PING | 预期 `EXTENSION_UNAVAILABLE`（旧内容脚本已失效），页面提示刷新，不卡在等待 | 待填 |

### V7 公网路径

Pages 已于 2026-08-15 通过 `gh api` 启用（`build_type: workflow`）。`workflow_dispatch` 要求工作流存在于默认分支，因此本项须在本分支合并到 `main`、`pages.yml` 首次运行成功后执行。

| 预期 | 实际结果 |
| --- | --- |
| `pages.yml` 运行成功，且其「Verify nothing private was staged」步骤输出的发布清单只含 5 个文件 | 待填 |
| 公网 `https://xiaobaiworld.github.io/lessonpilot/teacher-web/workspace.html` 返回页面 | 待填 |
| 公网页面的 `shared/course-contract.js` 与 `shared/bridge-protocol.js` 均加载成功（Network 面板无 404） | 待填 |
| 在公网页面重复 V3 全部七步，结果一致 | 待填 |
| 确认 `https://xiaobaiworld.github.io/lessonpilot/doc/` 与 `/src/` **不可访问**（应为 404） | 待填 |

若公网不可访问：按 D-007 重开条件记录证据（错误码、网络环境、是否被阻断），**不得默默更换 origin 或在白名单中加入模糊来源**，先与用户确认。

## 结论

| 项 | 值 |
| --- | --- |
| 全部通过 | 待填 |
| 未通过项及处置 | 待填 |
| 1A 是否可标记完成 | 待填 |

只有 V1–V7 全部通过，1A 才能标记完成并把 `next.md` 推进到 1B。
