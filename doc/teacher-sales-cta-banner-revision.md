# 销售页深绿 CTA 横幅修订方案

> 文档状态（2026-08-21）：方案待实施。只改视觉层级与对比度，不改正文案与转化语义。  
> 关联：`doc/teacher-sales-page-design.md`（主转化定义）、`doc/plans/stage-1b-sales-page-revision.md`（CTA / 话术 / 飞书降级）、实现文件 `teacher-web/forsales.html`。

版本：0.1  
更新时间：2026-08-21  
状态：方案稿（未改实现）

---

## 1. 背景与目标

### 1.1 背景

销售页收口区是深绿横幅（`<section class="wrap cta">` → `.cta-card`，背景 `var(--dark)` = `#103b2b`）。设计意图（见 `doc/teacher-sales-page-design.md` §2、§5）是：

> 页面末尾只有一个主转化动作「回复我，试一节真实课」；飞书表单是清晰降级的次要入口；复制话术只是辅助，且须说明仅复制到剪贴板。

当前截图区暴露两个可感知问题：

1. **左侧**四条 `.cta-terms` 在深绿底上发灰、发糊，难以扫读。  
2. **右侧**多个动作挤在一起，黄底「复制试用话术」视觉权重高于主转化主题块，主题不突出。

### 1.2 目标

| 目标 | 说明 |
|------|------|
| 可读性 | 左侧条款在深绿底上对比度足够，扫读不吃力 |
| 层级清晰 | 一眼先看到「回复我，试一节真实课」，再看到辅助动作 |
| 语义不变 | 不改条款文案、主转化文案、话术内容、表单/插件行为 |
| 可落地 | 选择器、颜色、字号、结构可直接对照 `forsales.html` 实施 |

### 1.3 成功判据（一句话）

在桌面与 375px 宽度下，深绿 CTA 卡仍是「左说明 + 右行动」；左条款清晰可辨；右栏视觉主轴是「回复我，试一节真实课」，黄按钮不再抢戏。

---

## 2. 问题诊断（已核对代码）

### 2.1 现状结构（`teacher-web/forsales.html`）

```text
section.wrap.cta
└─ .cta-card                    /* grid: 1fr | auto；bg: --dark #103b2b；color: #fff */
   ├─ 左栏
   │  ├─ .eyebrow               /* #a9d2be */
   │  ├─ h2                     /* 白字大标题 */
   │  └─ ul.cta-terms           /* 四条条款 */
   └─ 右栏 .cta-action          /* text-align: center */
      ├─ p.cta-primary          /* 「回复我，试一节真实课」+ 渠道说明 */
      ├─ button#copy-request.button.secondary  /* 复制试用话术 */
      ├─ small                  /* 剪贴板说明 */
      ├─ .trial-intake[hidden]  /* 飞书表单挂载；无效 URL 时隐藏 */
      └─ .plugin-download       /* 学生插件下载 */
```

### 2.2 左侧：条款对比度错误

| 选择器 | 当前样式 | 问题 |
|--------|----------|------|
| `.cta-terms` | `color: var(--muted)` → `#52635b`；`font-size: 11px`；`line-height: 1.75` | `--muted` 为**浅色纸面**副文案色，叠在 `#103b2b` 上几乎同明度，发糊 |
| `.cta-terms b` | `color: var(--ink)` → `#16251f` | `--ink` 比深绿底更暗，加粗词反而更糊 |

同卡内已正确使用浅绿系的参考：

- `.cta .eyebrow` → `#a9d2be`
- `.cta p` → `#c7dbd0`
- `.cta small` → `#aac6b7`
- `.cta-primary span` → `#d8e8e0`

**结论**：不是文案问题，是 token 误用。应在 `.cta` 作用域内改用浅绿系，或给 `.cta-terms` / `.cta-terms b` 单独指定深绿底可读色。

### 2.3 右侧：层级颠倒

| 层级意图（设计文档） | 当前视觉表现 | 冲突 |
|----------------------|--------------|------|
| 主转化：回复我 | `.cta-primary`：`background: var(--brand)` `#1d5c43`，与卡底 `#103b2b` 差小；标题仅 `14px` | 像说明卡，不像主行动 |
| 辅助：复制话术 | `.cta .button` 覆盖为实心黄 `#f5d569` / 字色 `#1c3028`；全宽感强、对比最高 | **抢戏**，像主按钮 |
| 降级：飞书表单 | `.trial-intake .button`：描边透明底白字（与黄按钮同 specificity，后声明胜出） | 权重尚可，但与插件同级、间距紧 |
| 工具：插件下载 | `.plugin-download .button`：同上描边样式；`margin-top: 18px` | 与表单视觉双胞胎，进一步稀释焦点 |

