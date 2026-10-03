import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
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
import { FollowEntry, UserSummary } from '../../core/api/models';
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
          } @else {
            @switch (follows.status()) {
              @case ('ready') {
                <ul class="list">
                  @for (f of visible(); track f.kind + f.target) {
                    <li class="row tb-tile">
                      @switch (f.kind) {
                        @case ('user') {
                          <app-avatar [name]="f.label" />
                          <a class="label" [routerLink]="['/users', f.target]">{{ '@' + f.label }}</a>
                        }
                        @case ('ayah') {
                          <span class="icon"><ion-icon name="book-outline" /></span>
                          <a class="label" [routerLink]="['/quran', f.target.split(':')[0]]" [queryParams]="{ ayah: f.target.split(':')[1] }">{{ ayahLabel(f.target) }}</a>
                        }
                        @default {
                          <span class="icon"><ion-icon name="chatbubbles-outline" /></span>
                          <a class="label" [routerLink]="['/reflections', f.target]">{{ f.label }}</a>
                        }
                      }
                      <ion-button size="small" fill="outline" (click)="unfollow(f)">Unfollow</ion-button>
                    </li>
                  } @empty {
                    <app-state-view state="empty" [message]="emptyMessage()" />
                  }
                </ul>
              }
              @case ('error') { <app-state-view state="error" [message]="follows.error()" (retry)="load()" /> }
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
    .icon { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--tb-chip-bg); color: var(--tb-gold); flex: none; }
  `,
})
export class FollowingPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LibraryApi);
  private readonly library = inject(LibraryService);
  private readonly notify = inject(NotifyService);

  protected readonly tab = signal<Tab>('user');
  protected readonly follows = new Loadable<FollowEntry[]>();
  protected readonly followers = new Loadable<UserSummary[]>();
  protected readonly visible = computed(() => (this.follows.data() ?? []).filter((f) => f.kind === this.tab()));
  protected readonly emptyMessage = computed(() => {
    switch (this.tab()) {
      case 'user':
        return "You don't follow anyone yet. Follow people from their profile page.";
      case 'ayah':
        return 'Follow a verse in the reader to see new reflections on it in your feed.';
      default:
        return 'Follow a reflection to hear about new comments on it.';
    }
  });

  constructor() {
    effect(() => {
      if (this.auth.user()) untracked(() => this.load());
    });
  }

  ionViewWillEnter(): void {
    if (this.auth.user()) this.load();
  }

  protected load(): void {
    this.follows.load(this.api.follows());
    this.followers.load(this.api.followers());
  }

  protected setTab(value: unknown): void {
    if (value === 'user' || value === 'ayah' || value === 'reflection' || value === 'followers') this.tab.set(value);
  }

  protected ayahLabel(target: string): string {
    const [s, a] = target.split(':').map(Number);
    return verseRef(s, a);
  }

  protected unfollow(f: FollowEntry): void {
    const before = this.follows.data() ?? [];
    this.follows.data.set(before.filter((x) => x !== f));
    const request =
      f.kind === 'user'
        ? this.library.followUser(f.target, false)
        : f.kind === 'ayah'
          ? this.library.followAyah(Number(f.target.split(':')[0]), Number(f.target.split(':')[1]), false)
          : this.api.follow('reflection', f.target, false);
    request.subscribe({
      error: (err: unknown) => {
        this.follows.data.set(before);
        this.notify.show(errorMessage(err));
      },
    });
  }
}
