import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { reportApiFailure } from '../monitoring/sentry';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Base URL of the API, without a trailing slash. */
export const API_BASE = environment.apiUrl.replace(/\/+$/, '');

/** Set on a request to stop the auth interceptor touching it (login, refresh). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** An API failure with a message that is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly retryAfter?: number,
  ) {
    super(message);
  }

  /** Field → first message, from the backend's {"details": {...}} on 400s. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const details = this.details;
    if (details && typeof details === 'object') {
      for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
        const first = Array.isArray(value) ? value[0] : value;
        if (typeof first === 'string') out[key] = first;
        else if (first && typeof first === 'object') out[key] = Object.values(first).flat().join(' ');
      }
    }
    return out;
  }
}

interface RequestOptions {
  query?: QueryParams;
  /** Send this token instead of the session's (used for the refresh token). */
  bearer?: string;
  /** Send no token at all (login, sign-up). */
  anonymous?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<T = unknown>(path: string, query: QueryParams = {}): Observable<T> {
    return this.request<T>('GET', path, undefined, { query });
  }

  post<T = unknown>(path: string, body: unknown = {}, opts: RequestOptions = {}): Observable<T> {
    return this.request<T>('POST', path, body, opts);
  }

  put<T = unknown>(path: string, body: unknown = {}, opts: RequestOptions = {}): Observable<T> {
    return this.request<T>('PUT', path, body, opts);
  }

  delete<T = unknown>(path: string, query: QueryParams = {}): Observable<T> {
    return this.request<T>('DELETE', path, undefined, { query });
  }

  private request<T>(method: string, path: string, body: unknown, opts: RequestOptions): Observable<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(opts.query ?? {})) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    }
    const headers: Record<string, string> = opts.bearer ? { Authorization: `Bearer ${opts.bearer}` } : {};
    const context = new HttpContext().set(SKIP_AUTH, !!opts.bearer || !!opts.anonymous);
    return this.http.request<T>(method, `${API_BASE}${path}`, { body, params, headers, context }).pipe(
      catchError((err: unknown) => {
        const apiError = toApiError(err);
        reportApiFailure(method, path, apiError.status, apiError.message);
        return throwError(() => apiError);
      }),
    );
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return new ApiError("Can't reach the Tadabbur server. Check your connection and try again.", 0);
    }
    const retryAfter = Number(err.headers?.get('Retry-After')) || undefined;
    const body = err.error as { error?: unknown; details?: unknown; message?: unknown } | null;
    const text = typeof body?.error === 'string' ? body.error : typeof body?.message === 'string' ? body.message : '';
    if (text) {
      const wait = err.status === 429 && retryAfter ? ` Try again in ${formatWait(retryAfter)}.` : '';
      const sentence = /[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`;
      return new ApiError(sentence + wait, err.status, body?.details, retryAfter);
    }
    if (err.status === 401) return new ApiError('Please log in to do that.', 401);
    if (err.status === 403) return new ApiError("You don't have permission to do that.", 403);
    if (err.status === 404) return new ApiError('This could not be found.', 404);
    if (err.status === 413) return new ApiError('That file is too large.', 413);
    if (err.status === 429) return new ApiError('Too many requests. Wait a moment and try again.', 429, undefined, retryAfter);
    return new ApiError(`The server had a problem (error ${err.status}). Try again in a moment.`, err.status);
  }
  return new ApiError('Something went wrong. Try again.', -1);
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

export function errorMessage(err: unknown): string {
  return toApiError(err).message;
}
