import { Component, effect, inject, signal, untracked } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { errorMessage } from '../../core/api/api-client';
import { ReportGroup } from '../../core/api/models';
import { ReflectionApi } from '../../core/api/reflection-api';
import { AuthService } from '../../core/auth/auth.service';
import { Loadable } from '../../core/util/loadable';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { StateView } from '../../shared/state-view';

/** GET /reflection/reports: open reports grouped by reflection, most reported first. Moderators only. */
@Component({
  selector: 'app-moderation-page',
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    HeaderActions,
    ReflectionCard,
    StateView,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/you" text="" /></ion-buttons>
        <ion-title>Moderation</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content /></ion-refresher>
      <div class="tb-container tb-container--narrow">
        <section class="tb-page-intro tb-pattern">
          <p class="tb-eyebrow">Reports waiting for review</p>
          <h1 class="tb-display">Moderation</h1>
          <p class="tb-muted">Three reports from accounts at least a day old hide a reflection automatically. Hiding or restoring resolves its open reports.</p>
        </section>
        @if (auth.user() && !auth.isModerator()) {
          <app-state-view state="empty" message="Only moderators and admins can see reports." />
        } @else {
          @switch (queue.status()) {
            @case ('ready') {
              <div class="list">
                @for (g of queue.data()!; track g.reflection.id) {
                  <article class="group">
                    <div class="summary">
                      <span class="count"><ion-icon name="flag-outline" aria-hidden="true" /> {{ g.reports }} report{{ g.reports === 1 ? '' : 's' }}</span>
                      @for (reason of g.reasons; track reason) {
                        <span class="tb-chip">{{ reason }}</span>
                      }
                    </div>
                    <app-reflection-card [reflection]="g.reflection" [clamp]="false" />
                    @if (g.notes.length) {
                      <ul class="notes">
                        @for (n of g.notes; track $index) {
                          <li>“{{ n }}”</li>
                        }
                      </ul>
                    }
                    <div class="actions">
                      @if (g.reflection.status === 'hidden') {
                        <ion-button size="small" (click)="decide(g, 'published')" [disabled]="busy() === g.reflection.id">
                          <ion-icon slot="start" name="eye-outline" />Restore
                        </ion-button>
                        <ion-button size="small" fill="outline" (click)="decide(g, 'hidden')" [disabled]="busy() === g.reflection.id">Keep hidden</ion-button>
                      } @else {
                        <ion-button size="small" (click)="decide(g, 'hidden')" [disabled]="busy() === g.reflection.id">
                          <ion-icon slot="start" name="eye-off-outline" />Hide
                        </ion-button>
                        <ion-button size="small" fill="outline" (click)="decide(g, 'published')" [disabled]="busy() === g.reflection.id">Dismiss reports</ion-button>
                      }
                      <ion-button size="small" fill="clear" class="tb-danger" (click)="remove(g)" [disabled]="busy() === g.reflection.id">
                        <ion-icon slot="start" name="trash-outline" />Delete
                      </ion-button>
                    </div>
                  </article>
                } @empty {
                  <app-state-view state="empty" message="No open reports. Alhamdulillah." />
                }
              </div>
            }
            @case ('error') { <app-state-view state="error" [message]="queue.error()" (retry)="load()" /> }
            @default { <app-state-view state="loading" [rows]="2" /> }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .list { display: grid; gap: 22px; }
    .group { display: grid; gap: 8px; }
    .summary { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .count { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; color: var(--tb-gold); margin-inline-end: 4px; }
    .notes { margin: 0; padding-inline-start: 18px; color: var(--tb-muted); font-size: 13.5px; display: grid; gap: 4px; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; }
  `,
})
export class ModerationPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ReflectionApi);
  private readonly notify = inject(NotifyService);
  protected readonly queue = new Loadable<ReportGroup[]>();
  protected readonly busy = signal('');

  constructor() {
    effect(() => {
      if (this.auth.isModerator()) untracked(() => this.load());
    });
  }

  protected load(done?: () => void): void {
    this.queue.load(this.api.reports(), done);
  }

  protected refresh(e: RefresherCustomEvent): void {
    this.load(() => e.target.complete());
  }

  protected decide(g: ReportGroup, status: 'hidden' | 'published'): void {
    this.busy.set(g.reflection.id);
    this.api.moderate(g.reflection.id, status).subscribe({
      next: () => {
        this.busy.set('');
        this.queue.data.update((list) => list?.filter((x) => x !== g));
        this.notify.show(status === 'hidden' ? 'Hidden. Reports resolved.' : 'Published. Reports resolved.');
      },
      error: (err: unknown) => {
        this.busy.set('');
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected remove(g: ReportGroup): void {
    this.busy.set(g.reflection.id);
    this.api.remove(g.reflection.id).subscribe({
      next: () => {
        this.busy.set('');
        this.queue.data.update((list) => list?.filter((x) => x !== g));
        this.notify.show('Reflection deleted');
      },
      error: (err: unknown) => {
        this.busy.set('');
        this.notify.show(errorMessage(err));
      },
    });
  }
}
