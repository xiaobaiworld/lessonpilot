# KnownMap 品牌组合标识修正设计

版本：0.1

更新时间：2026-08-18

状态：已确认，待实现验证

关联文档：

- 品牌设计：`docs/superpowers/specs/2026-08-18-knownmap-brand-update-design.md`
- Logo 资源：`docs/knownmap-logo-resources.md`
- 当前教师应用设计：`doc/teacher-platform-experience-polish-design.md`
- 实施计划：`doc/plans/knownmap-brand-lockup-refinement.md`

## 1. 目标

修正教师页面顶部的 KnownMap 品牌组合标识：

1. 保持圆形 Logo 外部尺寸不变，把内部地图轮廓、路径、折页线和两个节点整体缩小到
   当前几何的 82%，围绕画布中心缩放，避免内部线框贴近圆形边缘。
2. 教师应用的产品类别由“课程设计平台”改为“互动课程工具”。
3. `KnownMap` 字标中的 `K` 使用暖金节点色 `#D9A51E`，`M` 使用陶土节点色
   `#A9654E`，其余字母保持当前深墨色。

## 2. 资源规则

- `src/assets/knownmap-logo.svg` 继续作为唯一主 Logo 源文件。
- 圆形、方形和透明 SVG 变体共享同一套缩小后的内部几何。
- 16、24、48、128 像素扩展 PNG 与网页 48 像素 PNG 均从新主几何重新导出。
- 不缩小圆形或方形背景，不通过页面 CSS 临时给图片增加内边距。
- 不增加渐变、阴影、第三种强调色或新的字母造型。

## 3. 字标规则

品牌字标仍读作 `KnownMap`，只给两个首字母增加颜色：

```text
K -> 暖金色节点
M -> 陶土色节点
nown / ap -> 深墨色
```

颜色用于页眉品牌字标，不用于正文中的 `KnownMap`，也不修改插件协议、JavaScript 全局名、
存储键或域名写法。

## 4. 产品称呼

教师应用统一使用：

```text
品牌：KnownMap
产品类别：互动课程工具
完整名称：KnownMap 互动课程工具
```

登录页标题、页面标题、meta description、运行时 document title、课程创建说明和当前权威文档
同步修改。课程编辑功能内部仍可使用“课程设计”描述具体动作。

## 5. 验收

- 圆形 Logo 内部地图四周有明显、均衡的安全留白；
- SVG 变体和全部 PNG 导出来自同一缩小几何；
- 教师应用不再显示“课程设计平台”；
- 页眉 `K`、`M` 分别与 Logo 两个节点颜色一致；
- 1440px 和 375px 页眉无重叠或页面级横向溢出；
- 现有品牌、页面和教师工作台测试通过。
