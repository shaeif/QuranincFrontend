import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
import { AuthorPage as AuthorData, Reflection, ReflectionSort } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LibraryService } from '../../core/auth/library.service';
import { UserNamesService } from '../../core/auth/user-names.service';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { SideColumn } from '../../shared/side-column';
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
    SideColumn,
    StateView,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/home" text="" /></ion-buttons>
        <ion-title>{{ page.data() ? '@' + page.data()!.author.username : 'Profile' }}</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-columns">
        <main class="tb-main">
          @switch (page.status()) {
            @case ('ready') {
              @let d = page.data()!;
              <section class="profile tb-glass">
                <div class="banner tb-pattern" aria-hidden="true"></div>
                <div class="top">
                  <app-avatar class="pic" [name]="d.author.username" [src]="d.author.pictureUrl" [size]="96" />
                  @if (isMe()) {
                    <div class="actions">
                      <ion-button fill="outline" size="small" routerLink="/account">Edit profile</ion-button>
                    </div>
                  } @else if (!d.author.deleted) {
                    <div class="actions">
                      <ion-button fill="outline" size="small" (click)="message()" aria-label="Message" title="Message">
                        <ion-icon slot="icon-only" name="mail-outline" />
                      </ion-button>
                      <ion-button size="small" [fill]="following() ? 'outline' : 'solid'" [class.tb-glow]="!following()" (click)="toggleFollow()" [disabled]="busy()">
                        {{ following() ? 'Following' : 'Follow' }}
                      </ion-button>
                    </div>
                  }
                </div>
                <div class="who">
                  <h1>{{ '@' + d.author.username }}</h1>
                  @if (d.author.deleted) {
                    <p class="tb-muted">This account has been deleted.</p>
                  }
                </div>
                <dl class="stats">
                  @if (d.stats.following !== null) {
                    <div><dt>{{ d.stats.following }}</dt><dd>Following</dd></div>
                  }
                  <div><dt>{{ followers() }}</dt><dd>{{ followers() === 1 ? 'Follower' : 'Followers' }}</dd></div>
                  <div><dt>{{ d.stats.reflections }}</dt><dd>{{ d.stats.reflections === 1 ? 'Reflection' : 'Reflections' }}</dd></div>
                  <div><dt>{{ d.stats.likesReceived }}</dt><dd>Likes</dd></div>
                </dl>
              </section>

              <ion-segment class="tb-tabs" mode="md" [value]="sort()" (ionChange)="setSort($event.detail.value)" aria-label="Order">
                <ion-segment-button value="newest">Latest</ion-segment-button>
                <ion-segment-button value="likes">Top</ion-segment-button>
                <ion-segment-button value="comments">Discussed</ion-segment-button>
              </ion-segment>

              <div class="tb-timeline">
                @for (r of d.reflections.items; track r.id) {
                  <app-reflection-card [reflection]="r" (changed)="updated($event)" />
                } @empty {
                  <app-state-view state="empty" [message]="emptyText()">
                    @if (isMe()) {
                      <ion-button fill="outline" routerLink="/reflections/new">Write a reflection</ion-button>
                    }
                  </app-state-view>
                }
              </div>
            }
            @case ('error') { <app-state-view state="error" [message]="page.error()" (retry)="load()" /> }
            @default { <app-state-view state="loading" [rows]="2" /> }
          }
        </main>

        <app-side-column />
      </div>
      <ion-infinite-scroll (ionInfinite)="more($event)" [disabled]="!hasMore()">
        <ion-infinite-scroll-content />
      </ion-infinite-scroll>
    </ion-content>
  `,
  styles: `
    .profile { overflow: hidden; padding: 0 0 14px; display: grid; }
    .banner { height: 120px; background: var(--tb-accent-gradient); opacity: .55; }
    .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding: 0 16px; margin-top: -48px; }
    .pic { box-shadow: 0 0 0 4px var(--tb-bg); }
    .actions { display: flex; gap: 8px; padding-bottom: 4px; }
    .who { padding: 10px 16px 0; display: grid; gap: 2px; }
    h1 { margin: 0; font-size: 21px; font-weight: 800; overflow-wrap: anywhere; }
    .who p { margin: 0; font-size: 14px; }
    .stats { margin: 12px 0 0; padding: 0 16px; display: flex; flex-wrap: wrap; gap: 6px 18px; }
    .stats div { display: flex; gap: 4px; align-items: baseline; }
    .stats dt { font-weight: 800; font-variant-numeric: tabular-nums; }
    .stats dd { margin: 0; font-size: 14px; color: var(--tb-muted); }
  `,
})
export class AuthorPage {
  readonly id = input('');

  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  private readonly library = inject(LibraryService);
  private readonly notify = inject(NotifyService);
  private readonly names = inject(UserNamesService);
  private readonly router = inject(Router);

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

  /** Keeps the list in step with likes and bookmarks made on a card. */
  protected updated(r: Reflection): void {
    this.page.data.update((d) =>
      d ? { ...d, reflections: { ...d.reflections, items: d.reflections.items.map((x) => (x.id === r.id ? r : x)) } } : d,
    );
  }

  protected message(): void {
    const next = `/messages/new?to=${encodeURIComponent(this.id())}`;
    if (this.auth.requireLogin(next)) this.router.navigateByUrl(next);
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
