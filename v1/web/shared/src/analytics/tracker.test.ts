import { describe, expect, it } from 'vitest';
import type { AnalyticsEvent } from '@v1/contracts/analytics';
import { MockAnalyticsAdapter } from './mock';
import { sanitizeAnalyticsProperties } from './sanitize';
import { AnalyticsTracker } from './tracker';

const event: AnalyticsEvent = {
  event_id: '00000000-0000-4000-8000-000000000001',
  event_name: 'draft_save_result',
  event_version: '1.0.0',
  occurred_at: '2026-09-01T08:00:00.000Z',
  actor_type: 'teacher',
  source: 'teacher_web',
  environment: 'test',
  session_id: 'session-1',
  request_id: 'request-1',
  course_id: 'course-1',
  lesson_id: 'lesson-1',
  release_id: null,
  status: 'failure',
  duration_ms: 50,
  properties: { error_code: 'DRAFT_SAVE_FAILED' },
  privacy_class: 'operational',
};

describe('analytics tracker', () => {
  it('sanitizes sensitive properties before delivery', () => {
    expect(
      sanitizeAnalyticsProperties({
        password: 'secret',
        answer_text: 'student answer',
        route: '/teacher/courses',
        count: 2,
      }),
    ).toEqual({ route: '/teacher/courses', count: 2 });
  });

  it('delivers registered events to the mock adapter', async () => {
    const adapter = new MockAnalyticsAdapter();
    const tracker = new AnalyticsTracker(adapter);

    expect(tracker.track(event)).toEqual({ accepted: true, errors: [] });
    await Promise.resolve();
    expect(adapter.events).toHaveLength(1);
    expect(adapter.events[0].event_id).toBe(event.event_id);
  });

  it('rejects unknown properties before delivery', () => {
    const adapter = new MockAnalyticsAdapter();
    const tracker = new AnalyticsTracker(adapter);
    const result = tracker.track({
      ...event,
      properties: { error_code: 'DRAFT_SAVE_FAILED', course_title: 'secret course' },
    });

    expect(result.accepted).toBe(false);
    expect(result.errors).toContain('property is not allowed: course_title');
    expect(adapter.events).toHaveLength(0);
  });

  it('does not throw or block when the adapter fails', async () => {
    const failures: unknown[] = [];
    const tracker = new AnalyticsTracker(
      new MockAnalyticsAdapter(new Error('network unavailable')),
      'mock',
      (failure) => failures.push(failure),
    );

    expect(() => tracker.track(event)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(failures).toEqual([
      expect.objectContaining({
        adapter: 'mock',
        event_name: 'draft_save_result',
        request_id: 'request-1',
        error_type: 'Error',
      }),
    ]);
  });
});
