import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from './api-client';
import { Page, Reflection, ReflectionComment, ReflectionSort, ReportGroup, TagCount } from './models';
import { extractArray, field, toComment, toPage, toReflection, toReportGroup, toTag, unwrapResult } from './normalize';

export interface PageQuery {
  page?: number;
  size?: number;
  sort?: ReflectionSort;
}

export interface ReflectionDraft {
  reflection: string;
  surahId: number;
  ayahId: number;
  tags: string[];
  highlightText?: string;
}

export type ReportReason = 'spam' | 'offensive' | 'incorrect' | 'other';

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

  /** GET /reflection/search?tag= (any case). */
  byTag(tag: string, q: PageQuery = {}): Observable<Page<Reflection>> {
    return this.page('/reflection/search', { tag }, q);
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
      .get(`/reflection/${encodeURIComponent(id)}/comments`, { size: 100 })
      .pipe(map((raw) => toPage(raw, toComment, 1, 100)));
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

  /* ---------- Writing ---------- */

  /** POST /reflection/create */
  create(d: ReflectionDraft): Observable<Reflection> {
    const body: Record<string, unknown> = { reflection: d.reflection, surah_id: d.surahId, ayah_id: d.ayahId, tags: d.tags };
    if (d.highlightText?.trim()) body['highlight_text'] = d.highlightText.trim();
    return this.api.post('/reflection/create', body).pipe(map((raw) => toReflection(unwrapResult(raw))));
  }

  /** PUT /reflection/<id> (author only): text, highlight and tags. */
  update(id: string, changes: { reflection?: string; highlightText?: string; tags?: string[] }): Observable<Reflection> {
    const body: Record<string, unknown> = {};
    if (changes.reflection !== undefined) body['reflection'] = changes.reflection;
    if (changes.highlightText !== undefined) body['highlight_text'] = changes.highlightText;
    if (changes.tags !== undefined) body['tags'] = changes.tags;
    return this.api.put(`/reflection/${encodeURIComponent(id)}`, body).pipe(
      map((raw) => {
        const r = toReflection(unwrapResult(raw));
        return { ...r, id: r.id || id };
      }),
    );
  }

  /** DELETE /reflection/delete?id= (author or moderator) */
  remove(id: string): Observable<unknown> {
    return this.api.delete('/reflection/delete', { id });
  }

  /** POST or DELETE /reflection/<id>/like */
  like(id: string, on: boolean): Observable<{ liked: boolean; count: number }> {
    const path = `/reflection/${encodeURIComponent(id)}/like`;
    return (on ? this.api.post(path) : this.api.delete(path)).pipe(
      map((r) => ({ liked: field(r, 'liked_by_me') === true, count: Number(field(r, 'like_count')) || 0 })),
    );
  }

  /** POST /reflection/<id>/comments */
  addComment(id: string, text: string): Observable<ReflectionComment> {
    return this.api.post(`/reflection/${encodeURIComponent(id)}/comments`, { text }).pipe(map(toComment));
  }

  /** DELETE /reflection/<id>/comments/<comment_id> (comment author, reflection author or moderator) */
  deleteComment(id: string, commentId: string): Observable<unknown> {
    return this.api.delete(`/reflection/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`);
  }

  /** POST /reflection/<id>/report */
  report(id: string, reason: ReportReason, note?: string): Observable<unknown> {
    const body: Record<string, string> = { reason };
    if (note?.trim()) body['note'] = note.trim();
    return this.api.post(`/reflection/${encodeURIComponent(id)}/report`, body);
  }

  /* ---------- Moderation ---------- */

  /** GET /reflection/reports (moderators): open reports, most reported first. */
  reports(): Observable<ReportGroup[]> {
    return this.api.get('/reflection/reports', { size: 100 }).pipe(map((raw) => extractArray(raw).map(toReportGroup)));
  }

  /** PUT /reflection/<id>/moderation */
  moderate(id: string, status: 'hidden' | 'published'): Observable<unknown> {
    return this.api.put(`/reflection/${encodeURIComponent(id)}/moderation`, { status });
  }

  private page(path: string, filters: Record<string, string | number>, q: PageQuery): Observable<Page<Reflection>> {
    const page = q.page ?? 1;
    const size = q.size ?? 20;
    return this.api
      .get(path, { ...filters, page, size, sort: q.sort })
      .pipe(map((raw) => toPage(raw, toReflection, page, size)));
  }
}
