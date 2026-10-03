import { effect, inject, Injectable, signal, untracked, WritableSignal } from '@angular/core';
import { catchError, forkJoin, Observable, of, tap } from 'rxjs';
import { LibraryApi } from '../api/library-api';
import { AuthService } from './auth.service';

const key = (surah: number, ayah: number) => `${surah}:${ayah}`;

/**
 * What the signed-in user has liked, bookmarked or followed among ayahs and
 * people, so the reader and author pages can show it without a request per item.
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly api = inject(LibraryApi);
  private readonly auth = inject(AuthService);

  readonly likedAyahs = signal(new Set<string>());
  readonly bookmarkedAyahs = signal(new Set<string>());
  readonly followedAyahs = signal(new Set<string>());
  readonly followedUsers = signal(new Set<string>());

  constructor() {
    effect(() => {
      const id = this.auth.user()?.id;
      untracked(() => (id ? this.load() : this.clear()));
    });
  }

  load(): void {
    forkJoin({
      liked: this.api.likedAyahs().pipe(catchError(() => of(null))),
      bookmarked: this.api.bookmarkedAyahs().pipe(catchError(() => of(null))),
      follows: this.api.follows().pipe(catchError(() => of(null))),
    }).subscribe(({ liked, bookmarked, follows }) => {
      if (liked) this.likedAyahs.set(new Set(liked.items.map((v) => key(v.surah, v.ayah))));
      if (bookmarked) this.bookmarkedAyahs.set(new Set(bookmarked.items.map((v) => key(v.surah, v.ayah))));
      if (follows) {
        this.followedAyahs.set(new Set(follows.filter((f) => f.kind === 'ayah').map((f) => f.target)));
        this.followedUsers.set(new Set(follows.filter((f) => f.kind === 'user').map((f) => f.target)));
      }
    });
  }

  isLiked = (s: number, a: number) => this.likedAyahs().has(key(s, a));
  isBookmarked = (s: number, a: number) => this.bookmarkedAyahs().has(key(s, a));
  isFollowed = (s: number, a: number) => this.followedAyahs().has(key(s, a));

  likeAyah(s: number, a: number, on: boolean): Observable<unknown> {
    return this.toggle(this.likedAyahs, key(s, a), on, this.api.likeAyah(s, a, on));
  }

  bookmarkAyah(s: number, a: number, on: boolean): Observable<unknown> {
    return this.toggle(this.bookmarkedAyahs, key(s, a), on, this.api.bookmarkAyah(s, a, on));
  }

  followAyah(s: number, a: number, on: boolean): Observable<unknown> {
    return this.toggle(this.followedAyahs, key(s, a), on, this.api.follow('ayah', key(s, a), on));
  }

  followUser(id: string, on: boolean): Observable<unknown> {
    return this.toggle(this.followedUsers, id, on, this.api.follow('user', id, on));
  }

  /** Updates the set straight away and puts it back if the request fails. */
  private toggle(set: WritableSignal<Set<string>>, item: string, on: boolean, request: Observable<unknown>): Observable<unknown> {
    const apply = (value: boolean) =>
      set.update((s) => {
        const next = new Set(s);
        if (value) next.add(item);
        else next.delete(item);
        return next;
      });
    apply(on);
    return request.pipe(tap({ error: () => apply(!on) }));
  }

  private clear(): void {
    this.likedAyahs.set(new Set());
    this.bookmarkedAyahs.set(new Set());
    this.followedAyahs.set(new Set());
    this.followedUsers.set(new Set());
  }
}
