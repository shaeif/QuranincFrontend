import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSearchbar,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { catchError, of } from 'rxjs';
import { AccountApi } from '../../core/api/account-api';
import { errorMessage } from '../../core/api/api-client';
import { UserSummary } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { UserNamesService } from '../../core/auth/user-names.service';
import { ChatApi } from '../../core/chat/chat-api';
import { Attachment, ChatSummary } from '../../core/chat/chat-models';
import { ChatSyncService } from '../../core/chat/chat-sync.service';
import { getSurah } from '../../core/quran/surahs';
import { inputValue } from '../../core/util/forms';
import { AttachmentCard } from '../../shared/attachment-card';
import { AuthPrompt } from '../../shared/auth-prompt';
import { Avatar } from '../../shared/avatar';
import { NotifyService } from '../../shared/notify.service';

/**
 * Start a chat, or share an ayah / reflection with someone.
 * /messages/new?to=<user id>&ayah=2:255&reflection=<id>
 */
@Component({
  selector: 'app-new-message-page',
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSearchbar,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    AttachmentCard,
    AuthPrompt,
    Avatar,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/messages" text="" /></ion-buttons>
        <ion-title>{{ attachment() ? 'Send to…' : 'New message' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt title="Share with someone" message="Log in to send messages, ayahs and reflections." [next]="'/messages/new'" />
        } @else {
          @if (attachment(); as a) {
            <section class="tb-section">
              <p class="tb-eyebrow">Sharing</p>
              <app-attachment-card [attachment]="a" />
            </section>
          }

          @if (recipient(); as r) {
            <section class="to tb-tile">
              <app-avatar [name]="r.username" [src]="r.pictureUrl" [size]="40" />
              <span class="to-name"><small class="tb-muted">To</small><b>{{ r.username ? '@' + r.username : 'member' }}</b></span>
              @if (!toParam()) {
                <ion-button fill="clear" size="small" (click)="picked.set(null)">Change</ion-button>
              }
            </section>

            <form class="tb-form" (submit)="send($event)">
              <ion-textarea fill="outline" label="Message" labelPlacement="floating" [autoGrow]="true" [rows]="3" [maxlength]="2000"
                [placeholder]="attachment() ? 'Add a note (optional)' : 'Salam…'" [value]="text()" (ionInput)="text.set(inputValue($event))" />
              <p class="tb-field-hint">
                If they don't follow you, this arrives as a message request. You can send up to 3 messages until they accept.
              </p>
              @if (error()) {
                <p class="tb-alert" role="alert"><ion-icon name="alert-circle-outline" />{{ error() }}</p>
              }
              <ion-button type="submit" expand="block" class="tb-glow" [disabled]="busy() || (!text().trim() && !attachment())">
                @if (busy()) { <ion-spinner name="dots" /> } @else { <ion-icon slot="start" name="send" />Send }
              </ion-button>
            </form>
          } @else {
            <ion-searchbar class="tb-searchbar" placeholder="Search people by username" [debounce]="300"
              [value]="query()" (ionInput)="query.set(inputValue($event))" aria-label="Search people" />
            @if (query().trim().length >= 2) {
              <ul class="people">
                @for (u of results(); track u.id) {
                  <li><button type="button" class="person tb-tile" (click)="pick(u)">
                    <app-avatar [name]="u.username" [src]="u.pictureUrl" [size]="36" /><b>{{ '@' + u.username }}</b>
                  </button></li>
                } @empty {
                  <li class="tb-muted empty">{{ searching() ? 'Searching…' : 'No one by that name.' }}</li>
                }
              </ul>
            } @else if (recent().length) {
              <p class="tb-eyebrow">Recent chats</p>
              <ul class="people">
                @for (c of recent(); track c.id) {
                  <li><button type="button" class="person tb-tile" (click)="pick(c.other)">
                    <app-avatar [name]="c.other.username" [src]="c.other.pictureUrl" [size]="36" />
                    <b>{{ c.other.username ? '@' + c.other.username : 'member' }}</b>
                  </button></li>
                }
              </ul>
            }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .to { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
    .to-name { flex: 1; display: grid; }
    .to-name small { font-size: 11px; text-transform: uppercase; letter-spacing: .12em; }
    .people { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .person { font: inherit; width: 100%; display: flex; align-items: center; gap: 12px; padding: 8px 12px; color: var(--tb-fg); cursor: pointer; text-align: left; }
    .person:hover { border-color: var(--tb-gold-soft); }
    .empty { padding: 12px; }
  `,
})
export class NewMessagePage {
  readonly toParam = input<string | undefined>(undefined, { alias: 'to' });
  readonly ayahParam = input<string | undefined>(undefined, { alias: 'ayah' });
  readonly reflectionParam = input<string | undefined>(undefined, { alias: 'reflection' });

  protected readonly auth = inject(AuthService);
  private readonly api = inject(ChatApi);
  private readonly accounts = inject(AccountApi);
  private readonly names = inject(UserNamesService);
  private readonly sync = inject(ChatSyncService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);
  protected readonly inputValue = inputValue;

  protected readonly query = signal('');
  protected readonly results = signal<UserSummary[]>([]);
  protected readonly searching = signal(false);
  protected readonly recent = signal<ChatSummary[]>([]);
  protected readonly picked = signal<UserSummary | null>(null);
  protected readonly text = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected readonly attachment = computed<Attachment | null>(() => {
    const ayah = this.ayahParam();
    if (ayah && /^\d+:\d+$/.test(ayah)) {
      const [s, a] = ayah.split(':').map(Number);
      if (getSurah(s) && a >= 1 && a <= getSurah(s)!.ayahs) return { kind: 'ayah', ref: ayah };
    }
    const reflection = this.reflectionParam();
    return reflection ? { kind: 'reflection', ref: reflection } : null;
  });

  protected readonly recipient = computed<UserSummary | null>(() => {
    const to = this.toParam();
    if (to) return this.names.get(to)() ?? { id: to, username: '' };
    return this.picked();
  });

  constructor() {
    effect(() => {
      if (this.auth.user()) {
        untracked(() =>
          this.api.list('inbox').pipe(catchError(() => of([]))).subscribe((list) => this.recent.set(list.filter((c) => c.other.id).slice(0, 8))),
        );
      }
    });
    effect(() => {
      const q = this.query().trim().replace(/^@/, '');
      if (q.length < 2) {
        this.results.set([]);
        return;
      }
      untracked(() => {
        this.searching.set(true);
        this.accounts.searchUsers(q).pipe(catchError(() => of([]))).subscribe((list) => {
          this.searching.set(false);
          if (q === this.query().trim().replace(/^@/, '')) this.results.set(list.filter((u) => u.id !== this.auth.user()?.id));
        });
      });
    });
  }

  protected pick(u: UserSummary): void {
    this.names.remember(u);
    this.picked.set(u);
  }

  protected send(event?: Event): void {
    event?.preventDefault();
    const to = this.recipient();
    if (!to?.id || this.busy()) return;
    if (to.id === this.auth.user()?.id) {
      this.error.set("You can't message yourself.");
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.start(to.id, { text: this.text(), attachment: this.attachment() ?? undefined }).subscribe({
      next: ({ chatId }) => {
        this.busy.set(false);
        this.sync.refreshBadge();
        this.notify.show('Sent');
        this.router.navigate(chatId ? ['/messages', chatId] : ['/messages'], { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
