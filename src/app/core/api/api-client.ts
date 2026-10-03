import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** An API failure with a message that is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/+$/, '');

  get<T = unknown>(path: string, query: QueryParams = {}): Observable<T> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== '') params = params.set(key, String(value));
    }
    return this.http
      .get<T>(`${this.base}${path}`, { params })
      .pipe(catchError((err: unknown) => throwError(() => toApiError(err))));
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return new ApiError("Can't reach the Tadabbur server. Check your connection and try again.", 0);
    }
    const body = err.error as { error?: unknown; details?: unknown } | null;
    if (body && typeof body.error === 'string') return new ApiError(body.error, err.status, body.details);
    if (err.status === 404) return new ApiError('This page could not be found.', 404);
    if (err.status === 429) return new ApiError('Too many requests. Wait a moment and try again.', 429);
    return new ApiError(`The server had a problem (error ${err.status}). Try again in a moment.`, err.status);
  }
  return new ApiError('Something went wrong. Try again.', -1);
}

export function errorMessage(err: unknown): string {
  return toApiError(err).message;
}
