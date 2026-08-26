# 互动节点结构化编辑器实施计划

重点标注与练习节点共用一个富页面编辑器。编辑体验允许可视化排版、颜色、链接、标题、引用和列表；HTML Tab 只是编辑输入方式，不是公共数据真源。

## 持久化模型

每个节点使用稳定 `id`，正文保存为 `content: RichPageDocument`，题型专属数据保存为 `interactionData`，窗口大小与样式保存为 `presentationHints`。不再生成或读取 `display.body`、`display.richBody`、普通正文回退或独立 HTML 真源。

```ts
type PortableNode = {
  id: string;
  interaction: 'notice' | 'choice' | 'blank' | 'free_text';
  anchor: { kind: 'time_cross'; timeSeconds: number; captionId?: string | null };
  title: string;
  content: RichPageDocument;
  interactionData: Record<string, unknown> | null;
  presentationHints?: { windowSize?: 's' | 'm' | 'l' | 'overlay'; windowStyle?: 'card' | 'document' };
};
```

节点媒体块只保存 `assetId`。图片、音频和节点内视频属于课程资源，不是 B 站课节播放视频；后者仍只在 `lesson.videoRef` 中保存。

## 编辑器边界

- Quill 可视化编辑器提供标题、粗体、斜体、下划线、颜色、列表、引用和链接。
- HTML Tab 进入和离开时先经过有限标签与协议消毒，然后立即转换为 `RichPageDocument`。
- 当前资源上传/CDN/资源选择器不在本阶段实现；插图入口只接受已存在的 `assetId`，不允许保存外部图片 URL。
- 创建课程和课节不创建草稿；首次保存时以整节聚合原子创建草稿。

## 验收

- 节点移动、排序、修改正文不改变 `id`，删除后不复用。
- 后端草稿、发布快照和插件安装均拒绝未知文档版本、未知内容块、旧 `display/body` 字段和缺失资源。
- 发布快照保存节点内容与资源清单；后续草稿修改不影响已发布版本。
