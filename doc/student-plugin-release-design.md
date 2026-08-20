# 学生插件下载与手动更新设计

日期：2026-08-20

状态：已接受，待生产部署验证

## 目标

学生可以从销售页或已安装插件的工具栏首页下载当前学生插件包。下载入口固定，
后续插件版本更新不需要修改销售页链接。

## 当前实现边界

- 插件仍以 Chrome 解压版目录交付；
- 学生主动点击“在线更新”时，插件自动下载最新 `knownmapplugin.zip`；
- 下载后由学生替换本地解压目录，并在 Chrome 扩展管理页手动刷新；
- 不实现 Chrome 后台自动升级；
- 不引入 `.crx`、`updates.xml`、`update_url` 或插件自更新私钥。

## 固定入口

网页和插件统一使用：

```text
/downloads/student-plugin/knownmapplugin.zip
```

完整生产地址：

```text
https://knownmap.com/downloads/student-plugin/knownmapplugin.zip
```

销售页使用站点根路径，不能使用相对当前 HTML 文件目录的 `./downloads/...`。

## 压缩包结构

发布包从精确 Git commit 的 `src/` 目录组装。解压后的第一层必须直接包含：

```text
manifest.json
background/
content/
popup/
shared/
assets/
```

不能多包一层 `src/` 或版本目录，否则学生在扩展管理页选择目录时会选错。

## 服务器与发布目录

静态发布包中的路径为：

```text
public/downloads/student-plugin/knownmapplugin.zip
```

生产服务器通过现有 Web 发布链路进入：

```text
/var/www/knownmap/releases/<release-id>/public/downloads/student-plugin/knownmapplugin.zip
```

`/var/www/knownmap/current` 原子切换后，固定下载地址始终指向当前网页发布中的插件包。
旧 Web 发布目录保留，因此可以随网页发布一起回滚插件包。

## 发布流程

```text
修改 src/
→ 修改 src/manifest.json 版本号
→ 提交并推送 GitHub
→ tools/web-release.sh 从精确 commit 组装销售页和插件包
→ 校验 ZIP 根目录、SHA256 和销售页测试
→ 发布到 knownmap.com
→ 验证固定下载地址返回 200
```

同一次 Web 发布中，销售页、教师工作台和学生插件包使用同一个 commit。插件包不把
`src/` 源码目录作为独立公网目录发布，只发布压缩包。

## 学生更新流程

```text
点击插件里的“在线更新”
→ 下载 knownmapplugin.zip
→ 解压并替换本地插件目录
→ 打开 chrome://extensions/
→ 点击 KnownMap 的“重新加载”
→ 刷新 B 站页面
```

销售页的“学生插件下载”链接执行同一个固定下载动作。

## 回滚

插件包不覆盖旧发布目录。线上下载异常或新插件验证失败时，使用既有 Web 发布回滚，
使固定下载地址重新指向上一份发布包。

## 后续重开条件

- 需要不依赖学生替换目录的真正一键安装；
- 需要 Chrome 后台自动检查和升级；
- 需要 Chrome Web Store 或企业策略分发；
- 插件包与销售页需要独立发布、独立回滚或进入对象存储/CDN。
