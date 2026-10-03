import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from './api-client';
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
  toFollow,
  toHistoryEntry,
  toLikedVerse,
  toNotification,
  toPage,
  toReading,
  toReflection,
  toUserSummary,
} from './normalize';

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
    return this.api.get('/user/bookmarks', { kind: 'reflection' }).pipe(map((r) => toPage(r, toReflection)));
  }

  bookmarkedAyahs(): Observable<Page<LikedVerse>> {
    return this.api.get('/user/bookmarks', { kind: 'ayah' }).pipe(map((r) => toPage(r, toLikedVerse)));
  }

  /* ---------- Likes ---------- */

  likedReflections(): Observable<Page<Reflection>> {
    return this.api.get('/user/likes').pipe(map((r) => toPage(r, toReflection)));
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
    return this.api.get('/user/likes/ayahs').pipe(map((r) => toPage(r, toLikedVerse)));
  }

  /* ---------- Follows and feed ---------- */

  follow(kind: FollowKind, target: string, on: boolean): Observable<unknown> {
    const segment = kind === 'user' ? 'users' : kind === 'ayah' ? 'ayahs' : 'reflections';
    const path = `/user/follows/${segment}/${kind === 'ayah' ? target.replace(':', '/') : encodeURIComponent(target)}`;
    return on ? this.api.put(path) : this.api.delete(path);
  }

  follows(): Observable<FollowEntry[]> {
    return this.api.get('/user/follows').pipe(map((r) => extractArray(r).map(toFollow)));
  }

  followers(): Observable<UserSummary[]> {
    return this.api.get('/user/followers').pipe(map((r) => extractArray(r).map(toUserSummary)));
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
    return this.api.get('/user/reading-progress/history').pipe(map((r) => extractArray(r).map(toHistoryEntry)));
  }

  /* ---------- Notifications ---------- */

  notifications(): Observable<Page<AppNotification> & { unread: number }> {
    return this.api.get('/user/notifications').pipe(
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
}
