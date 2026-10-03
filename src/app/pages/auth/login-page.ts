import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
import { ApiError, toApiError } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth.service';
import { inputValue, safeNext } from '../../core/util/forms';
import { BrandMark } from '../../shared/brand-mark';
import { NotifyService } from '../../shared/notify.service';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-login-page',
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
    BrandMark,
    ThemeToggle,
  ],
  templateUrl: './login-page.html',
})
export class LoginPage {
  readonly next = input<string | undefined>(undefined);

  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotifyService);
  protected readonly inputValue = inputValue;

  protected readonly step = signal<'password' | 'code'>('password');
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  private challenge = '';

  protected submitPassword(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    if (!this.username().trim() || !this.password()) {
      this.error.set('Enter your username and password.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.auth.login(this.username().trim(), this.password()).subscribe({
      next: (result) => {
        this.busy.set(false);
        if (result.done) {
          this.finish();
        } else {
          this.challenge = result.challenge;
          this.step.set('code');
        }
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected submitCode(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    if (!this.code().trim()) {
      this.error.set('Enter the code from your authenticator app, or a recovery code.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.auth.loginTwoFactor(this.challenge, this.code()).subscribe({
      next: ({ recoveryCodesLeft }) => {
        this.busy.set(false);
        if (recoveryCodesLeft !== undefined && recoveryCodesLeft <= 3) {
          this.notify.show(`You have ${recoveryCodesLeft} recovery codes left. Make new ones in Account → Security.`);
        }
        this.finish();
      },
      error: (err: unknown) => {
        const e = toApiError(err);
        // An expired or used challenge means starting again with the password.
        if ((e.status === 400 || e.status === 401) && /challenge/i.test(e.message)) {
          this.step.set('password');
          this.password.set('');
        }
        this.fail(e);
      },
    });
  }

  protected backToPassword(): void {
    this.step.set('password');
    this.code.set('');
    this.error.set('');
  }

  private finish(): void {
    const user = this.auth.user();
    this.notify.show(user ? `Welcome back, ${user.displayName}` : 'Logged in');
    this.router.navigateByUrl(safeNext(this.next()), { replaceUrl: true });
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    const e = err instanceof ApiError ? err : toApiError(err);
    this.error.set(e.message);
  }
}
