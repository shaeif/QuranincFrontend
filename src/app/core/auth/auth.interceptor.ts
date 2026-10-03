import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE, SKIP_AUTH } from '../api/api-client';
import { AuthService } from './auth.service';

/**
 * Adds the access token to API requests, refreshing it first when it is about
 * to expire, and retries once if the server still says it expired.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_BASE) || req.context.get(SKIP_AUTH)) return next(req);
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) return next(req);

  const send = (token: string | null) => next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);

  return auth.validAccessToken().pipe(
    switchMap((token) =>
      send(token).pipe(
        catchError((err: unknown) => {
          if (!token || !(err instanceof HttpErrorResponse) || err.status !== 401) return throwError(() => err);
          const message = String((err.error as { error?: unknown } | null)?.error ?? '');
          if (/expired/i.test(message)) return auth.refresh().pipe(switchMap((fresh) => send(fresh)));
          if (/session has ended|deleted or disabled/i.test(message)) auth.endSession('Your session ended. Please log in again.');
          return throwError(() => err);
        }),
      ),
    ),
  );
};
