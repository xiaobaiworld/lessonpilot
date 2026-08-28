import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_SCHEMA_VERSION, emptyRoot } from './types';
import { DEFAULT_STUDENT_SETTINGS } from './settings';
import { VERSIONS } from '../../contracts/version-manifest';

/**
 * 把实现钉在契约上。
 *
 * schema 是双端真源，但没有测试的话代码可以静静地偏离它——写这版时我就把
 * storage_schema_version 写成了 1.0.0，而 schema 要求 ^2\.\d+\.\d+$。
 * 这种漂移只有在真实浏览器里读到旧数据时才会暴露，那时已经太晚。
 */
const schema = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../contracts/schemas/extension-storage.schema.json'),
    'utf8'
  )
);

describe('存储契约一致性', () => {
  it('版本号匹配 schema 的 pattern', () => {
    const pattern = new RegExp(schema.properties.storage_schema_version.pattern);
    expect(STORAGE_SCHEMA_VERSION).toMatch(pattern);
  });

  it('版本清单与存储常量保持一致', () => {
    const component = VERSIONS.components.find((item) => item.component === 'extensionStorage');
    expect(component?.version).toBe(STORAGE_SCHEMA_VERSION);
    expect(VERSIONS.supportMatrix[0]?.extensionStorage).toBe(STORAGE_SCHEMA_VERSION);
  });

  it('空根带齐 schema 声明的全部顶层字段', () => {
    const root = emptyRoot() as unknown as Record<string, unknown>;
    for (const field of Object.keys(schema.properties)) {
      expect(root, `缺少字段 ${field}`).toHaveProperty(field);
    }
  });

  it('空根带有稳定的设置默认值', () => {
    expect(emptyRoot().settings).toEqual(DEFAULT_STUDENT_SETTINGS);
  });

  it('空根不含 schema 未声明的字段', () => {
    const declared = new Set(Object.keys(schema.properties));
    for (const field of Object.keys(emptyRoot())) {
      expect(declared.has(field), `多出字段 ${field}`).toBe(true);
    }
  });

  it('schema 的必填字段在空根里都有值', () => {
    const root = emptyRoot() as unknown as Record<string, unknown>;
    for (const field of schema.required ?? []) {
      expect(root[field], `必填字段 ${field} 为空`).toBeDefined();
    }
  });
});
