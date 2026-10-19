import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { LikedVerse, Page } from '../core/api/models';
import { QuranApi, VerseOfTheDay } from '../core/api/quran-api';
import { ReflectionApi, TagCloud } from '../core/api/reflection-api';
import { verseRef } from '../core/quran/surahs';
import { Loadable } from '../core/util/loadable';
import { AyahQuote } from './ayah-quote';

/** Same breakpoint as .tb-aside in global.scss. */
const WIDE = '(min-width: 1200px)';

/** Right-hand column on wide screens: search, verse of the day, trending topics, most-loved verses. */
@Component({
  selector: 'app-side-column',
  imports: [RouterLink, IonIcon, AyahQuote],
  host: { class: 'tb-aside', role: 'complementary', 'aria-label': 'Discover' },
  template: `
    <form class="search" role="search" (submit)="search($event, q.value)">
      <ion-icon name="search-outline" aria-hidden="true" />
      <input #q type="search" name="q" placeholder="Search the Quran and reflections" aria-label="Search" />
    </form>

    @if (votd.status() === 'ready') {
      @let v = votd.data()!;
      <section class="box tb-glass">
        <h2>Verse of the day</h2>
        <app-ayah-quote [surah]="v.verse.surah" [ayah]="v.verse.ayah" />
        <a class="more" [routerLink]="['/ayah', v.verse.surah, v.verse.ayah]">
          {{ v.reflections.total ? v.reflections.total + ' reflections' : 'Be the first to reflect' }}
        </a>
      </section>
    }

    @if (tags.status() === 'ready' && tags.data()!.tags.length) {
      <section class="box tb-glass">
        <h2>Trending topics</h2>
        <ol class="rows">
          @for (t of tags.data()!.tags.slice(0, 6); track t.tag) {
            <li>
              <a class="row" routerLink="/reflections" [queryParams]="{ tag: t.tag }">
                <b>#{{ t.tag }}</b>
                <small class="tb-muted">{{ t.count }} {{ t.count === 1 ? 'reflection' : 'reflections' }}</small>
              </a>
            </li>
          }
        </ol>
        <a class="more" routerLink="/reflections">Explore</a>
      </section>
    }

    @if (liked.status() === 'ready' && liked.data()!.items.length) {
      <section class="box tb-glass">
        <h2>Most-loved verses</h2>
        <ol class="rows">
          @for (v of liked.data()!.items; track v.surah + ':' + v.ayah) {
            <li>
              <a class="row" [routerLink]="['/ayah', v.surah, v.ayah]">
                <b>{{ verseRef(v.surah, v.ayah) }}</b>
                @if (v.translation) {
                  <small class="tb-muted clamp">{{ v.translation }}</small>
                }
              </a>
            </li>
          }
        </ol>
      </section>
    }

    <p class="foot tb-muted">
      <a routerLink="/quran">Quran</a> · <a routerLink="/settings">Settings</a>
    </p>
  `,
  styles: `
    :host { gap: 16px; }
    .search {
      display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 44px;
      border-radius: 999px; background: var(--tb-field); border: 1px solid var(--tb-line);
    }
    .search:focus-within { border-color: var(--tb-gold-soft); }
    .search ion-icon { color: var(--tb-gold); font-size: 18px; flex: none; }
    .search input { flex: 1; min-width: 0; border: 0; outline: 0; background: none; color: var(--tb-fg); font: inherit; font-size: 14px; }
    .box { padding: 14px 16px; display: grid; gap: 10px; }
    h2 { margin: 0; font-size: 17px; font-weight: 800; }
    .rows { list-style: none; margin: 0 -16px; padding: 0; display: grid; }
    .row { display: grid; gap: 2px; padding: 8px 16px; text-decoration: none; color: var(--tb-fg); }
    .row:hover { background: var(--tb-field); }
    .row b { font-size: 14px; }
    .row small { font-size: 12.5px; }
    .clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .more { font-size: 13.5px; font-weight: 600; text-decoration: none; }
    .foot { margin: 0; padding: 0 16px; font-size: 12.5px; }
    .foot a { color: inherit; text-decoration: none; }
    .foot a:hover { text-decoration: underline; }
  `,
})
export class SideColumn implements OnInit {
  private readonly quran = inject(QuranApi);
  private readonly reflections = inject(ReflectionApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly verseRef = verseRef;

  protected readonly votd = new Loadable<VerseOfTheDay>();
  protected readonly tags = new Loadable<TagCloud>();
  protected readonly liked = new Loadable<Page<LikedVerse>>();

  ngOnInit(): void {
    // The column is hidden on narrower screens; load it only once it shows.
    const wide = window.matchMedia(WIDE);
    if (wide.matches) return this.load();
    const onChange = () => {
      if (!wide.matches) return;
      wide.removeEventListener('change', onChange);
      this.load();
    };
    wide.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => wide.removeEventListener('change', onChange));
  }

  private load(): void {
    this.votd.load(this.quran.verseOfTheDay());
    this.tags.load(this.reflections.tags());
    this.liked.load(this.quran.mostLiked({ size: 3 }));
  }

  protected search(event: Event, q: string): void {
    event.preventDefault();
    if (q.trim()) this.router.navigate(['/search'], { queryParams: { q: q.trim() } });
  }
}
