import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  checkReleaseGate,
  formatGateFailures,
  ComponentVersions,
  SupportedRelease,
} from './release-gate';

const matrix: SupportedRelease[] = [
  {
    release: 'v1.0.0',
    status: 'development',
    httpApi: '2.0.0',
    coursePackage: '2.0.0',
    extensionMessages: '2.0.0',
    extensionStorage: '2.0.0',
    webBuild: '1.0.0',
    extensionBuild: '1.0.0',
    backendMigration: '0011_fix_admin_auth_schema',
  },
];

const good = (): ComponentVersions => ({ ...matrix[0] });

describe('切换闸门', () => {
  it('全部匹配时放行', () => {
    expect(checkReleaseGate(good(), matrix)).toEqual({ ok: true, release: 'v1.0.0' });
  });

  it('major 不同判为破坏性，禁止切换', () => {
    const r = checkReleaseGate({ ...good(), coursePackage: '3.0.0' }, matrix);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures[0]).toMatchObject({ component: 'coursePackage', breaking: true });
    expect(r.reason).toContain('破坏性');
  });

  it('minor 不同也拦，但不标为破坏性', () => {
    const r = checkReleaseGate({ ...good(), webBuild: '1.1.0' }, matrix);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures[0]).toMatchObject({ component: 'webBuild', breaking: false });
    expect(r.reason).not.toContain('破坏性');
  });

  it('一次报出全部不符项，不让运维跑好几轮', () => {
    const r = checkReleaseGate(
      { ...good(), webBuild: '2.0.0', extensionBuild: '2.0.0', httpApi: '3.0.0' },
      matrix
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures).toHaveLength(3);
    expect(r.failures.map((f) => f.component).sort()).toEqual([
      'extensionBuild',
      'httpApi',
      'webBuild',
    ]);
  });

  it('迁移不符一律视为破坏性——数据形状不是 semver', () => {
    const r = checkReleaseGate({ ...good(), backendMigration: '0009_access_grants' }, matrix);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failures[0]).toMatchObject({ component: 'backendMigration', breaking: true });
  });

  it('空矩阵时拒绝，不默认放行', () => {
    const r = checkReleaseGate(good(), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('支持矩阵为空');
  });

  it('多个候选组合时匹配任一即放行', () => {
    const next: SupportedRelease = {
      ...matrix[0],
      release: 'v1.1.0',
      webBuild: '1.1.0',
      extensionBuild: '1.1.0',
    };
    const r = checkReleaseGate({ ...good(), webBuild: '1.1.0', extensionBuild: '1.1.0' }, [
      matrix[0],
      next,
    ]);
    expect(r).toEqual({ ok: true, release: 'v1.1.0' });
  });

  it('都不匹配时指向最接近的组合', () => {
    const far: SupportedRelease = {
      ...matrix[0],
      release: 'v2.0.0',
      httpApi: '9.0.0',
      coursePackage: '9.0.0',
      extensionMessages: '9.0.0',
      extensionStorage: '9.0.0',
    };
    const r = checkReleaseGate({ ...good(), webBuild: '1.2.0' }, [far, matrix[0]]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('v1.0.0');
  });

  it('失败清单每行一项，破坏性用不同标记', () => {
    const r = checkReleaseGate({ ...good(), coursePackage: '3.0.0', webBuild: '1.1.0' }, matrix);
    if (r.ok) throw new Error('应当失败');
    const text = formatGateFailures(r.failures);
    expect(text.split('\n')).toHaveLength(2);
    expect(text).toContain('✗ coursePackage');
    expect(text).toContain('! webBuild');
  });
});

describe('清单自身', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(__dirname, 'versions.json'), 'utf8')
  );

  it('仓库里的支持矩阵能通过自己的闸门', () => {
    // 清单声明的组合必须自洽，否则它无法作为切换依据
    const declared = manifest.supportMatrix[0];
    expect(checkReleaseGate(declared, manifest.supportMatrix).ok).toBe(true);
  });

  it('矩阵里的契约版本与 contracts 段一致', () => {
    const m = manifest.supportMatrix[0];
    expect(m.httpApi).toBe(manifest.contracts.http_api.version);
    expect(m.coursePackage).toBe(manifest.contracts.course_package.version);
    expect(m.extensionMessages).toBe(manifest.contracts.extension_messages.version);
    expect(m.extensionStorage).toBe(manifest.contracts.extension_storage.version);
  });

  it('未通过阶段 7 验收前不得标为 released', () => {
    expect(manifest.supportMatrix[0].status).not.toBe('released');
  });

  it('标为 implemented 的契约必须指出实现在哪', () => {
    // 否则"已实现"是一句无法核对的声明，清单就失去了作为切换依据的价值
    for (const [name, contract] of Object.entries<any>(manifest.contracts)) {
      if (contract.status !== 'implemented') continue;
      expect(contract.implementedBy, `${name} 标为 implemented 但未指出实现`).toBeTruthy();
    }
  });

  it('契约状态只能取已定义的几种，不许随手编新词', () => {
    const allowed = ['development', 'implemented', 'drifted', 'deprecated'];
    for (const [name, contract] of Object.entries<any>(manifest.contracts)) {
      expect(allowed, `${name} 的状态 ${contract.status} 未定义`).toContain(
        contract.status
      );
    }
  });
});