补充：全局 `.button.secondary` 是浅底深字，在 CTA 内被 `.cta .button { background:#f5d569; ... }` 整段盖掉，因此「复制试用话术」实际是**唯一实心高对比按钮**。

### 2.4 与设计文档的偏差

`doc/teacher-sales-page-design.md` 已规定：主转化唯一、复制为辅助、表单为降级。代码结构顺序大体正确，但**样式权重**与文档相反——黄按钮成了视觉主 CTA。

---

## 3. 修改范围与不改范围

### 3.1 修改范围

| 项 | 说明 |
|----|------|
| 文件 | 优先 `teacher-web/forsales.html` 内联 CSS；必要时微调 `.cta-action` 内 HTML **包裹顺序/分组 class**（文案节点内容不变） |
| 左栏样式 | `.cta .cta-terms`、`.cta .cta-terms b`（或等价作用域选择器） |
| 右栏样式 | `.cta-primary`、`.cta .button` / 更精确的 `#copy-request` 或 `.cta-action > .button`、`.trial-intake`、`.plugin-download` 间距与按钮权重 |
| 可选结构 | 为四级层级增加轻量分组（如 `.cta-theme` / `.cta-assist` / `.cta-degrade` / `.cta-tool`），便于样式与验收 |

### 3.2 不改范围

- 四条 `.cta-terms` 文案、`h2` / `eyebrow` 文案  
- 「回复我，试一节真实课」及渠道说明 span 文案  
- 「复制试用话术」按钮文案、剪贴板 `requestText`、toast 逻辑  
- `trial-intake.js` 行为与隐藏规则、飞书 URL 策略  
- 插件下载路径与说明文案  
- 页面其他区块、全局 `:root` token（避免波及浅色区 `--muted` / `--ink`）  
- 不在本方案实施阶段改 `doc/teacher-sales-page-design.md` 正文（实施后可补一句「深绿 CTA 对比度与右栏四级层级」交叉链接）

---

## 4. 推荐方案（主方案）：右栏四级层级 + 左栏提亮

核心：**结构/样式明确四级**；颜色与字号服务于「主题最重、复制辅助、表单降级、插件工具」。

### 4.1 左栏：条款微微提亮（文案不动）

仅改 `.cta` 内条款色，避免改全局 `--muted` / `--ink`。

| 选择器 | 建议 | 理由 |
|--------|------|------|
| `.cta .cta-terms` | `color: #c7dbd0`（与 `.cta p` 一致）或略浅 `#d2e4da`；保持 `11px` / `1.75`，可选升至 `12px` 若 375px 仍吃力 | 与深绿底拉开对比，仍低于白标题 |
| `.cta .cta-terms b` | `color: #eef6f1` 或 `#fff`；`font-weight` 保持现有加粗 | 关键词可读，不抢 `h2` |
| 列表间距 | 保持 `margin: 9px 0 0`；`padding-left: 17px`；若需更疏，`li + li` 可加 `margin-top: 2px`（可选） | 不改变版式骨架 |

对比度目标（相对 `#103b2b`）：正文字色 ≈ 浅薄荷绿，加粗接近白；肉眼扫读清晰即可，不必追求 AA 大段正文标准，但应明显优于当前 `#52635b` / `#16251f`。

### 4.2 右栏：四级视觉层级

#### Level 1 — 主题（主转化）

目标：右栏第一视线落点。

| 项 | 建议 |
|----|------|
| 节点 | 现有 `p.cta-primary`（可外包一层 `.cta-theme`，可选） |
| 背景 | 从弱绿块改为**高对比主面**：推荐 `background: #f5d569`（现黄）或略沉的 `#e8c44a`；字色 `#1c3028` |
| 标题 `b` | `font-size: 16px`～`17px`；`font-weight: 800`；行高 `1.35` |
| 说明 `span` | `color: #3a4f44` 或 `rgba(28,48,40,.78)`；`font-size: 11px`～`12px`（现 `10px` 偏小） |
| 内边距 | `padding: 14px 16px`；`border-radius: 8px`；`margin: 0 0 12px` |
| 语义 | **不是**可点按钮（仍无 `href`/`onclick` 发消息）；视觉上是「行动主题卡」，诚实边界不变 |

