import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonSkeletonText } from '@ionic/angular';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AyahTextService } from '../core/quran/ayah-text.service';
import { verseRef } from '../core/quran/surahs';
import { ReadingSettingsService } from '../core/settings/reading-settings.service';

/**
 * The ayah a post is about, embedded like a quoted post: reference, Arabic in
 * the reader's script and (if on in Settings) the English. Opens the ayah page.
 */
@Component({
  selector: 'app-ayah-quote',
  imports: [RouterLink, IonIcon, IonSkeletonText],
  template: `
    <a class="quote" [routerLink]="['/ayah', surah(), ayah()]" [attr.aria-label]="'Open ' + ref()">
      <span class="ref"><ion-icon name="book-outline" aria-hidden="true" /> {{ ref() }}</span>
      @if (loading()) {
        <ion-skeleton-text [animated]="true" style="width: 80%; margin-inline-start: auto" />
        <ion-skeleton-text [animated]="true" style="width: 60%" />
      } @else {
        @if (arabic()) {
          <span class="ar tb-quran" lang="ar" [class.clamp]="clamp()">{{ arabic() }}</span>
        }
        @if (english()) {
          <span class="en" [class.clamp]="clamp()">{{ english() }}</span>
        }
      }
    </a>
  `,
  styles: `
    :host { display: block; position: relative; z-index: 1; }
    .quote {
      display: grid; gap: 6px; padding: 12px 14px; border-radius: 16px; text-decoration: none; color: var(--tb-fg);
      background: var(--tb-field); border: 1px solid var(--tb-glass-line);
      transition: border-color .2s ease;
    }
    .quote:hover { border-color: var(--tb-gold-soft); }
    .ref { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: var(--tb-gold); }
    .ar { font-size: 22px; line-height: 2; }
    .en { font-size: 13.5px; line-height: 1.55; color: var(--tb-muted); }
    .clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  `,
})
export class AyahQuote {
  readonly surah = input.required<number>();
  readonly ayah = input.required<number>();
  /** Long ayahs are cut to three lines in timelines. */
  readonly clamp = input(true);

  private readonly texts = inject(AyahTextService);
  private readonly settings = inject(ReadingSettingsService);

  protected readonly arabic = signal('');
  protected readonly english = signal('');
  protected readonly loading = signal(true);
  protected readonly ref = computed(() => verseRef(this.surah(), this.ayah()));

  constructor() {
    effect((onCleanup) => {
      const surah = this.surah();
      const ayah = this.ayah();
      const script = this.settings.arabicType();
      const withEnglish = this.settings.showTranslation();
      untracked(() => {
        this.loading.set(true);
        const sub = forkJoin({
          ar: this.texts.text(surah, ayah, script),
          en: withEnglish ? this.texts.text(surah, ayah, environment.translationType) : of(''),
        })
          .pipe(catchError(() => of({ ar: '', en: '' })))
          .subscribe(({ ar, en }) => {
            this.arabic.set(ar);
            this.english.set(en);
            this.loading.set(false);
          });
        onCleanup(() => sub.unsubscribe());
      });
    });
  }
}
