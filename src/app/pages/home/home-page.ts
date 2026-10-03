import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { LikedVerse, Page } from '../../core/api/models';
import { QuranApi, VerseOfTheDay } from '../../core/api/quran-api';
import { getSurah, SURAHS, TOTAL_AYAHS, verseRef } from '../../core/quran/surahs';
import { LastReadService } from '../../core/settings/last-read.service';
import { hijriDate, partOfDay } from '../../core/util/format';
import { Loadable } from '../../core/util/loadable';
import { AyahMarker } from '../../shared/ayah-marker';
import { BrandMark } from '../../shared/brand-mark';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { StarNumber } from '../../shared/star-number';
import { StateView } from '../../shared/state-view';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonRouterLink,
    IonRouterLinkWithHref,
    IonToolbar,
    AyahMarker,
    BrandMark,
    ReflectionCard,
    StarNumber,
    StateView,
    ThemeToggle,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit {
  private readonly quran = inject(QuranApi);
  private readonly notify = inject(NotifyService);
  protected readonly lastRead = inject(LastReadService);

  protected readonly votd = new Loadable<VerseOfTheDay>();
  protected readonly mostLiked = new Loadable<Page<LikedVerse>>();

  protected readonly greeting = partOfDay();
  protected readonly hijri = hijriDate();
  protected readonly today = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  protected readonly surahCount = SURAHS.length;
  protected readonly ayahCount = TOTAL_AYAHS.toLocaleString('en');
  protected readonly verseRef = verseRef;
  protected readonly getSurah = getSurah;

  protected readonly verse = computed(() => this.votd.data()?.verse);
  protected readonly verseSurah = computed(() => getSurah(this.verse()?.surah ?? 0));
  protected readonly continueSurah = computed(() => getSurah(this.lastRead.position()?.surah ?? 0));

  ngOnInit(): void {
    this.loadVerse();
    this.loadMostLiked();
  }

  protected loadVerse(): void {
    this.votd.load(this.quran.verseOfTheDay());
  }

  protected loadMostLiked(): void {
    this.mostLiked.load(this.quran.mostLiked({ size: 5 }));
  }

  protected refresh(event: RefresherCustomEvent): void {
    forkJoin([this.quran.verseOfTheDay(), this.quran.mostLiked({ size: 5 })]).subscribe({
      next: ([v, m]) => {
        this.votd.data.set(v);
        this.votd.status.set('ready');
        this.mostLiked.data.set(m);
        this.mostLiked.status.set('ready');
      },
      error: () => {
        this.loadVerse();
        this.loadMostLiked();
        event.target.complete();
      },
      complete: () => event.target.complete(),
    });
  }

  protected shareVerse(): void {
    const v = this.verse();
    if (!v) return;
    const text = `${v.textAr}\n\n${v.translation}\n— ${verseRef(v.surah, v.ayah)}`;
    this.notify.share('Verse of the day', text);
  }

  protected join(): void {
    this.notify.show('Sign-up opens in the next update, in shā’ Allāh.');
  }
}
