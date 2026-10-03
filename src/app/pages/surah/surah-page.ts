import { Component, computed, DestroyRef, effect, ElementRef, inject, input, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { map } from 'rxjs';
import { Verse } from '../../core/api/models';
import { QuranApi } from '../../core/api/quran-api';
import { BISMILLAH, BISMILLAH_EN, showsBismillah, stripLeadingBismillah } from '../../core/quran/bismillah';
import { getSurah } from '../../core/quran/surahs';
import { LastReadService } from '../../core/settings/last-read.service';
import { ARABIC_SIZE, ReadingSettingsService } from '../../core/settings/reading-settings.service';
import { Loadable } from '../../core/util/loadable';
import { AyahMarker } from '../../shared/ayah-marker';
import { NotifyService } from '../../shared/notify.service';
import { StateView } from '../../shared/state-view';
import { ThemeToggle } from '../../shared/theme-toggle';

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
    IonTitle,
    IonToolbar,
    AyahMarker,
    StateView,
    ThemeToggle,
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
  private readonly notify = inject(NotifyService);
  private readonly lastRead = inject(LastReadService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly settings = inject(ReadingSettingsService);
  protected readonly sizes = ARABIC_SIZE;

  private readonly content = viewChild(IonContent);
  private observer?: IntersectionObserver;
  private saveTimer?: ReturnType<typeof setTimeout>;
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
      if (s) untracked(() => this.load());
    });
    effect(() => {
      const ayah = this.focusAyah();
      if (ayah && this.verses.status() === 'ready') untracked(() => this.scrollTo(ayah));
    });
    inject(DestroyRef).onDestroy(() => {
      this.observer?.disconnect();
      clearTimeout(this.saveTimer);
    });
  }

  protected load(): void {
    const s = this.surah();
    if (!s) return;
    this.verses.load(
      this.quran.surahVerses(s.number).pipe(
        map((list) => list.map((v) => ({ ...v, textAr: stripLeadingBismillah(v.surah, v.ayah, v.textAr) }))),
      ),
      () => setTimeout(() => this.trackReading(), 0),
    );
  }

  protected copy(v: Verse): void {
    const s = this.surah();
    const text = `${v.textAr}\n\n${v.translation}\n— ${s?.name} ${v.surah}:${v.ayah}`;
    this.notify.copy(text, `Copied ${v.surah}:${v.ayah}`);
  }

  protected changeSize(delta: number): void {
    this.settings.setArabicSize(this.settings.arabicSize() + delta * ARABIC_SIZE.step);
  }

  private async scrollTo(ayah: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 60));
    const content = this.content();
    const el = this.host.nativeElement.querySelector<HTMLElement>(`#ayah-${ayah}`);
    if (!content || !el) return;
    const scroller = await content.getScrollElement();
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 84;
    await content.scrollToPoint(0, Math.max(0, top), 500);
  }

  /** Remembers the first ayah on screen as the place to continue from. */
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
          if (this.visible.size) this.lastRead.save(s.number, Math.min(...this.visible));
        }, 1200);
      },
      { root, threshold: 0.6 },
    );
    this.host.nativeElement.querySelectorAll('[data-ayah]').forEach((el) => this.observer!.observe(el));
  }
}
