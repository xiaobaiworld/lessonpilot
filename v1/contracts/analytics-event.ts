export const ANALYTICS_EVENT_VERSION = '1.0.0' as const;

export type AnalyticsActorType = 'teacher' | 'student_local' | 'system' | 'preview';
export type AnalyticsSource =
  | 'teacher_web'
  | 'student_extension'
  | 'admin_web'
  | 'server'
  | 'test';
export type AnalyticsEnvironment = 'development' | 'test' | 'staging' | 'production';
export type AnalyticsStatus =
  | 'started'
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'unknown';
export type AnalyticsPrivacyClass = 'operational' | 'learning_local' | 'diagnostic';

export type AnalyticsPropertyValue = string | number | boolean | null;

export interface AnalyticsEvent {
  event_id: string;
  event_name: string;
  event_version: string;
  occurred_at: string;
  actor_type: AnalyticsActorType;
  source: AnalyticsSource;
  environment: AnalyticsEnvironment;
  session_id: string | null;
  request_id: string | null;
  course_id: string | null;
  lesson_id: string | null;
  release_id: string | null;
  status: AnalyticsStatus;
  duration_ms: number | null;
  properties: Record<string, AnalyticsPropertyValue>;
  privacy_class: AnalyticsPrivacyClass;
}
