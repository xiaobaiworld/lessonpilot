import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
const updateSource = readFileSync(resolve(__dirname, 'update.ts'), 'utf8');
const stylesheet = readFileSync(resolve(__dirname, 'popup.css'), 'utf8');

describe('V1.0.5 弹窗保留旧版入口并保留 V1 能力', () => {
  it('恢复 0.9.2 的品牌、教师登录和在线更新入口', () => {
    expect(source).toMatch(/课程助手/);
    expect(source).toMatch(/chrome\.runtime\.getManifest\(\)\.version/);
    expect(source).toMatch(/教师登录/);
    expect(source).toMatch(/chrome\.downloads\.download/);
    expect(updateSource).toMatch(/knownmapplugin\.zip/);
    expect(source).not.toMatch(/试用课程/);
  });

  it('恢复 0.9.2 的学生入口、授权码和课程区结构', () => {
    expect(source).toMatch(/学生入口/);
    expect(source).toMatch(/使用授权码，无需注册/);
    expect(source).toMatch(/老师发来的课程授权码/);
    expect(source).toMatch(/课程授权码/);
    expect(source).toMatch(/我的课程/);
    expect(source).toMatch(/当前 \$\{courses\.length\} 门/);
    expect(source).toMatch(/还没有课程，输入授权码后会显示在这里/);
    expect(source).toMatch(/创建和发布课程/);
    expect(source).toMatch(/插件维护/);
  });

  it('视觉基线采用 0.9.2 的 380px 弹窗和蓝色操作按钮', () => {
    expect(stylesheet).toMatch(/width:\s*380px/);
    expect(stylesheet).toMatch(/min-height:\s*560px/);
    expect(stylesheet).toMatch(/background:\s*#f6f7f8/);
    expect(stylesheet).toMatch(/background:\s*#00aeec/);
    expect(stylesheet).toMatch(/border-radius:\s*16px/);
  });

  it('保留 V1 课程库和进度操作', () => {
    expect(source).toMatch(/type: 'library'/);
    expect(source).toMatch(/type: 'redeem'/);
    expect(source).toMatch(/type: 'resetProgress'/);
    expect(source).toMatch(/type: 'removeCourse'/);
    expect(source).toMatch(/doneCount/);
  });
});
