/** @vitest-environment happy-dom */

import { describe, expect, it } from 'vitest';
import {
  resolvePresentationHints,
  richDocumentFromHtml,
  richDocumentToHtml,
  richDocumentToPlainText,
} from './portableContent';

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

  it('可以读取教师编辑器清洗后的裸 assetId，并忽略回显 URL', () => {
    const documentValue = richDocumentFromHtml(
      '<p><img data-asset-id="image-1" src="/api/v1/teacher/assets/image-1" alt="图"></p>' +
        '<audio data-asset-id="audio-1" src="/api/v1/teacher/assets/audio-1" controls></audio>' +
        '<video data-asset-id="video-1" src="/api/v1/teacher/assets/video-1" controls></video>'
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

  it('教师预览和插件对缺失展示参数使用同一套默认值', () => {
    expect(resolvePresentationHints({})).toEqual({
      size: { widthPercent: 40, heightPercent: 30 },
      style: 'document',
      position: { xPercent: 50, yPercent: 50 },
    });
    expect(resolvePresentationHints({ windowSize: 'overlay' })).toEqual({
      size: { widthPercent: 66, heightPercent: 66 },
      style: 'card',
      position: { xPercent: 50, yPercent: 50 },
    });
    expect(resolvePresentationHints({
      windowSize: 'l',
      windowStyle: 'document',
      windowPosition: 'bottom-left',
    })).toEqual({
      size: { widthPercent: 55, heightPercent: 42 },
      style: 'document',
      position: { xPercent: 20, yPercent: 78 },
    });
    expect(resolvePresentationHints({ windowSize: 'unknown', windowPosition: 'unknown' })).toEqual({
      size: { widthPercent: 40, heightPercent: 30 },
      style: 'document',
      position: { xPercent: 50, yPercent: 50 },
    });
  });

  it('解析新数值展示配置并保留一位小数', () => {
    expect(resolvePresentationHints({
      windowSize: { widthPercent: 42.56, heightPercent: 31.24 },
      windowPosition: { xPercent: 63.44, yPercent: 28.74 },
      windowStyle: 'document',
    })).toEqual({
      size: { widthPercent: 42.6, heightPercent: 31.2 },
      style: 'document',
      position: { xPercent: 63.4, yPercent: 28.7 },
    });
  });

  it('数值展示配置越界时整组回退到默认值', () => {
    expect(resolvePresentationHints({
      windowSize: { widthPercent: 99, heightPercent: 5 },
      windowPosition: { xPercent: -1, yPercent: 101 },
      windowStyle: 'document',
    })).toEqual({
      size: { widthPercent: 40, heightPercent: 30 },
      style: 'document',
      position: { xPercent: 50, yPercent: 50 },
    });
  });
});
