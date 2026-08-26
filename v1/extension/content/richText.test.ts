import { describe, expect, it } from 'vitest';
import { isSafeRichTextColor, isSafeRichTextHref } from './richText';

describe('重点标注富文本安全渲染', () => {
  it('只允许安全协议的链接', () => {
    expect(isSafeRichTextHref('https://example.com')).toBe(true);
    expect(isSafeRichTextHref('mailto:teacher@example.com')).toBe(true);
    expect(isSafeRichTextHref('javascript:alert(1)')).toBe(false);
    expect(isSafeRichTextHref('data:text/html,unsafe')).toBe(false);
  });

  it('只允许十六进制或 rgb 颜色值', () => {
    expect(isSafeRichTextColor('#1d5c43')).toBe(true);
    expect(isSafeRichTextColor('rgb(29, 92, 67)')).toBe(true);
    expect(isSafeRichTextColor('expression(alert(1))')).toBe(false);
  });
});
