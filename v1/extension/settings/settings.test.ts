import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(__dirname, 'index.html'), 'utf8');
const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
const stylesheet = readFileSync(resolve(__dirname, 'settings.css'), 'utf8');

describe('学习助手头像独立设置页', () => {
  it('展示角色类别和当前猫咪的六个真实状态预览', () => {
    expect(html).toContain('返回插件');
    expect(html).toContain('选择你的学习伙伴');
    expect(html).toContain('神秘猫精灵');
    expect(html).toContain('元气伙伴');
    expect(html).toContain('森林伙伴');
    expect(html).toContain('未知世界伙伴');
    for (const state of ['focus', 'idle', 'prompt', 'correct', 'wrong', 'complete']) {
      expect(html).toContain(`data-state-preview="${state}"`);
    }
    expect(html).toContain('下一版本完成');
    expect(html).not.toContain('选择一个即可');
    expect(html).toContain('data-audio-preview');
    expect(html).toContain('sound-switch');
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
    expect(source).toContain("type: 'companionSound'");
    expect(source).toContain("type: 'setCompanionSound'");
  });

  it('以一个主头像承载状态预览，并保持缩略图可交互', () => {
    expect(html).toContain('id="selected-avatar"');
    expect(source).toContain("addEventListener('mouseenter'");
    expect(source).toContain("addEventListener('focus'");
    expect(stylesheet).toContain('.selected-avatar');
    expect(stylesheet).toContain('.state-thumb');
    expect(stylesheet).toContain('object-fit: contain');
    expect(stylesheet).toContain('#00aeec');
    expect(stylesheet).not.toContain('min-width: 520px');
    expect(stylesheet).not.toContain('width: min(720px');
  });
});
