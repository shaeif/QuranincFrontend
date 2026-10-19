import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { QuranApi } from '../api/quran-api';
import { stripLeadingBismillah } from './bismillah';

/**
 * One ayah's text in one text type, fetched once per session. Timelines quote
 * the same ayah in many posts, so they share the request.
 */
@Injectable({ providedIn: 'root' })
export class AyahTextService {
  private readonly quran = inject(QuranApi);
  private readonly cache = new Map<string, Observable<string>>();

  /** Empty when it could not be loaded; a later call tries again. */
  text(surah: number, ayah: number, type: string): Observable<string> {
    const key = `${type}/${surah}/${ayah}`;
    let hit = this.cache.get(key);
    if (!hit) {
      hit = this.quran.ayahText(surah, ayah, type).pipe(
        // Quoted on its own, ayah 1 is shown without the Bismillah some sources prefix to it.
        map((text) => stripLeadingBismillah(surah, ayah, text)),
        catchError(() => {
          this.cache.delete(key);
          return of('');
        }),
        shareReplay(1),
      );
      this.cache.set(key, hit);
    }
    return hit;
  }
}
