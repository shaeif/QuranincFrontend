import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from './api-client';
import { Page, Reflection, SearchVerse, TagCount, UserSummary } from './models';
import { field, toPage, toReflection, toSearchVerse, toTag, toUserSummary } from './normalize';

export type SearchSection = 'quran' | 'reflections' | 'tags' | 'users';

export interface SearchEverything {
  query: string;
  lang: string;
  quran: Page<SearchVerse>;
  reflections: Page<Reflection>;
  tags: Page<TagCount>;
  /** Null when signed out (the API only searches people for signed-in users). */
  users: Page<UserSummary> | null;
}

@Injectable({ providedIn: 'root' })
export class SearchApi {
  private readonly api = inject(ApiClient);

  /**
   * GET /search: Quran, reflections and tags at once. Without a section each
   * part holds its first results and its total; with one, that part pages.
   */
  everything(q: string, opts: { section?: SearchSection; page?: number; size?: number } = {}): Observable<SearchEverything> {
    const page = opts.page ?? 1;
    const size = opts.size ?? (opts.section ? 20 : 5);
    return this.api.get('/search', { q, section: opts.section, page: opts.section ? page : undefined, size }).pipe(
      map((raw) => ({
        query: String(field(raw, 'query') ?? q),
        lang: String(field(raw, 'lang') ?? ''),
        quran: toPage(field(raw, 'quran'), toSearchVerse, page, size),
        reflections: toPage(field(raw, 'reflections'), toReflection, page, size),
        tags: toPage(field(raw, 'tags'), toTag, page, size),
        users: field(raw, 'users') ? toPage(field(raw, 'users'), toUserSummary, page, size) : null,
      })),
    );
  }
}
