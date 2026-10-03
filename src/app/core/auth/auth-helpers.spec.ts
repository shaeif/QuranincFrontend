import { describe, expect, it } from 'vitest';
import { toUser } from '../api/normalize';
import { passwordProblem, safeNext } from '../util/forms';
import { isExpiring, jwtExpiry } from './jwt';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const token = (exp: number) => `${b64({ alg: 'HS256' })}.${b64({ exp })}.sig`;

describe('jwt', () => {
  it('reads the expiry and treats near-expiry as expiring', () => {
    const now = 1_800_000_000_000;
    expect(jwtExpiry(token(1_800_000_300))).toBe(1_800_000_300);
    expect(isExpiring(token(now / 1000 + 300), 20, now)).toBe(false);
    expect(isExpiring(token(now / 1000 + 10), 20, now)).toBe(true);
    expect(isExpiring('not-a-token', 20, now)).toBe(true);
  });
});

describe('safeNext', () => {
  it('only allows same-site paths after login', () => {
    expect(safeNext('/reflections/r1')).toBe('/reflections/r1');
    expect(safeNext('https://evil.example')).toBe('/you');
    expect(safeNext('//evil.example')).toBe('/you');
    expect(safeNext('/login?next=/x')).toBe('/you');
    expect(safeNext(undefined)).toBe('/you');
  });
});

describe('passwordProblem', () => {
  it('mirrors the backend rules we can check', () => {
    expect(passwordProblem('short')).toMatch(/at least 10/);
    expect(passwordProblem('a'.repeat(129))).toMatch(/at most 128/);
    expect(passwordProblem('amina_k-is-great', 'amina_k')).toMatch(/username/);
    expect(passwordProblem('amina.kareem2026', '', 'amina.kareem@example.com')).toMatch(/email/);
    expect(passwordProblem('with hardship comes ease')).toBe('');
  });
});

describe('toUser', () => {
  it('reads roles, names and the picture URL', () => {
    const u = toUser({ id: 'u1', username: 'amina_k', first_name: 'Amina', role: 'moderator', profile_picture: '/user/u1/picture?v=2' });
    expect(u.role).toBe('moderator');
    expect(u.displayName).toBe('Amina');
    expect(u.pictureUrl).toMatch(/^https?:\/\/.+\/user\/u1\/picture\?v=2$/);
    expect(toUser({ id: 'u2', username: 'x', is_admin: true }).role).toBe('admin');
    expect(toUser({ id: 'u4', username: 'z', privilege: 'admin' }).role).toBe('admin');
    expect(toUser({ id: 'u5', username: 'w', privilege: 'user' }).role).toBe('user');
    expect(toUser({ user: { id: 'u3', username: 'y' } }).username).toBe('y');
  });
});
