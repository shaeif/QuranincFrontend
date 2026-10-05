import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { extractArray, field, toPage } from '../api/normalize';
import { Page } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { Attachment, BlockedUser, ChatMessage, ChatReport, ChatReportReason, ChatSummary, ChatUnread, Retention } from './chat-models';
import { toBlocked, toChat, toChatReport, toChatUnread, toMessage } from './chat-normalize';

export interface OutgoingMessage {
  text?: string;
  attachment?: Pick<Attachment, 'kind' | 'ref'>;
}

/** /chats: message requests, disappearing messages, saving, blocking and reports. */
@Injectable({ providedIn: 'root' })
export class ChatApi {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);

  private me(): string | undefined {
    return this.auth.user()?.id;
  }

  private body(m: OutgoingMessage): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    if (m.text?.trim()) body['text'] = m.text.trim();
    if (m.attachment) body['attachment'] = { kind: m.attachment.kind, ref: m.attachment.ref };
    return body;
  }

  /** GET /chats?box=inbox|requests */
  list(box: 'inbox' | 'requests' = 'inbox'): Observable<ChatSummary[]> {
    return this.api.get('/chats', { box: box === 'inbox' ? undefined : box }).pipe(
      map((raw) =>
        extractArray(raw)
          .map((c) => toChat(c, this.me()))
          .map((c) => (box === 'requests' && c.state === 'active' ? { ...c, state: 'request_in' as const } : c)),
      ),
    );
  }

  unreadCount(): Observable<ChatUnread> {
    return this.api.get('/chats/unread-count').pipe(map(toChatUnread));
  }

  get(chatId: string): Observable<ChatSummary> {
    return this.api.get(`/chats/${encodeURIComponent(chatId)}`).pipe(map((raw) => toChat(raw, this.me())));
  }

  /** GET /chats/{id}/messages: newest first from the API, returned oldest first for display. */
  messages(chatId: string): Observable<Page<ChatMessage>> {
    return this.api.get(`/chats/${encodeURIComponent(chatId)}/messages`).pipe(
      map((raw) => {
        const p = toPage(raw, (m) => toMessage(m, this.me()));
        return { ...p, items: [...p.items].reverse() };
      }),
    );
  }

  /** POST /chats: message someone, starting a chat (or a message request) if needed. */
  start(userId: string, message: OutgoingMessage): Observable<{ chatId: string; message?: ChatMessage }> {
    return this.api.post('/chats', { ...this.body(message), user_id: userId }).pipe(
      map((raw) => {
        const chat = field(raw, 'chat');
        const msg = field(raw, 'message');
        return {
          chatId: String(field(raw, 'chat_id') ?? field(chat, 'id') ?? field(msg, 'chat_id') ?? ''),
          message: msg ? toMessage(msg, this.me()) : undefined,
        };
      }),
    );
  }

  send(chatId: string, message: OutgoingMessage): Observable<ChatMessage> {
    return this.api
      .post(`/chats/${encodeURIComponent(chatId)}/messages`, this.body(message))
      .pipe(map((raw) => toMessage(field(raw, 'message') ?? raw, this.me())));
  }

  markSeen(chatId: string): Observable<unknown> {
    return this.api.post(`/chats/${encodeURIComponent(chatId)}/read`);
  }

  save(chatId: string, messageId: string, on: boolean): Observable<unknown> {
    const path = `/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/save`;
    return on ? this.api.put(path) : this.api.delete(path);
  }

  unsend(chatId: string, messageId: string): Observable<unknown> {
    return this.api.delete(`/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`);
  }

  report(chatId: string, messageId: string, reason: ChatReportReason, note?: string): Observable<unknown> {
    const body: Record<string, string> = { reason };
    if (note?.trim()) body['note'] = note.trim();
    return this.api.post(`/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/report`, body);
  }

  setRetention(chatId: string, retention: Retention): Observable<unknown> {
    return this.api.put(`/chats/${encodeURIComponent(chatId)}/retention`, { retention });
  }

  accept(chatId: string): Observable<unknown> {
    return this.api.post(`/chats/${encodeURIComponent(chatId)}/accept`);
  }

  decline(chatId: string): Observable<unknown> {
    return this.api.post(`/chats/${encodeURIComponent(chatId)}/decline`);
  }

  clear(chatId: string): Observable<unknown> {
    return this.api.post(`/chats/${encodeURIComponent(chatId)}/clear`);
  }

  block(userId: string, on: boolean): Observable<unknown> {
    const path = `/chats/blocks/${encodeURIComponent(userId)}`;
    return on ? this.api.put(path) : this.api.delete(path);
  }

  blocked(): Observable<BlockedUser[]> {
    return this.api.get('/chats/blocks').pipe(map((raw) => extractArray(raw).map(toBlocked)));
  }

  /* ---------- Moderators ---------- */

  reports(): Observable<ChatReport[]> {
    return this.api.get('/chats/reports').pipe(map((raw) => extractArray(raw).map(toChatReport)));
  }

  review(reportId: string, action: 'dismiss' | 'remove'): Observable<unknown> {
    return this.api.put(`/chats/reports/${encodeURIComponent(reportId)}`, { action });
  }
}
