import { Component, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { AppNotification } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationBadgeService } from '../../core/auth/notification-badge.service';
import { verseRef } from '../../core/quran/surahs';
import { timeAgo } from '../../core/util/format';
import { LoadStatus } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { Avatar } from '../../shared/avatar';
import { NotifyService } from '../../shared/notify.service';
import { StateView } from '../../shared/state-view';
import { ThemeToggle } from '../../shared/theme-toggle';

/** GET /user/notifications: likes, comments and follows from the last 90 days. */
@Component({
  selector: 'app-notifications-page',
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemOption,
    IonItemOptions,
    IonItemSliding,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    AuthPrompt,
    Avatar,
    StateView,
    ThemeToggle,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/you" text="" /></ion-buttons>
        <ion-title>Notifications</ion-title>
        <ion-buttons slot="end">
          @if (unread() > 0) {
            <ion-button (click)="markAll()">Mark all read</ion-button>
          }
          <app-theme-toggle />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content /></ion-refresher>
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt next="/notifications" />
        } @else {
          @switch (status()) {
            @case ('ready') {
              <div class="list">
                @for (n of items(); track n.id) {
                  <ion-item-sliding>
                    <ion-item button [detail]="false" lines="none" class="note" [class.unread]="!n.read" (click)="open(n)">
                      <app-avatar slot="start" [name]="n.actor?.username ?? '?'" [src]="n.actor?.pictureUrl" [size]="38" />
                      <div class="text">
                        <p>
                          @if (n.actor) {
                            <b>{{ '@' + n.actor.username }}</b>
                            @if (n.actorCount > 1) {
                              and {{ n.actorCount - 1 }} other{{ n.actorCount > 2 ? 's' : '' }}
                            }
                          }
                          {{ verb(n) }}
                        </p>
                        @if (n.commentText) {
                          <p class="quote">“{{ n.commentText }}”</p>
                        }
                        <small class="tb-muted">{{ ago(n.createdAt) }}</small>
                      </div>
                      <ion-icon slot="end" [name]="icon(n.kind)" class="kind" aria-hidden="true" />
                    </ion-item>
                    <ion-item-options side="end">
                      <ion-item-option color="danger" (click)="remove(n)">Delete</ion-item-option>
                    </ion-item-options>
                  </ion-item-sliding>
                } @empty {
                  <app-state-view state="empty" message="Nothing yet. When people like, comment on or follow your reflections, you'll see it here." />
                }
              </div>
              @if (items().length) {
                <p class="tb-muted hint">Swipe left on a notification to delete it. Notifications older than 90 days are cleared.</p>
              }
            }
            @case ('error') { <app-state-view state="error" [message]="error()" (retry)="load()" /> }
            @default { <app-state-view state="loading" /> }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .list { display: grid; gap: 8px; }
    .note {
      --background: var(--tb-field); --padding-start: 12px; --inner-padding-end: 12px;
      border: 1px solid var(--tb-line); border-radius: 16px;
    }
    .note.unread { --background: var(--tb-glass); border-color: var(--tb-glass-line); }
    .note.unread .text p:first-child::before {
      content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--tb-teal); margin-inline-end: 6px; vertical-align: 1px;
    }
    .text { padding: 10px 0; min-width: 0; }
    .text p { margin: 0; font-size: 14px; line-height: 1.45; }
    .quote { color: var(--tb-muted); font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .text small { font-size: 12px; }
    .kind { color: var(--tb-gold); font-size: 18px; }
    ion-item-sliding { border-radius: 16px; }
    .hint { font-size: 12px; text-align: center; }
  `,
})
export class NotificationsPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LibraryApi);
  private readonly badge = inject(NotificationBadgeService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  protected readonly items = signal<AppNotification[]>([]);
  protected readonly unread = signal(0);
  protected readonly status = signal<LoadStatus>('idle');
  protected readonly error = signal('');
  protected readonly ago = timeAgo;

  constructor() {
    effect(() => {
      if (this.auth.user()) untracked(() => this.load());
    });
  }

  /** Live: a new notification while this page is open. */
  private readonly live = this.badge.events.pipe(takeUntilDestroyed()).subscribe(() => this.status() === 'ready' && this.load());

  ionViewWillEnter(): void {
    if (this.auth.user()) this.load();
  }

  protected load(done?: () => void): void {
    if (this.status() !== 'ready') this.status.set('loading');
    this.api.notifications().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.unread.set(res.unread || res.items.filter((n) => !n.read).length);
        this.badge.unread.set(this.unread());
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

  protected verb(n: AppNotification): string {
    const where = n.reflectionSurah && n.reflectionAyah ? ` on ${verseRef(n.reflectionSurah, n.reflectionAyah)}` : '';
    switch (n.kind) {
      case 'like':
        return `liked your reflection${where}`;
      case 'comment':
        return `commented on your reflection${where}`;
      case 'follow':
        return 'started following you';
      case 'followed_comment':
        return `commented on a reflection you follow${where}`;
      case 'report':
        return n.actorCount > 1 ? `${n.actorCount} people reported a reflection${where}` : `A reflection${where} was reported`;
      case 'auto_hidden':
        return `A reflection${where} was hidden automatically after reports`;
      case 'message_report':
        return 'A message was reported';
      case 'reply':
        return `replied${where}`;
      default:
        return n.kind.replace(/_/g, ' ');
    }
  }

  protected icon(kind: string): string {
    if (kind === 'like') return 'heart';
    if (kind === 'follow') return 'person-add-outline';
    if (kind === 'report' || kind === 'message_report') return 'flag-outline';
    if (kind === 'auto_hidden') return 'eye-off-outline';
    return 'chatbubble-outline';
  }

  protected open(n: AppNotification): void {
    if (!n.read) {
      this.items.update((list) => list.map((x) => (x === n ? { ...x, read: true } : x)));
      this.unread.update((u) => Math.max(0, u - 1));
      this.badge.unread.set(this.unread());
      this.api.markRead(n.id).subscribe({ error: () => undefined });
    }
    if (n.kind === 'report' || n.kind === 'auto_hidden' || n.kind === 'message_report') {
      this.router.navigate(['/moderation'], { queryParams: n.kind === 'message_report' ? { tab: 'messages' } : {} });
    } else if (n.reflectionId) this.router.navigate(['/reflections', n.reflectionId]);
    else if (n.kind === 'follow' && n.actor?.id) this.router.navigate(['/users', n.actor.id]);
  }

  protected markAll(): void {
    this.api.markAllRead().subscribe({
      next: () => {
        this.items.update((list) => list.map((n) => ({ ...n, read: true })));
        this.unread.set(0);
        this.badge.unread.set(0);
      },
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  protected remove(n: AppNotification): void {
    this.items.update((list) => list.filter((x) => x !== n));
    this.api.deleteNotification(n.id).subscribe({
      next: () => this.badge.refresh(),
      error: (err: unknown) => {
        this.notify.show(errorMessage(err));
        this.load();
      },
    });
  }
}
