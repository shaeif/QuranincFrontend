import { Component, computed, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { ReadingHistoryEntry, ReadingStatus } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { getSurah, verseRef } from '../../core/quran/surahs';
import { timeAgo } from '../../core/util/format';
import { Loadable } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { StateView } from '../../shared/state-view';

interface ReadingData {
  status: ReadingStatus;
  history: ReadingHistoryEntry[];
}

/** Streak, where you stopped, and the last 50 places you read (GET /user/reading-progress). */
@Component({
  selector: 'app-reading-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRouterLink,
    IonRouterLinkWithHref,
    IonTitle,
    IonToolbar,
    AuthPrompt,
    HeaderActions,
    StateView,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/you" text="" /></ion-buttons>
        <ion-title>Reading</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt title="Build a daily habit" message="Log in and the reader keeps your place and your reading streak across devices." next="/reading" />
        } @else {
          @switch (data.status()) {
            @case ('ready') {
              @let d = data.data()!;
              <section class="streak tb-glass tb-pattern">
                <div class="big" [class.lit]="d.status.streak.readToday">
                  <ion-icon [name]="d.status.streak.readToday ? 'flame' : 'flame-outline'" aria-hidden="true" />
                  <span class="num">{{ d.status.streak.current }}</span>
                </div>
                <div>
                  <h1 class="tb-display">{{ d.status.streak.current }}-day streak</h1>
                  <p class="tb-muted">
                    Longest: {{ d.status.streak.longest }} days.
                    {{ d.status.streak.readToday ? 'You have read today.' : 'Read any ayah today to keep it going.' }}
                  </p>
                  @if (d.status.streak.timeZone) {
                    <p class="tb-muted small">Days are counted in {{ d.status.streak.timeZone }}.</p>
                  }
                </div>
              </section>

              @if (d.status.position; as p) {
                <section class="tb-section">
                  <div class="tb-section-head"><h2>Where you stopped</h2></div>
                  <a class="here tb-tile" [routerLink]="['/quran', p.surah]" [queryParams]="{ ayah: p.ayah }">
                    @if (p.textAr) {
                      <span class="ar tb-quran" lang="ar">{{ p.textAr }}</span>
                    }
                    @if (p.translation) {
                      <span class="en">{{ p.translation }}</span>
                    }
                    <span class="ref">Continue at {{ ref(p.surah, p.ayah) }} <ion-icon name="arrow-forward" /></span>
                  </a>
                </section>
              }

              <section class="tb-section">
                <div class="tb-section-head"><h2>Recently read</h2></div>
                <ul class="history">
                  @for (h of d.history; track $index) {
                    <li>
                      <a class="h-row tb-tile" [routerLink]="['/quran', h.surah]" [queryParams]="{ ayah: h.ayah }">
                        <b>{{ surahName(h.surah) }}</b>
                        <span class="tb-muted">{{ h.surah }}:{{ h.ayah }}</span>
                        <small class="tb-muted">{{ ago(h.at) }}</small>
                      </a>
                    </li>
                  } @empty {
                    <app-state-view state="empty" message="Open any surah and your reading history starts here.">
                      <ion-button fill="outline" routerLink="/quran">Open the Quran</ion-button>
                    </app-state-view>
                  }
                </ul>
              </section>

              @if (d.status.position) {
                <ion-button fill="clear" class="tb-danger" (click)="clear()">Clear my reading position</ion-button>
              }
            }
            @case ('error') { <app-state-view state="error" [message]="data.error()" (retry)="load()" /> }
            @default { <app-state-view state="loading" /> }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .streak { padding: 22px; display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
    .streak h1 { font-size: calc(30px * var(--tb-display-scale)); }
    .streak p { margin: 4px 0 0; }
    .small { font-size: 12px; }
    .big { position: relative; width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center;
      background: var(--tb-field); border: 1px solid var(--tb-line); color: var(--tb-muted); font-size: 44px; }
    .big.lit { color: var(--tb-gold); box-shadow: var(--tb-glow); }
    .num { position: absolute; bottom: -6px; right: -6px; min-width: 32px; padding: 4px 8px; border-radius: 16px;
      background: var(--tb-teal); color: var(--tb-bg); font-size: 14px; font-weight: 700; text-align: center; }
    .here { display: grid; gap: 6px; padding: 14px 16px; color: var(--tb-fg); text-decoration: none; }
    .ar { font-size: 24px; line-height: 1.9; }
    .en { color: var(--tb-muted); font-size: 14px; }
    .ref { display: inline-flex; align-items: center; gap: 6px; color: var(--tb-gold); font-weight: 600; font-size: 13px; }
    .history { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .h-row { display: flex; align-items: baseline; gap: 10px; padding: 11px 14px; color: var(--tb-fg); text-decoration: none; }
    .h-row small { margin-inline-start: auto; font-size: 12px; }
  `,
})
export class ReadingPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LibraryApi);
  private readonly alerts = inject(AlertController);
  private readonly notify = inject(NotifyService);
  protected readonly data = new Loadable<ReadingData>();
  protected readonly ref = verseRef;
  protected readonly ago = timeAgo;
  protected readonly hasData = computed(() => !!this.data.data());

  constructor() {
    effect(() => {
      if (this.auth.user()) untracked(() => this.load());
    });
  }

  ionViewWillEnter(): void {
    if (this.auth.user() && this.hasData()) this.load();
  }

  protected load(): void {
    this.data.load(forkJoin({ status: this.api.reading(), history: this.api.readingHistory() }));
  }

  protected surahName(n: number): string {
    return getSurah(n)?.name ?? `Surah ${n}`;
  }

  protected async clear(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Clear reading position?',
      message: 'This removes your saved place from your account.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear',
          role: 'destructive',
          handler: () =>
            this.api.clearReading().subscribe({
              next: () => this.load(),
              error: (err: unknown) => this.notify.show(errorMessage(err)),
            }),
        },
      ],
    });
    await alert.present();
  }
}
