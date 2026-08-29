/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from 'vitest';
import {
  appendRichText,
  isSafeRichTextColor,
  isSafeRichTextHref,
  isSafeRichTextImageSrc,
  resolveWindowPresentation,
  resolveRichTextAssets,
  sanitizeRichTextHtml,
} from './richText';

describe('重点标注富文本安全渲染', () => {
  it('只允许安全协议的链接', () => {
    expect(isSafeRichTextHref('https://example.com')).toBe(true);
    expect(isSafeRichTextHref('mailto:teacher@example.com')).toBe(true);
    expect(isSafeRichTextHref('javascript:alert(1)')).toBe(false);
    expect(isSafeRichTextHref('data:text/html,unsafe')).toBe(false);
  });

  it('图片只允许 http 和 https', () => {
    expect(isSafeRichTextImageSrc('https://knownmap.com/demo.png')).toBe(true);
    expect(isSafeRichTextImageSrc('http://example.com/a.jpg')).toBe(true);
    expect(isSafeRichTextImageSrc('javascript:alert(1)')).toBe(false);
    expect(isSafeRichTextImageSrc('data:image/png;base64,abc')).toBe(false);
    expect(isSafeRichTextImageSrc('blob:https://knownmap.com/1')).toBe(false);
    expect(isSafeRichTextImageSrc('mailto:a@b.c')).toBe(false);
  });

  it('只允许十六进制或 rgb 颜色值', () => {
    expect(isSafeRichTextColor('#1d5c43')).toBe(true);
    expect(isSafeRichTextColor('rgb(29, 92, 67)')).toBe(true);
    expect(isSafeRichTextColor('expression(alert(1))')).toBe(false);
  });

  it('放行标题、颜色、链接和 https 图片，剥掉脚本协议与未知标签', () => {
    const html = sanitizeRichTextHtml(
      [
        '<h2>标题</h2>',
        '<p><span style="color: #1d5c43">绿字</span>',
        '<a href="https://knownmap.com">站内</a>',
        '<a href="javascript:alert(1)">危险</a>',
        '<img src="https://knownmap.com/demo.png" alt="示意" onclick="alert(1)">',
        '<img src="data:image/png;base64,abc" alt="丢">',
        '<script>alert(1)</script>',
        '</p>',
      ].join('')
    );

    expect(html).toContain('<h2>标题</h2>');
    expect(html).toContain('color: #1d5c43');
    expect(html).toContain('href="https://knownmap.com"');
    expect(html).toContain('src="https://knownmap.com/demo.png"');
    expect(html).toContain('alt="示意"');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:image');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('script');
    expect(html).toContain('危险');
  });

  it('appendRichText 用 DOM 节点写入，不把未消毒字符串直接赋给 innerHTML', () => {
    const target = document.createElement('div');
    appendRichText(target, '<img src="https://knownmap.com/a.png" alt="图"><p>正文</p>');
    expect(target.querySelector('img')?.getAttribute('src')).toBe(
      'https://knownmap.com/a.png'
    );
    expect(target.textContent).toContain('正文');
  });
});

describe('学习窗口外观预设', () => {
  it('合法旧枚举转换为连续展示配置', () => {
    expect(
      resolveWindowPresentation({
        windowSize: 'overlay',
        windowStyle: 'document',
        windowPosition: 'center',
      })
    ).toEqual({
      size: { widthPercent: 66, heightPercent: 66 },
      style: 'document',
      position: { xPercent: 50, yPercent: 50 },
    });
  });

  it('缺失或非法值回退到默认居中普通窗口', () => {
    expect(resolveWindowPresentation({})).toEqual({
      size: { widthPercent: 40, heightPercent: 30 },
      style: 'document',
      position: { xPercent: 50, yPercent: 50 },
    });
    expect(
      resolveWindowPresentation({
        windowSize: 'huge',
        windowStyle: 'neon',
        windowPosition: 'top-right',
      })
    ).toEqual({
      size: { widthPercent: 40, heightPercent: 30 },
      style: 'document',
      position: { xPercent: 50, yPercent: 50 },
    });
  });
});

describe('节点媒体引用', () => {
  it('只保留 assetId 标记，不把资源引用当作外部 URL', () => {
    const target = document.createElement('div');
    appendRichText(target, '<img src="asset://asset-1" alt="示例">');
    expect(target.querySelector('img')?.getAttribute('data-asset-id')).toBe('asset-1');
    expect(target.querySelector('img')?.getAttribute('src')).toBeNull();
  });

  it('清洗带服务器回显 URL 的节点媒体时仍保留资源 ID', () => {
    const html = sanitizeRichTextHtml(
      '<img data-asset-id="asset-1" src="/api/v1/teacher/assets/asset-1" alt="示例">' +
        '<audio data-asset-id="asset-2" src="/api/v1/teacher/assets/asset-2" controls></audio>'
    );
    expect(html).toContain('data-asset-id="asset-1"');
    expect(html).toContain('data-asset-id="asset-2"');
    expect(html).not.toContain('/api/v1/teacher/assets/');
  });

  it('在 content 世界把资源 ID 解析为 blob URL，并支持统一释放', async () => {
    const target = document.createElement('div');
    appendRichText(
      target,
      '<img src="asset://image-1" alt="图">' +
        '<audio data-asset-id="audio-1" controls></audio>'
    );
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob) => `blob:${(blob as Blob).type}`);
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => undefined);

    const release = await resolveRichTextAssets(target, async (assetId) => ({
      mimeType: assetId.startsWith('image') ? 'image/png' : 'audio/mpeg',
      bytes: new TextEncoder().encode(assetId).buffer,
    }));

    expect(target.querySelector('img')?.getAttribute('src')).toBe('blob:image/png');
    expect(target.querySelector('audio')?.getAttribute('src')).toBe('blob:audio/mpeg');
    release();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
