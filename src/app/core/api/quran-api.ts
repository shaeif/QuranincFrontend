import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TRANSLITERATION_TYPE } from '../quran/quran-texts';
import { getSurah } from '../quran/surahs';
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

/** Largest page GET /quran/get_surah allows. */
const PAGE_SIZE = 100;

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

  /**
   * A whole surah: the chosen Arabic script, plus the translation and/or
   * transliteration when asked for. The Arabic is required; the extras are
   * left empty if they fail, so the reader still works.
   */
  surahVerses(surah: number, opts: { arabic?: string; translation?: boolean; transliteration?: boolean } = {}): Observable<Verse[]> {
    const empty = of(new Map<number, string>());
    const optional = (type: string, wanted: boolean | undefined) =>
      wanted ? this.surahText(surah, type).pipe(catchError(() => empty)) : empty;
    return forkJoin([
      this.surahText(surah, opts.arabic ?? environment.quranTextType),
      optional(environment.translationType, opts.translation ?? true),
      optional(TRANSLITERATION_TYPE, opts.transliteration),
    ]).pipe(
      map(([arabic, english, latin]) =>
        [...arabic.entries()]
          .sort(([a], [b]) => a - b)
          .map(([ayah, textAr]) => ({
            surah,
            ayah,
            textAr,
            translation: english.get(ayah) ?? '',
            transliteration: latin.get(ayah)?.replace(/<[^>]*>/g, ''),
          })),
      ),
    );
  }

  /** One ayah in one text type: GET /quran/<type>/<surah>/<ayah>. */
  ayahText(surah: number, ayah: number, type: string): Observable<string> {
    return this.api.get(`/quran/${encodeURIComponent(type)}/${surah}/${ayah}`).pipe(
      map((raw) => {
        const texts = toAyahTexts(raw);
        if (texts.size) return texts.get(ayah) ?? [...texts.values()][0];
        const single = toVerse(raw);
        return single.textAr || String(field(raw, 'text') ?? '');
      }),
    );
  }

  /**
   * A whole surah in one text type. GET /quran/get_surah pages at most 100 ayahs,
   * so longer surahs (Al-Baqarah has 286) are fetched as several pages in parallel.
   */
  surahText(surah: number, type: string): Observable<Map<number, string>> {
    const count = getSurah(surah)?.ayahs ?? PAGE_SIZE;
    const pages = Array.from({ length: Math.ceil(count / PAGE_SIZE) }, (_, i) => i + 1);
    return forkJoin(
      pages.map((page) =>
        this.api
          .get('/quran/get_surah', { quran_type: type, surah_id: surah, page, size: PAGE_SIZE })
          .pipe(map((raw) => toAyahTexts(raw, (page - 1) * PAGE_SIZE))),
      ),
    ).pipe(map((parts) => new Map(parts.flatMap((part) => [...part.entries()]))));
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

  /** GET /quran/most-liked (optionally one surah); `size` trims the list on this side. */
  mostLiked(opts: { surahId?: number; size?: number } = {}): Observable<Page<LikedVerse>> {
    return this.api.get('/quran/most-liked', { surah_id: opts.surahId }).pipe(
      map((raw) => {
        const page = toPage(raw, toLikedVerse);
        return opts.size ? { ...page, items: page.items.slice(0, opts.size) } : page;
      }),
    );
  }
}
