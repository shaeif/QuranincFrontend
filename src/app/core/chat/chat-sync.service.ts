import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { filter, Observable, Subject, timer } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ChatApi } from './chat-api';
import { ChatUnread } from './chat-models';

const BADGE_MS = 30_000;

/**
 * Keeps chat screens up to date. Today it polls; when the backend's realtime
 * connection is wired in, only this service changes (pages listen to `changed`).
 */
@Injectable({ providedIn: 'root' })
export class ChatSyncService {
  private readonly api = inject(ChatApi);
  private readonly auth = inject(AuthService);
  private timer?: ReturnType<typeof setInterval>;

  readonly unread = signal<ChatUnread>({ messages: 0, requests: 0 });
  readonly badge = computed(() => this.unread().messages + this.unread().requests);
  /** Something in chats may have changed (a new message, a seen receipt…). */
  readonly changed = new Subject<string | null>();

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.user();
      untracked(() => (signedIn ? this.start() : this.stop()));
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible' && this.auth.user()) {
        this.refreshBadge();
        this.changed.next(null);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** A timer for an open screen, paused while the app is in the background. */
  pulse(ms: number): Observable<number> {
    return timer(ms, ms).pipe(filter(() => document.visibilityState === 'visible'));
  }

  refreshBadge(): void {
    this.api.unreadCount().subscribe({ next: (u) => this.unread.set(u), error: () => undefined });
  }

  private start(): void {
    this.stop();
    this.refreshBadge();
    this.timer = setInterval(() => document.visibilityState === 'visible' && this.refreshBadge(), BADGE_MS);
  }

  private stop(): void {
    clearInterval(this.timer);
    this.unread.set({ messages: 0, requests: 0 });
  }
}
