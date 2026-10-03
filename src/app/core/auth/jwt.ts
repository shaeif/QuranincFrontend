/** Seconds since epoch when a JWT expires, or 0 if it can't be read. */
export function jwtExpiry(token: string): number {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : 0;
  } catch {
    return 0;
  }
}

/** True when the token expires within `marginSeconds` (or can't be read). */
export function isExpiring(token: string, marginSeconds = 20, now = Date.now()): boolean {
  const exp = jwtExpiry(token);
  return !exp || exp * 1000 - now < marginSeconds * 1000;
}
