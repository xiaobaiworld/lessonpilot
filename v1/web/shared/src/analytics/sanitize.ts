import type { AnalyticsPropertyValue } from '@v1/contracts/analytics';

const SENSITIVE_KEY_PARTS = [
  'password',
  'secret',
  'token',
  'cookie',
  'authorization',
  'access_code',
  'credential',
  'proof',
  'email',
  'phone',
  'subtitle',
  'content',
  'answer',
  'prompt',
  'response',
  'body',
  'html',
  'text',
];

const SENSITIVE_VALUE_PATTERN = /(password|secret|token|cookie|access[_-]?code|authorization|proof)\s*[:=]/i;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function isSafeValue(value: unknown): value is AnalyticsPropertyValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Keep analytics properties scalar, bounded and free of known content/credential fields.
 * Unknown properties are still rejected by the event registry; this function is a final
 * defensive boundary before an adapter is allowed to see the event.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, AnalyticsPropertyValue> {
  const sanitized: Record<string, AnalyticsPropertyValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isSensitiveKey(key) || !isSafeValue(value)) continue;
    if (typeof value === 'string' && (value.length > 256 || SENSITIVE_VALUE_PATTERN.test(value))) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}
