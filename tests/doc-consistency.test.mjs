// 文档一致性门禁：把 v1 文档体系自己写下的规则变成可执行检查。
//
// 冻结 v1 需求时，04/05 里有 306 处「关联要求」指向从未签发的编号族。文档规则
// （`ACC-LINK-001`）要求双向链接，但没有任何检查在跑，于是「已冻结」把这些悬空回链
// 一起冻结了。这个文件的存在就是为了让同类漂移在提交前失败，而不是靠人工记得。

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  checkAuthority,
  checkIdentifiers,
  checkLinks,
  checkMatrix,
} from '../tools/doc-check.mjs';
import { buildRows } from '../tools/build-traceability.mjs';
import { compare as compareEndpoints } from '../tools/endpoint-check.mjs';
import { runAll as runContractChecks } from '../tools/contract-check.mjs';
import {
  RULES as SECRET_RULES,
  looksLikePlaceholder,
  scan as scanSecrets,
} from '../tools/secret-scan.mjs';
import { runAll as checkDependencies } from '../tools/dependency-check.mjs';
import {
  MODEL_OWNER,
  MODULES,
  analyze as analyzeModules,
} from '../tools/module-check.mjs';
import { ID_PREFIXES, RESERVED_FAMILIES, extractDefinitions } from '../tools/lib/requirement-ids.mjs';

const TSV = 'doc/traceability/v1-requirements.tsv';

test('每个编号引用都能解析到定义或已登记的保留族', () => {
  const problems = checkIdentifiers();
  assert.deepEqual(problems, [], `存在无法解析的编号引用：\n${problems.join('\n')}`);
});

test('文档之间没有断链', () => {
  const { problems, checked } = checkLinks();
  assert.ok(checked > 100, `检查到的 Markdown 文件过少（${checked}），范围可能配置错误`);
  assert.deepEqual(problems, [], `存在断链：\n${problems.join('\n')}`);
});

test('追踪矩阵覆盖全部稳定编号且不重复', () => {
  const { problems, total, rows } = checkMatrix();
  assert.deepEqual(problems, [], `矩阵覆盖不完整：\n${problems.join('\n')}`);
  assert.equal(rows, total, `矩阵行数 ${rows} 与稳定编号数 ${total} 不一致`);
});

test('矩阵与需求文档保持同步，重新生成不产生差异', () => {
  assert.ok(existsSync(TSV), `矩阵缺失：${TSV}`);
  const { rows } = buildRows('.');
  const lines = readFileSync(TSV, 'utf8').split('\n').filter((line) => line.length > 0);
  assert.equal(
    lines.length - 1,
    rows.length,
    '矩阵行数与重新生成结果不一致；运行 node tools/build-traceability.mjs',
  );
});

test('矩阵不保留指向未签发编号的关联需求', () => {
  const lines = readFileSync(TSV, 'utf8').split('\n').filter((line) => line.length > 0);
  const header = lines[0].split('\t');
  const relatedIndex = header.indexOf('关联需求');
  assert.notEqual(relatedIndex, -1, '矩阵缺少「关联需求」列');

  const definitions = extractDefinitions('.');
  const families = new Set(definitions.map((d) => d.family));
  const ids = new Set(definitions.map((d) => d.id));
  const prefixes = new Set(ID_PREFIXES.map((p) => p.prefix));

  const dangling = [];
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const value = cells[relatedIndex] ?? '';
    if (!value || value === '—') continue;
    for (const match of value.matchAll(/`([A-Z]+(?:-[A-Z]+)?)-(\*|\d{2,3})`/g)) {
      const [token, family, suffix] = [match[0], match[1], match[2]];
      if (RESERVED_FAMILIES.has(family)) continue;
      const ok =
        suffix === '*' ? families.has(family) || prefixes.has(family) : ids.has(`${family}-${suffix}`);
      if (!ok) dangling.push(`${cells[0]} -> ${token}`);
    }
  }
  assert.deepEqual(dangling, [], `矩阵含悬空关联：\n${dangling.join('\n')}`);
});

test('矩阵的最终状态只使用已定义的取值', () => {
  const allowed = new Set([
    '待设计',
    '待实现',
    '待验证',
    '已验证',
    '阻塞',
    '不适用',
    '已替代',
    '已发布',
  ]);
  const lines = readFileSync(TSV, 'utf8').split('\n').filter((line) => line.length > 0);
  const header = lines[0].split('\t');
  const index = header.indexOf('最终状态');
  assert.notEqual(index, -1, '矩阵缺少「最终状态」列');

  const invalid = [];
  for (const line of lines.slice(1)) {
    const cells = line.split('\t');
    const value = cells[index] ?? '';
    if (!allowed.has(value)) invalid.push(`${cells[0]} -> "${value}"`);
  }
  assert.deepEqual(invalid, [], `最终状态取值非法：\n${invalid.join('\n')}`);
});

