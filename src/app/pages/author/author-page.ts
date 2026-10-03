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
  IonRouterLink,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AccountApi } from '../../core/api/account-api';
import { errorMessage } from '../../core/api/api-client';
import { AuthorPage as AuthorData, ReflectionSort } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LibraryService } from '../../core/auth/library.service';
import { UserNamesService } from '../../core/auth/user-names.service';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { StateView } from '../../shared/state-view';

/** GET /user/<id>/reflections: someone's reflections, stats and a follow button. */
@Component({
  selector: 'app-author-page',
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
    IonRouterLink,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    Avatar,
    HeaderActions,
    ReflectionCard,
    StateView,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/reflections" text="" /></ion-buttons>
        <ion-title>{{ page.data() ? '@' + page.data()!.author.username : 'Profile' }}</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container tb-container--narrow">
        @switch (page.status()) {
          @case ('ready') {
            @let d = page.data()!;
            <section class="head tb-glass tb-pattern">
              <app-avatar [name]="d.author.username" [src]="d.author.pictureUrl" [size]="84" />
              <h1 class="tb-display">{{ '@' + d.author.username }}</h1>
              @if (d.author.deleted) {
                <p class="tb-muted">This account has been deleted.</p>
              }
              <dl class="stats">
                <div><dt>{{ d.stats.reflections }}</dt><dd>reflections</dd></div>
                <div><dt>{{ d.stats.likesReceived }}</dt><dd>likes received</dd></div>
                <div><dt>{{ followers() }}</dt><dd>followers</dd></div>
                @if (d.stats.following !== null) {
                  <div><dt>{{ d.stats.following }}</dt><dd>following</dd></div>
                }
              </dl>
              @if (isMe()) {
                <div class="actions">
                  <ion-button fill="outline" routerLink="/account">Edit profile</ion-button>
                  <ion-button class="tb-glow" routerLink="/reflections/new"><ion-icon slot="start" name="create-outline" />Write</ion-button>
                </div>
              } @else if (!d.author.deleted) {
                <ion-button [fill]="following() ? 'outline' : 'solid'" [class.tb-glow]="!following()" (click)="toggleFollow()" [disabled]="busy()">
                  <ion-icon slot="start" [name]="following() ? 'checkmark' : 'person-add-outline'" />
                  {{ following() ? 'Following' : 'Follow' }}
                </ion-button>
              }
            </section>

            <ion-segment class="tb-segment" [value]="sort()" (ionChange)="setSort($event.detail.value)">
              <ion-segment-button value="newest">Newest</ion-segment-button>
              <ion-segment-button value="likes">Most liked</ion-segment-button>
              <ion-segment-button value="comments">Discussed</ion-segment-button>
            </ion-segment>

            <div class="list">
              @for (r of d.reflections.items; track r.id) {
                <app-reflection-card [reflection]="r" />
              } @empty {
                <app-state-view state="empty" [message]="emptyText()" />
              }
            </div>
          }
          @case ('error') { <app-state-view state="error" [message]="page.error()" (retry)="load()" /> }
          @default { <app-state-view state="loading" [rows]="2" /> }
        }
      </div>
      <ion-infinite-scroll (ionInfinite)="more($event)" [disabled]="!hasMore()">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  `,
  styles: `
    .head { padding: 26px 20px; display: grid; justify-items: center; gap: 10px; text-align: center; }
    h1 { font-size: calc(28px * var(--tb-display-scale)); }
    .head p { margin: 0; }
    .stats { margin: 4px 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 22px; }
    .stats div { display: grid; }
    .stats dt { font-size: 22px; font-weight: 300; color: var(--tb-gold); font-variant-numeric: tabular-nums; }
    .stats dd { margin: 0; font-size: 12px; color: var(--tb-muted); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
    .list { display: grid; gap: 12px; }
  `,
})
export class AuthorPage {
  readonly id = input('');

  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly library = inject(LibraryService);
  private readonly notify = inject(NotifyService);
  private readonly names = inject(UserNamesService);

  protected readonly page = new Loadable<AuthorData>();
  protected readonly sort = signal<ReflectionSort>('newest');
  protected readonly busy = signal(false);
  private readonly followDelta = signal(0);
  private pageNo = 1;

  protected readonly isMe = computed(() => !!this.auth.user() && this.auth.user()!.id === this.id());
  protected readonly following = computed(
    () => this.page.data()?.author.followedByMe === true || this.library.followedUsers().has(this.id()),
  );
  protected readonly emptyText = computed(() =>
    this.isMe() ? "You haven't written a reflection yet." : 'No reflections yet.',
  );
  protected readonly followers = computed(() => (this.page.data()?.stats.followers ?? 0) + this.followDelta());
  protected readonly hasMore = computed(() => {
    const d = this.page.data();
    return !!d && d.reflections.items.length < d.reflections.total;
  });

  constructor() {
    effect(() => {
      this.sort();
      this.auth.user();
      if (this.id()) untracked(() => this.load());
    });
  }

  protected setSort(value: unknown): void {
    if (value === 'newest' || value === 'likes' || value === 'comments') this.sort.set(value);
  }

  protected load(): void {
    this.pageNo = 1;
    this.followDelta.set(0);
    this.page.load(this.api.authorPage(this.id(), this.sort()), () => {
      const author = this.page.data()?.author;
      if (author) this.names.remember(author);
    });
  }

  protected more(e: InfiniteScrollCustomEvent): void {
    this.api.authorPage(this.id(), this.sort(), this.pageNo + 1).subscribe({
      next: (res) => {
        this.pageNo++;
        this.page.data.update((d) =>
          d ? { ...d, reflections: { ...d.reflections, items: [...d.reflections.items, ...res.reflections.items] } } : d,
        );
        e.target.complete();
      },
      error: () => e.target.complete(),
    });
  }

  protected toggleFollow(): void {
    if (!this.auth.requireLogin()) return;
    const on = !this.following();
    this.busy.set(true);
    this.page.data.update((d) => (d ? { ...d, author: { ...d.author, followedByMe: on } } : d));
    this.followDelta.update((n) => n + (on ? 1 : -1));
    this.library.followUser(this.id(), on).subscribe({
      next: () => this.busy.set(false),
      error: (err: unknown) => {
        this.busy.set(false);
        this.page.data.update((d) => (d ? { ...d, author: { ...d.author, followedByMe: !on } } : d));
        this.followDelta.update((n) => n + (on ? -1 : 1));
        this.notify.show(errorMessage(err));
      },
    });
  }
}
