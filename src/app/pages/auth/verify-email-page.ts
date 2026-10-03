import { Component, effect, inject, input, signal, untracked } from '@angular/core';
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
import { AuthService } from '../../core/auth/auth.service';
import { inputValue } from '../../core/util/forms';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-verify-email-page',
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
        <ion-title>Verify email</ion-title>
        <ion-buttons slot="end"><app-theme-toggle /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container">
        <section class="tb-auth tb-glass tb-pattern">
          @if (verified()) {
            <h1 class="tb-display">Email verified</h1>
            <p>Thank you. Your address is confirmed.</p>
            <ion-button expand="block" class="tb-glow" [routerLink]="auth.isLoggedIn() ? '/you' : '/login'">
              {{ auth.isLoggedIn() ? 'Go to your profile' : 'Log in' }}
            </ion-button>
          } @else {
            <h1 class="tb-display">Confirm your email</h1>
            <p class="tb-muted">Enter the code from the "Verify your email address" message. It works for 24 hours.</p>
            <form class="tb-form" (submit)="verify($event)" novalidate>
              <ion-input label="Verification code" labelPlacement="floating" fill="outline" autocomplete="one-time-code"
                autocapitalize="off" [value]="code()" (ionInput)="code.set(inputValue($event))" />
              @if (error()) {
                <p class="tb-alert" role="alert"><ion-icon name="alert-circle-outline" />{{ error() }}</p>
              }
              <ion-button type="submit" expand="block" class="tb-glow" [disabled]="busy()">
                @if (busy()) { <ion-spinner name="dots" /> } @else { Verify }
              </ion-button>
            </form>

            <div class="resend tb-tile">
              <p class="tb-muted">No email? Check spam, or send a new code (up to 3 an hour).</p>
              <ion-input label="Email" labelPlacement="floating" fill="outline" type="email" inputmode="email"
                [value]="emailValue()" (ionInput)="emailValue.set(inputValue($event))" />
              @if (resent()) {
                <p class="tb-alert tb-alert--ok" role="status"><ion-icon name="checkmark-circle" />{{ resent() }}</p>
              }
              <ion-button fill="outline" (click)="resend()" [disabled]="resending()">Send a new code</ion-button>
            </div>
          }
        </section>
      </div>
    </ion-content>
  `,
  styles: `
    .resend { padding: 14px; display: grid; gap: 10px; }
    .resend p { margin: 0; font-size: 13.5px; }
  `,
})
export class VerifyEmailPage {
  readonly token = input<string | undefined>(undefined);
  readonly email = input<string | undefined>(undefined);

  private readonly api = inject(AccountApi);
  protected readonly auth = inject(AuthService);
  protected readonly inputValue = inputValue;

  protected readonly code = signal('');
  protected readonly emailValue = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly verified = signal(false);
  protected readonly resending = signal(false);
  protected readonly resent = signal('');

  constructor() {
    effect(() => {
      const token = this.token();
      const email = this.email() ?? this.auth.user()?.email;
      untracked(() => {
        if (email) this.emailValue.set(email);
        // A link with ?token= verifies straight away.
        if (token) {
          this.code.set(token);
          this.verify();
        }
      });
    });
  }

  protected verify(event?: Event): void {
    event?.preventDefault();
    if (!this.code().trim() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.verifyEmail(this.code()).subscribe({
      next: () => {
        this.busy.set(false);
        this.verified.set(true);
        if (this.auth.isLoggedIn()) this.auth.loadMe().subscribe({ error: () => undefined });
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  protected resend(): void {
    const email = this.emailValue().trim();
    if (!email) return;
    this.resending.set(true);
    this.api.resendVerification(email).subscribe({
      next: () => {
        this.resending.set(false);
        this.resent.set(`If ${email} needs verifying, a new code is on its way.`);
      },
      error: (err: unknown) => {
        this.resending.set(false);
        this.resent.set('');
        this.error.set(errorMessage(err));
      },
    });
  }
}
