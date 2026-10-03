import { inject, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { UserSummary } from '../api/models';
import { toAuthorPage, toUserSummary } from '../api/normalize';
import { AuthService } from './auth.service';

/**
 * Usernames for author ids. Reflections from the API carry only created_by_id,
 * so each author is looked up once (GET /user/<id>, or the public author page
 * when that needs a login) and cached for the rest of the visit.
 */
@Injectable({ providedIn: 'root' })
export class UserNamesService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private readonly cache = new Map<string, WritableSignal<UserSummary | null>>();

  /** The author for an id: null until known. Safe to call from templates and computed(). */
  get(id: string): Signal<UserSummary | null> {
    let entry = this.cache.get(id);
    if (!entry) {
      entry = signal<UserSummary | null>(null);
      this.cache.set(id, entry);
      const target = entry;
      // Resolve outside the current reactive read (signals can't be written inside computed()).
      queueMicrotask(() => this.resolve(id, target));
    }
    return entry;
  }

  /** Seeds the cache with a user already known (author pages, the signed-in user). */
  remember(user: UserSummary): void {
    if (!user.id || !user.username) return;
    const entry = this.cache.get(user.id);
    if (entry) entry.set(user);
    else this.cache.set(user.id, signal(user));
  }

  private resolve(id: string, target: WritableSignal<UserSummary | null>): void {
    const me = this.auth.user();
    if (me?.id === id) {
      target.set({ id, username: me.username, pictureUrl: me.pictureUrl });
      return;
    }
    this.lookup(id).subscribe({
      next: (user) => user.username && target.set({ ...user, id }),
      // Unknown or deleted accounts stay unnamed; the card says "a member".
      error: () => undefined,
    });
  }

  private lookup(id: string): Observable<UserSummary> {
    const path = encodeURIComponent(id);
    return this.api.get(`/user/${path}`).pipe(
      map(toUserSummary),
      catchError(() => this.api.get(`/user/${path}/reflections`).pipe(map((raw) => toAuthorPage(raw).author))),
    );
  }
}
