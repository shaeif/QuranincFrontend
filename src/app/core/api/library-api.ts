import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { ApiClient, QueryParams } from './api-client';
import {
  AppNotification,
  FeedItem,
  FollowEntry,
  FollowKind,
  LikedVerse,
  Page,
  ReadingHistoryEntry,
  ReadingStatus,
  Reflection,
  ReflectionSort,
  UserSummary,
} from './models';
import {
  extractArray,
  field,
  toFeedItem,
  toFollowedReflection,
  toHistoryEntry,
  toLikedVerse,
  toNotification,
  toPage,
  toReading,
  toReflection,
  toUserSummary,
} from './normalize';

/** The API's largest page; lists default to 10 items. */
const MAX_SIZE = 100;
/** At most this many pages are fetched for a whole list (2,000 items). */
const MAX_PAGES = 20;

/** The signed-in user's own things: bookmarks, likes, follows, feed, reading, notifications. */
@Injectable({ providedIn: 'root' })
export class LibraryApi {
  private readonly api = inject(ApiClient);

  /* ---------- Bookmarks ---------- */

  bookmarkReflection(id: string, on: boolean): Observable<unknown> {
    const path = `/user/bookmarks/reflections/${encodeURIComponent(id)}`;
    return on ? this.api.put(path) : this.api.delete(path);
  }

  bookmarkAyah(surah: number, ayah: number, on: boolean): Observable<unknown> {
    const path = `/user/bookmarks/ayahs/${surah}/${ayah}`;
    return on ? this.api.put(path) : this.api.delete(path);
  }

  bookmarkedReflections(): Observable<Page<Reflection>> {
    return this.all('/user/bookmarks', { kind: 'reflection' }, toReflection);
  }

  bookmarkedAyahs(): Observable<Page<LikedVerse>> {
    return this.all('/user/bookmarks', { kind: 'ayah' }, toLikedVerse);
  }

  /* ---------- Likes ---------- */

  likedReflections(): Observable<Page<Reflection>> {
    return this.all('/user/likes', {}, toReflection);
  }

  likeAyah(surah: number, ayah: number, on: boolean): Observable<{ liked: boolean; count: number }> {
    const path = `/user/likes/ayahs/${surah}/${ayah}`;
    return (on ? this.api.put(path) : this.api.delete(path)).pipe(
      map((r) => ({ liked: field(r, 'liked_by_me') === true, count: Number(field(r, 'like_count')) || 0 })),
    );
  }

  ayahLikeStatus(surah: number, ayah: number): Observable<{ liked: boolean; count: number }> {
    return this.api
      .get(`/user/likes/ayahs/${surah}/${ayah}`)
      .pipe(map((r) => ({ liked: field(r, 'liked_by_me') === true, count: Number(field(r, 'like_count')) || 0 })));
  }

  likedAyahs(): Observable<Page<LikedVerse>> {
    return this.all('/user/likes/ayahs', {}, toLikedVerse);
  }

  /* ---------- Follows and feed ---------- */

  follow(kind: FollowKind, target: string, on: boolean): Observable<unknown> {
    const segment = kind === 'user' ? 'users' : kind === 'ayah' ? 'ayahs' : 'reflections';
    const path = `/user/follows/${segment}/${kind === 'ayah' ? target.replace(':', '/') : encodeURIComponent(target)}`;
    return on ? this.api.put(path) : this.api.delete(path);
  }

  /** GET /user/follows?kind=user: public profiles of the people you follow. */
  followedUsers(): Observable<UserSummary[]> {
    return this.all('/user/follows', { kind: 'user' }, toUserSummary).pipe(map((p) => p.items));
  }

  /** GET /user/follows?kind=ayah: with Arabic and translation. */
  followedAyahs(): Observable<LikedVerse[]> {
    return this.all('/user/follows', { kind: 'ayah' }, toLikedVerse).pipe(map((p) => p.items));
  }

  /** GET /user/follows?kind=reflection: hidden or deleted ones are marked unavailable. */
  followedReflections(): Observable<FollowEntry[]> {
    return this.all('/user/follows', { kind: 'reflection' }, toFollowedReflection).pipe(map((p) => p.items));
  }

  followers(): Observable<UserSummary[]> {
    return this.all('/user/followers', {}, toUserSummary).pipe(map((p) => p.items));
  }

  feed(sort: ReflectionSort = 'activity', page = 1, size = 20): Observable<Page<FeedItem>> {
    return this.api.get('/user/feed', { sort, page, size }).pipe(map((r) => toPage(r, toFeedItem, page, size)));
  }

  /* ---------- Reading progress ---------- */

  saveReading(surah: number, ayah: number, quranType?: string): Observable<ReadingStatus> {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return this.api
      .put('/user/reading-progress', { surah_id: surah, ayah_id: ayah, quran_type: quranType, tz })
      .pipe(map(toReading));
  }

  reading(): Observable<ReadingStatus> {
    return this.api.get('/user/reading-progress').pipe(map(toReading));
  }

  clearReading(): Observable<unknown> {
    return this.api.delete('/user/reading-progress');
  }

  readingHistory(): Observable<ReadingHistoryEntry[]> {
    return this.api
      .get('/user/reading-progress/history', { size: MAX_SIZE })
      .pipe(map((r) => extractArray(r).map(toHistoryEntry)));
  }

  /* ---------- Notifications ---------- */

  /** GET /user/notifications: newest first, kept 90 days. */
  notifications(): Observable<Page<AppNotification> & { unread: number }> {
    return this.api.get('/user/notifications', { size: MAX_SIZE }).pipe(
      map((r) => ({ ...toPage(r, toNotification), unread: Number(field(r, 'unread')) || 0 })),
    );
  }

  unreadCount(): Observable<number> {
    return this.api.get('/user/notifications/unread-count').pipe(
      map((r) => Number(field(r, 'unread') ?? field(r, 'count') ?? field(r, 'unread_count')) || 0),
    );
  }

  markAllRead(): Observable<unknown> {
    return this.api.put('/user/notifications/read');
  }

  markRead(id: string): Observable<unknown> {
    return this.api.put(`/user/notifications/${encodeURIComponent(id)}/read`);
  }

  deleteNotification(id: string): Observable<unknown> {
    return this.api.delete(`/user/notifications/${encodeURIComponent(id)}`);
  }
  /** Every page of a listing: the first, then the rest in parallel. */
  private all<T>(path: string, query: QueryParams, toItem: (raw: unknown) => T): Observable<Page<T>> {
    const get = (page: number) =>
      this.api.get(path, { ...query, page, size: MAX_SIZE }).pipe(map((r) => toPage(r, toItem, page, MAX_SIZE)));
    return get(1).pipe(
      switchMap((first) => {
        const pages = Math.min(Math.ceil(first.total / MAX_SIZE), MAX_PAGES);
        if (pages <= 1 || first.items.length < MAX_SIZE) return of(first);
        const rest = Array.from({ length: pages - 1 }, (_, i) => get(i + 2));
        return forkJoin(rest).pipe(map((more) => ({ ...first, items: [first.items, ...more.map((p) => p.items)].flat() })));
      }),
    );
  }
}
