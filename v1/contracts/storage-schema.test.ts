import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import schema from './schemas/extension-storage.schema.json';

const node = {
  id: 'node-1',
  enabled: true,
  family: 'attention',
  interaction: 'notice',
  anchor: { kind: 'time_cross', timeSeconds: 10, captionId: null },
  title: '重点',
  content: { schemaVersion: 1, blocks: [{ type: 'paragraph', children: [{ text: '提示' }] }] },
  interactionData: null,
  presentationHints: { windowSize: 'm', windowStyle: 'document' },
  effects: { pause: true },
};

const validRoot = {
  storage_schema_version: '2.0.0',
  localIdentity: {
    clientId: '00000001-0000-4000-8000-000000000000',
    proof: 'proof',
    proofSalt: 'salt',
    createdAt: '2026-08-26T00:00:00.000Z',
  },
  installedCourses: {
    '00000002-0000-4000-8000-000000000000': {
      courseId: '00000002-0000-4000-8000-000000000000',
      title: '课程',
      lessons: [{ lessonId: '00000003-0000-4000-8000-000000000000', title: '第一节', videoId: 'BV1Ac41187Lm', page: 1, cid: null, nodes: [node] }],
      assets: [],
      publishedAt: '2026-08-26T00:00:00.000Z',
      installedAt: '2026-08-26T00:00:00.000Z',
      source: 'authorized',
      readOnly: false,
      sourceId: 'redemption-1',
    },
  },
  authorizationSourceCache: { sources: [] },
  localLearningState: {},
  quarantine: { entries: [] },
};

const currentSettings = {
  showRedeemEntry: true,
  showRecommendations: true,
  syncMode: 'prompt',
  shortcut: 'Alt+K',
  mascot: 'standard',
};

function validator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

describe('extension storage contract', () => {
  it('accepts the shape written by CourseLibrary', () => {
    expect(validator()(validRoot)).toBe(true);
  });

  it('accepts the optional settings and release metadata', () => {
    const value = structuredClone(validRoot) as any;
    value.settings = currentSettings;
    value.installedCourses['00000002-0000-4000-8000-000000000000'].releaseId =
      '00000004-0000-4000-8000-000000000000';
    value.installedCourses['00000002-0000-4000-8000-000000000000'].releaseNumber = 2;
    expect(validator()(value)).toBe(true);
  });

  it('accepts continuous window size and position values', () => {
    const value = structuredClone(validRoot) as any;
    value.installedCourses['00000002-0000-4000-8000-000000000000'].lessons[0].nodes[0].presentationHints = {
      windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
      windowPosition: { xPercent: 63.4, yPercent: 28.7 },
      windowStyle: 'document',
    };
    expect(validator()(value)).toBe(true);
  });

  it('rejects unknown settings fields and values', () => {
    const value = structuredClone(validRoot) as any;
    value.settings = { ...currentSettings, remoteScript: 'https://example.com/x.js' };
    expect(validator()(value)).toBe(false);

    value.settings = { ...currentSettings, syncMode: 'silent' };
    expect(validator()(value)).toBe(false);
  });

  it('rejects the old embedded-coursePackage shape', () => {
    const value = { ...validRoot, installedCourses: { course: { courseId: 'course', coursePackage: {} } } };
    expect(validator()(value)).toBe(false);
  });

  it('rejects an unknown rich-document block', () => {
    const value = structuredClone(validRoot);
    const blocks = value.installedCourses['00000002-0000-4000-8000-000000000000'].lessons[0].nodes[0].content.blocks as unknown[];
    blocks.splice(0, blocks.length, { type: 'custom_widget' });
    expect(validator()(value)).toBe(false);
  });
});
