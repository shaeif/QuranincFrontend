import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClient } from './api-client';
import { LikedVerse, Page, Reflection, SearchVerse, Verse } from './models';
import { field, toAyahTexts, toLikedVerse, toPage, toReflection, toSearchVerse, toVerse } from './normalize';

export interface VerseOfTheDay {
  date: string;
  verse: Verse;
  reflections: Page<Reflection>;
}

export interface QuranSearchResult {
  query: string;
  lang: string;
  total: number;
  results: SearchVerse[];
}

export type SearchLang = 'auto' | 'ar' | 'en';

@Injectable({ providedIn: 'root' })
export class QuranApi {
  private readonly api = inject(ApiClient);

  /** GET /quran/verse-of-the-day: the same verse for everyone on a date. */
  verseOfTheDay(date?: string): Observable<VerseOfTheDay> {
    return this.api.get('/quran/verse-of-the-day', { date }).pipe(
      map((raw) => ({
        date: String(field(raw, 'date') ?? date ?? ''),
        verse: toVerse(field(raw, 'ayah') ?? field(raw, 'verse')),
        reflections: toPage(field(raw, 'reflections'), toReflection, 1, 3),
      })),
    );
  }

  /** Arabic and English for a whole surah, merged by ayah number. */
  surahVerses(surah: number): Observable<Verse[]> {
    const arabic$ = this.surahText(surah, environment.quranTextType);
    // The reader still works in Arabic only if the translation can't load.
    const english$ = this.surahText(surah, environment.translationType).pipe(catchError(() => of(new Map<number, string>())));
    return forkJoin([arabic$, english$]).pipe(
      map(([arabic, english]) =>
        [...arabic.entries()]
          .sort(([a], [b]) => a - b)
          .map(([ayah, textAr]) => ({ surah, ayah, textAr, translation: english.get(ayah) ?? '' })),
      ),
    );
  }

  /** GET /quran/<type>/<surah> */
  surahText(surah: number, type: string): Observable<Map<number, string>> {
    return this.api.get(`/quran/${encodeURIComponent(type)}/${surah}`).pipe(map(toAyahTexts));
  }

  /** GET /quran/search: Arabic or English, "quoted" for an exact phrase. */
  search(q: string, opts: { lang?: SearchLang; surahId?: number; page?: number; size?: number } = {}): Observable<QuranSearchResult> {
    const page = opts.page ?? 1;
    const size = opts.size ?? 20;
    return this.api
      .get('/quran/search', { q, lang: opts.lang ?? 'auto', surah_id: opts.surahId, page, size })
      .pipe(
        map((raw) => {
          const parsed = toPage(raw, toSearchVerse, page, size);
          return {
            query: String(field(raw, 'query') ?? q),
            lang: String(field(raw, 'lang') ?? ''),
            total: parsed.total,
            results: parsed.items,
          };
        }),
      );
  }

  /** GET /quran/most-liked */
  mostLiked(opts: { surahId?: number; page?: number; size?: number } = {}): Observable<Page<LikedVerse>> {
    const page = opts.page ?? 1;
    const size = opts.size ?? 10;
    return this.api
      .get('/quran/most-liked', { surah_id: opts.surahId, page, size })
      .pipe(map((raw) => toPage(raw, toLikedVerse, page, size)));
  }
}
