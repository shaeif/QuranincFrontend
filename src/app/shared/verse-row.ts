import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Verse } from '../core/api/models';
import { verseRef } from '../core/quran/surahs';

/** A verse in a list: Arabic always, translation under it, reference, link to the reader. */
@Component({
  selector: 'app-verse-row',
  imports: [RouterLink],
  template: `
    @let v = verse();
    <a class="row tb-tile" [routerLink]="['/quran', v.surah]" [queryParams]="{ ayah: v.ayah }">
      @if (v.textAr) {
        <span class="ar tb-quran" lang="ar">{{ v.textAr }}</span>
      }
      @if (v.translation) {
        <span class="en">{{ v.translation }}</span>
      }
      <span class="meta">
        <span class="ref">{{ ref(v.surah, v.ayah) }}</span>
        <ng-content />
      </span>
    </a>
  `,
  styles: `
    :host { display: block; }
    .row { display: grid; gap: 6px; padding: 14px 16px; color: var(--tb-fg); text-decoration: none; transition: border-color .2s ease; }
    .row:hover { border-color: var(--tb-gold-soft); }
    .ar { font-size: 22px; line-height: 1.95; }
    .en { font-size: 14px; line-height: 1.55; color: var(--tb-muted); }
    .meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; }
    .ref { color: var(--tb-teal); }
  `,
})
export class VerseRow {
  readonly verse = input.required<Verse>();
  protected readonly ref = verseRef;
}
