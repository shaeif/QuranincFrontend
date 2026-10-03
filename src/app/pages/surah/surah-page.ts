import { Component, computed, DestroyRef, effect, ElementRef, inject, input, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ActionSheetController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { map } from 'rxjs';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { Verse } from '../../core/api/models';
import { QuranApi } from '../../core/api/quran-api';
import { AuthService } from '../../core/auth/auth.service';
import { LibraryService } from '../../core/auth/library.service';
import { BISMILLAH, BISMILLAH_EN, showsBismillah, stripLeadingBismillah } from '../../core/quran/bismillah';
import { ARABIC_SCRIPTS } from '../../core/quran/quran-texts';
import { getSurah } from '../../core/quran/surahs';
import { LastReadService } from '../../core/settings/last-read.service';
import { ARABIC_SIZE, ReadingSettingsService } from '../../core/settings/reading-settings.service';
import { Loadable } from '../../core/util/loadable';
import { AyahMarker } from '../../shared/ayah-marker';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { StateView } from '../../shared/state-view';

/** The server allows 30 saves a minute; one every few seconds is plenty. */
const SYNC_EVERY_MS = 5000;

@Component({
  selector: 'app-surah-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRouterLink,
    IonRouterLinkWithHref,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    AyahMarker,
    HeaderActions,
    StateView,
  ],
  templateUrl: './surah-page.html',
  styleUrl: './surah-page.scss',
})
export class SurahPage {
  /** Route param :surah */
  readonly surahParam = input<string>('', { alias: 'surah' });
  /** Query param ?ayah= */
  readonly ayahParam = input<string | undefined>(undefined, { alias: 'ayah' });