说明：把黄色从「复制按钮」挪到「主题卡」，符合「主转化是回复我」；复制降为辅助后不再需要最亮实心黄。

#### Level 2 — 复制辅助

| 项 | 建议 |
|----|------|
| 节点 | `#copy-request` |
| 样式 | **取消**作为全 CTA 区默认黄底；改为描边次按钮：`background: transparent`；`border: 1px solid #aac6b7`；`color: #e8f3ec`；`font-weight: 700`；`min-height` 可略小于主题卡视觉高度 |
| Hover | `background: #184b39`（与现 `.trial-intake .button:hover` 一致） |
| 选择器 | 用 `.cta-action > .button` 或 `#copy-request`，**不要**再写笼统的 `.cta .button { background:#f5d569 }`，以免再次盖掉表单/插件描边 |
| 下方 `small` | 保持 `#aac6b7` / `11px`；`max-width` 可放宽至 `260px`，居中或左对齐随断点 |

#### Level 3 — 表单降级

| 项 | 建议 |
|----|------|
| 节点 | `.trial-intake`（逻辑仍由 `trial-intake.js` 控制 `[hidden]`） |
| 间距 | `margin-top: 16px`；与 Level 2 之间可用 `padding-top: 14px; border-top: 1px solid rgba(169,210,190,.28)` 轻分隔 |
| 按钮 | 维持描边透明底；字号可 `13px`，视觉权重 ≤ Level 2 |
| 文案 | 不改；仅保证「不方便私信」语义仍是降级路径 |

#### Level 4 — 插件工具

| 项 | 建议 |
|----|------|
| 节点 | `.plugin-download` |
| 间距 | `margin-top: 14px`；可比表单再弱一档（字号 `12px` 或按钮 `opacity`/`border-color` 略淡，如边框 `#7f9e90`） |
| 角色 | 明确是**工具下载**，不是转化；不与主题抢色 |

### 4.3 建议 DOM 微调（可选但推荐）

文案不变，仅分组，便于 CSS 与验收：

```html
<div class="cta-action">
  <div class="cta-theme">
    <p class="cta-primary">…</p>
  </div>
  <div class="cta-assist">
    <button …>复制试用话术</button>
    <small>…</small>
  </div>
  <div class="cta-degrade trial-intake" data-trial-intake hidden>…</div>
  <div class="cta-tool plugin-download">…</div>
</div>
```

注意：若给 `.trial-intake` 增加并列 class，须确认 `trial-intake.js` 仍只依赖 `[data-trial-intake]` / `[hidden]`，不因多 class 失效。

### 4.4 响应式

现有 `@media (max-width: 920px)`：`.cta-card` 单列、`.cta-action` 左对齐——保留。  
实施时确认：单列后 Level 1 仍在复制按钮之上；375px 下主题卡不溢出、按钮可点区域 ≥ 44px 高（可维持现 `min-height: 46px`）。

### 4.5 颜色落地速查（推荐取值）

| 用途 | Token / 色值 |
|------|----------------|
| 卡底 | `--dark` `#103b2b`（不变） |
| 条款正文 | `#c7dbd0` |
| 条款加粗 | `#eef6f1` |
| 主题卡底 | `#f5d569` |
| 主题卡标题 | `#1c3028` |
| 主题卡说明 | `#3a4f44` |
| 辅助/降级/工具描边按钮 | 边 `#aac6b7`，字 `#e8f3ec`，hover `#184b39` |
| 辅助说明 small | `#aac6b7` |

---

## 5. 备选方案（仅 CSS，少动结构）

在不增加分组 class、不改 DOM 顺序的前提下，用更高优先级选择器纠偏：

1. **左栏**：同主方案，写 `.cta .cta-terms` / `.cta .cta-terms b`。  
2. **主题**：强化 `.cta-primary`（加大字号、加深/提亮底、加内边距）；若不愿把黄挪到主题卡，可用更亮绿底 `#1f6b4e` + 白字，并给主题卡 `box-shadow: 0 0 0 1px rgba(245,213,105,.55)` 用金边暗示焦点。  
3. **复制按钮**：覆盖为  
   `.cta-action > .button { background: transparent; border: 1px solid #aac6b7; color: #e8f3ec; }`  
   并**删除或收窄** `.cta .button { background:#f5d569 }`。  
4. **表单/插件**：维持现有描边样式，仅用 `margin-top` 拉开。

