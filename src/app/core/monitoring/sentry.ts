import { ErrorHandler, Provider } from '@angular/core';
import { Router } from '@angular/router';
import * as Sentry from '@sentry/angular';
import { environment } from '../../../environments/environment';

/** True once Sentry is set up (a DSN is configured). */
export const sentryEnabled = (): boolean => !!environment.sentryDsn;

/** Query parameters whose values must never leave the device (email codes, reset codes, tokens). */
const SECRET_PARAMS = /([?&](?:token|code|challenge|access_token|refresh_token|password)=)[^&#]*/gi;

function scrubUrl(url: string | undefined): string | undefined {
  return url?.replace(SECRET_PARAMS, '$1[removed]');
}

/**
 * Starts Sentry before Angular boots, so errors during startup are caught too.
 * No personal data is sent: no IP, cookies, emails or usernames, only the user id.
 */
export function initSentry(): void {
  if (!sentryEnabled()) return;
  Sentry.init({
    dsn: environment.sentryDsn,
    environment: environment.sentryEnvironment,
    release: environment.release,
    // Collect nothing personal: no automatic user info (IP), cookies, headers, bodies or query strings.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: environment.sentryTracesSampleRate,
    // Don't add sentry-trace/baggage headers to API calls: the API's CORS rules would have to allow them.
    tracePropagationTargets: [],
    ignoreErrors: ['ResizeObserver loop limit exceeded', 'ResizeObserver loop completed with undelivered notifications'],
    beforeSend(event) {
      if (event.request) {
        event.request.url = scrubUrl(event.request.url);
        delete event.request.cookies;
        if (event.request.headers) delete event.request.headers['Authorization'];
      }
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.data?.['url']) crumb.data['url'] = scrubUrl(String(crumb.data['url']));
      if (crumb.data?.['to']) crumb.data['to'] = scrubUrl(String(crumb.data['to']));
      if (crumb.data?.['from']) crumb.data['from'] = scrubUrl(String(crumb.data['from']));
      // Form values typed into inputs are never recorded; console noise from Ionic is dropped.
      if (crumb.category === 'console' && crumb.level !== 'error') return null;
      return crumb;
    },
  });
}

/** Angular providers: report uncaught errors, and time route changes. */
export function provideSentry(): Provider[] {
  return [
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler({ logErrors: true }) },
    { provide: Sentry.TraceService, deps: [Router] },
  ];
}

/** Tags errors with the signed-in user's id only (null when signed out). */
export function setSentryUser(id: string | null): void {
  if (sentryEnabled()) Sentry.setUser(id ? { id } : null);
}

/**
 * Server errors (5xx) are reported as events; 4xx answers are normal
 * (wrong password, not found…) and network drops are the user's connection.
 */
export function reportApiFailure(method: string, url: string, status: number, message: string): void {
  if (!sentryEnabled() || status < 500) return;
  const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  Sentry.captureMessage(`API ${status} ${method} ${path}`, {
    level: 'error',
    tags: { api_status: String(status), api_method: method },
    extra: { message },
    fingerprint: ['api', method, path.replace(/\/[0-9a-f-]{8,}|\/\d+/gi, '/:id'), String(status)],
  });
}
