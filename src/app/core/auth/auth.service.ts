import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { ApiClient, ApiError } from '../api/api-client';
import { Session, UserProfile } from '../api/models';
import { toUser } from '../api/normalize';
import { readStored, writeStored } from '../storage/local-store';
import { isExpiring } from './jwt';

const STORAGE_KEY = 'session';

export type LoginResult = { done: true } | { done: false; challenge: string };

/**
 * The signed-in session. Tokens are kept on the device so people stay signed
 * in (access token 5 minutes, refresh token 30 days, rotated on every refresh).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(readSession());
  private refreshing$?: Observable<string>;

  readonly user = signal<UserProfile | null>(null);
  /** Set when a session ends on its own (expired, logged out elsewhere). */
  readonly endedMessage = signal('');

  readonly isLoggedIn = computed(() => !!this.session());
  readonly isModerator = computed(() => ['moderator', 'admin'].includes(this.user()?.role ?? ''));
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  /** Loads the profile for a saved session at startup. */
  init(): void {
    if (this.session()) this.loadMe().subscribe({ error: () => undefined });
  }

  accessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  /** The access token, refreshed first if it is about to expire. Null when signed out or refresh fails. */
  validAccessToken(): Observable<string | null> {
    const s = this.session();
    if (!s) return of(null);
    if (!isExpiring(s.accessToken)) return of(s.accessToken);
    return this.refresh().pipe(catchError(() => of(null)));
  }

  /** POST /user/refresh: one at a time, whatever number of requests ask for it. */
  refresh(): Observable<string> {
    const s = this.session();
    if (!s) return throwError(() => new ApiError('Please log in again.', 401));
    if (!this.refreshing$) {
      this.refreshing$ = this.api.post('/user/refresh', {}, { bearer: s.refreshToken }).pipe(
        map((raw) => this.storeTokens(raw)),
        map((session) => session.accessToken),
        catchError((err: ApiError) => {
          if (err.status === 401 || err.status === 422) this.endSession('Your session ended. Please log in again.');
          return throwError(() => err);
        }),
        finalize(() => (this.refreshing$ = undefined)),
        shareReplay(1),
      );
    }
    return this.refreshing$;
  }

  /** POST /user/login. Returns a challenge when two-factor is on. */
  login(username: string, password: string): Observable<LoginResult> {
    return this.api.post('/user/login', { username, password }, { anonymous: true }).pipe(
      switchMap((raw) => {
        const r = raw as { two_factor_required?: boolean; challenge?: string };
        if (r.two_factor_required && r.challenge) return of<LoginResult>({ done: false, challenge: r.challenge });
        return this.startSession(raw).pipe(map((): LoginResult => ({ done: true })));
      }),
    );
  }

  /** POST /user/login/2fa with an authenticator code or a recovery code. */
  loginTwoFactor(challenge: string, code: string): Observable<{ recoveryCodesLeft?: number }> {
    return this.api.post('/user/login/2fa', { challenge, code }, { anonymous: true }).pipe(
      switchMap((raw) =>
        this.startSession(raw).pipe(
          map(() => ({ recoveryCodesLeft: (raw as { recovery_codes_left?: number }).recovery_codes_left })),
        ),
      ),
    );
  }

  /** Stores tokens from a response and loads the profile. */
  startSession(raw: unknown): Observable<UserProfile> {
    this.storeTokens(raw);
    this.endedMessage.set('');
    return this.loadMe();
  }

  /** For responses that hand back fresh tokens (change password, two-factor changes). */
  replaceTokens(raw: unknown): void {
    const r = raw as { access_token?: unknown; refresh_token?: unknown };
    if (typeof r?.access_token === 'string' && typeof r?.refresh_token === 'string') this.storeTokens(raw);
  }

  loadMe(): Observable<UserProfile> {
    return this.api.get('/user/me').pipe(
      map(toUser),
      tap((user) => this.user.set(user)),
      catchError((err: ApiError) => {
        if (err.status === 401) this.endSession('Your session ended. Please log in again.');
        return throwError(() => err);
      }),
    );
  }

  /** POST /user/logout: ends this device's session. */
  logout(): Observable<void> {
    return this.api.post('/user/logout').pipe(
      catchError(() => of(null)),
      map(() => this.endSession()),
    );
  }

  /** POST /user/logout-all: ends every session, including this one. */
  logoutEverywhere(): Observable<void> {
    return this.api.post('/user/logout-all').pipe(map(() => this.endSession()));
  }

  /** Forgets the session on this device. */
  endSession(message = ''): void {
    const wasSignedIn = !!this.session();
    this.session.set(null);
    this.user.set(null);
    writeStored(STORAGE_KEY, null);
    if (wasSignedIn && message) this.endedMessage.set(message);
  }

  /** Sends signed-out people to the login page, coming back here afterwards. */
  requireLogin(next = this.router.url): boolean {
    if (this.isLoggedIn()) return true;
    this.router.navigate(['/login'], { queryParams: { next } });
    return false;
  }

  private storeTokens(raw: unknown): Session {
    const r = (raw ?? {}) as { access_token?: unknown; refresh_token?: unknown };
    if (typeof r.access_token !== 'string' || typeof r.refresh_token !== 'string') {
      throw new ApiError('The server did not return a session. Try again.', -1);
    }
    const session: Session = { accessToken: r.access_token, refreshToken: r.refresh_token };
    this.session.set(session);
    writeStored(STORAGE_KEY, session);
    return session;
  }
}

function readSession(): Session | null {
  const s = readStored<unknown>(STORAGE_KEY, null) as Partial<Session> | null;
  return s && typeof s.accessToken === 'string' && typeof s.refreshToken === 'string'
    ? { accessToken: s.accessToken, refreshToken: s.refreshToken }
    : null;
}
