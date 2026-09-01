import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import schema from './schemas/analytics-event.schema.json';
import { ANALYTICS_EVENT_REGISTRY, getAnalyticsEventDefinition } from './analytics-event-registry';
import type { AnalyticsEvent } from './analytics-event';

const baseEvent: AnalyticsEvent = {
  event_id: '00000000-0000-4000-8000-000000000001',
  event_name: 'draft_save_result',
  event_version: '1.0.0',
  occurred_at: '2026-09-01T08:00:00.000Z',
  actor_type: 'teacher',
  source: 'teacher_web',
  environment: 'test',
  session_id: 'test-session',
  request_id: 'test-request',
  course_id: 'course-1',
  lesson_id: 'lesson-1',
  release_id: null,
  status: 'failure',
  duration_ms: 120,
  properties: { error_code: 'DRAFT_SAVE_FAILED' },
  privacy_class: 'operational',
};

function validate(event: unknown) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema)(event);
}

describe('analytics event contract', () => {
  it('accepts a registered event envelope', () => {
    expect(validate(baseEvent)).toBe(true);
    expect(getAnalyticsEventDefinition(baseEvent.event_name)).toBeDefined();
  });

  it('rejects dynamic names and nested properties', () => {
    const event = structuredClone(baseEvent) as any;
    event.event_name = 'draft_save_result_course-1';
    event.properties = { error_code: { raw: 'secret' } };
    expect(validate(event)).toBe(false);
  });

  it('keeps the registry finite and explicit', () => {
    expect(Object.keys(ANALYTICS_EVENT_REGISTRY)).toEqual([
      'teacher_app_loaded',
      'course_opened',
      'lesson_opened',
      'draft_save_started',
      'draft_save_result',
      'preview_started',
      'publish_result',
      'access_code_create_result',
      'teacher_error_seen',
      'lesson_started',
      'node_presented',
      'node_submitted',
      'node_completed',
      'lesson_completed',
      'local_runtime_error',
    ]);
  });
});
