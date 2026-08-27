#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const MODULES_DIR = 'v1/backend/app/modules';

export const V1_MODULES = {
  identity: '身份与会话',
  workspace_course: '工作空间与课程',
  authoring_release: '制作与发布',
  entitlement_delivery: '授权与交付',
  admin_support: '管理与支持',
  runtime_audit: '运行与审计',
};

export const V1_TABLE_OWNER = {
  v1_admin_accounts: 'identity',
  v1_admin_sessions: 'identity',
  v1_teacher_accounts: 'identity',
  v1_teacher_sessions: 'identity',
  v1_workspaces: 'workspace_course',
  v1_courses: 'workspace_course',
  v1_lessons: 'workspace_course',
  v1_video_references: 'workspace_course',
  v1_script_drafts: 'authoring_release',
  v1_preview_sessions: 'authoring_release',
  v1_course_releases: 'authoring_release',
  v1_release_lesson_snapshots: 'authoring_release',
  v1_release_availability: 'authoring_release',
  v1_course_version_operations: 'authoring_release',
  v1_access_codes: 'entitlement_delivery',
  v1_grant_items: 'entitlement_delivery',
  v1_redemptions: 'entitlement_delivery',
  v1_rights_attestations: 'admin_support',
  v1_trial_followups: 'admin_support',
  v1_operation_audit: 'runtime_audit',
};

function pythonFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__pycache__') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...pythonFiles(path));
    else if (entry.name.endsWith('.py')) files.push(path);
  }
  return files;
}

export function analyze(root = '.') {
  const base = join(root, MODULES_DIR);
  const violations = [];
  const seenTables = new Set();
  if (!existsSync(base)) return { violations: [`缺少 ${MODULES_DIR}`], seenTables };

  for (const file of pythonFiles(base)) {
    const module = relative(base, file).split('/')[0];
    const text = readFileSync(file, 'utf8');

    for (const match of text.matchAll(/__tablename__\s*=\s*["']([^"']+)["']/g)) {
      const table = match[1];
      seenTables.add(table);
      if (!V1_TABLE_OWNER[table]) violations.push(`${file}: 表 ${table} 未登记归属`);
      else if (V1_TABLE_OWNER[table] !== module) {
        violations.push(`${file}: 表 ${table} 应属于 ${V1_TABLE_OWNER[table]}，不属于 ${module}`);
      }
    }

    for (const match of text.matchAll(/from app\.modules\.([a-z_]+) import repository/g)) {
      if (match[1] !== module) violations.push(`${file}: 直接导入其它模块仓储 ${match[1]}`);
    }
    for (const match of text.matchAll(/from app\.modules\.([a-z_]+)\.repository import/g)) {
      if (match[1] !== module) violations.push(`${file}: 直接导入其它模块仓储 ${match[1]}`);
    }
  }

  for (const table of Object.keys(V1_TABLE_OWNER)) {
    if (!seenTables.has(table)) violations.push(`登记表 ${table} 没有模型定义`);
  }
  return { violations, seenTables };
}

function main() {
  const { violations, seenTables } = analyze('.');
  if (violations.length) {
    console.error(`✗ v1 模块边界失败（${violations.length}）`);
    for (const item of violations) console.error(`  - ${item}`);
    process.exit(1);
  }
  console.log(`✓ v1 六模块零越界；${seenTables.size} 张表均有唯一归属`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
