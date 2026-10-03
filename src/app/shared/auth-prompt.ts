import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonIcon, IonRouterLink } from '@ionic/angular';

/** Shown where a feature needs an account. */
@Component({
  selector: 'app-auth-prompt',
  imports: [RouterLink, IonButton, IonIcon, IonRouterLink],
  template: `
    <div class="box tb-glass tb-pattern">
      <ion-icon name="lock-closed-outline" aria-hidden="true" />
      <h2 class="tb-display">{{ title() }}</h2>
      <p class="tb-muted">{{ message() }}</p>
      <div class="actions">
        <ion-button class="tb-glow" routerLink="/login" [queryParams]="{ next: next() }">Log in</ion-button>
        <ion-button fill="outline" routerLink="/signup">Create an account</ion-button>
      </div>
    </div>
  `,
  styles: `
    .box { padding: 32px 22px; display: grid; justify-items: center; gap: 10px; text-align: center; }
    ion-icon { font-size: 30px; color: var(--tb-gold); }
    h2 { font-size: calc(26px * var(--tb-display-scale)); }
    p { margin: 0; max-width: 46ch; line-height: 1.6; }
    .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 6px; }
  `,
})
export class AuthPrompt {
  readonly title = input('Your space on Tadabbur');
  readonly message = input('Log in to keep bookmarks, follow verses and people, and post your own reflections.');
  readonly next = input('/you');
}