  private readonly quran = inject(QuranApi);
  private readonly libraryApi = inject(LibraryApi);
  protected readonly library = inject(LibraryService);
  protected readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly sheets = inject(ActionSheetController);
  private readonly router = inject(Router);
  private readonly lastRead = inject(LastReadService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly settings = inject(ReadingSettingsService);
  protected readonly sizes = ARABIC_SIZE;
  protected readonly scripts = ARABIC_SCRIPTS;

  private readonly content = viewChild(IonContent);
  private observer?: IntersectionObserver;
  private saveTimer?: ReturnType<typeof setTimeout>;
  private lastSync = 0;
  private syncTimer?: ReturnType<typeof setTimeout>;
  private readonly visible = new Set<number>();

  protected readonly verses = new Loadable<Verse[]>();
  protected readonly surah = computed(() => getSurah(Number(this.surahParam())));
  protected readonly prev = computed(() => getSurah((this.surah()?.number ?? 0) - 1));
  protected readonly next = computed(() => getSurah((this.surah()?.number ?? 0) + 1));
  protected readonly bismillah = BISMILLAH;
  protected readonly bismillahEn = BISMILLAH_EN;
  protected readonly showBismillah = computed(() => showsBismillah(this.surah()?.number ?? 1));
  protected readonly focusAyah = computed(() => Number(this.ayahParam()) || 0);

  constructor() {
    effect(() => {
      const s = this.surah();
      this.settings.arabicType();
      this.settings.showTranslation();
      this.settings.showTransliteration();
      if (s) untracked(() => this.load());
    });
    effect(() => {
      const ayah = this.focusAyah();
      if (ayah && this.verses.status() === 'ready') untracked(() => this.scrollTo(ayah));
    });
    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      clearTimeout(this.saveTimer);
      clearTimeout(this.syncTimer);
    });
  }

  protected load(): void {
    const s = this.surah();
    if (!s) return;
    this.verses.load(
      this.quran
        .surahVerses(s.number, {
          arabic: this.settings.arabicType(),
          translation: this.settings.showTranslation(),
          transliteration: this.settings.showTransliteration(),
        })
        .pipe(map((list) => list.map((v) => ({ ...v, textAr: stripLeadingBismillah(v.surah, v.ayah, v.textAr) })))),
      () => setTimeout(() => this.trackReading(), 0),
    );
  }

  protected setScript(value: unknown): void {
    if (typeof value === 'string') this.settings.setArabicType(value);
  }

  protected changeSize(delta: number): void {
    this.settings.setArabicSize(this.settings.arabicSize() + delta * ARABIC_SIZE.step);
  }

  /* ---------- Per-ayah actions ---------- */

  protected toggleLike(v: Verse): void {
    if (!this.auth.requireLogin()) return;
    const on = !this.library.isLiked(v.surah, v.ayah);
    this.library.likeAyah(v.surah, v.ayah, on).subscribe({ error: (err: unknown) => this.notify.show(errorMessage(err)) });
  }

  protected toggleBookmark(v: Verse): void {
    if (!this.auth.requireLogin()) return;
    const on = !this.library.isBookmarked(v.surah, v.ayah);
    this.library.bookmarkAyah(v.surah, v.ayah, on).subscribe({
      next: () => this.notify.show(on ? `Saved ${v.surah}:${v.ayah}` : 'Bookmark removed'),
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  protected async more(v: Verse): Promise<void> {
    const followed = this.library.isFollowed(v.surah, v.ayah);
    const sheet = await this.sheets.create({
      header: `${this.surah()?.name} ${v.surah}:${v.ayah}`,
      buttons: [
        { text: 'Write a reflection', icon: 'create-outline', data: 'write' },
        { text: 'Read reflections', icon: 'chatbubbles-outline', data: 'read' },
        { text: followed ? 'Stop following this verse' : 'Follow this verse', icon: 'notifications-outline', data: 'follow' },
        { text: 'Copy', icon: 'copy-outline', data: 'copy' },
        { text: 'Share', icon: 'share-social-outline', data: 'share' },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<string>();
    switch (data) {
      case 'write':
        if (this.auth.requireLogin(`/reflections/new?surah=${v.surah}&ayah=${v.ayah}`)) {
          this.router.navigate(['/reflections/new'], { queryParams: { surah: v.surah, ayah: v.ayah } });
        }
        break;
      case 'read':
        this.router.navigate(['/reflections'], { queryParams: { surah: v.surah, ayah: v.ayah } });
        break;
      case 'follow':
        if (!this.auth.requireLogin()) return;
        this.library.followAyah(v.surah, v.ayah, !followed).subscribe({
          next: () => this.notify.show(followed ? 'Unfollowed' : 'New reflections on this verse will appear in your feed'),
          error: (err: unknown) => this.notify.show(errorMessage(err)),
        });
        break;
      case 'copy':
        this.notify.copy(this.verseText(v), `Copied ${v.surah}:${v.ayah}`);
        break;
      case 'share':
        this.notify.share(`${this.surah()?.name} ${v.surah}:${v.ayah}`, this.verseText(v));
        break;
    }
  }

  private verseText(v: Verse): string {
    return [v.textAr, v.translation, `— ${this.surah()?.name} ${v.surah}:${v.ayah}`].filter(Boolean).join('\n\n');
  }

  /* ---------- Position ---------- */

  private async scrollTo(ayah: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const content = this.content();
    const el = this.host.nativeElement.querySelector<HTMLElement>(`#ayah-${ayah}`);
    if (!content || !el) return;
    const scroller = await content.getScrollElement();
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 84;
    await content.scrollToPoint(0, Math.max(0, top), 500);
  }

  /** Remembers the first ayah on screen, on this device and (signed in) on the account. */
  private async trackReading(): Promise<void> {
    const s = this.surah();
    const content = this.content();
    if (!s || !content || this.verses.status() !== 'ready') return;
    this.observer?.disconnect();
    this.visible.clear();
    const root = await content.getScrollElement();
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset['ayah']);
          if (e.isIntersecting) this.visible.add(n);
          else this.visible.delete(n);
        }
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
          if (!this.visible.size) return;
          const ayah = Math.min(...this.visible);
          this.lastRead.save(s.number, ayah);
          this.syncToAccount(s.number, ayah);
        }, 1200);
      },
      { root, threshold: 0.6 },
    );
    this.host.nativeElement.querySelectorAll('[data-ayah]').forEach((el) => this.observer!.observe(el));
  }

  private syncToAccount(surah: number, ayah: number): void {
    if (!this.auth.user()) return;
    clearTimeout(this.syncTimer);
    const wait = Math.max(0, this.lastSync + SYNC_EVERY_MS - Date.now());
    this.syncTimer = setTimeout(() => {
      this.lastSync = Date.now();
      this.libraryApi.saveReading(surah, ayah, this.settings.arabicType()).subscribe({ error: () => undefined });
    }, wait);
  }
}
