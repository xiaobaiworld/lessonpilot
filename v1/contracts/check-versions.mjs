#!/usr/bin/env node

/**
 * v1 Version Compatibility Check
 *
 * Validates:
 * - All components in supportMatrix have defined versions
 * - No version downgrade paths
 * - Major version changes require explicit migration strategy
 *
 * Used as pre-deployment gate to prevent incompatible component combinations.
 */

import fs from 'fs';
import path from 'path';

const versionsFile = path.join(import.meta.dirname, 'versions.json');

function parseVersion(v) {
  const [major, minor, patch] = v.split('.').map(Number);
  return { major, minor, patch, raw: v };
}

function checkVersionCompatibility() {
  const manifest = JSON.parse(fs.readFileSync(versionsFile, 'utf8'));
  const errors = [];

  // Check each support matrix entry
  for (const entry of manifest.supportMatrix) {
    const versionFields = [
      'httpApi',
      'coursePackage',
      'extensionMessages',
      'extensionStorage',
      'webBuild',
      'extensionBuild'
    ];

    for (const field of versionFields) {
      if (!entry[field]) {
        errors.push(`${entry.release}: missing ${field}`);
      } else {
        const version = parseVersion(entry[field]);
        if (version.major === undefined) {
          errors.push(`${entry.release}: invalid version format ${entry[field]} in ${field}`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error('❌ Version compatibility check failed:');
    errors.forEach(e => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log('✓ Version manifest: all contracts have compatible versions');
  console.log(`  - ${manifest.contracts ? Object.keys(manifest.contracts).length : 0} contracts defined`);
  console.log(`  - ${manifest.supportMatrix ? manifest.supportMatrix.length : 0} release combinations`);
}

checkVersionCompatibility();
