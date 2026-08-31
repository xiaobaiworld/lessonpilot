# 学习助手头像设置入口正式接入计划

## Goal

将已批准的“学习助手头像设置”从设计草稿正式接入学生插件：在真实弹窗品牌栏增加设置图标，点击后打开独立设置页；设置页读取第一版小猫角色包，展示六种状态、声音试听和声音开关，并将插件版本升级为 `1.1.0`。本次不改变课程领取、课程进度和节点判分逻辑，也不提前实现自定义头像上传。

## Architecture

弹窗只负责提供入口，使用 MV3 的 `chrome.runtime.openOptionsPage()` 打开 `settings/index.html`。设置页通过现有 background 消息边界读取角色状态资源和声音开关，不直接访问课程资源、不拼接任意本地路径。角色图片、声音和完成态小鱼继续作为内置角色包随插件构建产物发布；自定义头像区域保留产品入口和格式规则说明，后续再接入 IndexedDB 上传链路。

## Tech Stack

- Chrome MV3 extension
- TypeScript + Vite
- 原生 DOM/CSS 设置页，不引入新的 UI 依赖
- Vitest 源码约束测试与现有构建门禁

## Implementation Tasks

1. 先扩展测试：断言版本为 `1.1.0`、manifest 声明独立设置页、构建产物包含设置页文件；断言弹窗品牌栏包含头像设置按钮并调用 `openOptionsPage()`。
2. 更新 manifest 构建目标和 Vite 多入口配置，增加 `options_page` 以及设置页 HTML/CSS/JS 的产物校验。
3. 在真实弹窗品牌栏右上角增加齿轮设置图标，保持现有课程入口和布局不变。
4. 新增独立头像设置页：展示当前角色包、六种状态图片、完成态小鱼和提示语、声音开关与试听按钮、插件版本；通过 background 消息加载资源和保存声音偏好。
5. 更新设计/开发文档与本机插件加载说明，明确 `1.1.0` 的加载目录、入口关系、资源边界和后续上传功能状态。
6. 运行扩展测试、类型检查、文档/契约/模块检查，构建 local 与 production 包并校验 ZIP 内容，确认 `dist/local` 可重新加载。

## Verification Commands

```bash
npm --prefix v1/extension test
npm --prefix v1/extension run type-check
npm run check:contract
npm run check:module
npm run check:doc
npm --prefix v1/extension run build:all
unzip -tq v1/extension/dist/knownmapplugin.zip
```

## Self-review

- 设置页是否只通过白名单消息取得内置资源，而不是读取任意文件或外部 URL？
- popup、manifest、Vite 产物和 ZIP 是否全部使用同一个设置页路径？
- 版本是否只在插件 manifest 的单一来源升级到 `1.1.0`，没有误改契约版本？
- 失败、无声音、设置页直接打开和完成庆祝四类状态是否都有可验证的视觉反馈？
- 自定义上传是否明确标注为后续功能，避免把预留 UI 误认为已完成？