test('doc/INDEX.md 的当前权威段只含 v1 真源', () => {
  const problems = checkAuthority();
  assert.deepEqual(problems, [], `当前权威段含已退出指导链的文档：\n${problems.join('\n')}`);
});

test('需求编号前缀清单与 README 登记一致', () => {
  const readme = readFileSync('doc/requirements/v1/README.md', 'utf8');
  for (const { prefix, kind } of ID_PREFIXES) {
    if (kind === 'reserved') continue;
    assert.ok(
      readme.includes(`\`${prefix}-*\``),
      `README 第 1.2 节未登记编号前缀 ${prefix}-*；两处清单必须一致`,
    );
  }
});

test('已保留未签发的编号族没有被实际签发', () => {
  const definitions = extractDefinitions('.');
  for (const family of RESERVED_FAMILIES.keys()) {
    const issued = definitions.filter((d) => d.family === family || d.family.startsWith(`${family}-`));
    assert.deepEqual(
      issued.map((d) => d.id),
      [],
      `${family} 已登记为保留未签发，但发现实际定义；应先从保留名单移除`,
    );
  }
});

test('后端没有未登记的 HTTP 端点', () => {
  const { extra } = compareEndpoints('.');
  const lines = extra.map((e) => `${e.verb} ${e.path}  (${e.file})`);
  assert.deepEqual(
    lines,
    [],
    `以下端点未在 06 第 4.5 节登记，也未登记为改名前的旧路径：\n${lines.join('\n')}`,
  );
});

test('端点清单的「已有」标注与实际实现一致', () => {
  const { wrongState } = compareEndpoints('.');
  const lines = wrongState.map((e) => `${e.verb} ${e.path}`);
  assert.deepEqual(lines, [], `清单标为「已有」但代码中不存在：\n${lines.join('\n')}`);
});

test('端点清单的旧路径标注没有过期', () => {
  const { staleLegacy } = compareEndpoints('.');
  const lines = staleLegacy.map((e) => `${e.verb} ${e.path} -> 旧路径 ${e.legacy.verb} ${e.legacy.path}`);
  assert.deepEqual(lines, [], `旧路径已不存在，应从依据列移除标注：\n${lines.join('\n')}`);
});

test('端点清单每一行都归属六个业务模块之一', () => {
  const allowed = new Set([
    '身份与会话',
    '管理与支持',
    '工作空间与课程',
    '制作与发布',
    '授权与交付',
    '运行与审计',
  ]);
  const { inventory } = compareEndpoints('.');
  assert.ok(inventory.length > 0, '端点清单为空，第 4.5 节可能被改动');
  const orphans = inventory.filter((e) => !allowed.has(e.module)).map((e) => `${e.verb} ${e.path} -> ${e.module}`);
  assert.deepEqual(orphans, [], `端点未归属设计 03 第 7 节的业务模块：\n${orphans.join('\n')}`);
});

test('端点清单的状态取值受限', () => {
  const allowed = new Set(['已有', '改名', '新建']);
  const { inventory } = compareEndpoints('.');
  const invalid = inventory
    .filter((e) => !allowed.has(e.state))
    .map((e) => `${e.verb} ${e.path} -> "${e.state}"`);
  assert.deepEqual(invalid, [], `状态取值非法：\n${invalid.join('\n')}`);
});

test('后端没有新增的跨模块表访问', () => {
  const { newViolations } = analyzeModules('.');
  const lines = newViolations.map(
    (v) => `${v.file} [${MODULES[v.fileModule]}] -> ${v.model} [${MODULES[v.modelModule]}] (${v.kinds.join(', ')})`,
  );
  assert.deepEqual(
    lines,
    [],
    `违反设计 03 第 7 节的模块边界。跨模块动作必须经拥有方的应用服务：\n${lines.join('\n')}`,
  );
});

test('模块越界白名单没有过期', () => {
  const { staleKnown } = analyzeModules('.');
  const lines = staleKnown.map((e) => `${e.file} -> ${e.accesses.join(', ')}`);
  assert.deepEqual(
    lines,
    [],
    `以下越界已修复，应从 KNOWN_VIOLATIONS 删除，否则白名单会变成永久豁免：\n${lines.join('\n')}`,
  );
});

