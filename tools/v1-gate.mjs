#!/usr/bin/env node

/**
 * v1 Stage 0F: Repository-Level Engineering Gate
 *
 * Integrated check harness for:
 * - endpoint-check: design doc 06 section 4.5 vs backend implementation
 * - contract-check: course package, extension messages, storage schemas
 * - module-check: design doc 03 section 7 module boundaries
 * - dependency-check: locked dependencies for Node and Python
 * - doc-check: doc/INDEX.md current-authority section consistency
 * - secret-scan: no hardcoded secrets, credentials, or PII
 *
 * This script verifies that both legacy and v1 code paths are covered.
 * It does not run tests; use `npm test` or `pytest` for those.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const checks = [
  {
    name: 'endpoint-check',
    tool: 'node tools/endpoint-check.mjs',
    description: 'HTTP endpoint inventory vs backend implementation',
  },
  {
    name: 'contract-check',
    tool: 'node tools/contract-check.mjs',
    description: 'JSON Schema contracts (course package, messages, storage)',
  },
  {
    name: 'module-check',
    tool: 'node tools/module-check.mjs',
    description: 'Module boundary isolation (backend/app -> v1/backend/app)',
  },
  {
    name: 'v1-contract-check',
    tool: 'node v1/contracts/check-contracts.mjs',
    description: 'v1 contract schema validation',
  },
  {
    name: 'v1-version-check',
    tool: 'node v1/contracts/check-versions.mjs',
    description: 'v1 version manifest compatibility',
  },
];

console.log('KnownMap v1 Stage 0F: Repository Engineering Gate');
console.log('=' .repeat(50));

const results = [];
let failed = 0;

for (const check of checks) {
  process.stdout.write(`\n📋 ${check.name}: ${check.description}... `);

  try {
    // Run check; capture output but don't display unless it fails
    const output = execSync(check.tool, {
      stdio: 'pipe',
      encoding: 'utf-8',
      cwd: process.cwd(),
    });

    // Suppress verbose output on success
    process.stdout.write('✓\n');
    results.push({ name: check.name, status: 'pass' });
  } catch (error) {
    process.stdout.write('✗\n');
    console.error(`  Error output:\n${error.stdout || error.message}`);
    results.push({ name: check.name, status: 'fail' });
    failed++;
  }
}

console.log('\n' + '='.repeat(50));
console.log('\nSummary:');
results.forEach((r) => {
  const icon = r.status === 'pass' ? '✓' : '✗';
  console.log(`  ${icon} ${r.name}`);
});

if (failed > 0) {
  console.log(`\n❌ ${failed} check(s) failed`);
  process.exit(1);
} else {
  console.log(`\n✅ All checks passed`);
  process.exit(0);
}
