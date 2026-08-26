import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('学生页面入口回归', () => {
  it('必须挂载旧版学生助手能力，而不是只启动课程窗口', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');

    expect(source).toMatch(/StudentCompanion/);
    expect(source).toMatch(/mount\(/);
    expect(source).toMatch(/onTogglePlayback/);
    expect(source).toMatch(/library/);
    expect(source).toMatch(/redeem/);
  });

  it('重点提示必须使用确认并继续，避免旧版交互倒退', () => {
    const source = readFileSync(resolve(__dirname, 'window.ts'), 'utf8');
    expect(source).toMatch(/确认并继续/);
  });

  it('教师正文编辑器必须同时提供可视化和 HTML 两种方式', () => {
    const source = readFileSync(
      resolve(__dirname, '../../web/teacher/src/components/RichTextEditor.tsx'),
      'utf8'
    );
    expect(source).toMatch(/可视化/);
    expect(source).toMatch(/HTML/);
    expect(source).toMatch(/quill/i);
  });

  it('工具栏课程库必须继续显示 KnownMap 原有图标', () => {
    const source = readFileSync(resolve(__dirname, '../popup/index.ts'), 'utf8');
    expect(source).toMatch(/icon-48\.png/);
  });

  it('学生助手要同步视频播放状态并在页面销毁时停止同步', () => {
    const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
    expect(source).toMatch(/companion\.setState/);
    expect(source).toMatch(/setInterval/);
    expect(source).toMatch(/clearInterval/);
  });
});
