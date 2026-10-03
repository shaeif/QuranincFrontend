import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AccountApi } from '../../core/api/account-api';
import { errorMessage } from '../../core/api/api-client';
import { inputValue } from '../../core/util/forms';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-forgot-password-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonSpinner,
    IonTitle,
    IonToolbar,
    ThemeToggle,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/login" text="" /></ion-buttons>
        <ion-title>Forgot password</ion-title>
        <ion-buttons slot="end"><app-theme-toggle /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container">
        <section class="tb-auth tb-glass tb-pattern">
          <h1 class="tb-display">Reset your password</h1>
          @if (sent()) {
            <p class="tb-alert tb-alert--ok" role="status">
              <ion-icon name="mail-outline" />If an account exists for {{ email() }}, we've emailed a reset code. It works for 30 minutes.
            </p>
            <ion-button expand="block" class="tb-glow" routerLink="/reset-password">I have a code</ion-button>
          } @else {
            <p class="tb-muted">Enter the email on your account and we'll send you a code to choose a new password.</p>
            <form class="tb-form" (submit)="send($event)" novalidate>
              <ion-input label="Email" labelPlacement="floating" fill="outline" type="email" inputmode="email" autocomplete="email"
                [value]="email()" (ionInput)="email.set(inputValue($event))" />
              @if (error()) {
                <p class="tb-alert" role="alert"><ion-icon name="alert-circle-outline" />{{ error() }}</p>
              }
              <ion-button type="submit" expand="block" class="tb-glow" [disabled]="busy()">
                @if (busy()) { <ion-spinner name="dots" /> } @else { Send reset code }
              </ion-button>
            </form>
          }
          <div class="tb-auth-links"><a routerLink="/login">Back to log in</a></div>
        </section>
      </div>
    </ion-content>
  `,
})
export class ForgotPasswordPage {
  private readonly api = inject(AccountApi);
  protected readonly inputValue = inputValue;
  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal('');

  protected send(event?: Event): void {
    event?.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(this.email().trim())) {
      this.error.set('Enter a valid email address.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.requestPasswordReset(this.email()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
