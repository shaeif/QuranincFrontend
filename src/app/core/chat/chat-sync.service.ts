import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { debounceTime, filter, Observable, Subject, timer } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { RealtimeEvent, RealtimeService } from '../realtime/realtime.service';
import { ChatApi } from './chat-api';
import { ChatUnread } from './chat-models';

const BADGE_MS = 30_000;
/** While connected, the badge is still re-checked every 4th tick in case an event was lost. */
const LIVE_BADGE_EVERY = 4;
/** How long "typing…" shows after the last typing event. */
const TYPING_MS = 4_000;

/**
 * Keeps chat screens up to date: from the realtime connection when it's open,
 * by polling when it isn't. Pages listen to `changed` (and `events` for details).
 */
@Injectable({ providedIn: 'root' })
export class ChatSyncService {
  private readonly api = inject(ChatApi);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private timer?: ReturnType<typeof setInterval>;
  private tick = 0;
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly badgeRequests = new Subject<void>();

  readonly unread = signal<ChatUnread>({ messages: 0, requests: 0 });
  readonly badge = computed(() => this.unread().messages + this.unread().requests);
  /** Something in a chat may have changed (null: anything, e.g. after reconnecting). */
  readonly changed = new Subject<string | null>();
  /** Chat events from the realtime connection (chat.message, chat.seen, chat.deleted…). */
  readonly events = new Subject<RealtimeEvent>();
  /** Chats where the other person is typing right now. */
  readonly typing = signal<ReadonlySet<string>>(new Set());
  readonly live = this.realtime.connected;

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

    const subs = [
      this.badgeRequests.pipe(debounceTime(300)).subscribe(() => this.fetchBadge()),
      this.realtime.ready.subscribe(() => {
        this.refreshBadge();
        this.changed.next(null);
      }),
      this.realtime.events.pipe(filter((e) => e.type.startsWith('chat.'))).subscribe((e) => this.onEvent(e)),
    ];
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      subs.forEach((s) => s.unsubscribe());
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  /** A polling timer for an open screen: paused in the background and while realtime is connected. */
  pulse(ms: number): Observable<number> {
    return timer(ms, ms).pipe(filter(() => document.visibilityState === 'visible' && !this.live()));
  }

  refreshBadge(): void {
    this.badgeRequests.next();
  }

  /** Lets the other person see you're typing (realtime only). */
  typed(chatId: string): void {
    this.realtime.typing(chatId);
  }

  private onEvent(e: RealtimeEvent): void {
    const chatId = typeof e['chat_id'] === 'string' ? e['chat_id'] : null;
    if (e.type === 'chat.unread') {
      this.unread.set({ messages: Number(e['unread']) || 0, requests: Number(e['requests']) || 0 });
      return;
    }
    if (e.type === 'chat.typing') {
      if (chatId && e['user_id'] !== this.auth.user()?.id) this.setTyping(chatId, true);
      return;
    }
    if (chatId && e.type === 'chat.message') this.setTyping(chatId, false);
    this.events.next(e);
    this.changed.next(chatId);
    // The dev API also sends chat.unread; production doesn't yet, so ask.
    this.refreshBadge();
  }

  private setTyping(chatId: string, on: boolean): void {
    clearTimeout(this.typingTimers.get(chatId));
    this.typing.update((s) => {
      const next = new Set(s);
      if (on) next.add(chatId);
      else next.delete(chatId);
      return next;
    });
    if (on) this.typingTimers.set(chatId, setTimeout(() => this.setTyping(chatId, false), TYPING_MS));
  }

  private fetchBadge(): void {
    if (!this.auth.user()) return;
    this.api.unreadCount().subscribe({ next: (u) => this.unread.set(u), error: () => undefined });
  }

  private start(): void {
    this.stop();
    this.refreshBadge();
    this.timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (!this.live() || ++this.tick % LIVE_BADGE_EVERY === 0) this.refreshBadge();
    }, BADGE_MS);
  }

  private stop(): void {
    clearInterval(this.timer);
    this.typingTimers.forEach((t) => clearTimeout(t));
    this.typingTimers.clear();
    this.typing.set(new Set());
    this.unread.set({ messages: 0, requests: 0 });
  }
}
