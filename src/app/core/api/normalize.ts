import { API_BASE } from './api-client';
import {
  AppNotification,
  AuthorPage,
  FeedItem,
  FollowEntry,
  FollowKind,
  LikedVerse,
  Page,
  ReadingHistoryEntry,
  ReadingStatus,
  Reflection,
  ReflectionComment,
  ReportGroup,
  Role,
  SearchVerse,
  TagCount,
  UserProfile,
  UserSummary,
  Verse,
} from './models';

/**
 * Maps raw API JSON to the app's models. Tolerant on purpose: it accepts
 * plain documents or Elasticsearch hits ({_id, _source}), and the few
 * field-name variants a document can carry, so a small backend change
 * doesn't blank a screen.
 */

type Json = Record<string, unknown>;

const ARRAY_KEYS = ['items', 'results', 'ayahs', 'verses', 'data', 'result', 'hits', 'comments', 'tags'];

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Unwraps an Elasticsearch hit into one flat object (hit fields win over _source). */
function flatten(raw: unknown): Json {
  if (!isObject(raw)) return {};
  const source = raw['_source'];
  if (!isObject(source)) return raw;
  const { _source, ...rest } = raw;
  return { ...source, ...rest, id: rest['_id'] ?? source['id'] };
}

function num(...values: unknown[]): number | undefined {
  for (const v of values) {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return undefined;
}

function str(...values: unknown[]): string | undefined {
  for (const v of values) {
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number') return String(v);
  }
  return undefined;
}

function time(...values: unknown[]): number | undefined {
  for (const v of values) {
    const n = num(v);
    if (n !== undefined) return n < 1e12 ? n * 1000 : n;
    if (typeof v === 'string') {
      const parsed = Date.parse(v);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

/** Finds the list inside a response: the response itself, or items/results/hits.hits/... */
export function extractArray(raw: unknown, depth = 0): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isObject(raw) || depth > 3) return [];
  for (const key of ARRAY_KEYS) {
    if (key in raw) {
      const found = extractArray(raw[key], depth + 1);
      if (found.length || Array.isArray(raw[key])) return found;
    }
  }
  return [];
}

export function toPage<T>(raw: unknown, map: (item: unknown) => T, page = 1, size = 20): Page<T> {
  const items = extractArray(raw).map(map);
  const obj = isObject(raw) ? raw : {};
  const hitsTotal = isObject(obj['hits']) ? (obj['hits'] as Json)['total'] : undefined;
  const total = num(obj['total'], isObject(hitsTotal) ? hitsTotal['value'] : hitsTotal) ?? items.length;
  return {
    items,
    total,
    page: num(obj['page']) ?? page,
    size: num(obj['size']) ?? size,
  };
}

/** Escapes text, then lets only <em> and </em> back in (search highlights). */
export function safeHighlight(value: unknown): string | undefined {
  const text = Array.isArray(value) ? value.filter((v) => typeof v === 'string').join(' … ') : value;
  if (typeof text !== 'string' || !text) return undefined;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/&lt;(\/?)em&gt;/g, '<$1em>');
}

function pickHighlight(h: unknown, keys: string[]): string | undefined {
  if (typeof h === 'string' || Array.isArray(h)) return keys.includes('*') ? safeHighlight(h) : undefined;
  if (!isObject(h)) return undefined;
  for (const key of Object.keys(h)) {
    if (keys.some((k) => key === k || key.startsWith(`${k}.`))) return safeHighlight(h[key]);
  }
  return undefined;
}

export function toVerse(raw: unknown): Verse {
  const v = flatten(raw);
  const key = str(v['id'], v['key']);
  const [keySurah, keyAyah] = key?.includes(':') ? key.split(':').map(Number) : [];
  return {
    surah: num(v['surah'], v['surah_id'], v['sura'], keySurah) ?? 0,
    ayah: num(v['ayah'], v['ayah_id'], v['aya'], v['verse'], keyAyah) ?? 0,
    textAr: str(v['text_ar'], v['text_uthmani'], v['arabic'], v['text']) ?? '',
    translation: str(v['translation'], v['text_en'], v['english']) ?? '',
    transliteration: str(v['transliteration']),
  };
}

export function toSearchVerse(raw: unknown): SearchVerse {
  const v = flatten(raw);
  const h = v['highlight'];
  return {
    ...toVerse(v),
    highlightAr: pickHighlight(h, ['text_ar', 'arabic', '*']),
    highlightEn: pickHighlight(h, ['translation', 'text_en', 'english']),
  };
}

export function toLikedVerse(raw: unknown): LikedVerse {
  const v = flatten(raw);
  return { ...toVerse(v), likeCount: num(v['like_count'], v['likes']) ?? 0 };
}

/**
 * One text type of a surah (GET /quran/<type>/<surah>) as ayah → text.
 * Accepts a list of docs/hits, or an object keyed by ayah number.
 */
export function toAyahTexts(raw: unknown): Map<number, string> {
  const out = new Map<number, string>();
  const list = extractArray(raw);
  if (list.length) {
    list.forEach((item, i) => {
      if (typeof item === 'string') {
        out.set(i + 1, item);
        return;
      }
      const v = flatten(item);
      const verse = toVerse(v);
      const text = str(v['text'], v['text_ar'], v['translation'], v['content'], v['aya_text']);
      if (text) out.set(verse.ayah || i + 1, text);
    });
    return out;
  }
  if (isObject(raw)) {
    for (const [k, value] of Object.entries(raw)) {
      const n = Number(k.includes(':') ? k.split(':')[1] : k);
      const text = typeof value === 'string' ? value : str(flatten(value)['text']);
      if (Number.isInteger(n) && n > 0 && text) out.set(n, text);
    }
  }
  return out;
}

export function toReflection(raw: unknown): Reflection {
  const r = flatten(raw);
  const author = isObject(r['author']) ? r['author'] : isObject(r['created_by']) ? (r['created_by'] as Json) : {};
  return {
    id: str(r['id'], r['_id'], r['reflection_id']) ?? '',
    text: str(r['reflection'], r['text'], r['content']) ?? '',
    surah: num(r['surah_id'], r['surah']) ?? 0,
    ayah: num(r['ayah_id'], r['ayah']) ?? 0,
    highlightText: str(r['highlight_text']),
    tags: Array.isArray(r['tags']) ? r['tags'].filter((t): t is string => typeof t === 'string') : [],
    authorId: str(r['created_by_id'], author['id']),
    authorName:
      str(r['created_by_username'], r['username'], r['author_name'], author['username'],
        typeof r['created_by'] === 'string' ? r['created_by'] : undefined) ?? 'Anonymous',
    likeCount: num(r['like_count']) ?? 0,
    commentCount: num(r['comment_count']) ?? 0,
    createdAt: time(r['created_at_ms'], r['created_at'], r['timestamp']),
    edited: r['edited'] === true,
    status: str(r['status']),
    likedByMe: r['liked_by_me'] === true,
    bookmarkedByMe: r['bookmarked_by_me'] === true,
    followedByMe: r['followed_by_me'] === true,
  };
}

export function toComment(raw: unknown): ReflectionComment {
  const c = flatten(raw);
  const author = isObject(c['author']) ? c['author'] : {};
  return {
    id: str(c['id']) ?? '',
    text: str(c['text']) ?? '',
    authorId: str(author['id'], c['user_id']),
    authorName: str(author['username'], c['username']) ?? 'Anonymous',
    createdAt: time(c['created_at'], c['created_at_ms']),
  };
}

export function toTag(raw: unknown): TagCount {
  if (typeof raw === 'string') return { tag: raw, count: 0 };
  const t = flatten(raw);
  return { tag: str(t['tag'], t['key'], t['name']) ?? '', count: num(t['count'], t['doc_count']) ?? 0 };
}

/** Unwraps {"success": true, "result": {...}} envelopes. */
export function unwrapResult(raw: unknown): unknown {
  return isObject(raw) && isObject(raw['result']) ? raw['result'] : raw;
}

export function field(raw: unknown, key: string): unknown {
  return isObject(raw) ? raw[key] : undefined;
}

/* ---------------- Accounts ---------------- */

/** "/user/<id>/picture?v=..." → absolute URL on the API host. */
export function pictureUrl(value: unknown): string | undefined {
  const path = str(value);
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

function toRole(u: Json): Role {
  const role = str(u['role'])?.toLowerCase();
  if (role === 'admin' || u['is_admin'] === true) return 'admin';
  if (role === 'moderator' || u['is_moderator'] === true) return 'moderator';
  return 'user';
}

export function toUserSummary(raw: unknown): UserSummary {
  const u = flatten(raw);
  return {
    id: str(u['id'], u['user_id']) ?? '',
    username: str(u['username'], u['name']) ?? 'Anonymous',
    pictureUrl: pictureUrl(u['profile_picture'] ?? u['picture']),
  };
}

export function toUser(raw: unknown): UserProfile {
  const u = flatten(unwrapResult(isObject(raw) && isObject(raw['user']) ? raw['user'] : raw));
  const firstName = str(u['first_name'], u['firstname']);
  const lastName = str(u['last_name'], u['lastname']);
  const username = str(u['username']) ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || str(u['name'], u['names'], u['display_name']);
  const twoFactor = u['two_factor_enabled'] ?? u['two_factor'] ?? u['totp_enabled'];
  return {
    id: str(u['id'], u['user_id']) ?? '',
    username,
    email: str(u['email']),
    firstName,
    lastName,
    displayName: fullName || username,
    role: toRole(u),
    emailVerified: typeof u['email_verified'] === 'boolean' ? u['email_verified'] : undefined,
    pictureUrl: pictureUrl(u['profile_picture'] ?? u['picture']),
    twoFactorEnabled: typeof twoFactor === 'boolean' ? twoFactor : undefined,
    createdAt: time(u['created_at'], u['created_at_ms']),
    raw: u,
  };
}

export function toAuthorPage(raw: unknown, page = 1, size = 20): AuthorPage {
  const r = isObject(raw) ? raw : {};
  const author = isObject(r['author']) ? r['author'] : {};
  const stats = isObject(r['stats']) ? r['stats'] : {};
  const following = num(stats['following']);
  return {
    author: {
      ...toUserSummary(author),
      followedByMe: author['followed_by_me'] === true,
      deleted: author['deleted'] === true,
    },
    stats: {
      reflections: num(stats['reflections']) ?? 0,
      likesReceived: num(stats['likes_received']) ?? 0,
      followers: num(stats['followers']) ?? 0,
      following: following ?? null,
    },
    reflections: toPage(r, toReflection, page, size),
  };
}

export function toNotification(raw: unknown): AppNotification {
  const n = flatten(raw);
  const reflection = isObject(n['reflection']) ? n['reflection'] : undefined;
  const comment = isObject(n['comment']) ? n['comment'] : undefined;
  return {
    id: str(n['id']) ?? '',
    kind: str(n['kind'], n['type']) ?? 'activity',
    actor: isObject(n['actor']) ? toUserSummary(n['actor']) : undefined,
    actorCount: num(n['actor_count']) ?? 1,
    reflectionId: str(reflection?.['id'], n['reflection_id']),
    reflectionSurah: num(reflection?.['surah_id'], reflection?.['surah']),
    reflectionAyah: num(reflection?.['ayah_id'], reflection?.['ayah']),
    commentText: str(comment?.['text'], n['comment_text']),
    read: n['read'] === true || !!n['read_at'],
    createdAt: time(n['updated_at'], n['created_at']),
  };
}

export function toReading(raw: unknown): ReadingStatus {
  const r = isObject(raw) ? raw : {};
  const p = isObject(r['position']) ? flatten(r['position']) : undefined;
  const s = isObject(r['streak']) ? r['streak'] : {};
  const surah = num(p?.['surah_id'], p?.['surah']);
  const ayah = num(p?.['ayah_id'], p?.['ayah']);
  return {
    position:
      p && surah && ayah
        ? {
            surah,
            ayah,
            quranType: str(p['quran_type']),
            textAr: str(p['text_ar']),
            translation: str(p['translation']),
          }
        : undefined,
    streak: {
      current: num(s['current']) ?? 0,
      longest: num(s['longest']) ?? 0,
      lastReadDate: str(s['last_read_date']),
      readToday: s['read_today'] === true,
      timeZone: str(s['time_zone']),
    },
  };
}

export function toHistoryEntry(raw: unknown): ReadingHistoryEntry {
  const h = flatten(raw);
  return {
    surah: num(h['surah_id'], h['surah']) ?? 0,
    ayah: num(h['ayah_id'], h['ayah']) ?? 0,
    at: time(h['read_at'], h['updated_at'], h['created_at']),
  };
}

export function toReportGroup(raw: unknown): ReportGroup {
  const g = flatten(raw);
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x) : []);
  const reportsField = g['reports'];
  return {
    reflection: toReflection(g['reflection'] ?? g),
    reports: Array.isArray(reportsField) ? reportsField.length : (num(reportsField, g['report_count'], g['count']) ?? 0),
    reasons: strings(g['reasons']),
    notes: strings(g['notes']),
  };
}

export function toFollow(raw: unknown): FollowEntry {
  const f = flatten(raw);
  const kind = (str(f['kind']) ?? 'user') as FollowKind;
  const target = str(f['target'], f['target_id'], f['id']) ?? '';
  const user = isObject(f['user']) ? f['user'] : undefined;
  const label =
    kind === 'user'
      ? (str(user?.['username'], f['username'], f['label']) ?? target)
      : kind === 'ayah'
        ? target
        : (str(f['label'], f['excerpt']) ?? 'A reflection');
  return { kind, target, label, at: time(f['followed_at_ms'], f['created_at']) };
}

export function toFeedItem(raw: unknown): FeedItem {
  const f = isObject(raw) ? raw : {};
  const because = f['because'];
  return {
    reflection: toReflection(f),
    because: Array.isArray(because) ? because.filter((b): b is string => typeof b === 'string') : [],
  };
}
