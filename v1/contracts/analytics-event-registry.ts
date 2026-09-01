import type {
  AnalyticsActorType,
  AnalyticsEvent,
  AnalyticsPrivacyClass,
  AnalyticsSource,
} from './analytics-event';

export interface AnalyticsEventDefinition {
  actors: readonly AnalyticsActorType[];
  sources: readonly AnalyticsSource[];
  privacy_class: AnalyticsPrivacyClass;
  required_properties: readonly string[];
  allowed_properties: readonly string[];
}

const teacherOperational = {
  actors: ['teacher', 'preview'] as const,
  sources: ['teacher_web', 'admin_web', 'test'] as const,
  privacy_class: 'operational' as const,
};

export const ANALYTICS_EVENT_REGISTRY = {
  teacher_app_loaded: {
    ...teacherOperational,
    required_properties: ['route', 'app_version'],
    allowed_properties: ['route', 'app_version'],
  },
  course_opened: {
    ...teacherOperational,
    required_properties: ['entry'],
    allowed_properties: ['entry'],
  },
  lesson_opened: {
    ...teacherOperational,
    required_properties: ['has_draft'],
    allowed_properties: ['has_draft'],
  },
  draft_save_started: {
    ...teacherOperational,
    required_properties: ['draft_revision'],
    allowed_properties: ['draft_revision'],
  },
  draft_save_result: {
    ...teacherOperational,
    required_properties: ['error_code'],
    allowed_properties: ['error_code'],
  },
  preview_started: {
    ...teacherOperational,
    required_properties: ['draft_revision'],
    allowed_properties: ['draft_revision'],
  },
  publish_result: {
    ...teacherOperational,
    required_properties: ['error_code'],
    allowed_properties: ['error_code'],
  },
  access_code_create_result: {
    ...teacherOperational,
    required_properties: ['batch_size', 'error_code'],
    allowed_properties: ['batch_size', 'error_code'],
  },
  teacher_error_seen: {
    ...teacherOperational,
    required_properties: ['error_code', 'module', 'recoverable'],
    allowed_properties: ['error_code', 'module', 'recoverable'],
  },
  lesson_started: {
    actors: ['student_local'] as const,
    sources: ['student_extension', 'test'] as const,
    privacy_class: 'learning_local' as const,
    required_properties: [],
    allowed_properties: [],
  },
  node_presented: {
    actors: ['student_local'] as const,
    sources: ['student_extension', 'test'] as const,
    privacy_class: 'learning_local' as const,
    required_properties: ['node_id', 'node_family', 'position_index'],
    allowed_properties: ['node_id', 'node_family', 'position_index'],
  },
  node_submitted: {
    actors: ['student_local'] as const,
    sources: ['student_extension', 'test'] as const,
    privacy_class: 'learning_local' as const,
    required_properties: ['node_id', 'outcome', 'attempt_index', 'duration_ms'],
    allowed_properties: ['node_id', 'outcome', 'attempt_index', 'duration_ms'],
  },
  node_completed: {
    actors: ['student_local'] as const,
    sources: ['student_extension', 'test'] as const,
    privacy_class: 'learning_local' as const,
    required_properties: ['node_id', 'outcome'],
    allowed_properties: ['node_id', 'outcome'],
  },
  lesson_completed: {
    actors: ['student_local'] as const,
    sources: ['student_extension', 'test'] as const,
    privacy_class: 'learning_local' as const,
    required_properties: ['completed_count', 'total_count'],
    allowed_properties: ['completed_count', 'total_count'],
  },
  local_runtime_error: {
    actors: ['student_local'] as const,
    sources: ['student_extension', 'test'] as const,
    privacy_class: 'diagnostic' as const,
    required_properties: ['error_code', 'recoverable'],
    allowed_properties: ['error_code', 'recoverable'],
  },
} satisfies Record<string, AnalyticsEventDefinition>;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENT_REGISTRY;

export function getAnalyticsEventDefinition(
  name: string,
): AnalyticsEventDefinition | undefined {
  return ANALYTICS_EVENT_REGISTRY[name as AnalyticsEventName];
}

export function isRegisteredAnalyticsEvent(event: AnalyticsEvent): event is AnalyticsEvent & {
  event_name: AnalyticsEventName;
} {
  return Boolean(getAnalyticsEventDefinition(event.event_name));
}
