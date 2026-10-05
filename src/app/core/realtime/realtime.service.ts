import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiError } from '../api/api-client';
import { AuthService } from '../auth/auth.service';

/** A server event: {"type": "chat.message", "chat_id": "…", "message_id": "…"} and the like. Ids only. */
export interface RealtimeEvent {
  type: string;
  [key: string]: unknown;
}

/** Reconnect delays (seconds), plus up to a second of jitter. */
const BACKOFF = [1, 2, 5, 10, 30];
/** App-level ping: notices a dead connection (sleeping laptop, lost network) sooner than the browser does. */
const PING_MS = 25_000;
const PONG_TIMEOUT_MS = 10_000;
/** Renew the token on the socket this long before the server's expires_at. */
const RENEW_EARLY_MS = 60_000;
const TYPING_GAP_MS = 2_500;

/**
 * The backend's WebSocket: one stream per signed-in user for chats,
 * notifications and moderation. Authenticates with the first message (never
 * the URL), renews the token before it expires, pings, and reconnects with
 * backoff. There is no replay, so `ready` fires after every (re)connect for
 * screens to re-fetch what they show.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private readonly url = realtimeUrl();

  /** True while an authenticated connection is open. Polling pauses meanwhile. */
  readonly connected = signal(false);
  readonly events = new Subject<RealtimeEvent>();
  /** A connection was (re)established: anything since the last one may have been missed. */
  readonly ready = new Subject<void>();

  private ws?: WebSocket;
  private userId?: string;
  private sentToken?: string;
  private authed = false;
  private attempt = 0;
  private gaveUp = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private renewTimer?: ReturnType<typeof setTimeout>;
  private pingTimer?: ReturnType<typeof setInterval>;
  private pongTimer?: ReturnType<typeof setTimeout>;
  private readonly lastTyping = new Map<string, number>();

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id;
      untracked(() => (id ? this.start(id) : this.stop()));
    });
    // A token refreshed for an API call is passed on straight away.
    effect(() => {
      const token = this.auth.accessToken();
      untracked(() => {
        if (token && this.authed && token !== this.sentToken) this.sendAuth(token);
      });
    });
    const wake = () => {
      if (document.visibilityState === 'visible' && this.userId && !this.ws && !this.gaveUp) {
        this.attempt = 0;
        this.connectNow();
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    });
  }

  /** Tells the other person in a chat you're typing (at most every 2.5 s per chat). */
  typing(chatId: string): void {
    const now = Date.now();
    if (!this.authed || now - (this.lastTyping.get(chatId) ?? 0) < TYPING_GAP_MS) return;
    this.lastTyping.set(chatId, now);
    this.send({ type: 'typing', chat_id: chatId });
  }

  private start(userId: string): void {
    if (this.userId === userId) return;
    this.stop();
    this.userId = userId;
    this.gaveUp = false;
    this.attempt = 0;
    this.connectNow();
  }

  private stop(): void {
    this.userId = undefined;
    clearTimeout(this.reconnectTimer);
    this.drop(1000);
  }

  private connectNow(): void {
    clearTimeout(this.reconnectTimer);
    if (!this.url || !this.userId || this.ws) return;
    const userId = this.userId;
    this.auth.validAccessToken().subscribe((token) => {
      if (this.userId !== userId || this.ws) return;
      // No token means the session couldn't be renewed; AuthService signs out if it has ended.
      if (!token) return this.retryLater();
      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url);
      } catch {
        return this.retryLater();
      }
      this.ws = ws;
      this.authed = false;
      ws.onopen = () => this.sendAuth(token);
      ws.onmessage = (e) => this.receive(e.data);
      ws.onclose = (e) => ws === this.ws && this.closed(e.code);
    });
  }

  private sendAuth(token: string): void {
    this.sentToken = token;
    this.send({ type: 'auth', token });
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  private receive(data: unknown): void {
    let msg: unknown;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || typeof (msg as RealtimeEvent).type !== 'string') return;
    const event = msg as RealtimeEvent;
    switch (event.type) {
      case 'ready':
        this.onReady(Number(event['expires_at']));
        return;
      case 'pong':
        clearTimeout(this.pongTimer);
        return;
      case 'error':
        return;
      default:
        this.events.next(event);
    }
  }

  private onReady(expiresAt: number): void {
    this.attempt = 0;
    this.scheduleRenew(expiresAt);
    if (this.authed) return; // a renewal, not a new connection
    this.authed = true;
    this.connected.set(true);
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.ping(), PING_MS);
    this.ready.next();
  }

  private scheduleRenew(expiresAt: number): void {
    clearTimeout(this.renewTimer);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return;
    const wait = Math.max(5_000, expiresAt * 1000 - Date.now() - RENEW_EARLY_MS);
    this.renewTimer = setTimeout(() => this.renew(), wait);
  }

  /** Sends a fresh access token before the server's deadline (it closes 30 s after expiry). */
  private renew(): void {
    this.auth.validAccessToken().subscribe((token) => {
      if (!token || !this.authed) return;
      if (token !== this.sentToken) return this.sendAuth(token);
      // Still the same token by this device's clock: refresh now so the server's clock is satisfied too.
      this.auth.refresh().subscribe({ next: (fresh) => fresh !== this.sentToken && this.sendAuth(fresh), error: () => undefined });
    });
  }

  private ping(): void {
    this.send({ type: 'ping' });
    clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => {
      // No answer: the connection is dead even if the browser hasn't noticed.
      this.drop(4000);
      this.retryLater();
    }, PONG_TIMEOUT_MS);
  }

  private closed(code: number): void {
    this.drop();
    if (!this.userId) return;
    if (code === 4401) {
      // Expired, ended or wrong token: refresh first. If the session is over, AuthService signs out.
      this.auth.refresh().subscribe({
        next: () => this.retryLater(),
        error: (err: unknown) => !(err instanceof ApiError && err.status === 401) && this.retryLater(),
      });
    } else if (code === 4429) {
      // Too many tabs or devices open for this account: stay on polling here.
      this.gaveUp = true;
    } else {
      this.retryLater();
    }
  }

  private retryLater(): void {
    if (!this.userId || this.gaveUp) return;
    clearTimeout(this.reconnectTimer);
    const delay = BACKOFF[Math.min(this.attempt, BACKOFF.length - 1)] * 1000 + Math.random() * 1000;
    this.attempt++;
    this.reconnectTimer = setTimeout(() => this.connectNow(), delay);
  }

  /** Forgets the current socket (closing it if open) and its timers. */
  private drop(code?: number): void {
    clearTimeout(this.renewTimer);
    clearTimeout(this.pongTimer);
    clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = undefined;
    this.authed = false;
    this.sentToken = undefined;
    this.connected.set(false);
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = null;
      if (code !== undefined && ws.readyState < WebSocket.CLOSING) ws.close(code);
    }
  }
}

/** The configured URL, or '' when a secure page can't open it (browsers block ws:// from https://). */
function realtimeUrl(): string {
  const url = environment.realtimeUrl?.trim() ?? '';
  if (url && location.protocol === 'https:' && url.startsWith('ws:')) {
    console.warn('Realtime is off: an https page cannot open a ws:// connection. Use wss:// for', url);
    return '';
  }
  return url;
}
