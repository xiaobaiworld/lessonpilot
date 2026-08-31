# 学生插件内容脚本单文件构建设计

状态：已接受，待实现
日期：2026-08-31

## 问题

Chrome 当前打开 B 站视频时，两个已安装的 KnownMap 扩展实例都在 `content/index.js` 第一行报 `Cannot use import statement outside a module`。现有生产包的内容脚本仍引用 `../portableContent.js`，但 `manifest.json` 的 `content_scripts` 只能以普通脚本方式注入。内容脚本因此没有执行，陪伴助手、课程匹配和节点触发都不会开始。

课程数据不是本次问题来源。阿里云课程快照已包含 `BV1xihA6PE6g`、10.007 秒节点和字幕。

## 目标与非目标

目标：

- 让 `dist/local/content/index.js` 和 `dist/production/content/index.js` 都成为可由 Chrome 普通内容脚本直接执行的单文件。
- 保持 `background/service-worker.js` 的模块化构建，以及 popup/settings 的模块化 HTML 入口。
- 将学生插件版本从 `1.2.1` 升到 `1.2.2`。
- 在发布前拒绝仍含顶层静态 `import` 的内容脚本。
- 重新构建、发布和验证 B 站页面上的陪伴助手与 10 秒节点。

非目标：

- 不修改课程、字幕、节点或授权码数据。
- 不重写陪伴助手运行时逻辑。
- 不改变课程匹配规则、节点触发规则或学习状态协议。

## 方案

保留当前 MV3 清单，让内容脚本入口使用专门的单入口构建配置，开启 Rollup 的 `inlineDynamicImports: true`，把内容脚本所需依赖全部内联到 `content/index.js`。其他入口继续走多入口构建，以保留 service worker 和 HTML 模块入口的现有结构。

不采用把 content script 改成模块的方案，因为 Chrome `content_scripts` 清单没有可用的 `type: module` 配置。也不采用复制共享模块的方案，因为它会制造两份运行时代码并增加后续漂移风险。

## 验收

- 构建后的两个内容脚本首行不是 `import`，且不包含静态模块入口。
- 本机扩展加载 B 站页面时无内容脚本语法错误，页面出现 `#knownmap-student-companion`。
- 对 `BV1xihA6PE6g` 的课程运行时能启动，10.007 秒节点能暂停视频并显示互动窗口。
- 线上下载的 `knownmapplugin.zip` 版本为 `1.2.2`，内容脚本可按普通脚本加载。
- 代码、构建、发布和浏览器验证通过后，工作树保持干净。
