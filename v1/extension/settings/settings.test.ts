import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf8');
const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
const stylesheet = readFileSync(resolve(__dirname, 'settings.css'), 'utf8');

describe('学习助手头像独立设置页', () => {
  it('展示角色类别和当前猫咪的六个真实状态预览', () => {
    expect(html).toContain('选择你的学习伙伴');
    expect(html).toContain('神秘猫精灵');
    expect(html).toContain('元气狗狗伙伴');
    expect(html).toContain('奇趣森林伙伴');
    expect(html).toContain('未知世界伙伴');
    for (const state of ['focus', 'idle', 'prompt', 'correct', 'wrong', 'complete']) {
      expect(html).toContain(`data-state-preview="${state}"`);
    }
    expect(html).toContain('下一版本完成');
    expect(html).toContain('个性设定');
    expect(html).toContain('自己上传');
    expect(html).not.toContain('选择一个即可');
    expect(html).not.toContain('data-audio');
    expect(html).not.toContain('sound-switch');
    expect(html).not.toContain('upload-box');
  });

  it('通过 background 白名单消息按角色包和状态读取真实图片', () => {
    expect(source).toContain("type: 'companionAsset'");
    expect(source).toContain('COMPANION_PACK_ID');
    expect(source).toContain('COMPANION_STATES');
    expect(source).toContain('packId: COMPANION_PACK_ID');
    expect(source).toContain('state });');
    expect(source).toContain('data-state-preview');
    expect(source).toContain('chrome.runtime.getManifest().version');
  });

  it('为状态缩略图提供独立的悬停大图层', () => {
    expect(stylesheet).toContain('.state-popover');
    expect(stylesheet).toContain('.state-thumb:hover .state-popover');
    expect(stylesheet).toContain('object-fit: contain');
  });
});
