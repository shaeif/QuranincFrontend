import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  effect,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { PreloadAllModules, provideRouter, RouteReuseStrategy, withComponentInputBinding, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { LibraryService } from './core/auth/library.service';
import { NotificationBadgeService } from './core/auth/notification-badge.service';
import { registerIcons } from './core/icons';
import { provideSentry, sentryEnabled, setSentryUser } from './core/monitoring/sentry';
import { TraceService } from '@sentry/angular';
import { ThemeService } from './core/theme/theme.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideIonicAngular({}),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    ...provideSentry(),
    provideAppInitializer(() => {
      registerIcons();
      inject(ThemeService);
      inject(LibraryService);
      inject(NotificationBadgeService);
      const auth = inject(AuthService);
      auth.init();
      if (sentryEnabled()) {
        inject(TraceService);
        effect(() => setSentryUser(auth.user()?.id ?? null));
      }
    }),
  ],
};
