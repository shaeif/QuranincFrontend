import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_BASE, SKIP_AUTH } from '../api/api-client';
import { AuthService } from './auth.service';

/**
 * Adds the access token to API requests, refreshing it first when it is about
 * to expire, and retries once if the server still says it expired.
 *
 * Public reads answer 401 to an expired or invalid token (rather than treating
 * the caller as anonymous), so a GET whose token can't be renewed is retried
 * without one: the page still loads, just without "liked by me" and the like.
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
          const anonymousRetry = req.method === 'GET' ? next(req) : throwError(() => err);
          if (/expired/i.test(message)) {
            return auth.refresh().pipe(
              switchMap((fresh) => send(fresh)),
              catchError((retryErr: unknown) =>
                retryErr instanceof HttpErrorResponse && retryErr.status !== 401 ? throwError(() => retryErr) : anonymousRetry,
              ),
            );
          }
          if (/session has ended|deleted or disabled|token|signature|segments/i.test(message)) {
            auth.endSession('Your session ended. Please log in again.');
            return anonymousRetry;
          }
          return throwError(() => err);
        }),
      ),
    ),
  );
};
