import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from './api-client';
import { Page, Reflection, ReflectionComment, ReflectionSort, TagCount } from './models';
import { extractArray, field, toComment, toPage, toReflection, toTag, unwrapResult } from './normalize';

export interface PageQuery {
  page?: number;
  size?: number;
  sort?: ReflectionSort;
}

export interface TagCloud {
  tags: TagCount[];
  reflections: number;
}

@Injectable({ providedIn: 'root' })
export class ReflectionApi {
  private readonly api = inject(ApiClient);

  /** GET /reflection/list: every visible reflection. */
  list(q: PageQuery = {}): Observable<Page<Reflection>> {
    return this.page('/reflection/list', {}, q);
  }

  /** GET /reflection/by_surah_ayah */
  byAyah(surah: number, ayah: number, q: PageQuery = {}): Observable<Page<Reflection>> {
    return this.page('/reflection/by_surah_ayah', { surah_id: surah, ayah_id: ayah }, q);
  }

  /** GET /reflection/by_surah */
  bySurah(surah: number, q: PageQuery = {}): Observable<Page<Reflection>> {
    return this.page('/reflection/by_surah', { surah_id: surah }, q);
  }

  /** GET /reflection/search?tag= (case-insensitive). Sorted by the server. */
  byTag(tag: string, q: PageQuery = {}): Observable<Page<Reflection>> {
    return this.page('/reflection/search', { tag }, { ...q, sort: undefined });
  }

  /** GET /reflection/<id> */
  get(id: string): Observable<Reflection> {
    return this.api.get(`/reflection/${encodeURIComponent(id)}`).pipe(
      map((raw) => {
        const reflection = toReflection(unwrapResult(raw));
        return { ...reflection, id: reflection.id || id };
      }),
    );
  }

  /** GET /reflection/<id>/comments (public) */
  comments(id: string): Observable<Page<ReflectionComment>> {
    return this.api
      .get(`/reflection/${encodeURIComponent(id)}/comments`)
      .pipe(map((raw) => toPage(raw, toComment)));
  }

  /** GET /reflection/tags: most used first. */
  tags(opts: { surahId?: number; prefix?: string } = {}): Observable<TagCloud> {
    return this.api.get('/reflection/tags', { surah_id: opts.surahId, prefix: opts.prefix }).pipe(
      map((raw) => ({
        tags: extractArray(field(raw, 'tags') ?? raw).map(toTag).filter((t) => t.tag),
        reflections: Number(field(raw, 'reflections')) || 0,
      })),
    );
  }

  private page(path: string, filters: Record<string, string | number>, q: PageQuery): Observable<Page<Reflection>> {
    const page = q.page ?? 1;
    const size = q.size ?? 20;
    return this.api
      .get(path, { ...filters, page, size, sort: q.sort })
      .pipe(map((raw) => toPage(raw, toReflection, page, size)));
  }
}
