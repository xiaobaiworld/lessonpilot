#!/usr/bin/env node
// 检查后端代码是否遵守设计 03 第 7 节的模块边界。
//
// 用法：
//   node tools/module-check.mjs           打印越界报告
//   node tools/module-check.mjs --json     机器可读输出
//   node tools/module-check.mjs --list     列出表归属与文件归属，便于核对
//
// 约束来源：`doc/design/v1/03-system-architecture.md` 第 7 节 ——
// 「一个模块不能直接查询或修改另一个模块拥有的表；跨模块动作经显式应用服务组合」。
//
// 当前 `backend/app/` 仍是按技术分层的平铺结构，模块边界不体现在目录上，因此这里按
// 文件名映射模块。阶段 1 重构为 `modules/<domain>/` 后改为按目录判定，检查逻辑不变。
//
// 已知越界记录在 KNOWN_VIOLATIONS，只报告不失败（阶段 1 待修）。
// 新增越界一律失败 —— 这是本工具存在的唯一理由：阶段 1 写代码时守住边界，
// 而不是等 review 才发现。

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BACKEND = 'backend/app';

/** 六个业务模块。键用于报告，值是模块中文名（与设计文档一致）。 */
export const MODULES = {
  identity: '身份与会话',
  course: '工作空间与课程',
  authoring: '制作与发布',
  grant: '授权与交付',
  admin: '管理与支持',
  ops: '运行与审计',
};

/**
 * 表归属：模型类名 -> 模块键。
 *
 * 与 `03-system-architecture.md` 第 7.0 节的表归属表一一对应。
 * 新增模型时必须在两处同时登记，否则本工具会报「未登记模型」。
 */
export const MODEL_OWNER = {
  Admin: 'identity',
  AdminSession: 'identity',
  Teacher: 'identity',
  TeacherSession: 'identity',
  Workspace: 'course',
  Course: 'course',
  Lesson: 'course',
  ScriptDraft: 'authoring',
  PublishedScript: 'authoring',
  AccessCode: 'grant',
  AccessGrant: 'grant',
  OperationLog: 'ops',
};

/**
 * 文件归属：文件名（不含扩展名）-> 模块键。
 *
 * 覆盖 services/ 和 repositories/。api/v1/ 由 endpoint-check 按路径管，这里不重复判定。
 */
export const FILE_OWNER = {
  // services
  auth_service: 'identity',
  admin_auth_service: 'identity',
  course_service: 'course',
  script_service: 'authoring',
  publish_service: 'authoring',
  access_code_service: 'grant',
  admin_teacher_service: 'admin',
  operation_log_service: 'ops',
  // repositories
  admin_repository: 'identity',
  admin_session_repository: 'identity',
  teacher_repository: 'identity',
  teacher_session_repository: 'identity',
  workspace_repository: 'course',
  course_repository: 'course',
  lesson_repository: 'course',
  script_repository: 'authoring',
  published_script_repository: 'authoring',
  access_code_repository: 'grant',
  access_grant_repository: 'grant',
  admin_teacher_repository: 'admin',
};

/**
 * 已知越界：阶段 1 待修，只报告不失败。
 *
 * 每条必须写明修法，否则白名单会变成永久豁免。
 * 修好后从这里删除；`--json` 输出可用于核对剩余项。
 */
export const KNOWN_VIOLATIONS = [
  {
    file: 'services/access_code_service.py',
    accesses: ['Course', 'Lesson'],
    note:
      '授权模块直接 select(Lesson)/session.get(Course) 组装课程包。' +
      '修法：改由「工作空间与课程」模块提供按课程取有序课节的应用服务；' +
      '排序规则（sort_order/sequence）不留在授权模块。',
  },
  {
    file: 'services/access_code_service.py',
    accesses: ['PublishedScript'],
    viaRepository: 'published_script_repository',
    note:
      '授权模块直接读发布表并校验 courseId 一致性。' +
      '修法：改由「制作与发布」模块提供「取某课程最新可交付发布快照」的应用服务；' +
      '04 第 8 节改为 CourseRelease 后这段必须跟着改。',
  },
  {
    file: 'services/access_code_service.py',
    accesses: ['Lesson'],
    viaRepository: 'lesson_repository',
    note:
      '授权模块 import 课程模块仓储做课节归属校验。' +
      '修法：与上一条合并处理，改为调用课程模块的应用服务。',
  },
  {
    file: 'repositories/admin_teacher_repository.py',
    accesses: ['Course', 'Workspace'],
    note:
      '管理模块仓储直接按 courses/workspaces 列统计教师课程数。' +
      '修法：课程计数由「工作空间与课程」模块提供只读摘要服务，管理模块不拼课程查询。',
  },
  {
    file: 'repositories/admin_teacher_repository.py',
    accesses: ['Teacher'],
    note:
      '管理模块仓储直接 select(Teacher) 组装教师摘要。' +
      '修法：教师账号事实由「身份与会话」模块提供摘要服务；' +
      '管理模块只组合结果，不自己查 teachers 表。',
  },
  {
    file: 'services/admin_teacher_service.py',
    accesses: ['Teacher'],
    viaRepository: 'teacher_repository',
    note:
      '管理模块直接构造 Teacher 行并 import 身份模块仓储，完成创建和密码重置。' +
      '按 FR-AUTH-002 与 04 第 5 节，创建教师及其工作空间必须在同一事务内完成，' +
      '因此这是合法的跨模块组合，但组合方式错误。' +
      '修法：由「身份与会话」模块提供「创建教师账号」「重置密码并失效会话」的应用服务，' +
      '管理模块在一个事务里调用它和课程模块的建工作空间服务，不直接构造对方的行。',
  },
];

