import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  InfiniteScrollCustomEvent,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { FeedItem, ReflectionSort } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LoadStatus } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { HeaderActions } from '../../shared/header-actions';
import { ReflectionCard } from '../../shared/reflection-card';
import { StateView } from '../../shared/state-view';

const SIZE = 20;
const BECAUSE: Record<string, string> = { user: 'a person you follow', ayah: 'a verse you follow', reflection: 'new activity' };

/** GET /user/feed: reflections from people, verses and reflections you follow. */
@Component({
  selector: 'app-feed-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonRouterLink,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    AuthPrompt,
    HeaderActions,
    ReflectionCard,
    StateView,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/you" text="" /></ion-buttons>
        <ion-title>Your feed</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content /></ion-refresher>
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt title="A feed of your own" message="Follow people and verses, and their new reflections gather here." next="/feed" />
        } @else {
          <section class="tb-page-intro tb-pattern">
            <p class="tb-eyebrow">From who and what you follow</p>
            <h1 class="tb-display">Your feed</h1>
            <ion-segment class="tb-segment" [value]="sort()" (ionChange)="setSort($event.detail.value)">
              <ion-segment-button value="activity">Active</ion-segment-button>
              <ion-segment-button value="newest">Newest</ion-segment-button>
              <ion-segment-button value="likes">Most liked</ion-segment-button>
            </ion-segment>
          </section>
          @switch (status()) {
            @case ('ready') {
              <div class="list">
                @for (item of items(); track item.reflection.id) {
                  <div class="item">
                    @if (item.because.length) {
                      <p class="because tb-muted">Because of {{ because(item.because) }}</p>
                    }
                    <app-reflection-card [reflection]="item.reflection" />
                  </div>
                } @empty {
                  <app-state-view state="empty" message="Your feed is empty. Follow a verse in the reader, or people from their profile, to fill it.">
                    <ion-button fill="outline" routerLink="/reflections">Find reflections</ion-button>
                  </app-state-view>
                }
              </div>
            }
            @case ('error') { <app-state-view state="error" [message]="error()" (retry)="load()" /> }
            @default { <app-state-view state="loading" /> }
          }
        }
      </div>
      <ion-infinite-scroll (ionInfinite)="more($event)" [disabled]="status() !== 'ready' || items().length >= total()">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  `,
  styles: `
    .list { display: grid; gap: 14px; }
    .item { display: grid; gap: 6px; }
    .because { margin: 0 4px; font-size: 12px; }
  `,
})
export class FeedPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LibraryApi);
  protected readonly sort = signal<ReflectionSort>('activity');
  protected readonly items = signal<FeedItem[]>([]);
  protected readonly total = signal(0);
  protected readonly status = signal<LoadStatus>('idle');
  protected readonly error = signal('');
  private page = 1;

  constructor() {
    effect(() => {
      this.sort();
      if (this.auth.user()) untracked(() => this.load());
    });
  }

  protected setSort(value: unknown): void {
    if (value === 'activity' || value === 'newest' || value === 'likes') this.sort.set(value);
  }

  protected because(list: string[]): string {
    return list.map((b) => BECAUSE[b] ?? b).join(' and ');
  }

  protected load(done?: () => void): void {
    this.page = 1;
    this.status.set('loading');
    this.api.feed(this.sort(), 1, SIZE).subscribe({
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

  protected refresh(e: RefresherCustomEvent): void {
    this.load(() => e.target.complete());
  }

  protected more(e: InfiniteScrollCustomEvent): void {
    this.api.feed(this.sort(), this.page + 1, SIZE).subscribe({
      next: (res) => {
        this.page++;
        this.items.update((list) => [...list, ...res.items]);
        if (!res.items.length) this.total.set(this.items().length);
        e.target.complete();
      },
      error: () => e.target.complete(),
    });
  }
}
