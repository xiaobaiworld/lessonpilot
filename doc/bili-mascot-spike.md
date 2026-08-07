# Bilibili 2D 小人播放控制 — 技术储备

Version: 0.1  
Last updated: 2026-08-07

## 1. 目标

验证 LessonPilot 在 B 站视频页通过 Content Script 控制播放/暂停，并用 2D 小人作为可见交互入口。

本 spike 不追求完整产品功能，只验证：

- 能否稳定找到主播放器 `<video>` 元素
- 能否通过 `play()` / `pause()` 控制播放
- 能否用轻量 2D 角色展示播放状态并响应点击

## 2. 相关开源项目调研

### 2.1 B 站播放控制类

| 项目 | Stars | 相关能力 | 可借鉴点 | 局限 |
| --- | --- | --- | --- | --- |
| [Bili-SyncPlay](https://github.com/sky1wu/Bili-SyncPlay) | ~146 | 跨用户同步 play/pause/seek/rate | MV3 monorepo、content script 与页面 video 同步、host 匹配规则 | 目标是多人同步，不是 UI 角色 |
| [bilibili-Pro](https://github.com/dt12e0/bilibili-Pro) | — | 逐帧、快捷键、下载 | MV3 权限设计、B 站 CDN host 声明 | 功能过重，非播放控制 spike |
| [bilibili-enhancer](https://github.com/yang-shuohao/bilibili-enhancer) | ~8 | 调速、AB 循环、PiP | 轻量 content script + 悬浮 UI | 无角色交互 |
| [h5player](https://github.com/xxxily/h5player) | 高 | 通用 H5 视频快捷键 | `document.querySelector('video')` 通用控制思路 | Userscript 形态，非扩展架构 |
| [biliplus](https://github.com/0xlau/biliplus) | ~999 | 站点增强、无级调速 | 大型 MV3 扩展工程化 | 不涉及 video 角色 UI |
| [seognil bilibili gist](https://gist.github.com/seognil/3e98d49515784df9b6cddf7d5d3a0ada) | — | `getBiliVideo()` 过滤 inline 预览 | **主播放器选择逻辑** | 个人脚本，非完整项目 |

**结论：** 没有「B 站 + 2D 小人控制播放」的现成项目。播放控制应参考 Bili-SyncPlay / bilibili gist 的 video 定位；角色 UI 应参考 PixelPals / Umaruify。

### 2.2 2D 角色 / 桌面宠物类

| 项目 | 相关能力 | 可借鉴点 | 局限 |
| --- | --- | --- | --- |
| [PixelPals](https://github.com/Relja92/PixelPals) | 像素宠物、监听 video play 事件、requestAnimationFrame 动画 | **video 事件驱动角色行为**、content script 注入 overlay、GIF 状态机 | 通用全站宠物，不控制 video |
| [Umaruify](https://github.com/LakshmanTurlapati/Umaruify) | Live2D + PixiJS 键盘/鼠标互动 | 模块化 content script、overlay 容器隔离 | Live2D 资源重，不适合 LessonPilot 首版 |
| [universal-pip-player](https://github.com/Prasann62/universal-pip-player) | Document PiP + 播放控制 UI | 播放状态与 UI 双向同步 | PiP 为主，不是页面内角色 |

**结论：** PixelPals 的「监听 video 事件 → 切换角色状态」模式最适合 LessonPilot；首版用 Canvas/CSS 轻量 2D，避免 Live2D 依赖。

## 3. 技术方案

### 3.1 架构（对齐 `doc/design.md`）

```text
Bilibili /video/* 页面
  -> content script 注入
  -> 定位主播放器 video
  -> 挂载 2D 小人 overlay（fixed, pointer-events 可控）
  -> 点击小人 -> toggle play/pause
  -> 监听 video play/pause/ended -> 更新小人动画状态
  -> background service worker 预留消息通道（后续 AI / 侧栏用）
```

### 3.2 Video 定位策略

B 站页面可能存在多个 `<video>`（推荐预览、广告等）。优先选择：

1. `.bpx-player-container video`（新版播放器）
2. `.bilibili-player-video video`（旧版播放器）
3. 回退：面积最大的 `video` 元素

控制方式：直接调用 HTML5 `HTMLMediaElement.play()` / `.pause()`，不依赖 B 站私有 JS API（首版仅点播页，不含直播）。

### 3.3 2D 小人实现（首版 spike）

- **渲染：** Canvas 绘制简单像素小人（无外部图片依赖）
- **状态：** `idle` | `playing` | `paused`
- **交互：** 单击 toggle；拖拽改变位置；双击复位到默认角落
- **同步：** 监听 `play` / `pause` / `ended` 事件，与 B 站原生控件保持一致

后续可替换为 sprite sheet 或 Lottie，接口保持不变。

### 3.4 Manifest V3 要点

```json
{
  "manifest_version": 3,
  "host_permissions": ["https://www.bilibili.com/*"],
  "content_scripts": [{
    "matches": ["https://www.bilibili.com/video/*"],
    "run_at": "document_idle"
  }],
  "background": { "service_worker": "..." }
}
```

首版 spike 不需要 `scripting` / `tabs` 权限；Phase 3 AI 接入时再扩展 background 消息协议。

### 3.5 风险与对策

| 风险 | 对策 |
| --- | --- |
| 多个 video 误控 | 播放器容器优先 + 最大面积回退 |
| `play()` 被 autoplay 策略拒绝 | catch Promise，小人显示 paused 状态 |
| B 站 DOM 改版 | 选择器集中在一处 `bili-player.js` 维护 |
| 小人遮挡视频控件 | 默认右下角，可拖拽；`z-index` 低于 B 站弹层 |
| SPA 切 P / 切视频 | 监听 URL 变化或 `MutationObserver` 重新 bind（Phase 1 后续） |

## 4. 与 LessonPilot 路线图的关系

- **本 spike：** 验证 design.md 中「Read or control the video element when feasible」
- **Phase 1：** 在同样 content script 入口旁注入侧栏，小人可作为品牌/IP 触点保留
- **Phase 2+：** 切 segment 时由侧栏调用同一 `bili-player` 模块 seek；小人可展示「学习中」状态

## 5. 本地验证

1. Chrome 打开 `chrome://extensions/`，开启开发者模式
2. 「加载已解压的扩展程序」→ 选择 `src/` 目录
3. 打开 demo 视频：<https://www.bilibili.com/video/BV1WW4y1e7GL/>
4. 确认右下角出现 2D 小人
5. 点击小人：视频暂停/继续；小人动画状态同步变化
6. 用 B 站原生播放按钮操作，确认小人状态仍同步

## 6. 参考链接

- [Bili-SyncPlay](https://github.com/sky1wu/Bili-SyncPlay)
- [PixelPals](https://github.com/Relja92/PixelPals)
- [Umaruify](https://github.com/LakshmanTurlapati/Umaruify)
- [bilibili enhanced gist (getBiliVideo)](https://gist.github.com/seognil/3e98d49515784df9b6cddf7d5d3a0ada)
- [MDN HTMLMediaElement.play()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)
