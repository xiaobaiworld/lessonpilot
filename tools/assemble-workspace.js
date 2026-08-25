#!/usr/bin/env node
/**
 * 确认教师工作台所需的共享契约文件已在 teacher-web/shared/。
 *
 * 旧插件 src/shared/ 已删除；这两份文件是冻结历史契约，随页面一起入库，
 * 不再从插件源码组装。
 *
 * Run: node tools/assemble-workspace.js
 */

const fs = require('node:fs');
const path = require('node:path');

const SHARED_FILES = ['bridge-protocol.js', 'course-contract.js'];

const repoRoot = path.resolve(__dirname, '..');
const targetDir = path.join(repoRoot, 'teacher-web', 'shared');

function main() {
  for (const file of SHARED_FILES) {
    const target = path.join(targetDir, file);
    if (!fs.existsSync(target)) {
      console.error(`missing shared contract: teacher-web/shared/${file}`);
      process.exit(1);
    }
    console.log(`ok teacher-web/shared/${file}`);
  }
}

main();

module.exports = { SHARED_FILES };
