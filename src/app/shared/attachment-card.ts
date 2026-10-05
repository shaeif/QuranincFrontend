import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { QuranApi } from '../core/api/quran-api';
import { ReflectionApi } from '../core/api/reflection-api';
import { Attachment } from '../core/chat/chat-models';
import { verseRef } from '../core/quran/surahs';

/** An ayah, reflection or comment shared in a message (or about to be). */
@Component({
  selector: 'app-attachment-card',
  imports: [RouterLink, IonIcon],
  template: `
    @let a = attachment();
    @if (a.unavailable) {
      <div class="card gone"><ion-icon name="eye-off-outline" aria-hidden="true" /> This {{ a.kind }} is no longer available.</div>
    } @else if (a.kind === 'ayah') {
      <a class="card" [routerLink]="['/quran', surah()]" [queryParams]="{ ayah: ayah() }">
        <span class="kind"><ion-icon name="book-outline" aria-hidden="true" /> {{ ref() }}</span>
        @if (arabic()) {
          <span class="ar tb-quran" lang="ar">{{ arabic() }}</span>
        }
        @if (english()) {
          <span class="en">{{ english() }}</span>
        }
      </a>
    } @else {
      <a class="card" [routerLink]="a.kind === 'reflection' ? ['/reflections', a.ref] : null">
        <span class="kind">
          <ion-icon [name]="a.kind === 'reflection' ? 'chatbubbles-outline' : 'chatbubble-outline'" aria-hidden="true" />
          {{ a.kind === 'reflection' ? 'Reflection' : 'Comment' }}{{ author() ? ' by @' + author() : '' }}
        </span>
        @if (english()) {
          <span class="text">{{ english() }}</span>
        }
      </a>
    }
  `,
  styles: `
    :host { display: block; }
    .card {
      display: grid; gap: 4px; padding: 10px 12px; border-radius: 14px; text-decoration: none; color: var(--tb-fg);
      background: var(--tb-glass); border: 1px solid var(--tb-glass-line);
    }
    .gone { color: var(--tb-muted); display: flex; align-items: center; gap: 6px; font-size: 13px; }
    .kind { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--tb-gold); }
    .ar { font-size: 20px; line-height: 1.9; }
    .en, .text { font-size: 13px; line-height: 1.5; color: var(--tb-muted); }
    .text { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
  `,
})
export class AttachmentCard {
  readonly attachment = input.required<Attachment>();

  private readonly quran = inject(QuranApi);
  private readonly reflections = inject(ReflectionApi);
  private readonly loaded = signal<{ ar?: string; en?: string; author?: string }>({});

  protected readonly surah = computed(() => Number(this.attachment().ref.split(':')[0]));
  protected readonly ayah = computed(() => Number(this.attachment().ref.split(':')[1]));
  protected readonly ref = computed(() => verseRef(this.surah(), this.ayah()));
  protected readonly arabic = computed(() => this.attachment().textAr || this.loaded().ar);
  protected readonly english = computed(() => this.attachment().text || this.loaded().en);
  protected readonly author = computed(() => this.attachment().authorName || this.loaded().author);

  constructor() {
    // Fill in the preview when the API sent only the reference.
    effect(() => {
      const a = this.attachment();
      if (a.unavailable || (a.text && (a.kind !== 'ayah' || a.textAr))) return;
      untracked(() => {
        if (a.kind === 'ayah' && this.surah() && this.ayah()) {
          forkJoin({
            ar: this.quran.ayahText(this.surah(), this.ayah(), environment.quranTextType).pipe(catchError(() => of(''))),
            en: this.quran.ayahText(this.surah(), this.ayah(), environment.translationType).pipe(catchError(() => of(''))),
          }).subscribe((t) => this.loaded.set(t));
        } else if (a.kind === 'reflection' && a.ref) {
          this.reflections.get(a.ref).subscribe({
            next: (r) => this.loaded.set({ en: r.text, author: r.authorName }),
            error: () => undefined,
          });
        }
      });
    });
  }
}
