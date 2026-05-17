/**
 * Tiny `localStorage` helper for user preferences. All keys are
 * automatically prefixed with the project namespace; functions degrade
 * silently when storage is unavailable (private-mode browsing, quota
 * exceeded, SSR environments, etc.) so callers never need to handle
 * errors.
 *
 * Booleans are stored as '1' / '0' strings; any other value is treated
 * as "not set" and the caller's `fallback` is returned.
 */
const KEY_PREFIX = 'geometry-dash:';

export function loadBoolPref(key: string, fallback: boolean): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(KEY_PREFIX + key);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveBoolPref(key: string, value: boolean): void {
  try {
    globalThis.localStorage?.setItem(KEY_PREFIX + key, value ? '1' : '0');
  } catch {
    // localStorage write failed (quota, private mode, etc.) — silently skip.
  }
}
