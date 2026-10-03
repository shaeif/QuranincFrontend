import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { errorMessage, toApiError } from '../../core/api/api-client';
import { QuranApi } from '../../core/api/quran-api';
import { ReflectionApi } from '../../core/api/reflection-api';
import { AuthService } from '../../core/auth/auth.service';
import { ReadingSettingsService } from '../../core/settings/reading-settings.service';
import { getSurah, SURAHS } from '../../core/quran/surahs';
import { inputValue } from '../../core/util/forms';
import { AuthPrompt } from '../../shared/auth-prompt';
import { NotifyService } from '../../shared/notify.service';
import { StateView } from '../../shared/state-view';
import { ThemeToggle } from '../../shared/theme-toggle';

const MAX_TEXT = 5000;
const MAX_TAGS = 20;

/** Write a reflection on an ayah (POST /reflection/create) or edit your own (PUT /reflection/<id>). */
@Component({
  selector: 'app-compose-page',
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    AuthPrompt,
    StateView,
    ThemeToggle,
  ],
  templateUrl: './compose-page.html',
  styleUrl: './compose-page.scss',
})
export class ComposePage {
  /** Edit mode when the route has :id. */
  readonly id = input<string | undefined>(undefined);
  readonly surahParam = input<string | undefined>(undefined, { alias: 'surah' });
  readonly ayahParam = input<string | undefined>(undefined, { alias: 'ayah' });

  protected readonly auth = inject(AuthService);
  private readonly quran = inject(QuranApi);
  private readonly api = inject(ReflectionApi);
  private readonly reading = inject(ReadingSettingsService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  protected readonly surahs = SURAHS;
  protected readonly maxText = MAX_TEXT;
  protected readonly maxTags = MAX_TAGS;
  protected readonly inputValue = inputValue;

  protected readonly surah = signal(1);
  protected readonly ayah = signal(1);
  protected readonly text = signal('');
  protected readonly highlight = signal('');
  protected readonly tags = signal<string[]>([]);
  protected readonly tagDraft = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly loadState = signal<'ready' | 'loading' | 'error'>('ready');
  protected readonly loadError = signal('');

  protected readonly preview = signal<{ ar: string; en: string } | null>(null);
  protected readonly previewLoading = signal(false);

  protected readonly editing = computed(() => !!this.id());
  protected readonly surahMeta = computed(() => getSurah(this.surah()));
  protected readonly ayahOptions = computed(() => Array.from({ length: this.surahMeta()?.ayahs ?? 0 }, (_, i) => i + 1));
  protected readonly remaining = computed(() => MAX_TEXT - this.text().length);

  constructor() {
    // Prefill from ?surah=&ayah= when writing a new reflection.
    effect(() => {
      const s = getSurah(Number(this.surahParam()));
      const a = Number(this.ayahParam());
      if (this.id() || !s) return;
      untracked(() => {
        this.surah.set(s.number);
        this.ayah.set(Number.isInteger(a) && a >= 1 && a <= s.ayahs ? a : 1);
      });
    });
    // Edit mode: load the reflection.
    effect(() => {
      const id = this.id();
      if (id && this.auth.user()) untracked(() => this.loadExisting(id));
    });
    // Verse preview follows the chosen ayah.
    effect(() => {
      const s = this.surah();
      const a = this.ayah();
      untracked(() => this.loadPreview(s, a));
    });
  }

  protected setSurah(value: unknown): void {
    const s = getSurah(Number(value));
    if (!s) return;
    this.surah.set(s.number);
    if (this.ayah() > s.ayahs) this.ayah.set(1);
  }

  protected setAyah(value: unknown): void {
    const a = Number(value);
    if (Number.isInteger(a) && a >= 1 && a <= (this.surahMeta()?.ayahs ?? 0)) this.ayah.set(a);
  }

  protected onTagInput(event: Event): void {
    const value = inputValue(event);
    if (/[,\n]/.test(value)) {
      value.split(/[,\n]/).forEach((t, i, all) => (i < all.length - 1 ? this.addTag(t) : this.tagDraft.set(t)));
    } else {
      this.tagDraft.set(value);
    }
  }

  protected addTag(raw = this.tagDraft()): void {
    const tag = raw.trim().replace(/^#/, '').toLowerCase().slice(0, 40);
    this.tagDraft.set('');
    if (!tag || this.tags().includes(tag) || this.tags().length >= MAX_TAGS) return;
    this.tags.update((t) => [...t, tag]);
  }

  protected removeTag(tag: string): void {
    this.tags.update((t) => t.filter((x) => x !== tag));
  }

  protected useHighlight(): void {
    const ar = this.preview()?.ar;
    if (ar && !this.highlight()) this.highlight.set(ar);
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    if (this.tagDraft().trim()) this.addTag();
    const text = this.text().trim();
    if (!text) {
      this.error.set('Write your reflection first.');
      return;
    }
    if (text.length > MAX_TEXT) {
      this.error.set(`Keep it under ${MAX_TEXT} characters.`);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.fieldErrors.set({});
    const id = this.id();
    const request = id
      ? this.api.update(id, { reflection: text, highlightText: this.highlight().trim(), tags: this.tags() })
      : this.api.create({ reflection: text, surahId: this.surah(), ayahId: this.ayah(), tags: this.tags(), highlightText: this.highlight() });
    request.subscribe({
      next: (r) => {
        this.busy.set(false);
        this.notify.show(id ? 'Reflection updated' : 'Reflection posted. JazakAllahu khayran.');
        this.router.navigate(['/reflections', r.id || id], { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const e = toApiError(err);
        this.fieldErrors.set(e.fieldErrors());
        this.error.set(e.message);
      },
    });
  }

  protected retryLoad(): void {
    const id = this.id();
    if (id) this.loadExisting(id);
  }

  private loadExisting(id: string): void {
    this.loadState.set('loading');
    this.api.get(id).subscribe({
      next: (r) => {
        if (r.authorId && r.authorId !== this.auth.user()?.id) {
          this.loadError.set('Only the author can edit a reflection.');
          this.loadState.set('error');
          return;
        }
        this.surah.set(r.surah);
        this.ayah.set(r.ayah);
        this.text.set(r.text);
        this.highlight.set(r.highlightText ?? '');
        this.tags.set(r.tags);
        this.loadState.set('ready');
      },
      error: (err: unknown) => {
        this.loadError.set(errorMessage(err));
        this.loadState.set('error');
      },
    });
  }

  private loadPreview(s: number, a: number): void {
    this.previewLoading.set(true);
    forkJoin({
      ar: this.quran.ayahText(s, a, this.reading.arabicType()).pipe(catchError(() => of(''))),
      en: this.quran.ayahText(s, a, environment.translationType).pipe(catchError(() => of(''))),
    }).subscribe(({ ar, en }) => {
      // Ignore answers for an ayah the user has already moved away from.
      if (s !== this.surah() || a !== this.ayah()) return;
      this.previewLoading.set(false);
      this.preview.set(ar || en ? { ar, en } : null);
    });
  }
}
