import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { filter, Subject } from 'rxjs';
import { LibraryApi } from '../api/library-api';
import { RealtimeEvent, RealtimeService } from '../realtime/realtime.service';
import { AuthService } from './auth.service';

const POLL_MS = 60_000;
/** While realtime is connected, poll only every 5th minute as a safety net. */
const LIVE_POLL_EVERY = 5;

/**
 * Unread notification count for the bell. Updated on realtime "notification"
 * events, and polled every minute while the app is visible and not connected.
 */
@Injectable({ providedIn: 'root' })
export class NotificationBadgeService {
  private readonly api = inject(LibraryApi);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private timer?: ReturnType<typeof setInterval>;
  private tick = 0;

  readonly unread = signal(0);
  /** Realtime notification events (likes, comments, follows; reports for moderators). */
  readonly events = new Subject<RealtimeEvent>();

  constructor() {
    effect(() => {
      const signedIn = !!this.auth.user();
      untracked(() => (signedIn ? this.start() : this.stop()));
    });
    const onVisible = () => document.visibilityState === 'visible' && this.auth.user() && this.refresh();
    document.addEventListener('visibilitychange', onVisible);
    const subs = [
      this.realtime.ready.subscribe(() => this.refresh()),
      this.realtime.events.pipe(filter((e) => e.type === 'notification')).subscribe((e) => {
        this.events.next(e);
        this.refresh();
      }),
    ];
    inject(DestroyRef).onDestroy(() => {
      subs.forEach((sub) => sub.unsubscribe());
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
    this.timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!this.realtime.connected() || ++this.tick % LIVE_POLL_EVERY === 0) this.refresh();
    }, POLL_MS);
  }

  private stop(): void {
    clearInterval(this.timer);
    this.unread.set(0);
  }
}
