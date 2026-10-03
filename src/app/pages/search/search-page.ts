import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRouterLinkWithHref,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { map, Observable, Subscription } from 'rxjs';
import { errorMessage } from '../../core/api/api-client';
import { Reflection, SearchVerse } from '../../core/api/models';
import { QuranApi } from '../../core/api/quran-api';
import { SearchApi, SearchEverything } from '../../core/api/search-api';
import { verseRef } from '../../core/quran/surahs';
import { LoadStatus, Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { ReflectionCard } from '../../shared/reflection-card';
import { StateView } from '../../shared/state-view';
import { HeaderActions } from '../../shared/header-actions';

type Mode = 'all' | 'quran' | 'reflections';
const PAGE_SIZE = 20;

interface ListPage<T> {
  items: T[];
  total: number;
}

@Component({
  selector: 'app-search-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    IonButtons,
    IonContent,
    IonHeader,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRouterLinkWithHref,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    Avatar,
    ReflectionCard,
    StateView,
    HeaderActions,
  ],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
})
export class SearchPage {
  /** ?q= keeps searches shareable and survives a reload. */
  readonly qParam = input<string | undefined>(undefined, { alias: 'q' });

  private readonly router = inject(Router);
  private readonly quranApi = inject(QuranApi);
  private readonly searchApi = inject(SearchApi);
  private sub?: Subscription;
  private page = 1;

  protected readonly verseRef = verseRef;
  protected readonly mode = signal<Mode>('all');
  protected readonly query = computed(() => (this.qParam() ?? '').trim().slice(0, 200));

  protected readonly all = new Loadable<SearchEverything>();
  protected readonly verses = signal<SearchVerse[]>([]);
  protected readonly reflections = signal<Reflection[]>([]);
  protected readonly total = signal(0);
  protected readonly status = signal<LoadStatus>('idle');
  protected readonly error = signal('');

  protected readonly hasMore = computed(() => {
    const shown = this.mode() === 'quran' ? this.verses().length : this.reflections().length;
    return shown < this.total();
  });

  protected readonly suggestions = [
    { q: 'mercy', label: 'mercy' },
    { q: 'الصبر', label: 'الصبر · patience' },
    { q: '"light upon light"', label: '“light upon light”' },
    { q: 'gratitude', label: 'gratitude' },
    { q: 'الجنة', label: 'الجنة · paradise' },
    { q: 'forgive', label: 'forgive' },
  ];

  constructor() {
    effect(() => {
      const q = this.query();
      const mode = this.mode();
      untracked(() => this.run(q, mode));
    });
  }

  protected onInput(value: string | null | undefined): void {
    const q = (value ?? '').trim();
    this.router.navigate([], { queryParams: { q: q || null }, replaceUrl: true });
  }

  protected setMode(value: unknown): void {
    this.mode.set(value === 'quran' || value === 'reflections' ? value : 'all');
  }

  protected retry(): void {
    this.run(this.query(), this.mode());
  }

  private run(q: string, mode: Mode): void {
    this.sub?.unsubscribe();
    this.all.cancel();
    this.page = 1;
    if (!q) {
      this.status.set('idle');
      this.all.status.set('idle');
      return;
    }
    if (mode === 'all') {
      this.all.load(this.searchApi.everything(q));
      return;
    }
    this.status.set('loading');
    this.sub = this.fetch(q, mode, 1).subscribe({
      next: (res) => {
        if (mode === 'quran') this.verses.set(res.items as SearchVerse[]);
        else this.reflections.set(res.items as Reflection[]);
        this.total.set(res.total);
        this.status.set('ready');
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.status.set('error');
      },
    });
  }

  protected loadMore(event: InfiniteScrollCustomEvent): void {
    const mode = this.mode();
    if (mode === 'all') {
      event.target.complete();
      return;
    }
    const next = this.page + 1;
    this.fetch(this.query(), mode, next).subscribe({
      next: (res) => {
        this.page = next;
        if (mode === 'quran') this.verses.update((v) => [...v, ...(res.items as SearchVerse[])]);
        else this.reflections.update((r) => [...r, ...(res.items as Reflection[])]);
        if (!res.items.length) this.total.set(mode === 'quran' ? this.verses().length : this.reflections().length);
        event.target.complete();
      },
      error: () => event.target.complete(),
    });
  }

  private fetch(q: string, mode: 'quran' | 'reflections', page: number): Observable<ListPage<SearchVerse | Reflection>> {
    if (mode === 'quran') {
      return this.quranApi.search(q, { page, size: PAGE_SIZE }).pipe(map((res) => ({ items: res.results, total: res.total })));
    }
    return this.searchApi
      .everything(q, { section: 'reflections', page, size: PAGE_SIZE })
      .pipe(map((res) => ({ items: res.reflections.items, total: res.reflections.total })));
  }
}
