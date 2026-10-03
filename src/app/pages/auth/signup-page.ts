import { Component, computed, inject, signal } from '@angular/core';
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
import { AccountApi, SignUpForm } from '../../core/api/account-api';
import { toApiError } from '../../core/api/api-client';
import { inputValue, passwordProblem } from '../../core/util/forms';
import { ThemeToggle } from '../../shared/theme-toggle';

type Field = keyof SignUpForm | 'confirm';

/** Backend field names → form fields, for showing 400 "details" next to the right input. */
const SERVER_FIELDS: Record<string, Field> = {
  username: 'username',
  email: 'email',
  password: 'password',
  first_name: 'firstName',
  last_name: 'lastName',
  country_code: 'countryCode',
  phone: 'phone',
};

@Component({
  selector: 'app-signup-page',
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
  templateUrl: './signup-page.html',
  styleUrl: './auth-pages.scss',
})
export class SignupPage {
  private readonly api = inject(AccountApi);
  protected readonly inputValue = inputValue;

  protected readonly form = signal<SignUpForm & { confirm: string }>({
    username: '',
    email: '',
    password: '',
    confirm: '',
    firstName: '',
    lastName: '',
    countryCode: '+',
    phone: '',
  });
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly general = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly usernameTaken = signal(false);
  protected readonly emailTaken = signal(false);

  protected readonly passwordHint = computed(() => {
    const f = this.form();
    return f.password ? passwordProblem(f.password, f.username, f.email) : '';
  });

  protected set(field: Field, event: Event): void {
    const value = inputValue(event);
    this.form.update((f) => ({ ...f, [field]: value }));
    if (this.errors()[field]) this.errors.update((e) => ({ ...e, [field]: undefined }));
  }

  protected checkUsername(): void {
    const u = this.form().username.trim();
    if (u.length < 3) return;
    this.api.checkUsername(u).subscribe({ next: (taken) => this.usernameTaken.set(taken), error: () => undefined });
  }

  protected checkEmail(): void {
    const e = this.form().email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return;
    this.api.checkEmail(e).subscribe({ next: (taken) => this.emailTaken.set(taken), error: () => undefined });
  }

  protected submit(event?: Event): void {
    event?.preventDefault();
    if (this.busy()) return;
    const f = this.form();
    const errors: Partial<Record<Field, string>> = {};
    if (!f.username.trim()) errors.username = 'Choose a username.';
    else if (this.usernameTaken()) errors.username = 'That username is taken.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) errors.email = 'Enter a valid email address.';
    else if (this.emailTaken()) errors.email = 'An account already uses this email.';
    if (!f.firstName.trim()) errors.firstName = 'Enter your first name.';
    const pw = passwordProblem(f.password, f.username, f.email);
    if (pw) errors.password = pw;
    if (f.confirm !== f.password) errors.confirm = "The passwords don't match.";
    this.errors.set(errors);
    this.general.set('');
    if (Object.keys(errors).length) return;

    this.busy.set(true);
    this.api.createUser(f).subscribe({
      next: () => {
        this.busy.set(false);
        this.done.set(true);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const e = toApiError(err);
        const fieldErrors = e.fieldErrors();
        const mapped: Partial<Record<Field, string>> = {};
        const unmapped: string[] = [];
        for (const [key, message] of Object.entries(fieldErrors)) {
          const field = SERVER_FIELDS[key];
          if (field) mapped[field] = message;
          else unmapped.push(`${key}: ${message}`);
        }
        this.errors.set(mapped);
        if (e.status === 409) {
          if (/username/i.test(e.message)) mapped.username = e.message;
          else if (/email/i.test(e.message)) mapped.email = e.message;
          else if (/phone/i.test(e.message)) mapped.phone = e.message;
          this.errors.set({ ...mapped });
        }
        this.general.set(unmapped.length ? `${e.message} ${unmapped.join(' ')}` : Object.keys(mapped).length ? '' : e.message);
      },
    });
  }
}
