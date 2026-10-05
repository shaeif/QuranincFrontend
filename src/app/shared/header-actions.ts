import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBadge, IonButton, IonIcon, IonRouterLink } from '@ionic/angular';
import { AuthService } from '../core/auth/auth.service';
import { NotificationBadgeService } from '../core/auth/notification-badge.service';
import { Avatar } from './avatar';
import { ThemeToggle } from './theme-toggle';

/** Right side of every page header: notifications, theme, and the account button. */
@Component({
  selector: 'app-header-actions',
  imports: [RouterLink, IonBadge, IonButton, IonIcon, IonRouterLink, Avatar, ThemeToggle],
  template: `
    <ion-button routerLink="/search" class="search" aria-label="Search" title="Search">
      <ion-icon slot="icon-only" name="search-outline" />
    </ion-button>
    @if (auth.user(); as user) {
      <ion-button routerLink="/notifications" class="bell" [attr.aria-label]="label()" [title]="label()">
        <ion-icon slot="icon-only" name="notifications-outline" />
        @if (badge.unread() > 0) {
          <ion-badge>{{ badge.unread() > 99 ? '99+' : badge.unread() }}</ion-badge>
        }
      </ion-button>
      <app-theme-toggle />
      <ion-button routerLink="/you" class="me" aria-label="Your profile" title="Your profile">
        <app-avatar [name]="user.username" [src]="user.pictureUrl" [size]="28" />
      </ion-button>
    } @else {
      <app-theme-toggle />
      @if (!auth.isLoggedIn()) {
        <ion-button routerLink="/login" fill="outline" size="small" class="login">Log in</ion-button>
      }
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 2px; padding-inline-end: 6px; }
    ion-button { --color: var(--tb-gold); }
    .bell { position: relative; }
    ion-badge {
      position: absolute; top: 2px; right: 0;
      --background: var(--tb-teal); --color: var(--tb-bg);
      font-size: 10px; min-width: 18px; border-radius: 9px; padding: 3px 5px;
    }
    .me { --padding-start: 6px; --padding-end: 6px; }
    /* On wide screens Search is in the sidebar. */
    @media (min-width: 992px) { .search { display: none; } }
    .login { margin-inline-start: 4px; }
  `,
})
export class HeaderActions {
  protected readonly auth = inject(AuthService);
  protected readonly badge = inject(NotificationBadgeService);
  protected label(): string {
    const n = this.badge.unread();
    return n ? `Notifications, ${n} unread` : 'Notifications';
  }
}
