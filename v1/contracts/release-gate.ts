/**
 * 切换闸门。
 *
 * 组件版本与支持矩阵不符时在切换前失败（6B）。
 *
 * 为什么必须挡在切换前：Web、API、插件、存储四者任一不匹配，症状都出现在
 * 学生端——插件读不懂课程包、或页面调不通 API。那时已经在生产上，回退要
 * 整组一起回，只回退一个组件会留下另一半不兼容。
 */

export interface ComponentVersions {
  httpApi: string;
  coursePackage: string;
  extensionMessages: string;
  extensionStorage: string;
  webBuild: string;
  extensionBuild: string;
  backendMigration: string;
}

export interface SupportedRelease extends ComponentVersions {
  release: string;
  status: string;
}

export interface GateFailure {
  component: keyof ComponentVersions;
  expected: string;
  actual: string;
  /** major 不同是破坏性的，minor 只是提示 */
  breaking: boolean;
}

export type GateResult =
  | { ok: true; release: string }
  | { ok: false; reason: string; failures: GateFailure[] };

function major(version: string): string {
  return version.split('.')[0] ?? '';
}

const SEMVER_FIELDS: (keyof ComponentVersions)[] = [
  'httpApi',
  'coursePackage',
  'extensionMessages',
  'extensionStorage',
  'webBuild',
  'extensionBuild',
];

/**
 * 校验一组实际版本能否作为候选发布切换。
 *
 * 只要有一个 major 不匹配就拒绝，并且拒绝时报出全部不符项——一次只报一个，
 * 运维要跑好几轮才能看全，每轮都是一次生产操作。
 */
export function checkReleaseGate(
  actual: ComponentVersions,
  matrix: SupportedRelease[]
): GateResult {
  if (matrix.length === 0) {
    return { ok: false, reason: '支持矩阵为空，无法判断兼容性。', failures: [] };
  }

  let best: { release: SupportedRelease; failures: GateFailure[] } | null = null;

  for (const supported of matrix) {
    const failures: GateFailure[] = [];

    for (const field of SEMVER_FIELDS) {
      const want = supported[field];
      const got = actual[field];
      if (want !== got) {
        failures.push({
          component: field,
          expected: want,
          actual: got,
          breaking: major(want) !== major(got),
        });
      }
    }

    // 迁移是标识符不是 semver，不等就是不等
    if (supported.backendMigration !== actual.backendMigration) {
      failures.push({
        component: 'backendMigration',
        expected: supported.backendMigration,
        actual: actual.backendMigration,
        breaking: true,
      });
    }

    if (failures.length === 0) return { ok: true, release: supported.release };

    // 记下最接近的一组，报错时指向它，运维才知道该往哪个组合对齐
    if (!best || failures.length < best.failures.length) {
      best = { release: supported, failures };
    }
  }

  const failures = best!.failures;
  const breaking = failures.filter((f) => f.breaking);

  return {
    ok: false,
    reason: breaking.length
      ? `与 ${best!.release.release} 有 ${breaking.length} 处破坏性不兼容，禁止切换。`
      : `与 ${best!.release.release} 有 ${failures.length} 处版本不符，禁止切换。`,
    failures,
  };
}

/** 把失败项排成给人看的清单，每行一项 */
export function formatGateFailures(failures: GateFailure[]): string {
  return failures
    .map(
      (f) =>
        `${f.breaking ? '✗' : '!'} ${f.component}：期望 ${f.expected}，实际 ${f.actual}`
    )
    .join('\n');
}
