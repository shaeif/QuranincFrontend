/**
 * localStorage that never throws: private windows and blocked site data
 * just behave as if nothing was stored.
 */
const PREFIX = 'tadabbur.';

export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the setting lasts for this visit only.
  }
}
