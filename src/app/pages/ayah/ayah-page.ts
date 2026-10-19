import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonSegment,
  IonSegmentButton,
  IonSkeletonText,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { forkJoin, Observable, of, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { errorMessage } from '../../core/api/api-client';
import { Reflection, ReflectionSort } from '../../core/api/models';
import { ReflectionApi, TagCloud } from '../../core/api/reflection-api';
import { AuthService } from '../../core/auth/auth.service';
import { LibraryService } from '../../core/auth/library.service';
import { AyahTextService } from '../../core/quran/ayah-text.service';
import { getSurah, verseRef } from '../../core/quran/surahs';
import { ReadingSettingsService } from '../../core/settings/reading-settings.service';
import { LoadStatus, Loadable } from '../../core/util/loadable';
import { AyahMarker } from '../../shared/ayah-marker';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { SideColumn } from '../../shared/side-column';
import { StateView } from '../../shared/state-view';

const PAGE_SIZE = 20;
const SORTS: ReflectionSort[] = ['likes', 'newest', 'comments'];

/**
 * One ayah as the subject of a conversation: the ayah at the top, every
 * reflection on it underneath (GET /reflection/by_surah_ayah).
 */
@Component({
  selector: 'app-ayah-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonRouterLink,
    IonSegment,
    IonSegmentButton,
    IonSkeletonText,
    IonTitle,
    IonToolbar,
    AyahMarker,
    HeaderActions,
    ReflectionCard,
    SideColumn,
    StateView,
  ],
  templateUrl: './ayah-page.html',
  styleUrl: './ayah-page.scss',
})
export class AyahPage {
  readonly surahParam = input('', { alias: 'surah' });
  readonly ayahParam = input('', { alias: 'ayah' });

  protected readonly auth = inject(AuthService);
  protected readonly library = inject(LibraryService);
  private readonly api = inject(ReflectionApi);
  private readonly texts = inject(AyahTextService);
  protected readonly settings = inject(ReadingSettingsService);
  private readonly notify = inject(NotifyService);

  protected readonly surah = computed(() => getSurah(Number(this.surahParam())));
  protected readonly ayah = computed(() => {
    const s = this.surah();
    const n = Number(this.ayahParam());
    return s && Number.isInteger(n) && n >= 1 && n <= s.ayahs ? n : 0;
  });
  protected readonly ref = computed(() => verseRef(this.surah()?.number ?? 0, this.ayah()));
  protected readonly prev = computed(() => (this.ayah() > 1 ? this.ayah() - 1 : 0));
  protected readonly next = computed(() => (this.ayah() && this.ayah() < (this.surah()?.ayahs ?? 0) ? this.ayah() + 1 : 0));

  protected readonly arabic = signal('');
  protected readonly english = signal('');
  protected readonly textStatus = signal<LoadStatus>('idle');

  protected readonly sort = signal<ReflectionSort>('likes');
  protected readonly items = signal<Reflection[]>([]);
  protected readonly total = signal(0);
  protected readonly status = signal<LoadStatus>('idle');
  protected readonly error = signal('');
  protected readonly hasMore = computed(() => this.items().length < this.total());
  private page = 1;
  private sub?: Subscription;

  /** Tags people used on this ayah's reflections. */
  protected readonly topics = new Loadable<TagCloud>();

  protected readonly liked = computed(() => this.library.isLiked(this.surah()?.number ?? 0, this.ayah()));
  protected readonly bookmarked = computed(() => this.library.isBookmarked(this.surah()?.number ?? 0, this.ayah()));
  protected readonly followed = computed(() => this.library.isFollowed(this.surah()?.number ?? 0, this.ayah()));

  constructor() {
    effect(() => {
      const s = this.surah()?.number;
      const a = this.ayah();
      const script = this.settings.arabicType();
      const withEnglish = this.settings.showTranslation();
      if (s && a) untracked(() => this.loadText(s, a, script, withEnglish));
    });
    effect(() => {
      const s = this.surah()?.number;
      const a = this.ayah();
      if (s && a) untracked(() => this.topics.load(this.api.tags({ surahId: s, ayahId: a })));
    });
    effect(() => {
      this.surah();
      this.ayah();
      this.sort();
      this.auth.user();
      untracked(() => this.reload());
    });
  }

  private loadText(surah: number, ayah: number, script: string, withEnglish: boolean): void {
    this.textStatus.set('loading');
    forkJoin({
      ar: this.texts.text(surah, ayah, script),
      en: withEnglish ? this.texts.text(surah, ayah, environment.translationType) : of(''),
    }).subscribe(({ ar, en }) => {
      this.arabic.set(ar);
      this.english.set(en);
      this.textStatus.set(ar ? 'ready' : 'error');
    });
  }

  protected setSort(value: unknown): void {
    if (SORTS.includes(value as ReflectionSort)) this.sort.set(value as ReflectionSort);
  }

  protected updated(r: Reflection): void {
    this.items.update((list) => list.map((x) => (x.id === r.id ? r : x)));
  }

  protected reload(done?: () => void): void {
    this.sub?.unsubscribe();
    this.page = 1;
    if (!this.ayah()) {
      done?.();
      return;
    }
    this.status.set('loading');
    this.sub = this.source(1).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.status.set('ready');
        done?.();
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.status.set('error');
        done?.();
      },
    });
  }

  protected refresh(event: RefresherCustomEvent): void {
    this.reload(() => event.target.complete());
  }

  protected loadMore(event: InfiniteScrollCustomEvent): void {
    const next = this.page + 1;
    this.source(next).subscribe({
      next: (res) => {
        this.page = next;
        const seen = new Set(this.items().map((r) => r.id));
        this.items.update((list) => [...list, ...res.items.filter((r) => !seen.has(r.id))]);
        if (!res.items.length) this.total.set(this.items().length);
        event.target.complete();
      },
      error: () => event.target.complete(),
    });
  }

  private source(page: number) {
    return this.api.byAyah(this.surah()!.number, this.ayah(), { page, size: PAGE_SIZE, sort: this.sort() });
  }

  /* ---------- Ayah actions ---------- */

  protected toggleLike(): void {
    this.toggle(this.liked(), (s, a, on) => this.library.likeAyah(s, a, on));
  }

  protected toggleBookmark(): void {
    this.toggle(this.bookmarked(), (s, a, on) => this.library.bookmarkAyah(s, a, on), 'Saved to bookmarks', 'Removed from bookmarks');
  }

  protected toggleFollow(): void {
    this.toggle(
      this.followed(),
      (s, a, on) => this.library.followAyah(s, a, on),
      'New reflections on this ayah will show in your Following timeline',
      'Unfollowed',
    );
  }

  private toggle(current: boolean, request: (s: number, a: number, on: boolean) => Observable<unknown>, onText?: string, offText?: string): void {
    const s = this.surah()?.number;
    if (!s || !this.ayah() || !this.auth.requireLogin()) return;
    const on = !current;
    request(s, this.ayah(), on).subscribe({
      next: () => {
        const text = on ? onText : offText;
        if (text) this.notify.show(text);
      },
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  protected share(): void {
    const s = this.surah();
    if (!s || !this.ayah()) return;
    const url = `${location.origin}/ayah/${s.number}/${this.ayah()}`;
    this.notify.share(this.ref(), [this.arabic(), this.english(), `— ${this.ref()}`, url].filter(Boolean).join('\n\n'));
  }
}
