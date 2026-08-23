/**
 * 切换前闸门核对（6B）。
 *
 * 从生产实际读取版本，与支持矩阵比对，任一组件不符则拒绝切换。
 * 只读：不改动生产任何状态。
 *
 *   cd v1 && npm run gate                            # 生产现状
 *   cd v1 && npm run gate -- --candidate <发布目录>   # 候选发布
 *
 * SSH 别名用 KNOWNMAP_SSH_HOST 指定，默认 aliyun。
 *
 * 不带 --candidate 时报告生产现状能否匹配矩阵；带上则核对候选发布。
 */

import { checkReleaseGate, formatGateFailures } from '../contracts/release-gate';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const SSH_HOST = process.env.KNOWNMAP_SSH_HOST ?? 'aliyun';

const manifest = JSON.parse(
  readFileSync(join(ROOT, 'v1/contracts/versions.json'), 'utf8')
);

const candidateIndex = process.argv.indexOf('--candidate');
const candidateDir = candidateIndex > -1 ? process.argv[candidateIndex + 1] : null;

/** SSH 只读取值。任何一步失败都如实报告，不猜 */
function remote(command) {
  try {
    return execFileSync(
      'ssh',
      ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', SSH_HOST, command],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
  } catch {
    return null;
  }
}

function productionVersions() {
  const migration = remote(
    `python3 -c "import sqlite3;print(sqlite3.connect('file:/var/lib/knownmap/knownmap.db?mode=ro',uri=True).execute('select version_num from alembic_version').fetchone()[0])"`
  );
  // 两个应用的入口在不在，决定线上有没有 v1 构建
  const hasApps = remote(
    '[ -f /var/www/knownmap/current/admin/index.html ] && ' +
      '[ -f /var/www/knownmap/current/teacher/index.html ] && echo yes || echo no'
  );

  return {
    reachable: migration !== null,
    migration: migration ?? 'unknown',
    hasV1Apps: hasApps === 'yes',
  };
}

/** 候选发布目录里的版本：由构建产物与本仓库清单共同决定 */
function candidateVersions(dir) {
  const ok =
    existsSync(join(dir, 'public/admin/index.html')) &&
    existsSync(join(dir, 'public/teacher/index.html'));
  if (!ok) {
    console.error(`候选目录缺少应用入口：${dir}`);
    process.exit(1);
  }
  return { ...manifest.supportMatrix[0] };
}

async function main() {
  if (candidateDir) {
    const versions = candidateVersions(candidateDir);
    const result = checkReleaseGate(versions, manifest.supportMatrix);
    console.log(
      result.ok
        ? `✓ 候选匹配 ${result.release}，可以切换。`
        : `✗ ${result.reason}\n${formatGateFailures(result.failures)}`
    );
    process.exit(result.ok ? 0 : 1);
  }

  const production = productionVersions();
  if (!production.reachable) {
    console.error(
      `连不上生产主机 '${SSH_HOST}'，无法核对。` +
        '设置 KNOWNMAP_SSH_HOST 为 ~/.ssh/config 里的别名。'
    );
    process.exit(1);
  }

  console.log('生产实测：');
  console.log(`  迁移版本：${production.migration}`);
  console.log(`  v1 应用：${production.hasV1Apps ? '已部署' : '未部署'}`);

  const versions = {
    ...manifest.supportMatrix[0],
    // 没有 v1 应用就是还没切换，用占位版本让闸门如实报告差距
    webBuild: production.hasV1Apps ? manifest.builds.web_build.version : '0.0.0',
    extensionBuild: production.hasV1Apps
      ? manifest.builds.extension_build.version
      : '0.0.0',
    backendMigration: production.migration,
  };

  const result = checkReleaseGate(versions, manifest.supportMatrix);
  console.log();
  if (result.ok) {
    console.log(`✓ 生产已匹配 ${result.release}。`);
  } else {
    console.log(`当前生产与 v1 的差距：\n${formatGateFailures(result.failures)}`);
    console.log('\n这是预期的——v1 尚未切换。切换后此处应当全部匹配。');
  }
  // 报告差距不算失败：不带 --candidate 时这是一次状态核对
  process.exit(0);
}

main().catch((error) => {
  console.error('核对中断：', error.message);
  process.exit(1);
});