test('每个后端服务与仓储都登记了所属模块', () => {
  const { unregisteredFiles } = analyzeModules('.');
  assert.deepEqual(
    unregisteredFiles,
    [],
    `新增服务或仓储必须在 FILE_OWNER 登记模块归属：\n${unregisteredFiles.join('\n')}`,
  );
});

test('每个数据模型都登记了所属模块', () => {
  const { unregisteredModels } = analyzeModules('.');
  assert.deepEqual(
    unregisteredModels,
    [],
    `新增模型必须同时更新 MODEL_OWNER 和设计 03 第 7.0 节表归属表：\n${unregisteredModels.join('\n')}`,
  );
});

test('表归属登记与设计 03 第 7.0 节一致', () => {
  const design = readFileSync('doc/design/v1/03-system-architecture.md', 'utf8');
  const start = design.indexOf('### 7.0 表归属');
  assert.notEqual(start, -1, '设计 03 缺少第 7.0 节表归属');
  const section = design.slice(start, design.indexOf('### 7.1', start));

  // 表名由模型名推导校验：设计文档用表名，工具用模型类名，两者必须指向同一模块
  const tableOf = {
    Admin: 'admins',
    AdminSession: 'admin_sessions',
    Teacher: 'teachers',
    TeacherSession: 'teacher_sessions',
    Workspace: 'workspaces',
    Course: 'courses',
    Lesson: 'lessons',
    ScriptDraft: 'script_drafts',
    PublishedScript: 'published_scripts',
    AccessCode: 'access_codes',
    AccessGrant: 'access_grants',
    OperationLog: 'operation_logs',
  };
  for (const [model, module] of Object.entries(MODEL_OWNER)) {
    const table = tableOf[model];
    assert.ok(table, `测试未覆盖模型 ${model}，请补 tableOf 映射`);
    const row = section.split('\n').find((line) => line.includes(`\`${table}\``));
    assert.ok(row, `设计 03 第 7.0 节未登记表 ${table}`);
    assert.ok(
      row.includes(MODULES[module]),
      `表 ${table} 在设计文档归属与 MODEL_OWNER 不一致：文档行「${row.trim()}」，工具登记「${MODULES[module]}」`,
    );
  }
});

test('模块键与代码重构计划的目标目录名一致', () => {
  // 阶段 1 会把后端改成 modules/<domain>/。若工具的模块键与计划的目录名不一致，
  // 届时要么改目录要么改工具，白白多一次重命名，且中间状态无法检查。
  const plan = readFileSync('doc/plans/v1-code-refactor-execution-plan.md', 'utf8');
  const start = plan.indexOf('## 5. 目标代码边界');
  assert.notEqual(start, -1, '代码重构计划缺少第 5 节目标代码边界');
  const section = plan.slice(start, plan.indexOf('## 6.', start));

  const modulesBlock = section.slice(section.indexOf('modules/'));
  for (const key of Object.keys(MODULES)) {
    assert.ok(
      new RegExp(`^\\s+${key}/\\s*$`, 'm').test(modulesBlock),
      `计划第 5 节 modules/ 下缺少目录 ${key}/；模块键与目标目录名必须一致`,
    );
  }
});

test('npm test 覆盖全部测试文件，CI 与文档使用同一命令', () => {
  // 测试目录同时有 .test.js（CommonJS）和 .test.mjs（ESM）。
  // 单个 glob 只匹配一类，会静默漏掉另一类 —— 加 package.json 时就发生过：
  // node --test tests/*.test.js 从 352 项变成 331 项，且不报错。
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const script = pkg.scripts?.test ?? '';
  const legacyScript = pkg.scripts?.['test:legacy'] ?? '';
  const v1Script = pkg.scripts?.['test:v1'] ?? '';
  assert.match(script, /test:legacy/, `package.json 的 test 入口未调用 legacy 测试；当前为「${script}」`);
  assert.match(script, /test:v1/, `package.json 的 test 入口未调用 v1 测试；当前为「${script}」`);
  for (const ext of ['*.test.js', '*.test.mjs']) {
    assert.ok(
      legacyScript.includes(ext),
      `package.json 的 test:legacy 脚本未覆盖 ${ext}；当前为「${legacyScript}」`,
    );
  }
  assert.match(v1Script, /--prefix v1 test/, `package.json 的 test:v1 未运行 v1 测试；当前为「${v1Script}」`);

  // CI 必须用同一入口，否则本地全绿而 CI 漏跑。
  for (const workflow of ['.github/workflows/test.yml', '.github/workflows/pages.yml']) {
    const text = readFileSync(workflow, 'utf8');
    assert.match(text, /run:\s*npm test/, `${workflow} 未使用 npm test；直接写 glob 会漏掉一类测试文件`);
    assert.match(text, /run:\s*npm ci/, `${workflow} 缺少 npm ci；契约校验依赖必须从仓库内解析`);
    assert.match(text, /npm ci --prefix v1/, `${workflow} 缺少 v1 锁定依赖安装，npm test 无法在干净环境运行`);
  }
});

