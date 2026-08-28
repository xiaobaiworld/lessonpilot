export const STUDENT_SYNC_MODES = ['auto', 'prompt', 'manual'] as const;
export type StudentSyncMode = (typeof STUDENT_SYNC_MODES)[number];

export const STUDENT_SHORTCUTS = ['Alt+K'] as const;
export type StudentShortcut = (typeof STUDENT_SHORTCUTS)[number];

export const STUDENT_MASCOTS = ['standard'] as const;
export type StudentMascot = (typeof STUDENT_MASCOTS)[number];

export interface StudentSettings {
  showRedeemEntry: boolean;
  showRecommendations: boolean;
  syncMode: StudentSyncMode;
  shortcut: StudentShortcut;
  mascot: StudentMascot;
}

export const DEFAULT_STUDENT_SETTINGS: StudentSettings = {
  showRedeemEntry: true,
  showRecommendations: true,
  syncMode: 'prompt',
  shortcut: 'Alt+K',
  mascot: 'standard',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function includes<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === 'string' && values.includes(value);
}

export function isStudentSettings(value: unknown): value is StudentSettings {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  const expected = Object.keys(DEFAULT_STUDENT_SETTINGS);
  return (
    keys.length === expected.length &&
    expected.every((key) => keys.includes(key)) &&
    typeof value.showRedeemEntry === 'boolean' &&
    typeof value.showRecommendations === 'boolean' &&
    includes(STUDENT_SYNC_MODES, value.syncMode) &&
    includes(STUDENT_SHORTCUTS, value.shortcut) &&
    includes(STUDENT_MASCOTS, value.mascot)
  );
}

/** 只从白名单读取本机偏好，坏字段回退默认值。 */
export function normalizeStudentSettings(value: unknown): StudentSettings {
  if (!isPlainObject(value)) return { ...DEFAULT_STUDENT_SETTINGS };
  return {
    showRedeemEntry:
      typeof value.showRedeemEntry === 'boolean'
        ? value.showRedeemEntry
        : DEFAULT_STUDENT_SETTINGS.showRedeemEntry,
    showRecommendations:
      typeof value.showRecommendations === 'boolean'
        ? value.showRecommendations
        : DEFAULT_STUDENT_SETTINGS.showRecommendations,
    syncMode: includes(STUDENT_SYNC_MODES, value.syncMode)
      ? value.syncMode
      : DEFAULT_STUDENT_SETTINGS.syncMode,
    shortcut: includes(STUDENT_SHORTCUTS, value.shortcut)
      ? value.shortcut
      : DEFAULT_STUDENT_SETTINGS.shortcut,
    mascot: includes(STUDENT_MASCOTS, value.mascot)
      ? value.mascot
      : DEFAULT_STUDENT_SETTINGS.mascot,
  };
}
