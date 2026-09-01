import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'index.ts'), 'utf8');
const updateSource = readFileSync(resolve(__dirname, 'update.ts'), 'utf8');
const stylesheet = readFileSync(resolve(__dirname, 'popup.css'), 'utf8');

describe('V1.2.0 弹窗发布功能总览 V1', () => {
  it('恢复 0.9.2 的品牌、教师登录和在线更新入口', () => {
    expect(source).toMatch(/课程助手/);
    expect(source).toMatch(/chrome\.runtime\.getManifest\(\)\.version/);
    expect(source).toMatch(/教师登录/);
    expect(source).toMatch(/chrome\.downloads\.download/);
    expect(updateSource).toMatch(/knownmapplugin\.zip/);
    expect(source).not.toMatch(/试用课程/);
    expect(source).not.toMatch(/role-badge/);
  });

  it('品牌栏提供插件总设置入口', () => {
    expect(source).toMatch(/avatar-settings-button/);
    expect(source).toMatch(/打开插件设置/);
    expect(source).toMatch(/renderSettings/);
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
    expect(source).toMatch(/使用老师发来的授权码/);
    expect(source).toMatch(/领取新课程/);
    expect(source).toMatch(/全部课程/);
    expect(source).toMatch(/当前 \$\{courses\.length\} 门/);
    expect(source).toMatch(/还没有课程，领取新课程后会显示在这里/);
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

  it('首页发布功能总览 V1 的真实入口和状态区块', () => {
    expect(source).toMatch(/学生账号/);
    expect(source).toMatch(/登录 \/ 注册/);
    expect(source).toMatch(/需要升级/);
    expect(source).toMatch(/为你推荐/);
    expect(source).toMatch(/checkCourseUpdates/);
    expect(source).toMatch(/upgradeCourse/);
    expect(source).toMatch(/showRedeemEntry/);
    expect(source).toMatch(/showRecommendations/);
  });

  it('设置在插件弹窗内可返回首页并保存，而不是只打开头像页', () => {
    expect(source).toMatch(/插件设置/);
    expect(source).toMatch(/返回首页/);
    expect(source).toMatch(/setStudentSettings/);
    expect(source).not.toMatch(/chrome\.runtime\.openOptionsPage\(\)/);
  });

  it('学习伙伴设置在同一弹窗内展示角色包和试听声音', () => {
    expect(source).toContain("type CompanionState = 'idle' | 'focus' | 'prompt' | 'correct' | 'wrong' | 'complete'");
    expect(source).toContain('renderCompanionSettings');
    expect(source).toContain('神秘猫精灵声音组');
    expect(source).toContain('开始注意');
    expect(source).toContain('提示与等待');
    expect(source).toContain('答对反馈');
    expect(source).toContain('答错反馈');
    expect(source).toContain('完成庆祝');
    expect(source).toContain("type: 'setCompanionSound'");
    expect(source).not.toContain("chrome.tabs.create({ url: chrome.runtime.getURL('settings/index.html') })");
  });
});
