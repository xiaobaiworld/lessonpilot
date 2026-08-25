# KnownMap Logo 资源说明

状态：当前品牌资源说明
日期：2026-08-25
数据真源：[`v1/assets/brand/knownmap-tokens.json`](../v1/assets/brand/knownmap-tokens.json)

**改 Logo 颜色、折线端点或字标 K/M 时，先改 `knownmap-tokens.json`，再改 SVG 和 CSS。**
色值以该 JSON 的 `colors.pathStart` / `colors.pathEnd` 为准；页面和插件不得另写一套。

关联决策：`doc/DECISIONS.md` 的 D-014
关联规范：[`docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md`](../doc/archive/2026-08-22-pre-v1-rewrite/docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md)

## 核心含义

KnownMap 的 Logo 使用“地图窗口”作为核心图形：

- 地图外轮廓：代表可以进入、展开和理解的知识空间；
- 内部折线路径：代表从内容理解到下一步行动的学习路径；
- 两个节点：代表路径上的关键知识停靠点；
- 两条弱化竖线：代表地图的折页与空间分区，不应抢过主路径；
- 深墨绿：代表稳定、可信和持续探索；
- 暖金色与陶土色节点：代表重点、练习、反馈等不同类型的学习停靠点。

Logo 不只是装饰。涉及“知识地图”“学习路径”“关键节点”“从理解到行动”等文案或视觉表达时，可以复用这些含义；不要把它解释成真实地理地图、导航产品或单纯的视频播放器。

## 当前三种形态

三种形态共享同一套地图轮廓、路径、节点和竖线几何，只改变外框或适配颜色：

| 形态 | 资源 | 适用场景 |
| --- | --- | --- |
| 圆形深绿底 | `v1/assets/brand/knownmap-circle.svg` | 网页品牌头像、favicon、需要明确品牌容器的入口 |
| 方形深绿底 | `v1/assets/brand/knownmap-square.svg` | Chrome 扩展入口、工具栏、方形应用容器 |
| 透明背景 | `v1/assets/brand/knownmap-transparent.svg` | 浅色页面、文档、印刷物、自定义背景和不希望带外框的场景 |

透明背景版的地图边缘和主路径使用品牌深绿色 `#1D5C43`，不使用纯黑；这样在浅色背景上保持清晰，同时与 KnownMap 的品牌色一致。

所有形态的内部地图几何围绕 260 x 260 画布中心缩放为原尺寸的 82%。圆形和方形背景尺寸保持不变，内部地图与容器边缘之间必须保留均衡安全留白。

## 颜色规范

色值只维护在 `knownmap-tokens.json` 的 `colors` 里。下表是该文件的可读摘要：

| 角色 | JSON 键 | 用途 |
| --- | --- | --- |
| 深墨绿底 | `containerGreen` | 圆形和方形品牌容器 |
| 品牌深绿 | `brandGreen` | 透明背景版外轮廓和主路径 |
| 浅灰绿轮廓 | `mapStroke` | 深色底上的地图外轮廓 |
| 纸白主路径 | `pathStroke` | 深色底上的清晰学习路径 |
| 弱化竖线 | `foldStroke` | 深色底上的空间折页线 |
| 透明版竖线 | `foldStrokeOnLight` | 浅色背景上的弱化分区线 |
| 暖金节点 / 字标 K | `pathStart` | 折线起点；KnownMap 的 K |
| 陶土节点 / 字标 M | `pathEnd` | 折线终点；KnownMap 的 M |

不要为 Logo 增加渐变、阴影、字母缩写、纯黑边缘或新的高饱和主色。

字标规则：`K` 用 `pathStart`，`M` 用 `pathEnd`，其余字母跟随正文墨色。CSS 选择器见 JSON 的 `cssSelectors`。

## 使用规则

- 页面品牌入口优先使用圆形版；工具栏和扩展入口优先使用方形版。
- 页面背景已经提供品牌容器时，使用透明背景版，避免重复套圆形或方形底。
- 文案描述 Logo 时，优先使用“知识空间”“学习路径”“关键节点”“理解与行动”这些语义。
- 不要把节点颜色固定解释成某一种功能，除非页面本身已经定义了对应节点类型。
- 不要将内部路径画到外轮廓之外；两条竖线必须收在地图边界内部。
- 所有尺寸导出必须来自同一套 SVG 几何，不能为小尺寸临时画另一套图形。
- 教师应用页眉字标中的 `K` / `M` 使用 tokens 里的 `pathStart` / `pathEnd`；其余字母保持深墨色。

## 当前导出资源

现有扩展和网页资源仍由主 Logo 源文件导出：

- `v1/assets/brand/knownmap-logo.svg`：当前主 Logo 源文件；
- `v1/extension/assets/icon-16.png`、`v1/extension/assets/icon-24.png`、`v1/extension/assets/icon-48.png`、`v1/extension/assets/icon-128.png`：扩展图标；
- `v1/site/assets/knownmap-icon.png`：网页图标。

三种形态的 SVG 变体集中在 `v1/assets/brand/`。后续确认具体页面采用哪一种后，再为该形态补齐对应的 16/24/48/128 PNG 导出，并在页面引用中统一切换。
