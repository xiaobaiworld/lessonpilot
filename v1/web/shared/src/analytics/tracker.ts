import type {
  AnalyticsActorType,
  AnalyticsEnvironment,
  AnalyticsEvent,
  AnalyticsPrivacyClass,
  AnalyticsSource,
  AnalyticsStatus,
} from '@v1/contracts/analytics';
import { getAnalyticsEventDefinition } from '@v1/contracts/analytics-registry';
import { sanitizeAnalyticsProperties } from './sanitize';

export interface AnalyticsAdapter {
  send(event: AnalyticsEvent): void | Promise<void>;
}

export interface AnalyticsDeliveryFailure {
  adapter: string;
  event_name: string;
  request_id: string | null;
  error_type: string;
  duration_ms: number;
}

export type AnalyticsFailureSink = (failure: AnalyticsDeliveryFailure) => void;

export interface AnalyticsTrackResult {
  accepted: boolean;
  errors: string[];
}

const ACTOR_TYPES: readonly AnalyticsActorType[] = ['teacher', 'student_local', 'system', 'preview'];
const ENVIRONMENTS: readonly AnalyticsEnvironment[] = ['development', 'test', 'staging', 'production'];
const SOURCES: readonly AnalyticsSource[] = [
  'teacher_web',
  'student_extension',
  'admin_web',
  'server',
  'test',
];
const STATUSES: readonly AnalyticsStatus[] = [
  'started',
  'success',
  'failure',
  'cancelled',
  'skipped',
  'unknown',
];
const PRIVACY_CLASSES: readonly AnalyticsPrivacyClass[] = [
  'operational',
  'learning_local',
  'diagnostic',
];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isNullableBoundedString(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length <= 128);
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function validateAnalyticsEvent(event: AnalyticsEvent): string[] {
  const errors: string[] = [];
  const definition = getAnalyticsEventDefinition(event.event_name);

  if (!definition) errors.push('event_name is not registered');
  if (!UUID_PATTERN.test(event.event_id)) errors.push('event_id must be a UUID');
  if (!/^\d+\.\d+\.\d+$/.test(event.event_version)) errors.push('event_version must be semver');
  if (!isDateTime(event.occurred_at)) errors.push('occurred_at must be an ISO date-time');
  if (!ACTOR_TYPES.includes(event.actor_type)) errors.push('actor_type is invalid');
  if (!SOURCES.includes(event.source)) errors.push('source is invalid');
  if (!ENVIRONMENTS.includes(event.environment)) errors.push('environment is invalid');
  if (!STATUSES.includes(event.status)) errors.push('status is invalid');
  if (!PRIVACY_CLASSES.includes(event.privacy_class)) errors.push('privacy_class is invalid');
  for (const [field, value] of Object.entries({
    session_id: event.session_id,
    request_id: event.request_id,
    course_id: event.course_id,
    lesson_id: event.lesson_id,
    release_id: event.release_id,
  })) {
    if (!isNullableBoundedString(value)) errors.push(`${field} must be a bounded string or null`);
  }
  if (event.duration_ms !== null && (!Number.isInteger(event.duration_ms) || event.duration_ms < 0)) {
    errors.push('duration_ms must be a non-negative integer or null');
  }
  if (!event.properties || typeof event.properties !== 'object' || Array.isArray(event.properties)) {
    errors.push('properties must be an object');
  }

  if (!definition) return errors;
  if (!definition.actors.includes(event.actor_type)) errors.push('actor_type is not allowed for event');
  if (!definition.sources.includes(event.source)) errors.push('source is not allowed for event');
  if (event.privacy_class !== definition.privacy_class) errors.push('privacy_class does not match registry');

  const propertyKeys = Object.keys(event.properties ?? {});
  for (const key of propertyKeys) {
    if (!definition.allowed_properties.includes(key)) errors.push(`property is not allowed: ${key}`);
  }
  for (const key of definition.required_properties) {
    if (!(key in (event.properties ?? {}))) errors.push(`property is required: ${key}`);
  }
  return errors;
}

export class AnalyticsTracker {
  constructor(
    private readonly adapter: AnalyticsAdapter,
    private readonly adapterName = 'analytics-adapter',
    private readonly onFailure: AnalyticsFailureSink = () => undefined,
    private readonly now: () => number = () => performance.now(),
  ) {}

  track(event: AnalyticsEvent): AnalyticsTrackResult {
    const sanitized = {
      ...event,
      properties: sanitizeAnalyticsProperties(event.properties),
    };
    const errors = validateAnalyticsEvent(sanitized);
    if (errors.length > 0) return { accepted: false, errors };

    const startedAt = this.now();
    // The delivery is deliberately detached from the caller's business action.
    void Promise.resolve()
      .then(() => this.adapter.send(sanitized))
      .catch((error: unknown) => {
        this.onFailure({
          adapter: this.adapterName,
          event_name: sanitized.event_name,
          request_id: sanitized.request_id,
          error_type: error instanceof Error ? error.name : 'UnknownError',
          duration_ms: Math.max(0, Math.round(this.now() - startedAt)),
        });
      });

    return { accepted: true, errors: [] };
  }
}
