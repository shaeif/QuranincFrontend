import { UserSummary } from '../api/models';
import { pictureUrl, toUserSummary } from '../api/normalize';
import { Attachment, AttachmentKind, BlockedUser, ChatMessage, ChatReport, ChatState, ChatSummary, ChatUnread, Retention } from './chat-models';

/**
 * Chat responses → app models. The chat API's field names aren't all in its
 * export yet, so this accepts the likely variants (like normalize.ts does).
 */

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (...vs: unknown[]): string | undefined => {
  for (const v of vs) {
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
};
const num = (...vs: unknown[]): number | undefined => {
  for (const v of vs) {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return undefined;
};
const time = (...vs: unknown[]): number | undefined => {
  for (const v of vs) {
    const n = num(v);
    if (n !== undefined) return n < 1e12 ? n * 1000 : n;
    if (typeof v === 'string') {
      const t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
  }
  return undefined;
};

export function toRetention(v: unknown): Retention {
  return v === '30d' || v === 'keep' ? v : '7d';
}

export function toAttachment(raw: unknown): Attachment | undefined {
  if (!isObject(raw)) return undefined;
  const kind = str(raw['kind'], raw['type']) as AttachmentKind | undefined;
  if (kind !== 'ayah' && kind !== 'reflection' && kind !== 'comment') return undefined;
  const preview = isObject(raw['preview']) ? raw['preview'] : isObject(raw['data']) ? raw['data'] : raw;
  const surah = num(preview['surah'], preview['surah_id']);
  const ayah = num(preview['ayah'], preview['ayah_id']);
  const author = isObject(preview['author']) ? preview['author'] : {};
  return {
    kind,
    ref: str(raw['ref'], raw['id'], surah && ayah ? `${surah}:${ayah}` : undefined) ?? '',
    textAr: str(preview['text_ar']),
    text: str(preview['translation'], preview['reflection'], preview['text'], preview['excerpt']),
    authorName: str(author['username'], preview['username'], preview['created_by_username']),
    unavailable: raw['unavailable'] === true || preview['unavailable'] === true,
  };
}

export function toMessage(raw: unknown, myId?: string): ChatMessage {
  const m = isObject(raw) ? raw : {};
  const sender = isObject(m['sender']) ? m['sender'] : {};
  const senderId = str(m['sender_id'], sender['id'], m['from'], m['user_id']) ?? '';
  const kind = str(m['kind'], m['type']);
  const notice = kind === 'notice' || kind === 'system' || m['system'] === true || (!senderId && !!str(m['text']));
  const expires = m['expires_at'];
  return {
    id: str(m['id'], m['message_id']) ?? '',
    senderId,
    mine: m['mine'] === true || m['from_me'] === true || (!!myId && senderId === myId),
    text: str(m['text'], m['body']) ?? '',
    attachment: toAttachment(m['attachment']),
    notice,
    createdAt: time(m['created_at'], m['sent_at']),
    seenAt: time(m['seen_at'], m['read_at']),
    expiresAt: expires === null ? null : time(expires),
    savedByMe: m['saved_by_me'] === true || m['saved'] === true,
    saved: m['saved'] === true || m['saved_by_me'] === true || m['saved_by_other'] === true || (num(m['saved_count']) ?? 0) > 0,
  };
}

function toState(c: Json, myId?: string): ChatState {
  const state = str(c['state'], c['status'])?.toLowerCase() ?? '';
  const requestedBy = str(c['requested_by'], c['request_from'], c['initiator_id'], c['created_by']);
  const isRequest = state === 'request' || state === 'pending' || state === 'requested' || c['is_request'] === true;
  if (state === 'request_in' || state === 'incoming') return 'request_in';
  if (state === 'request_out' || state === 'outgoing' || state === 'sent') return 'request_out';
  if (!isRequest) return 'active';
  if (c['incoming'] === true) return 'request_in';
  if (c['outgoing'] === true) return 'request_out';
  return requestedBy && myId && requestedBy === myId ? 'request_out' : 'request_in';
}

export function toChat(raw: unknown, myId?: string): ChatSummary {
  const c = isObject(raw) ? (isObject(raw['chat']) ? raw['chat'] : raw) : {};
  const otherRaw = c['other'] ?? c['other_user'] ?? c['with'] ?? c['user'] ?? c['peer'] ?? c['participant'];
  const last = c['last_message'] ?? c['last'];
  return {
    id: str(c['id'], c['chat_id']) ?? '',
    other: isObject(otherRaw) ? toUserSummary(otherRaw) : { id: str(c['other_id'], c['user_id']) ?? '', username: '' },
    unread: num(c['unread'], c['unread_count']) ?? 0,
    retention: toRetention(c['retention']),
    state: toState(c, myId),
    lastMessage: isObject(last) ? toMessage(last, myId) : undefined,
    updatedAt: time(c['updated_at'], c['last_message_at'], isObject(last) ? last['created_at'] : undefined),
  };
}

export function toChatUnread(raw: unknown): ChatUnread {
  const r = isObject(raw) ? raw : {};
  return {
    messages: num(r['unread'], r['messages'], r['unread_messages'], r['count']) ?? 0,
    requests: num(r['requests'], r['waiting_requests'], r['pending_requests']) ?? 0,
  };
}

export function toBlocked(raw: unknown): BlockedUser {
  const b = isObject(raw) ? raw : {};
  const user = isObject(b['user']) ? b['user'] : b;
  return { ...toUserSummary(user), blockedAt: time(b['blocked_at'], b['created_at']) };
}

export function toChatReport(raw: unknown): ChatReport {
  const r = isObject(raw) ? raw : {};
  const msg = r['message'] ?? r['message_copy'] ?? r['copy'];
  const sender: UserSummary | undefined = isObject(r['sender'])
    ? toUserSummary(r['sender'])
    : str(r['sender_username'])
      ? { id: str(r['sender_id']) ?? '', username: str(r['sender_username'])!, pictureUrl: pictureUrl(r['sender_picture']) }
      : undefined;
  return {
    id: str(r['id'], r['report_id']) ?? '',
    message: toMessage(isObject(msg) ? msg : { text: str(r['text']) }),
    sender,
    reason: str(r['reason']) ?? 'other',
    note: str(r['note']),
    createdAt: time(r['created_at']),
    resolved: r['resolved'] === true || !!r['resolved_at'],
  };
}