**取舍**：备选改动面更小、回归风险低；但主题「不像按钮却最抢眼」的叙事略弱于主方案把黄色赋予主题卡。若排期紧或要最小 diff，可先上备选，再迭代到主方案。

---

## 6. 验收标准

### 6.1 视觉与层级

1. 深绿底上四条条款正文字色不再使用全局 `--muted` / `--ink`；肉眼清晰，加粗词可辨。  
2. 右栏第一视觉焦点是「回复我，试一节真实课」主题块，而非「复制试用话术」。  
3. 「复制试用话术」可辨、可点，但对比度与面积明显低于主题块。  
4. 飞书入口显示时，视觉权重低于复制辅助；隐藏时不留空白洞（现有 `[hidden]` 行为保留）。  
5. 插件下载权重最低，不与主题同色同重量。

### 6.2 语义与行为（回归）

6. 主转化仍是回复当前私信/微信；页面不伪装自动发送。  
7. 复制成功提示仍说明「已复制、需自行粘贴发送」。  
8. 飞书 URL 无效时整块隐藏；有效时新标签打开（既有规则）。  
9. 条款与主题文案零改动（diff 中无对应文本变更）。

### 6.3 适配

10. 桌面双栏与 ≤920px 单列均无横向溢出；375px 下条款与按钮可读可点。

### 6.4 建议验证方式

- 浏览器对照：实施前后同断面截图（桌面 + 375）。  
- 自动化：若已有 `tests/sales-page-copy.test.js` / 信息架构测试，断言文案与主转化字符串仍在；可增断言 `.cta-terms` 计算色不等于 `--muted` 解析值（可选）。  
- 手动：复制按钮、toast、飞书显隐、插件下载链接。

---

## 7. 实施步骤清单

1. [ ] 在 `forsales.html` 备份或分支上打开内联 `<style>`，定位 `.cta-terms`、`.cta-primary`、`.cta .button`、`.trial-intake`、`.plugin-download`。  
2. [ ] **左栏**：增加 `.cta .cta-terms` / `.cta .cta-terms b` 覆盖色（按 §4.1）；确认未改全局 `:root`。  
3. [ ] **收窄黄按钮规则**：删除或改写笼统 `.cta .button { background:#f5d569 }`，避免污染表单/插件。  
4. [ ] **Level 1**：按 §4.2 强化 `.cta-primary`（主方案：黄底深字；或备选：亮绿+金边）。  
5. [ ] **Level 2**：为 `#copy-request` / `.cta-action > .button` 设描边次按钮样式与 hover。  
6. [ ] **Level 3–4**：调整 `.trial-intake`、`.plugin-download` 的 `margin-top` / 可选顶部分隔线；必要时略降插件边框对比。  
7. [ ] （推荐）按 §4.3 增加分组 class，核对 `trial-intake.js` 选择器。  
8. [ ] 桌面 + 920 断点 + 375 目视验收 §6。  
9. [ ] 跑相关销售页文案/复制测试；手动点复制与插件下载。  
10. [ ] 实施完成后：在 `doc/teacher-sales-page-design.md` 验收条旁加交叉链接至本文；`doc/INDEX.md` 可增一行「CTA 横幅对比度与层级修订」。

---

## 8. 风险与回滚

| 风险 | 缓解 |
|------|------|
| `.cta .button` 一刀切导致表单/插件也变黄（现状已部分靠后声明抵消，易再踩坑） | 改用更精确选择器；实施后 DevTools 检查三颗按钮计算样式 |
| 主题卡过黄被误认为可点击发送 | 保持非 `<button>`/`<a>`；说明 span 保留「回复当前私信/微信」 |
| 分组 class 影响 JS | 只加 class，不改 `data-*` / `id` |
| 全局 token 误改波及全页 | 禁止改 `:root --muted/--ink`；仅 `.cta` 作用域覆盖 |

回滚：还原 `forsales.html` 内联 CSS（及可选 DOM 分组）即可；无后端迁移。

---

## 9. 决策摘要

| 项 | 决策 |
|----|------|
| 左栏 | 深绿作用域提亮条款色；文案不动 |
| 右栏 | 四级：主题 → 复制辅助 → 表单降级 → 插件工具 |
| 黄色 | 主方案赋予主题卡；复制改为描边次按钮 |
| 备选 | 仅 CSS：主题加重视觉、复制降黄、少动 DOM |
| 本阶段交付 | **本文方案**；不改 `forsales.html` 实现（由后续实施任务执行） |
