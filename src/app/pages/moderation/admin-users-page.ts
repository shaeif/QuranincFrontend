import { Component, effect, inject, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { AccountApi } from '../../core/api/account-api';
import { Page, UserProfile } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { StateView } from '../../shared/state-view';

/** GET /user (admins only). */
@Component({
  selector: 'app-admin-users-page',
  imports: [RouterLink, IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, Avatar, HeaderActions, StateView],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/you" text="" /></ion-buttons>
        <ion-title>All users</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container tb-container--narrow">
        @if (auth.user() && !auth.isAdmin()) {
          <app-state-view state="empty" message="Only admins can see the list of accounts." />
        } @else {
          @switch (users.status()) {
            @case ('ready') {
              <p class="tb-muted">{{ users.data()!.total }} accounts</p>
              <ul class="list">
                @for (u of users.data()!.items; track u.id) {
                  <li class="row tb-tile">
                    <app-avatar [name]="u.username" [src]="u.pictureUrl" />
                    <div class="who">
                      <a [routerLink]="['/users', u.id]">{{ '@' + u.username }}</a>
                      <small class="tb-muted">{{ u.email }}</small>
                    </div>
                    @if (u.role !== 'user') {
                      <span class="tb-chip">{{ u.role }}</span>
                    }
                    @if (u.emailVerified === false) {
                      <span class="tb-chip">unverified</span>
                    }
                  </li>
                }
              </ul>
            }
            @case ('error') { <app-state-view state="error" [message]="users.error()" (retry)="load()" /> }
            @default { <app-state-view state="loading" /> }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    .list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; }
    .who { flex: 1; min-width: 0; display: grid; }
    .who a { color: var(--tb-fg); font-weight: 700; text-decoration: none; }
    .who small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `,
})
export class AdminUsersPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AccountApi);
  protected readonly users = new Loadable<Page<UserProfile>>();

  constructor() {
    effect(() => {
      if (this.auth.isAdmin()) untracked(() => this.load());
    });
  }

  protected load(): void {
    this.users.load(this.api.listUsers());
  }
}
