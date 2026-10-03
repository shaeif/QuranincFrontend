import { Component, effect, inject, signal, untracked } from '@angular/core';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { FollowEntry, LikedVerse, UserSummary } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { LibraryService } from '../../core/auth/library.service';
import { verseRef } from '../../core/quran/surahs';
import { Loadable } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { StateView } from '../../shared/state-view';

type Tab = 'user' | 'ayah' | 'reflection' | 'followers';

/** People, verses and reflections you follow, and who follows you. Only you can see these lists. */
@Component({
  selector: 'app-following-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    AuthPrompt,
    Avatar,
    HeaderActions,
    StateView,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/you" text="" /></ion-buttons>
        <ion-title>Following</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt next="/following" />
        } @else {
          <section class="tb-page-intro tb-pattern">
            <p class="tb-eyebrow">Only you can see these lists</p>
            <h1 class="tb-display">Following</h1>
            <ion-segment class="tb-segment" [value]="tab()" (ionChange)="setTab($event.detail.value)" [scrollable]="true">
              <ion-segment-button value="user">People</ion-segment-button>
              <ion-segment-button value="ayah">Verses</ion-segment-button>
              <ion-segment-button value="reflection">Reflections</ion-segment-button>
              <ion-segment-button value="followers">Followers</ion-segment-button>
            </ion-segment>
          </section>

          @if (tab() === 'followers') {
            @switch (followers.status()) {
              @case ('ready') {
                <ul class="list">
                  @for (u of followers.data()!; track u.id) {
                    <li class="row tb-tile">
                      <app-avatar [name]="u.username" [src]="u.pictureUrl" />
                      <a class="label" [routerLink]="['/users', u.id]">{{ '@' + u.username }}</a>
                    </li>
                  } @empty {
                    <app-state-view state="empty" message="No followers yet. Share reflections and people will find you." />
                  }
                </ul>
              }
              @case ('error') { <app-state-view state="error" [message]="followers.error()" (retry)="load()" /> }
              @default { <app-state-view state="loading" /> }
            }
          } @else if (tab() === 'user') {
            @switch (users.status()) {
              @case ('ready') {
                <ul class="list">
                  @for (u of users.data()!; track u.id) {
                    <li class="row tb-tile">
                      <app-avatar [name]="u.username" [src]="u.pictureUrl" />
                      <a class="label" [routerLink]="['/users', u.id]">{{ '@' + u.username }}</a>
                      <ion-button size="small" fill="outline" (click)="unfollowUser(u)">Unfollow</ion-button>
                    </li>
                  } @empty {
                    <app-state-view state="empty" message="You don't follow anyone yet. Follow people from their profile page." />
                  }
                </ul>
              }
              @case ('error') { <app-state-view state="error" [message]="users.error()" (retry)="load()" /> }
              @default { <app-state-view state="loading" /> }
            }
          } @else if (tab() === 'ayah') {
            @switch (ayahs.status()) {
              @case ('ready') {
                <ul class="list">
                  @for (v of ayahs.data()!; track v.surah + ':' + v.ayah) {
                    <li class="row tb-tile">
                      <span class="icon"><ion-icon name="book-outline" /></span>
                      <a class="label" [routerLink]="['/quran', v.surah]" [queryParams]="{ ayah: v.ayah }">
                        {{ ayahLabel(v.surah, v.ayah) }}
                        @if (v.translation) {
                          <small class="tb-muted">{{ v.translation }}</small>
                        }
                      </a>
                      <ion-button size="small" fill="outline" (click)="unfollowAyah(v)">Unfollow</ion-button>
                    </li>
                  } @empty {
                    <app-state-view state="empty" message="Follow a verse in the reader to see new reflections on it in your feed." />
                  }
                </ul>
              }
              @case ('error') { <app-state-view state="error" [message]="ayahs.error()" (retry)="load()" /> }
              @default { <app-state-view state="loading" /> }
            }
          } @else {
            @switch (reflections.status()) {
              @case ('ready') {
                <ul class="list">
                  @for (f of reflections.data()!; track f.target) {
                    <li class="row tb-tile">
                      <span class="icon"><ion-icon name="chatbubbles-outline" /></span>
                      @if (f.unavailable) {
                        <span class="label tb-muted">{{ f.label }}</span>
                      } @else {
                        <a class="label" [routerLink]="['/reflections', f.target]">{{ f.label }}</a>
                      }
                      <ion-button size="small" fill="outline" (click)="unfollowReflection(f)">Unfollow</ion-button>
                    </li>
                  } @empty {
                    <app-state-view state="empty" message="Follow a reflection to see it in your feed when it gets new likes or comments." />
                  }
                </ul>
              }
              @case ('error') { <app-state-view state="error" [message]="reflections.error()" (retry)="load()" /> }
              @default { <app-state-view state="loading" /> }
            }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
    .label { flex: 1; min-width: 0; color: var(--tb-fg); font-weight: 600; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label small { display: block; font-weight: 400; font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
    .icon { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--tb-chip-bg); color: var(--tb-gold); flex: none; }
  `,
})
export class FollowingPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LibraryApi);
  private readonly library = inject(LibraryService);
  private readonly notify = inject(NotifyService);

  protected readonly tab = signal<Tab>('user');
  protected readonly users = new Loadable<UserSummary[]>();
  protected readonly ayahs = new Loadable<LikedVerse[]>();
  protected readonly reflections = new Loadable<FollowEntry[]>();
  protected readonly followers = new Loadable<UserSummary[]>();

  constructor() {
    effect(() => {
      if (this.auth.user()) untracked(() => this.load());
    });
  }

  ionViewWillEnter(): void {
    if (this.auth.user()) this.load();
  }

  protected load(): void {
    this.users.load(this.api.followedUsers());
    this.ayahs.load(this.api.followedAyahs());
    this.reflections.load(this.api.followedReflections());
    this.followers.load(this.api.followers());
  }

  protected setTab(value: unknown): void {
    if (value === 'user' || value === 'ayah' || value === 'reflection' || value === 'followers') this.tab.set(value);
  }

  protected ayahLabel(surah: number, ayah: number): string {
    return verseRef(surah, ayah);
  }

  protected unfollowUser(u: UserSummary): void {
    this.remove(this.users, (x) => x !== u, this.library.followUser(u.id, false));
  }

  protected unfollowAyah(v: LikedVerse): void {
    this.remove(this.ayahs, (x) => x !== v, this.library.followAyah(v.surah, v.ayah, false));
  }

  protected unfollowReflection(f: FollowEntry): void {
    this.remove(this.reflections, (x) => x !== f, this.api.follow('reflection', f.target, false));
  }

  /** Takes the row out straight away and puts the list back if the request fails. */
  private remove<T>(list: Loadable<T[]>, keep: (item: T) => boolean, request: Observable<unknown>): void {
    const before = list.data() ?? [];
    list.data.set(before.filter(keep));
    request.subscribe({
      error: (err: unknown) => {
        list.data.set(before);
        this.notify.show(errorMessage(err));
      },
    });
  }
}
