import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  AlertController,
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
import { AccountApi, EDITABLE_PROFILE_FIELDS, TwoFactorEnrollment } from '../../core/api/account-api';
import { errorMessage } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth.service';
import { ChatApi } from '../../core/chat/chat-api';
import { BlockedUser } from '../../core/chat/chat-models';
import { inputValue, passwordProblem } from '../../core/util/forms';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { NotifyService } from '../../shared/notify.service';
import { ThemeToggle } from '../../shared/theme-toggle';

const FIELD_LABELS: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  country: 'Country',
  country_code: 'Country calling code',
  phone_number: 'Phone (without the country code)',
};

const MAX_PICTURE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-account-page',
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
    Avatar,
    ThemeToggle,
  ],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
})
export class AccountPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(AccountApi);
  private readonly notify = inject(NotifyService);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);
  private readonly chats = inject(ChatApi);
  protected readonly inputValue = inputValue;
  protected readonly labels = FIELD_LABELS;

  /* Profile */
  protected readonly fields = computed(() => {
    const raw = this.auth.user()?.raw ?? {};
    return EDITABLE_PROFILE_FIELDS.filter((f) => f in raw);
  });
  protected readonly draft = signal<Record<string, string>>({});
  protected readonly profileBusy = signal(false);
  protected readonly profileMessage = signal('');
  protected readonly profileError = signal('');
  protected readonly pictureBusy = signal(false);

  /* Password */
  protected readonly oldPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly passwordBusy = signal(false);
  protected readonly passwordError = signal('');
  protected readonly passwordCode = signal('');

  /* Two-step */
  protected readonly tfPassword = signal('');
  protected readonly tfCode = signal('');
  protected readonly tfBusy = signal(false);
  protected readonly tfError = signal('');
  protected readonly enrollment = signal<TwoFactorEnrollment | null>(null);
  protected readonly qr = signal('');
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly showDisable = signal(false);

  /* Data */
  protected readonly exportBusy = signal(false);
  protected readonly deletePassword = signal('');
  protected readonly deleteConfirm = signal('');
  protected readonly deleteBusy = signal(false);
  protected readonly deleteError = signal('');
  protected readonly deleteCode = signal('');

  /* Blocked people */
  protected readonly blocked = new Loadable<BlockedUser[]>();

  constructor() {
    effect(() => {
      if (this.auth.user()?.id) untracked(() => this.loadBlocked());
    });
    effect(() => {
      const user = this.auth.user();
      if (!user) return;
      untracked(() => {
        const values: Record<string, string> = {};
        for (const f of this.fields()) values[f] = String(user.raw[f] ?? '');
        this.draft.set(values);
      });
    });
  }

  /* ---------- Profile ---------- */

  protected setDraft(field: string, event: Event): void {
    this.draft.update((d) => ({ ...d, [field]: inputValue(event) }));
  }

  protected saveProfile(event?: Event): void {
    event?.preventDefault();
    const user = this.auth.user();
    if (!user) return;
    const changes: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.draft())) if (String(user.raw[k] ?? '') !== v) changes[k] = v.trim();
    if (!Object.keys(changes).length) {
      this.profileMessage.set('Nothing to save.');
      return;
    }
    this.profileBusy.set(true);
    this.profileError.set('');
    this.profileMessage.set('');
    this.api.updateProfile(user.id, changes).subscribe({
      next: () => {
        this.profileBusy.set(false);
        this.profileMessage.set('Profile saved.');
        this.auth.loadMe().subscribe({ error: () => undefined });
      },
      error: (err: unknown) => {
        this.profileBusy.set(false);
        this.profileError.set(errorMessage(err));
      },
    });
  }

  protected pickPicture(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    const user = this.auth.user();
    if (!file || !user) return;
    if (file.size > MAX_PICTURE_BYTES) {
      this.notify.show('Choose a picture of 5 MB or less.');
      return;
    }
    this.pictureBusy.set(true);
    this.api.uploadPicture(user.id, file).subscribe({
      next: () => {
        this.pictureBusy.set(false);
        this.notify.show('Picture updated');
        this.auth.loadMe().subscribe({ error: () => undefined });
      },
      error: (err: unknown) => {
        this.pictureBusy.set(false);
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected removePicture(): void {
    const user = this.auth.user();
    if (!user) return;
    this.pictureBusy.set(true);
    this.api.removePicture(user.id).subscribe({
      next: () => {
        this.pictureBusy.set(false);
        this.notify.show('Picture removed');
        this.auth.loadMe().subscribe({ error: () => undefined });
      },
      error: (err: unknown) => {
        this.pictureBusy.set(false);
        this.notify.show(errorMessage(err));
      },
    });
  }

  /* ---------- Password ---------- */

  protected changePassword(event?: Event): void {
    event?.preventDefault();
    const user = this.auth.user();
    const problem = !this.oldPassword()
      ? 'Enter your current password.'
      : passwordProblem(this.newPassword(), user?.username, user?.email) ||
        (this.newPassword() !== this.confirmPassword() ? "The new passwords don't match." : '');
    this.passwordError.set(problem);
    if (problem) return;
    if (user?.twoFactorEnabled && !this.passwordCode().trim()) {
      this.passwordError.set('Enter the code from your authenticator app (or a recovery code).');
      return;
    }
    this.passwordBusy.set(true);
    this.api.changePassword(this.oldPassword(), this.newPassword(), this.passwordCode()).subscribe({
      next: (raw) => {
        this.passwordBusy.set(false);
        this.auth.replaceTokens(raw);
        this.oldPassword.set('');
        this.newPassword.set('');
        this.confirmPassword.set('');
        this.passwordCode.set('');
        this.notify.show('Password changed. Your other devices were signed out.');
      },
      error: (err: unknown) => {
        this.passwordBusy.set(false);
        this.passwordError.set(errorMessage(err));
      },
    });
  }

  /* ---------- Two-step ---------- */

  protected startEnroll(event?: Event): void {
    event?.preventDefault();
    if (!this.tfPassword()) {
      this.tfError.set('Enter your password to start.');
      return;
    }
    this.tfBusy.set(true);
    this.tfError.set('');
    this.api.enrollTwoFactor(this.tfPassword()).subscribe({
      next: async (enrollment) => {
        this.tfBusy.set(false);
        this.tfPassword.set('');
        this.enrollment.set(enrollment);
        try {
          const QRCode = await import('qrcode');
          this.qr.set(await QRCode.toDataURL(enrollment.otpauthUri, { margin: 1, width: 220 }));
        } catch {
          this.qr.set('');
        }
      },
      error: (err: unknown) => {
        this.tfBusy.set(false);
        this.tfError.set(errorMessage(err));
      },
    });
  }

  protected confirmEnroll(event?: Event): void {
    event?.preventDefault();
    if (!this.tfCode().trim()) {
      this.tfError.set('Enter the 6-digit code your app shows.');
      return;
    }
    this.tfBusy.set(true);
    this.tfError.set('');
    this.api.confirmTwoFactor(this.tfCode()).subscribe({
      next: (raw) => {
        this.tfBusy.set(false);
        this.tfCode.set('');
        this.auth.replaceTokens(raw);
        const codes = (raw as { recovery_codes?: unknown }).recovery_codes;
        this.recoveryCodes.set(Array.isArray(codes) ? codes.map(String) : []);
        this.enrollment.set(null);
        this.auth.loadMe().subscribe({ error: () => undefined });
        this.notify.show('Two-step login is on. Other devices were signed out.');
      },
      error: (err: unknown) => {
        this.tfBusy.set(false);
        this.tfError.set(errorMessage(err));
      },
    });
  }

  protected disableTwoFactor(event?: Event): void {
    event?.preventDefault();
    if (!this.tfPassword() || !this.tfCode().trim()) {
      this.tfError.set('Enter your password and a current code.');
      return;
    }
    this.tfBusy.set(true);
    this.tfError.set('');
    this.api.disableTwoFactor(this.tfPassword(), this.tfCode()).subscribe({
      next: (raw) => {
        this.tfBusy.set(false);
        this.tfPassword.set('');
        this.tfCode.set('');
        this.showDisable.set(false);
        this.auth.replaceTokens(raw);
        this.auth.loadMe().subscribe({ error: () => undefined });
        this.notify.show('Two-step login is off.');
      },
      error: (err: unknown) => {
        this.tfBusy.set(false);
        this.tfError.set(errorMessage(err));
      },
    });
  }

  protected copyCodes(): void {
    this.notify.copy(this.recoveryCodes().join('\n'), 'Recovery codes copied');
  }

  protected copySecret(): void {
    this.notify.copy(this.enrollment()?.secret ?? '', 'Key copied');
  }

  /* ---------- Blocked people ---------- */

  protected loadBlocked(): void {
    this.blocked.load(this.chats.blocked());
  }

  protected unblock(u: BlockedUser): void {
    const before = this.blocked.data() ?? [];
    this.blocked.data.set(before.filter((x) => x.id !== u.id));
    this.chats.block(u.id, false).subscribe({
      next: () => this.notify.show(`Unblocked @${u.username}`),
      error: (err: unknown) => {
        this.blocked.data.set(before);
        this.notify.show(errorMessage(err));
      },
    });
  }

  /* ---------- Sessions ---------- */

  protected async logoutEverywhere(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Log out everywhere?',
      message: 'Every device, including this one, will need to log in again.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Log out everywhere', role: 'destructive', handler: () => this.doLogoutEverywhere() },
      ],
    });
    await alert.present();
  }

  private doLogoutEverywhere(): void {
    this.auth.logoutEverywhere().subscribe({
      next: () => {
        this.notify.show('Logged out on every device');
        this.router.navigateByUrl('/login', { replaceUrl: true });
      },
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  /* ---------- Your data ---------- */

  protected exportData(): void {
    this.exportBusy.set(true);
    this.api.exportData().subscribe({
      next: (data) => {
        this.exportBusy.set(false);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tadabbur-${this.auth.user()?.username ?? 'account'}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      },
      error: (err: unknown) => {
        this.exportBusy.set(false);
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected deleteForever(event?: Event): void {
    event?.preventDefault();
    if (this.deleteConfirm().trim().toUpperCase() !== 'DELETE') {
      this.deleteError.set('Type DELETE to confirm.');
      return;
    }
    if (!this.deletePassword()) {
      this.deleteError.set('Enter your password.');
      return;
    }
    if (this.auth.user()?.twoFactorEnabled && !this.deleteCode().trim()) {
      this.deleteError.set('Enter the code from your authenticator app (or a recovery code).');
      return;
    }
    this.deleteBusy.set(true);
    this.deleteError.set('');
    this.api.deletePermanently(this.deletePassword(), this.deleteCode()).subscribe({
      next: () => {
        this.deleteBusy.set(false);
        this.auth.endSession();
        this.notify.show('Your account and everything in it has been deleted.');
        this.router.navigateByUrl('/home', { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.deleteBusy.set(false);
        this.deleteError.set(errorMessage(err));
      },
    });
  }
}
