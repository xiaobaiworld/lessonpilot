import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 把 service worker 处理的消息类型钉在契约上。
 *
 * 这份 schema 原先描述的是旧系统的三向消息（含已废弃的教师预览桥），
 * 与实现完全不符。契约跟着实际形状改了，这个测试保证两边不再各走各的。
 */
const schema = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../contracts/schemas/extension-messages.schema.json'),
    'utf8'
  )
);

const workerSource = readFileSync(resolve(__dirname, 'service-worker.ts'), 'utf8');
const redeemSource = readFileSync(resolve(__dirname, 'redeem.ts'), 'utf8');

const declaredTypes: string[] = schema.definitions.Request.properties.type.enum;

/** 从 switch 分支里取出实际处理的类型 */
const handledTypes = [...workerSource.matchAll(/^\s*case '([a-zA-Z]+)':/gm)].map(
  (m) => m[1]
);

describe('消息契约与实现一致', () => {
  it('契约声明的每个类型都有处理分支', () => {
    for (const type of declaredTypes) {
      expect(handledTypes, `契约声明了 ${type} 但 worker 未处理`).toContain(type);
    }
  });

  it('worker 处理的每个类型都在契约里', () => {
    for (const type of handledTypes) {
      expect(declaredTypes, `worker 处理了 ${type} 但契约未声明`).toContain(type);
    }
  });

  it('不认识的类型有 default 分支明确拒绝', () => {
    expect(workerSource).toContain('UNKNOWN_OPERATION');
    expect(workerSource).toMatch(/default:/);
  });

  it('错误码全大写下划线，符合契约 pattern', () => {
    const pattern = new RegExp(
      schema.definitions.Reply.oneOf[1].properties.code.pattern
    );
    const codes = [...workerSource.matchAll(/err\('([A-Z_]+)'/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) expect(code).toMatch(pattern);
  });

  it('契约不再包含已废弃的页面桥方向', () => {
    const text = JSON.stringify(schema);
    expect(text).not.toContain('HostedToContent');
    expect(text).not.toContain('ContentToHosted');
  });

  it('响应形状要求先看 ok，不靠字段存在推断', () => {
    const [success, failure] = schema.definitions.Reply.oneOf;
    expect(success.required).toContain('ok');
    expect(failure.required).toEqual(expect.arrayContaining(['ok', 'code', 'message']));
  });

  it('升级消息只能通过 background 的两阶段 API', () => {
    expect(redeemSource).toContain('/api/v1/student/course-updates/check');
    expect(redeemSource).toContain('/api/v1/student/course-updates/apply');
    expect(redeemSource).toContain('expectedReleaseId');
    expect(schema.definitions.Request.properties.type.enum).toEqual(
      expect.arrayContaining(['checkCourseUpdates', 'upgradeCourse'])
    );
  });

  it('资源消息只能由 background 读取本机缓存', () => {
    expect(declaredTypes).toContain('asset');
    expect(workerSource).toContain('assetStore.get');
    expect(workerSource).toContain('ASSET_MISSING');
  });
});
