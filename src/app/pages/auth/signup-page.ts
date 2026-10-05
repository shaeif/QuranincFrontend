import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonInputPasswordToggle,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { AccountApi, SignUpForm } from '../../core/api/account-api';
import { toApiError } from '../../core/api/api-client';
import { ARABIC_SCRIPTS } from '../../core/quran/quran-texts';
import { ReadingSettingsService } from '../../core/settings/reading-settings.service';
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
  phone_number: 'phone',
  country: 'country',
  gender: 'gender',
  date_of_birth: 'dateOfBirth',
};

@Component({
  selector: 'app-signup-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonInputPasswordToggle,
    IonSpinner,
    IonTitle,
    IonToggle,
    IonToolbar,
    ThemeToggle,
  ],
  templateUrl: './signup-page.html',
  styleUrl: './auth-pages.scss',
})
export class SignupPage {
  private readonly api = inject(AccountApi);
  private readonly reading = inject(ReadingSettingsService);
  protected readonly inputValue = inputValue;
  protected readonly scripts = ARABIC_SCRIPTS;

  /** How they'd like to read the Quran: saved on this device once the account is created. */
  protected readonly arabicType = signal(this.reading.arabicType());
  protected readonly showTranslation = signal(this.reading.showTranslation());
  protected readonly showTransliteration = signal(this.reading.showTransliteration());

  protected readonly form = signal<SignUpForm & { confirm: string }>({
    username: '',
    email: '',
    password: '',
    confirm: '',
    firstName: '',
    lastName: '',
    countryCode: '',
    phone: '',
    country: '',
    gender: '',
    dateOfBirth: '',
  });
  protected readonly errors = signal<Partial<Record<Field, string>>>({});
  protected readonly general = signal('');
  protected readonly busy = signal(false);
  protected readonly done = signal(false);
  protected readonly usernameTaken = signal(false);
  protected readonly emailTaken = signal(false);
  protected readonly phoneTaken = signal(false);
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly passwordHint = computed(() => {
    const f = this.form();
    return f.password ? passwordProblem(f.password, f.username, f.email) : '';
  });

  protected set(field: Field, event: Event): void {
    const value = field === 'gender' ? String((event as CustomEvent<{ value?: unknown }>).detail?.value ?? '') : inputValue(event);
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

  protected checkPhone(): void {
    const f = this.form();
    if (f.phone.trim().length < 5) return;
    this.api.checkPhone(f.phone.trim(), f.countryCode.trim() || undefined).subscribe({
      next: (taken) => this.phoneTaken.set(taken),
      error: () => undefined,
    });
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
    if (!/^\s*\+?\d{1,4}\s*$/.test(f.countryCode)) errors.countryCode = 'Enter your country calling code, like +91 or +44.';
    if (f.phone.trim() && !/^[\d\s-]{4,20}$/.test(f.phone.trim())) errors.phone = 'Enter the number without the country code, digits only.';
    else if (this.phoneTaken()) errors.phone = 'An account already uses this phone number.';
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
        this.reading.setArabicType(this.arabicType());
        this.reading.setShowTranslation(this.showTranslation());
        this.reading.setShowTransliteration(this.showTransliteration());
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
