# Student Companion Category Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 v1.1.0 插件设置页改成紧凑的角色类别选择页，并用角色包接口提供真实猫咪大图、六个状态缩略图和悬停大图预览。

**Architecture:** 设置页只负责角色元数据展示和当前角色资源预览；图片通过现有 background `companionAsset` 白名单接口按 `packId + state` 读取。第一版只有 `cat-v1` 可用，其他角色卡保留为不可选的下一版本占位，不新增节点状态或声音协议。

**Tech Stack:** TypeScript, Vite, HTML/CSS, Vitest, Chrome Extension Manifest V3.

---

### Task 1: 锁定设置页的新验收行为

**Files:**
- Modify: `/Users/bai/code/lessonpilot/v1/extension/settings/settings.test.ts`
- Test: `/Users/bai/code/lessonpilot/v1/extension/settings/settings.test.ts`

- [x] **Step 1: 写失败测试**

在现有设置页测试中增加以下断言：页面包含“选择你的学习伙伴”“神秘猫精灵”“元气狗狗伙伴”“奇趣森林伙伴”“未知世界伙伴”，包含 6 个 `data-state-preview` 缩略图挂载点和 `state-popover` 大图挂载点；页面不包含“选择一个即可”、`data-audio`、`sound-switch` 和旧的 `upload-box`；源码仍使用 `companionAsset`、`packId`、`state`。

- [x] **Step 2: 运行测试确认失败**

运行：

```bash
npm test --prefix /Users/bai/code/lessonpilot/v1/extension -- settings/settings.test.ts
```

预期：失败，因为当前页面仍是旧的状态、声音和上传设置布局。

### Task 2: 重做设置页结构和资源绑定

**Files:**
- Modify: `/Users/bai/code/lessonpilot/v1/extension/settings/index.html`
- Modify: `/Users/bai/code/lessonpilot/v1/extension/settings/index.ts`

- [x] **Step 1: 替换 HTML 结构**

保留 KnownMap 顶栏和版本号，改为当前伙伴卡、六个独立缩略图、四个角色卡和底部提示。当前伙伴卡使用以下结构：

```html
<img id="selected-avatar" alt="当前学习伙伴" />
<div class="state-strip" aria-label="神秘猫精灵状态预览">
  <button type="button" class="state-thumb" data-state-preview="idle" aria-label="等待状态">
    <img alt="" />
    <span class="state-popover"><img alt="等待状态大图" /></span>
  </button>
</div>
```

六个状态必须各有独立的 `data-state-preview` 元素；角色卡只让第一张可选，其余三张使用 `aria-disabled="true"` 和“下一版本完成”，并在动漫角色卡中保留“个性设定”“自己上传”两个未来能力标签。

- [x] **Step 2: 用角色包接口填充真实图片**

在 `index.ts` 中使用已有 `COMPANION_PACK_ID` 和 `COMPANION_STATES`，为每个状态调用：

```ts
ask<StateAsset>({ type: 'companionAsset', packId: COMPANION_PACK_ID, state });
```

将 `idle` 的 `image` 设置到 `#selected-avatar`；将每个状态的 `image` 同时设置到其缩略图和 `state-popover` 内的大图。移除旧的 `new Audio`、声音开关、状态切换和上传占位逻辑。资源接口失败时沿用现有错误提示区域。

- [x] **Step 3: 运行设置页测试确认通过**

运行：

```bash
npm test --prefix /Users/bai/code/lessonpilot/v1/extension -- settings/settings.test.ts
```

预期：设置页测试通过。

### Task 3: 实现紧凑视觉和悬停大图

**Files:**
- Modify: `/Users/bai/code/lessonpilot/v1/extension/settings/settings.css`

- [x] **Step 1: 替换旧的全屏双栏样式**

将页面最大宽度收敛到插件设置级别，使用单列卡片布局；保留温和的绿色、奶油色和圆角，但取消左侧全高导航、状态按钮组、声音列表和上传大卡片。

- [x] **Step 2: 添加状态缩略图悬停预览**

为 `.state-thumb` 增加相对定位、独立边框和 hover 层级；`.state-popover` 默认隐藏，`.state-thumb:hover .state-popover` 显示 86px 左右的真实大图，并通过 `object-fit: contain` 保持图片比例。悬停预览不得改变当前选择，也不得播放声音。

- [x] **Step 3: 运行设置页测试和类型检查**

运行：

```bash
npm test --prefix /Users/bai/code/lessonpilot/v1/extension -- settings/settings.test.ts
npm run type-check --prefix /Users/bai/code/lessonpilot/v1/extension
```

预期：测试和 extension 类型检查均通过。

### Task 4: 更新文档、构建和最终验证

**Files:**
- Modify: `/Users/bai/code/lessonpilot/docs/superpowers/specs/2026-08-29-student-companion-plugin-integration-design.md`
- Modify: `/Users/bai/code/lessonpilot/doc/插件文件资源管理.md`
- Modify: `/Users/bai/code/lessonpilot/README.md`

- [x] **Step 1: 更新文档中的设置页说明**

明确设置页是“角色类别选择”，状态图片和声音是角色包内部资源；第一版仅开放神秘猫精灵，其他三类和自定义能力为下一版本预留。

- [x] **Step 2: 执行完整验证**

运行：

```bash
npm test
npm run type-check --prefix /Users/bai/code/lessonpilot/v1/extension
npm run check:contract
npm run check:module
npm run check:doc
git diff --check
npm run build:all --prefix /Users/bai/code/lessonpilot/v1/extension
unzip -tq /Users/bai/code/lessonpilot/v1/extension/dist/knownmapplugin.zip
```

预期：所有命令退出码为 0，构建产物中的设置页和猫咪图片资源完整，ZIP 检查通过。

- [x] **Step 3: 检查差异范围**

确认只新增设置页样式、设置页逻辑、相关测试、文档和构建产物；保留用户已有的 `v1/web/teacher` 未提交改动，不将无关修改纳入本次推送。
