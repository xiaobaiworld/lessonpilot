import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import schema from './schemas/course-package.schema.json';

const node = {
  id: 'node-1',
  enabled: true,
  family: 'attention',
  interaction: 'notice',
  anchor: { kind: 'time_cross', timeSeconds: 10, captionId: null },
  title: '重点',
  content: { schemaVersion: 1, blocks: [{ type: 'paragraph', children: [{ text: '提示' }] }] },
  interactionData: null,
  presentationHints: {
    windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
    windowPosition: { xPercent: 63.4, yPercent: 28.7 },
    windowStyle: 'document',
  },
  effects: { pause: true },
};

const course = {
  schemaVersion: 3,
  courseId: '00000001-0000-4000-8000-000000000000',
  releaseId: '00000002-0000-4000-8000-000000000000',
  releaseNumber: 1,
  title: '课程',
  assets: [],
  lessons: [{
    lessonId: '00000003-0000-4000-8000-000000000000',
    title: '第一节',
    videoRef: { platform: 'bilibili', videoId: 'BV1Ac41187Lm', page: 1, cid: null },
    nodes: [node],
  }],
  updatedAt: '2026-08-29T00:00:00.000Z',
};

function validator() {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

describe('course package presentation contract', () => {
  it('accepts continuous window size and position values', () => {
    expect(validator()(course)).toBe(true);
  });

  it('rejects continuous values outside the viewport contract', () => {
    const value = structuredClone(course) as any;
    value.lessons[0].nodes[0].presentationHints.windowSize.widthPercent = 66.1;
    expect(validator()(value)).toBe(false);
  });
});
