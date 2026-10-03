import { Component, computed, effect, inject, input, OnInit, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
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
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { Observable, Subscription } from 'rxjs';
import { errorMessage } from '../../core/api/api-client';
import { Page, Reflection, ReflectionSort } from '../../core/api/models';
import { ReflectionApi, TagCloud } from '../../core/api/reflection-api';
import { getSurah } from '../../core/quran/surahs';
import { LoadStatus, Loadable } from '../../core/util/loadable';
import { ReflectionCard } from '../../shared/reflection-card';
import { StateView } from '../../shared/state-view';
import { HeaderActions } from '../../shared/header-actions';

const PAGE_SIZE = 20;

interface Filter {
  surah?: number;
  ayah?: number;
  tag?: string;
}

@Component({
  selector: 'app-reflections-page',
  imports: [
    RouterLink,
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
    IonTitle,
    IonToolbar,
    ReflectionCard,
    StateView,
    HeaderActions,
  ],
  templateUrl: './reflections-page.html',
  styleUrl: './reflections-page.scss',
})
export class ReflectionsPage implements OnInit {
  readonly surahParam = input<string | undefined>(undefined, { alias: 'surah' });
  readonly ayahParam = input<string | undefined>(undefined, { alias: 'ayah' });
  readonly tagParam = input<string | undefined>(undefined, { alias: 'tag' });

  private readonly api = inject(ReflectionApi);
  private sub?: Subscription;
  private page = 1;

  protected readonly sort = signal<ReflectionSort>('activity');
  protected readonly items = signal<Reflection[]>([]);
  protected readonly total = signal(0);
  protected readonly status = signal<LoadStatus>('idle');
  protected readonly error = signal('');
  protected readonly tags = new Loadable<TagCloud>();

  protected readonly filter = computed<Filter>(() => {
    const tag = this.tagParam()?.trim();
    if (tag) return { tag };
    const surah = getSurah(Number(this.surahParam()));
    if (!surah) return {};
    const ayah = Number(this.ayahParam());
    return Number.isInteger(ayah) && ayah >= 1 && ayah <= surah.ayahs ? { surah: surah.number, ayah } : { surah: surah.number };
  });

  protected readonly heading = computed(() => {
    const f = this.filter();
    if (f.tag) return `Tagged “${f.tag}”`;
    const s = getSurah(f.surah ?? 0);
    if (s && f.ayah) return `On ${s.name} ${s.number}:${f.ayah}`;
    if (s) return `On ${s.name}`;
    return 'Community reflections';
  });

  protected readonly writeParams = computed(() => {
    const f = this.filter();
    return f.surah ? { surah: f.surah, ayah: f.ayah ?? 1 } : {};
  });

  protected readonly hasFilter = computed(() => Object.keys(this.filter()).length > 0);
  protected readonly hasMore = computed(() => this.items().length < this.total());

  constructor() {
    effect(() => {
      this.filter();
      this.sort();
      untracked(() => this.reload());
    });
  }

  ngOnInit(): void {
    this.loadTags();
  }

  protected loadTags(): void {
    this.tags.load(this.api.tags());
  }

  protected setSort(value: unknown): void {
    const sorts: ReflectionSort[] = ['activity', 'newest', 'likes', 'comments'];
    if (sorts.includes(value as ReflectionSort)) this.sort.set(value as ReflectionSort);
  }

  protected reload(done?: () => void): void {
    this.sub?.unsubscribe();
    this.page = 1;
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
    const nextPage = this.page + 1;
    this.source(nextPage).subscribe({
      next: (res) => {
        this.page = nextPage;
        const seen = new Set(this.items().map((r) => r.id));
        this.items.update((list) => [...list, ...res.items.filter((r) => !seen.has(r.id))]);
        this.total.set(res.items.length ? res.total : this.items().length);
        event.target.complete();
      },
      error: () => event.target.complete(),
    });
  }

  private source(page: number): Observable<Page<Reflection>> {
    const f = this.filter();
    const q = { page, size: PAGE_SIZE, sort: this.sort() };
    if (f.tag) return this.api.byTag(f.tag, q);
    if (f.surah && f.ayah) return this.api.byAyah(f.surah, f.ayah, q);
    if (f.surah) return this.api.bySurah(f.surah, q);
    return this.api.list(q);
  }
}
