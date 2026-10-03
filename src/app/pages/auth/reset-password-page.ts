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
  IonInputPasswordToggle,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { AccountApi } from '../../core/api/account-api';
import { errorMessage } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth.service';
import { inputValue, passwordProblem } from '../../core/util/forms';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-reset-password-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonInputPasswordToggle,
    IonSpinner,
    IonTitle,
    IonToolbar,
    ThemeToggle,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/login" text="" /></ion-buttons>
        <ion-title>New password</ion-title>
        <ion-buttons slot="end"><app-theme-toggle /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container">
        <section class="tb-auth tb-glass tb-pattern">
          @if (done()) {
            <h1 class="tb-display">Password changed</h1>
            <p>Every device was signed out. Log in with your new password.</p>
            <ion-button expand="block" class="tb-glow" routerLink="/login">Log in</ion-button>
          } @else {
            <h1 class="tb-display">Choose a new password</h1>
            <form class="tb-form" (submit)="submit($event)" novalidate>
              <ion-input label="Reset code" labelPlacement="floating" fill="outline" autocomplete="one-time-code" autocapitalize="off"
                [value]="code()" (ionInput)="code.set(inputValue($event))" />
              <ion-input label="New password" labelPlacement="floating" fill="outline" type="password" autocomplete="new-password"
                [maxlength]="128" [value]="password()" (ionInput)="password.set(inputValue($event))">
                <ion-input-password-toggle slot="end" />
              </ion-input>
              <p class="tb-field-hint">At least 10 characters.</p>
              <ion-input label="Repeat new password" labelPlacement="floating" fill="outline" type="password" autocomplete="new-password"
                [maxlength]="128" [value]="confirm()" (ionInput)="confirm.set(inputValue($event))" />
              @if (error()) {
                <p class="tb-alert" role="alert"><ion-icon name="alert-circle-outline" />{{ error() }}</p>
              }
              <ion-button type="submit" expand="block" class="tb-glow" [disabled]="busy()">
                @if (busy()) { <ion-spinner name="dots" /> } @else { Save new password }
              </ion-button>
            </form>
            <div class="tb-auth-links"><a routerLink="/forgot-password">Send a new code</a></div>
          }
        </section>
      </div>
    </ion-content>
  `,
})
export class ResetPasswordPage {
  readonly token = input<string | undefined>(undefined);

  private readonly api = inject(AccountApi);
  private readonly auth = inject(AuthService);
  protected readonly inputValue = inputValue;
  protected readonly code = signal('');
  protected readonly password = signal('');
  protected readonly confirm = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly error = signal('');

  constructor() {
    effect(() => {
      const t = this.token();
      if (t) untracked(() => this.code.set(t));
    });
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    const problem = !this.code().trim()
      ? 'Enter the code from the email.'
      : passwordProblem(this.password()) || (this.password() !== this.confirm() ? "The passwords don't match." : '');
    this.error.set(problem);
    if (problem) return;
    this.busy.set(true);
    this.api.resetPassword(this.code(), this.password()).subscribe({
      next: () => {
        this.busy.set(false);
        this.done.set(true);
        this.auth.endSession();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
