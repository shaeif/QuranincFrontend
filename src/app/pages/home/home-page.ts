import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
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
import { LibraryApi } from '../../core/api/library-api';
import { ReadingStatus } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationBadgeService } from '../../core/auth/notification-badge.service';
import { ChatSyncService } from '../../core/chat/chat-sync.service';
import { LastReadService } from '../../core/settings/last-read.service';
import { hijriDate, partOfDay } from '../../core/util/format';
import { Loadable } from '../../core/util/loadable';
import { AyahMarker } from '../../shared/ayah-marker';
import { BrandMark } from '../../shared/brand-mark';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { StarNumber } from '../../shared/star-number';
import { StateView } from '../../shared/state-view';
import { HeaderActions } from '../../shared/header-actions';

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
    HeaderActions,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit {
  private readonly quran = inject(QuranApi);
  private readonly notify = inject(NotifyService);
  protected readonly lastRead = inject(LastReadService);
  protected readonly auth = inject(AuthService);
  protected readonly chats = inject(ChatSyncService);
  protected readonly notes = inject(NotificationBadgeService);
  private readonly library = inject(LibraryApi);
  protected readonly reading = signal<ReadingStatus | null>(null);
  /** Where to continue: the account's saved place, else this device's. */
  protected readonly resume = computed(() => {
    const p = this.reading()?.position ?? this.lastRead.position();
    const s = p ? getSurah(p.surah) : undefined;
    return s && p ? { surah: s.number, ayah: p.ayah, name: s.name } : null;
  });
  protected readonly firstName = computed(() => {
    const u = this.auth.user();
    return u ? u.firstName || u.username : '';
  });

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

  constructor() {
    effect(() => {
      if (this.auth.user()) {
        untracked(() => this.library.reading().subscribe({ next: (r) => this.reading.set(r), error: () => undefined }));
      } else {
        this.reading.set(null);
      }
    });
  }

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

}
