import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { LibraryApi } from '../api/library-api';
import { AuthService } from './auth.service';

const POLL_MS = 60_000;

/** Unread notification count for the bell, refreshed every minute while the app is visible. */
@Injectable({ providedIn: 'root' })
export class NotificationBadgeService {
  private readonly api = inject(LibraryApi);
  private readonly auth = inject(AuthService);
  private timer?: ReturnType<typeof setInterval>;

  readonly unread = signal(0);

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.user();
      untracked(() => (signedIn ? this.start() : this.stop()));
    });
    const onVisible = () => document.visibilityState === 'visible' && this.auth.user() && this.refresh();
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  refresh(): void {
    this.api.unreadCount().subscribe({ next: (n) => this.unread.set(n), error: () => undefined });
  }

  private start(): void {
    this.stop();
    this.refresh();
    this.timer = setInterval(() => document.visibilityState === 'visible' && this.refresh(), POLL_MS);
  }

  private stop(): void {
    clearInterval(this.timer);
    this.unread.set(0);
  }
}
