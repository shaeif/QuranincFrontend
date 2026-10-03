/** Value of an Ionic input/textarea event. */
export function inputValue(event: Event): string {
  const detail = (event as CustomEvent<{ value?: string | null }>).detail;
  return detail?.value ?? '';
}

/** Only same-site paths are allowed as a post-login destination. */
export function safeNext(next: string | null | undefined, fallback = '/you'): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : fallback;
}

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/** Mirrors the backend rules we can check before sending: 10–128 characters, not your username or email. */
export function passwordProblem(password: string, username = '', email = ''): string {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const lower = password.toLowerCase();
  if (username && lower.includes(username.toLowerCase())) return "Don't include your username.";
  const local = email.split('@')[0];
  if (local && local.length > 2 && lower.includes(local.toLowerCase())) return "Don't include your email address.";
  return '';
}