test('契约校验器依赖已在两侧声明并锁定', () => {
  // DEV-DEP-001：依赖最小、锁定、可追溯。ajv 曾只能从开发机全局
  // /Users/bai/node_modules 解析，那样检查在干净环境和 CI 里不可重现。
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const ajv = pkg.devDependencies?.ajv;
  assert.ok(ajv, 'package.json 未声明 ajv');
  assert.match(ajv, /^\d+\.\d+\.\d+$/, `ajv 必须锁定精确版本，当前为「${ajv}」`);
  assert.ok(existsSync('package-lock.json'), '缺少 package-lock.json');

  const pyproject = readFileSync('backend/pyproject.toml', 'utf8');
  assert.match(pyproject, /jsonschema>=/, 'backend/pyproject.toml 未声明 jsonschema');
  assert.ok(existsSync('backend/uv.lock'), '缺少 backend/uv.lock');
});

test('后端静态检查工具已声明且进入 CI 门禁', () => {
  // ruff 此前只有 [tool.ruff] 配置而没有声明依赖：本机能跑是因为解析到环境里已有的
  // 版本，但 CI 用 uv sync --frozen 时 uv run ruff 会失败。
  const pyproject = readFileSync('backend/pyproject.toml', 'utf8');
  assert.match(pyproject, /"ruff>=/, 'backend/pyproject.toml 未声明 ruff 依赖');

  const workflow = readFileSync('.github/workflows/test.yml', 'utf8');
  for (const command of ['ruff check .', 'ruff format --check .']) {
    assert.ok(
      workflow.includes(command),
      `CI 缺少 ${command}；0F 要求静态检查零错误并进门禁`,
    );
  }
});

test('CI 的契约检查 job 同时具备 Node 与 Python', () => {
  // 双端一致性检查需要两套工具链。若只在 node-test job 里跑，
  // Python 侧缺失会让它静默跳过 —— 那条阶段 0 门禁就永远不会真正执行。
  const workflow = readFileSync('.github/workflows/test.yml', 'utf8');
  const start = workflow.indexOf('contract-check:');
  assert.notEqual(start, -1, 'CI 缺少 contract-check job');
  const job = workflow.slice(start);
  assert.match(job, /setup-node/, 'contract-check job 缺少 Node');
  assert.match(job, /setup-python/, 'contract-check job 缺少 Python');
  assert.match(job, /contract-check\.mjs/, 'contract-check job 未运行契约检查');
});

test('契约 Schema 合法、可编译且版本清单一致', () => {
  const { schemas, versions } = runContractChecks('.', { python: false });
  assert.deepEqual(schemas, [], `Schema 问题：\n${schemas.join('\n')}`);
  assert.deepEqual(versions, [], `版本清单问题：\n${versions.join('\n')}`);
});

test('契约夹具行为与文件名一致', () => {
  // 反例「应被拒绝却通过了」说明 Schema 缺约束；
  // 正例「应通过却被拒绝」说明 Schema 过严或夹具写错。两种都不能放过。
  const { fixtures, fixtureCount } = runContractChecks('.', { python: false });
  assert.ok(fixtureCount > 0, '没有契约夹具，无法证明任何 Schema 规则生效');
  assert.deepEqual(fixtures, [], `夹具与命名不符：\n${fixtures.join('\n')}`);
});

test('Python 与 Node 对同一契约夹具给出一致结论', () => {
  // 阶段 0 门禁：跨语言契约必须在两侧得出相同结果，否则它不是真正的共同真源。
  // 无 uv 环境时跳过而非失败 —— 但 CI 里必须跑到（workflow 装了后端依赖）。
  const { crossLanguage, comparedCount, pythonSkipped } = runContractChecks('.', { python: true });
  if (pythonSkipped || crossLanguage.some((p) => p.startsWith('Python 侧校验无法执行'))) {
    console.log('    （跳过：本机无可用 uv/后端环境）');
    return;
  }
  assert.deepEqual(crossLanguage, [], `双端结论不一致：\n${crossLanguage.join('\n')}`);
  assert.ok(comparedCount > 0, 'Python 侧未比对任何夹具');
});

test('仓库不含可用秘密', () => {
  // SEC-SECRET-003 把「仓库秘密扫描测试」列为验收证据。
  const { findings, scanned } = scanSecrets();
  assert.ok(scanned > 100, `扫描文件数异常少（${scanned}），范围可能配置错误`);
  const lines = findings.map((f) => `${f.file}:${f.line} [${f.rule}]`);
  assert.deepEqual(lines, [], `发现疑似可用秘密：\n${lines.join('\n')}`);
});

test('秘密扫描能识别真实凭证形态', () => {
  // 一个只会通过的扫描器等于没有扫描器。这里用构造样本验证每条规则真的会命中，
  // 不写入仓库文件 —— 直接对规则求值。
  const samples = {
    'aws-access-key-id': 'const k = "AKIAQ7RJ4XKLM2NPWZ3B";',
    'github-token': 'const t = "ghp_9Kz2mQvR7tYuI3oP5aSdF8gHjKlZxCvBnM4q";',
    'postgres-url-with-password': 'postgres://svc:Rt7pQm2zXk@db.internal:5432/app',
    'generic-assigned-secret': 'sessionKey = "k9Vx2QmR7tPwZa4LbNc8YsEdFgHjKuIo"',
    'private-key-block': '-----BEGIN RSA PRIVATE KEY-----',
    'knownmap-access-code': 'code = "KM-Q7RJ4-XKLM2-NPWZ3-BVTY6"',
  };
  for (const [ruleName, sample] of Object.entries(samples)) {
    const rule = SECRET_RULES.find((r) => r.name === ruleName);
    assert.ok(rule, `规则 ${ruleName} 不存在`);
    const match = sample.match(rule.pattern);
    assert.ok(match, `规则 ${ruleName} 未命中真实凭证形态样本`);
    assert.ok(
      !looksLikePlaceholder(match[0]),
      `规则 ${ruleName} 的真实凭证样本被误判为占位，会造成漏报`,
    );
  }
});

test('秘密扫描不对占位与示例告警', () => {
  // 对每个测试夹具都告警的扫描器会被学会忽略，那时它对真实泄露也不起作用。
  for (const placeholder of [
    'KM-XXXXX-XXXXX-XXXXX-XXXXX',
    'KM-AAAAA-AAAAA-AAAAA-AAAAA',
    'KM-ABCDE-FGHIJ-KLMNO-PQRST',
    'KM-ZYXWV-TSRQP-NMLKJ-HGFED',
    '"replacement-password"',
    '"your-token-here"',
    '"example-secret-value"',
  ]) {
    assert.ok(looksLikePlaceholder(placeholder), `占位「${placeholder}」被判为真实秘密`);
  }
});

test('依赖已锁定、已约束且锁文件与声明同步', () => {
  // DEV-DEP-001。漏洞库查询不在此 —— 需要联网，由 CI 的 npm audit / pip-audit 承担。
  const { node, python, lockSync } = checkDependencies();
  assert.deepEqual(node, [], `Node 依赖问题：\n${node.join('\n')}`);
  assert.deepEqual(python, [], `后端依赖问题：\n${python.join('\n')}`);
  // 本机无 uv 时该项会给出提示而非失败，此处只在真正不同步时失败
  const outOfSync = lockSync.filter((p) => !p.includes('本机无 uv'));
  assert.deepEqual(outOfSync, [], `锁文件不同步：\n${outOfSync.join('\n')}`);
});

test('CI 覆盖漏洞扫描', () => {
  // 本机镜像源常不实现 advisories 端点，跑 npm audit 只会得到 404 而非「无漏洞」，
  // 那是最坏的假绿。因此漏洞扫描必须在 CI 里，且必须真的存在。
  const workflow = readFileSync('.github/workflows/test.yml', 'utf8');
  assert.match(workflow, /npm audit/, 'CI 缺少 npm audit');
  assert.match(workflow, /pip-audit|uv-secure|safety/, 'CI 缺少 Python 侧漏洞扫描');
  assert.match(workflow, /dependency-check\.mjs/, 'CI 缺少依赖锁定检查');
});

test('项目开发规则文件存在且指向真源', () => {
  const path = 'doc/dev-rules.md';
  assert.ok(existsSync(path), `${path} 缺失；设计 README 与全局规则都引用它`);
  const text = readFileSync(path, 'utf8');
  for (const target of [
    'requirements/v1/README.md',
    'design/v1/README.md',
    'traceability/v1-requirements.tsv',
  ]) {
    assert.ok(text.includes(target), `${path} 未指向真源 ${target}`);
  }
});