/** 真实表访问的语法形态。仅类型标注不算访问。 */
const ACCESS_PATTERNS = [
  { re: /select\(\s*([A-Z]\w+)/g, kind: 'select()' },
  { re: /session\.get\(\s*([A-Z]\w+)/g, kind: 'session.get()' },
  { re: /session\.add\(\s*([A-Z]\w+)\s*\(/g, kind: 'session.add()' },
  { re: /session\.delete\(\s*([A-Z]\w+)/g, kind: 'session.delete()' },
  // 列引用：Model.column 出现在比较、排序或过滤里
  {
    re: /\b([A-Z]\w+)\.[a-z_]+\s*(?:==|!=|<=|>=|<|>|\.(?:in_|is_|like|ilike|asc|desc|isnot))/g,
    kind: 'column ref',
  },
  // 构造实例：Model( 后紧跟关键字参数
  { re: /\b([A-Z]\w+)\(\s*\n?\s*[a-z_]+\s*=/g, kind: 'construct' },
];

function pythonFiles(root, group) {
  const dir = join(root, BACKEND, group);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith('.py') && n !== '__init__.py')
    .sort()
    .map((n) => ({ name: n.replace(/\.py$/, ''), path: join(dir, n), rel: `${group}/${n}` }));
}

/** 抽取一个文件里对各模型的真实访问，返回 Map<模型, Set<形态>>。 */
export function extractAccesses(text) {
  const found = new Map();
  for (const { re, kind } of ACCESS_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const model = m[1];
      if (!(model in MODEL_OWNER)) continue;
      if (!found.has(model)) found.set(model, new Set());
      found.get(model).add(kind);
    }
  }
  return found;
}

/** 抽取跨模块 repository import，它同样构成对另一模块表的间接访问。 */
export function extractRepositoryImports(text) {
  return [...text.matchAll(/from app\.repositories\.(\w+) import/g)].map((m) => m[1]);
}

/** 已知越界的匹配键：文件 + 单个模型。 */
const knownKey = (file, model) => `${file}::${model}`;

function buildKnownIndex() {
  const index = new Map();
  for (const entry of KNOWN_VIOLATIONS) {
    for (const model of entry.accesses) {
      index.set(knownKey(entry.file, model), entry);
    }
  }
  return index;
}

export function analyze(root = '.') {
  const files = [...pythonFiles(root, 'services'), ...pythonFiles(root, 'repositories')];
  const known = buildKnownIndex();

  const violations = [];
  const knownFound = new Set();
  const unregisteredFiles = [];
  const unregisteredModels = new Set();

  for (const file of files) {
    const owner = FILE_OWNER[file.name];
    if (!owner) {
      unregisteredFiles.push(file.rel);
      continue;
    }
    const text = readFileSync(file.path, 'utf8');

    // 直接表访问
    for (const [model, kinds] of extractAccesses(text)) {
      const modelOwner = MODEL_OWNER[model];
      if (modelOwner === owner) continue;
      const entry = known.get(knownKey(file.rel, model));
      const record = {
        file: file.rel,
        fileModule: owner,
        model,
        modelModule: modelOwner,
        kinds: [...kinds].sort(),
        known: Boolean(entry),
        note: entry?.note,
      };
      if (entry) knownFound.add(knownKey(file.rel, model));
      violations.push(record);
    }

    // 跨模块 repository import（间接访问另一模块的表）
    for (const repo of extractRepositoryImports(text)) {
      const repoOwner = FILE_OWNER[repo];
      if (!repoOwner) {
        unregisteredFiles.push(`repositories/${repo}.py`);
        continue;
      }
      if (repoOwner === owner) continue;
      const entry = KNOWN_VIOLATIONS.find(
        (v) => v.file === file.rel && v.viaRepository === repo,
      );
      const record = {
        file: file.rel,
        fileModule: owner,
        model: `(repository) ${repo}`,
        modelModule: repoOwner,
        kinds: ['repository import'],
        known: Boolean(entry),
        note: entry?.note,
      };
      if (entry) for (const m of entry.accesses) knownFound.add(knownKey(file.rel, m));
      violations.push(record);
    }
  }

  // 模型登记完整性：models/ 里有但 MODEL_OWNER 没登记
  const modelDir = join(root, BACKEND, 'models');
  if (existsSync(modelDir)) {
    for (const name of readdirSync(modelDir)) {
      if (!name.endsWith('.py') || name === '__init__.py') continue;
      const text = readFileSync(join(modelDir, name), 'utf8');
      for (const m of text.matchAll(/^class (\w+)\(/gm)) {
        if (!(m[1] in MODEL_OWNER)) unregisteredModels.add(m[1]);
      }
    }
  }

  // 白名单里写了但代码里已经不存在：说明修好了，该删记录
  const staleKnown = [];
  for (const entry of KNOWN_VIOLATIONS) {
    const anyFound = entry.accesses.some((m) => knownFound.has(knownKey(entry.file, m)));
    if (!anyFound) staleKnown.push(entry);
  }

  return {
    violations,
    newViolations: violations.filter((v) => !v.known),
    knownViolations: violations.filter((v) => v.known),
    staleKnown,
    unregisteredFiles: [...new Set(unregisteredFiles)],
    unregisteredModels: [...unregisteredModels],
    checkedFiles: files.length,
  };
}

function main() {
  const root = '.';
  if (process.argv.includes('--list')) {
    console.log('表归属：');
    for (const [model, mod] of Object.entries(MODEL_OWNER)) {
      console.log(`  ${model.padEnd(18)} ${MODULES[mod]}`);
    }
    console.log('\n文件归属：');
    for (const [file, mod] of Object.entries(FILE_OWNER)) {
      console.log(`  ${file.padEnd(32)} ${MODULES[mod]}`);
    }
    return;
  }

  const r = analyze(root);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.newViolations.length + r.unregisteredFiles.length + r.unregisteredModels.length > 0 ? 1 : 0);
  }

  console.log(`检查 ${r.checkedFiles} 个后端文件，越界 ${r.violations.length} 处（已知 ${r.knownViolations.length}、新增 ${r.newViolations.length}）。`);

  if (r.knownViolations.length > 0) {
    console.log('\n已知越界（阶段 1 待修，不阻断）：');
    let lastFile = '';
    for (const v of r.knownViolations) {
      if (v.file !== lastFile) {
        console.log(`  ${v.file}  [${MODULES[v.fileModule]}]`);
        lastFile = v.file;
      }
      console.log(`    · ${v.model.padEnd(24)} -> ${MODULES[v.modelModule]}  ${v.kinds.join(', ')}`);
    }
  }

  if (r.newViolations.length > 0) {
    console.log(`\n✗ 新增越界 ${r.newViolations.length} 处：`);
    for (const v of r.newViolations) {
      console.log(`    ${v.file}  [${MODULES[v.fileModule]}]`);
      console.log(`      ${v.model} 属于 ${MODULES[v.modelModule]}  (${v.kinds.join(', ')})`);
    }
    console.log('  违反设计 03 第 7 节：跨模块动作必须经拥有方的应用服务，不自己拼查询。');
  }

  if (r.staleKnown.length > 0) {
    console.log(`\n✗ 白名单已过期 ${r.staleKnown.length} 处（代码里已不存在，应从 KNOWN_VIOLATIONS 删除）：`);
    for (const e of r.staleKnown) console.log(`    ${e.file} -> ${e.accesses.join(', ')}`);
  }

  if (r.unregisteredFiles.length > 0) {
    console.log(`\n✗ 未登记归属的文件 ${r.unregisteredFiles.length} 个：`);
    for (const f of r.unregisteredFiles) console.log(`    ${f}`);
    console.log('  新增服务或仓储时必须在 FILE_OWNER 登记所属模块。');
  }

  if (r.unregisteredModels.length > 0) {
    console.log(`\n✗ 未登记归属的模型 ${r.unregisteredModels.length} 个：`);
    for (const m of r.unregisteredModels) console.log(`    ${m}`);
    console.log('  新增模型时必须同时更新 MODEL_OWNER 和设计 03 第 7.0 节的表归属表。');
  }

  const failures =
    r.newViolations.length + r.staleKnown.length + r.unregisteredFiles.length + r.unregisteredModels.length;
  if (failures === 0) {
    console.log('\n没有新增越界，白名单与代码一致，归属登记完整。');
    return;
  }
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
