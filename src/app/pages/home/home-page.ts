import { Component, computed, effect, inject, input, linkedSignal, OnInit, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonSegment,
  IonSegmentButton,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { map, Observable, Subscription } from 'rxjs';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { Page, ReadingStatus, Reflection } from '../../core/api/models';
import { QuranApi, VerseOfTheDay } from '../../core/api/quran-api';
import { ReflectionApi } from '../../core/api/reflection-api';
import { AuthService } from '../../core/auth/auth.service';
import { getSurah } from '../../core/quran/surahs';
import { LastReadService } from '../../core/settings/last-read.service';
import { LoadStatus, Loadable } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { AyahQuote } from '../../shared/ayah-quote';
import { Avatar } from '../../shared/avatar';
import { BrandMark } from '../../shared/brand-mark';
import { HeaderActions } from '../../shared/header-actions';
import { ReflectionCard } from '../../shared/reflection-card';
import { SideColumn } from '../../shared/side-column';
import { StateView } from '../../shared/state-view';

type Tab = 'foryou' | 'following';

const PAGE_SIZE = 20;
const BECAUSE: Record<string, string> = { user: 'someone you follow', ayah: 'an ayah you follow', reflection: 'a reflection you follow' };

interface Post {
  reflection: Reflection;
  because: string[];
}

/**
 * The timeline. "For you" is every reflection by recent activity
 * (GET /reflection/list); "Following" is GET /user/feed.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonRouterLink,
    IonRouterLinkWithHref,
    IonSegment,
    IonSegmentButton,
    IonToolbar,
    AuthPrompt,
    AyahQuote,
    Avatar,
    BrandMark,
    HeaderActions,
    ReflectionCard,
    SideColumn,
    StateView,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage implements OnInit {
  /** ?tab=following opens the Following tab (the old /feed link lands here). */
  readonly tabParam = input<string | undefined>(undefined, { alias: 'tab' });

  protected readonly auth = inject(AuthService);
  private readonly reflections = inject(ReflectionApi);
  private readonly library = inject(LibraryApi);
  private readonly quran = inject(QuranApi);
  protected readonly lastRead = inject(LastReadService);

  protected readonly tab = linkedSignal<Tab>(() => (this.tabParam() === 'following' ? 'following' : 'foryou'));
  protected readonly posts = signal<Post[]>([]);
  protected readonly total = signal(0);
  protected readonly status = signal<LoadStatus>('idle');
  protected readonly error = signal('');
  protected readonly hasMore = computed(() => this.posts().length < this.total());
  private page = 1;
  private sub?: Subscription;

  protected readonly votd = new Loadable<VerseOfTheDay>();
  protected readonly reading = signal<ReadingStatus | null>(null);
  /** Where to continue: the account's saved place, else this device's. */
  protected readonly resume = computed(() => {
    const p = this.reading()?.position ?? this.lastRead.position();
    const s = p ? getSurah(p.surah) : undefined;
    return s && p ? { surah: s.number, ayah: p.ayah, name: s.name } : null;
  });

  constructor() {
    effect(() => {
      this.tab();
      this.auth.user();
      untracked(() => this.reload());
    });
    effect(() => {
      if (this.auth.user()) {
        untracked(() => this.library.reading().subscribe({ next: (r) => this.reading.set(r), error: () => undefined }));
      } else {
        this.reading.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.votd.load(this.quran.verseOfTheDay());
  }

  protected setTab(value: unknown): void {
    if (value === 'foryou' || value === 'following') this.tab.set(value);
  }

  protected because(list: string[]): string {
    return list.map((b) => BECAUSE[b] ?? b).join(' and ');
  }

  /** Keeps the list in step with likes and bookmarks made on a card. */
  protected updated(r: Reflection): void {
    this.posts.update((list) => list.map((p) => (p.reflection.id === r.id ? { ...p, reflection: r } : p)));
  }

  protected reload(done?: () => void): void {
    this.sub?.unsubscribe();
    this.page = 1;
    if (this.tab() === 'following' && !this.auth.isLoggedIn()) {
      this.posts.set([]);
      this.status.set('ready');
      done?.();
      return;
    }
    this.status.set('loading');
    this.sub = this.source(1).subscribe({
      next: (res) => {
        this.posts.set(res.items);
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
    this.votd.refresh(this.quran.verseOfTheDay());
    this.reload(() => event.target.complete());
  }

  protected loadMore(event: InfiniteScrollCustomEvent): void {
    const next = this.page + 1;
    this.source(next).subscribe({
      next: (res) => {
        this.page = next;
        const seen = new Set(this.posts().map((p) => p.reflection.id));
        this.posts.update((list) => [...list, ...res.items.filter((p) => !seen.has(p.reflection.id))]);
        if (!res.items.length) this.total.set(this.posts().length);
        event.target.complete();
      },
      error: () => event.target.complete(),
    });
  }

  private source(page: number): Observable<Page<Post>> {
    if (this.tab() === 'following') return this.library.feed('activity', page, PAGE_SIZE);
    return this.reflections
      .list({ page, size: PAGE_SIZE, sort: 'activity' })
      .pipe(map((res) => ({ ...res, items: res.items.map((reflection) => ({ reflection, because: [] })) })));
  }
}
