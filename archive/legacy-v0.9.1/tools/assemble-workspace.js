#!/usr/bin/env node
/**
 * Copy the shared contract next to the workspace page.
 *
 * The contract has exactly one source, src/shared/ (D-010). src/ is not published to
 * the public site — it holds the extension runtime, and the repository also holds
 * pricing and sales material — so the workspace page cannot reach it with a relative
 * path once deployed. The files are copied into teacher-web/shared/ instead, by this
 * script locally and by the Pages workflow when publishing, so both environments load
 * the same path and the page needs no hostname branching.
 *
 * teacher-web/shared/ is git-ignored on purpose: a committed copy would be a second
 * definition of the contract, free to drift from the source without any test noticing.
 *
 * Run: node tools/assemble-workspace.js
 */

const fs = require('node:fs');
const path = require('node:path');

/** Only what the page actually loads. Adding a file here publishes it. */
const SHARED_FILES = ['bridge-protocol.js', 'course-contract.js'];

const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'src', 'shared');
const targetDir = path.join(repoRoot, 'teacher-web', 'shared');

function main() {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of SHARED_FILES) {
    const source = path.join(sourceDir, file);
    if (!fs.existsSync(source)) {
      console.error(`missing shared source: src/shared/${file}`);
      process.exit(1);
    }
    fs.copyFileSync(source, path.join(targetDir, file));
    console.log(`copied src/shared/${file} -> teacher-web/shared/${file}`);
  }
}

main();

module.exports = { SHARED_FILES };
