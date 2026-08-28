import { describe, it, expect } from 'vitest';
import { TARGETS, buildManifest, BUILD_ARTIFACTS, EXTENSION_VERSION } from './targets';

describe('构建目标', () => {
  it('V1.0.12 恢复旧版入口所需的目标配置', () => {
    expect(EXTENSION_VERSION).toBe('1.0.12');
    expect(TARGETS.local.teacherOrigin).toBe('http://localhost:5174');
    expect(TARGETS.production.teacherOrigin).toBe('https://knownmap.com');
    for (const target of Object.values(TARGETS)) {
      expect(target.studentPluginDownloadUrl).toBe(
        'https://knownmap.com/downloads/student-plugin/knownmapplugin.zip'
      );
    }
  });

  it('生产包不含本机 host permission', () => {
    const m = buildManifest(TARGETS.production);
    const hosts = m.host_permissions as string[];
    expect(hosts.some((h) => /127\.0\.0\.1|localhost/.test(h))).toBe(false);
  });

  it('本机包才有本机权限', () => {
    const hosts = buildManifest(TARGETS.local).host_permissions as string[];
    expect(hosts).toContain('http://127.0.0.1:8000/*');
  });

  it('两个目标都只申请 B 站页面权限，不申请全站', () => {
    for (const target of Object.values(TARGETS)) {
      const hosts = buildManifest(target).host_permissions as string[];
      expect(hosts).toContain('https://www.bilibili.com/*');
      expect(hosts).not.toContain('<all_urls>');
      expect(hosts.some((h) => h === '*://*/*')).toBe(false);
    }
  });

  it('课程存储与旧版在线更新分别申请 storage 和 downloads', () => {
    expect(buildManifest(TARGETS.production).permissions).toEqual(['storage', 'downloads']);
  });

  it('内容脚本只注入投稿视频页', () => {
    const scripts = buildManifest(TARGETS.production).content_scripts as any[];
    expect(scripts).toHaveLength(1);
    expect(scripts[0].matches).toEqual(['https://www.bilibili.com/video/*']);
  });

  it('本机包名字带标识，避免和生产包混装', () => {
    expect(buildManifest(TARGETS.local).name).toContain('本机');
    expect(buildManifest(TARGETS.production).name).toBe('KnownMap');
  });

  it('API 地址按目标固定，不留运行时开关', () => {
    expect(TARGETS.local.apiOrigin).toBe('http://127.0.0.1:8000');
    expect(TARGETS.production.apiOrigin).toBe('https://knownmap.com');
  });

  it('manifest 是 MV3', () => {
    expect(buildManifest(TARGETS.production).manifest_version).toBe(3);
  });

  it('产物清单包含 manifest 与三个入口', () => {
    expect(BUILD_ARTIFACTS).toContain('manifest.json');
    expect(BUILD_ARTIFACTS).toContain('background/service-worker.js');
    expect(BUILD_ARTIFACTS).toContain('content/index.js');
    expect(BUILD_ARTIFACTS).toContain('popup/index.js');
  });

  it('manifest 使用 V1 自有的完整图标组', () => {
    const m = buildManifest(TARGETS.production) as any;
    expect(m.icons).toEqual({
      '16': 'assets/icon-16.png',
      '24': 'assets/icon-24.png',
      '48': 'assets/icon-48.png',
      '128': 'assets/icon-128.png',
    });
    expect(m.action.default_icon).toEqual(m.icons);
    for (const path of Object.values(m.icons) as string[]) {
      expect(BUILD_ARTIFACTS).toContain(path);
    }
  });

  it('manifest 里引用的脚本都在产物清单里', () => {
    const m = buildManifest(TARGETS.production) as any;
    const referenced = [
      m.background.service_worker,
      ...m.content_scripts.flatMap((s: any) => [...s.js, ...s.css]),
      m.action.default_popup,
    ];
    for (const path of referenced) {
      expect(BUILD_ARTIFACTS).toContain(path);
    }
  });
});
