import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
const updateSource = readFileSync(resolve(__dirname, 'update.ts'), 'utf8');
const stylesheet = readFileSync(resolve(__dirname, 'popup.css'), 'utf8');

describe('V1.1.1 弹窗保留旧版入口并接入头像设置', () => {
  it('恢复 0.9.2 的品牌、教师登录和在线更新入口', () => {
    expect(source).toMatch(/课程助手/);
    expect(source).toMatch(/chrome\.runtime\.getManifest\(\)\.version/);
    expect(source).toMatch(/教师登录/);
    expect(source).toMatch(/chrome\.downloads\.download/);
    expect(updateSource).toMatch(/knownmapplugin\.zip/);
    expect(source).not.toMatch(/试用课程/);
    expect(source).not.toMatch(/role-badge/);
  });

  it('品牌栏提供独立的头像设置入口', () => {
    expect(source).toMatch(/avatar-settings-button/);
    expect(source).toMatch(/头像设置/);
    expect(source).toMatch(/chrome\.runtime\.openOptionsPage\(\)/);
  });

  it('KnownMap 的 K 与 M 对应 Logo 折线起点金和终点陶土', () => {
    expect(source).toMatch(/brand-letter-k/);
    expect(source).toMatch(/brand-letter-m/);
    expect(stylesheet).toMatch(/\.brand-letter-k\s*\{[^}]*color:\s*#e8b428/i);
    expect(stylesheet).toMatch(/\.brand-letter-m\s*\{[^}]*color:\s*#c56e52/i);
    expect(stylesheet).toMatch(/\.brand\s*>\s*div\s*>\s*span\s*\{[^}]*color:\s*#9499a0/i);
    expect(stylesheet).not.toMatch(/\.brand\s+div\s+span\s*\{/);
  });

  it('示例课程由课程库返回并按只读课程渲染', () => {
    expect(source).toMatch(/course\.readOnly/);
    expect(source).toMatch(/示例课/);
    expect(source).not.toMatch(/courses\.length \+ 1/);
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
