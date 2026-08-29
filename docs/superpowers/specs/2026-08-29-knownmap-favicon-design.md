# KnownMap Web favicon 设计

## 目标

让 KnownMap 教师端和管理端在浏览器标签页、书签等浏览器界面中显示统一的品牌小图标。

## 方案

复用现有资源 `v1/extension/assets/knownmap/knownmap-square.svg`，分别在以下两个 Vite HTML 入口的 `<head>` 中加入 favicon 声明：

- `v1/web/teacher/index.html`
- `v1/web/admin/index.html`

使用从各 HTML 入口指向共享 SVG 的相对路径，让 Vite 在构建时解析并复制该资源；不依赖部署站点根路径，因为两个 Web 应用都配置了 `base: './'`。

## 数据流与边界

浏览器加载 HTML 入口时读取 `<link rel="icon">`，再请求构建后的 SVG 资源。React 路由和页面组件不参与 favicon 加载，也不需要为每个路由单独处理。

## 错误处理

favicon 加载失败不会影响页面主体功能；构建验证需确保入口引用的资源在产物中可访问，避免留下 404 引用。

## 验证

运行 Web 应用构建命令，检查教师端和管理端均成功构建；同时检查构建产物中的入口 HTML 保留 favicon 引用，且对应 SVG 文件存在。

## 非目标

- 不设计新图标。
- 不复制 SVG 内容或改写现有 SVG 资源。
- 不修改 React 组件、路由或页面视觉内容。
