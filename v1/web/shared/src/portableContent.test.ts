/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import { richDocumentFromHtml, richDocumentToHtml, richDocumentToPlainText } from './portableContent';

describe('RichPageDocument', () => {
  it('把排版和链接转换为跨客户端 JSON', () => {
    const documentValue = richDocumentFromHtml(
      '<h2>重点</h2><p><strong>先理解</strong> <span style="color:#1d5c43">再练习</span> <a href="javascript:bad()">危险</a></p>'
    );
    expect(documentValue.schemaVersion).toBe(1);
    expect(documentValue.blocks[0]).toMatchObject({ type: 'heading', level: 2 });
    expect(documentValue.blocks[1]).toMatchObject({ type: 'paragraph' });
    expect(documentValue.blocks[1].type === 'paragraph' && documentValue.blocks[1].children[0]).toEqual({ text: '先理解', marks: ['strong'] });
    expect(richDocumentToPlainText(documentValue)).toContain('先理解');
    expect(richDocumentToHtml(documentValue)).not.toContain('javascript:');
  });

  it('媒体块只保存 assetId，音视频不进入 HTML URL 真源', () => {
    const documentValue = richDocumentFromHtml(
      '<p><img src="asset://image-1" alt="图"></p><audio data-asset-id="asset://audio-1"></audio><video data-asset-id="asset://video-1"></video>'
    );
    expect(documentValue.blocks).toEqual([
      { type: 'image', assetId: 'image-1', alt: '图' },
      { type: 'audio', assetId: 'audio-1' },
      { type: 'video', assetId: 'video-1' },
    ]);
  });

  it('保留节点视频的海报资源引用', () => {
    const html = richDocumentToHtml({
      schemaVersion: 1,
      blocks: [{ type: 'video', assetId: 'video-1', posterAssetId: 'image-1' }],
    });
    expect(html).toContain('data-poster-asset-id="image-1"');
    expect(richDocumentFromHtml(html)).toEqual({
      schemaVersion: 1,
      blocks: [{ type: 'video', assetId: 'video-1', posterAssetId: 'image-1' }],
    });
  });
});
