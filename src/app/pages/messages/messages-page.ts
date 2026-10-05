import { Component, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { UserNamesService } from '../../core/auth/user-names.service';
import { ChatApi } from '../../core/chat/chat-api';
import { ChatMessage, ChatSummary } from '../../core/chat/chat-models';
import { ChatSyncService } from '../../core/chat/chat-sync.service';
import { timeAgo } from '../../core/util/format';
import { Loadable } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { StateView } from '../../shared/state-view';

type Box = 'inbox' | 'requests';

/** GET /chats: your chats and the requests you sent; Requests: message requests sent to you. */
@Component({
  selector: 'app-messages-page',
  imports: [
    RouterLink,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonRouterLink,
    IonRouterLinkWithHref,
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
        <ion-title>Messages</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)"><ion-refresher-content /></ion-refresher>
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt title="Talk about what you read" message="Log in to message people, share ayahs and reflections, and keep the conversations that matter." next="/messages" />
        } @else {
          <section class="tb-page-intro tb-pattern">
            <p class="tb-eyebrow">Chats and message requests</p>
            <h1 class="tb-display">Messages</h1>
            <ion-segment class="tb-segment" [value]="box()" (ionChange)="setBox($event.detail.value)">
              <ion-segment-button value="inbox">Chats</ion-segment-button>
              <ion-segment-button value="requests">
                Requests{{ sync.unread().requests ? ' (' + sync.unread().requests + ')' : '' }}
              </ion-segment-button>
            </ion-segment>
          </section>

          @switch (chats.status()) {
            @case ('ready') {
              <ul class="list">
                @for (c of chats.data()!; track c.id) {
                  <li>
                    <a class="row tb-tile" [class.unread]="c.unread > 0" [routerLink]="['/messages', c.id]">
                      <app-avatar [name]="name(c)" [src]="c.other.pictureUrl ?? picture(c)" [size]="46" />
                      <span class="body">
                        <span class="top">
                          <b>{{ '@' + name(c) }}</b>
                          <time class="tb-muted">{{ ago(c.updatedAt ?? c.lastMessage?.createdAt) }}</time>
                        </span>
                        <span class="preview">
                          @if (c.state === 'request_out') {
                            <span class="pill">Request sent</span>
                          } @else if (c.state === 'request_in') {
                            <span class="pill in">Wants to message you</span>
                          }
                          {{ preview(c.lastMessage) }}
                        </span>
                      </span>
                      @if (c.unread > 0) {
                        <span class="count">{{ c.unread }}</span>
                      } @else if (c.retention !== '7d') {
                        <ion-icon class="keep" [name]="c.retention === 'keep' ? 'bookmark' : 'time-outline'"
                          [attr.aria-label]="c.retention === 'keep' ? 'Messages kept' : 'Kept 30 days'" />
                      }
                    </a>
                  </li>
                } @empty {
                  @if (box() === 'inbox') {
                    <app-state-view state="empty" message="No chats yet. Message someone from their profile, or share an ayah with a friend." />
                  } @else {
                    <app-state-view state="empty" message="No message requests. People you don't follow land here first." />
                  }
                }
              </ul>
            }
            @case ('error') { <app-state-view state="error" [message]="chats.error()" (retry)="load()" /> }
            @default { <app-state-view state="loading" [rows]="4" /> }
          }
        }
      </div>
      @if (auth.isLoggedIn()) {
        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button routerLink="/messages/new" aria-label="New message" title="New message">
            <ion-icon name="create-outline" />
          </ion-fab-button>
        </ion-fab>
      }
    </ion-content>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 10px; color: var(--tb-fg); text-decoration: none; transition: border-color .2s ease; }
    .row:hover { border-color: var(--tb-gold-soft); }
    .row.unread { border-color: var(--tb-glass-line); background: var(--tb-glass); }
    .body { flex: 1; min-width: 0; display: grid; gap: 2px; }
    .top { display: flex; justify-content: space-between; gap: 8px; }
    .top b { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .top time { font-size: 12px; white-space: nowrap; }
    .preview { font-size: 13.5px; color: var(--tb-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .unread .preview { color: var(--tb-fg); font-weight: 600; }
    .pill { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; background: var(--tb-field); border: 1px solid var(--tb-line); color: var(--tb-muted); margin-inline-end: 4px; }
    .pill.in { color: var(--tb-gold); border-color: var(--tb-glass-line); }
    .count { min-width: 22px; padding: 2px 7px; border-radius: 11px; background: var(--tb-teal); color: var(--tb-bg); font-size: 12px; font-weight: 700; text-align: center; }
    .keep { color: var(--tb-muted); font-size: 16px; }
  `,
})
export class MessagesPage {
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(ChatSyncService);
  private readonly api = inject(ChatApi);
  private readonly names = inject(UserNamesService);
  protected readonly box = signal<Box>('inbox');
  protected readonly chats = new Loadable<ChatSummary[]>();
  protected readonly ago = timeAgo;

  constructor() {
    effect(() => {
      this.box();
      if (this.auth.user()) untracked(() => this.load());
    });
    // New messages: refresh quietly while this list is open.
    this.sync.pulse(15_000).pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.auth.user() && this.quietReload());
  }

  ionViewWillEnter(): void {
    if (this.auth.user()) this.quietReload();
  }

  protected setBox(value: unknown): void {
    this.box.set(value === 'requests' ? 'requests' : 'inbox');
  }

  protected load(done?: () => void): void {
    this.chats.load(this.api.list(this.box()), done);
    this.sync.refreshBadge();
  }

  private quietReload(): void {
    this.api.list(this.box()).subscribe({
      next: (list) => {
        this.chats.data.set(list);
        this.chats.status.set('ready');
      },
      error: () => undefined,
    });
    this.sync.refreshBadge();
  }

  protected refresh(e: RefresherCustomEvent): void {
    this.load(() => e.target.complete());
  }

  /** The other person's username, looked up by id if the chat didn't include it. */
  protected name(c: ChatSummary): string {
    if (c.other.username && c.other.username !== 'Anonymous') return c.other.username;
    return (c.other.id && this.names.get(c.other.id)()?.username) || 'member';
  }

  protected picture(c: ChatSummary): string | undefined {
    return c.other.id ? this.names.get(c.other.id)()?.pictureUrl : undefined;
  }

  protected preview(m: ChatMessage | undefined): string {
    if (!m) return '';
    const who = m.mine ? 'You: ' : '';
    if (m.text) return who + m.text;
    if (m.attachment) return `${who}shared ${m.attachment.kind === 'ayah' ? 'an ayah' : `a ${m.attachment.kind}`}`;
    return '';
  }
}
