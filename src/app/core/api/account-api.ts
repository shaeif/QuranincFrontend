import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClient } from './api-client';
import { AuthorPage, Page, ReflectionSort, UserProfile, UserSummary } from './models';
import { field, toAuthorPage, toPage, toUser, toUserSummary } from './normalize';

/** Sign-up form, sent to POST /user/create_user. */
export interface SignUpForm {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Required by the API; "91", "+91" and " +91 " are all accepted. */
  countryCode: string;
  phone: string;
  country: string;
  gender: string;
  dateOfBirth: string;
}

export function signUpBody(f: SignUpForm): Record<string, string> {
  const body: Record<string, string> = {
    username: f.username.trim(),
    email: f.email.trim(),
    password: f.password,
    first_name: f.firstName.trim(),
    last_name: f.lastName.trim(),
    country_code: f.countryCode.trim(),
  };
  const optional: Record<string, string> = {
    phone_number: f.phone.trim(),
    country: f.country.trim(),
    gender: f.gender,
    date_of_birth: f.dateOfBirth,
  };
  for (const [key, value] of Object.entries(optional)) if (value) body[key] = value;
  return body;
}

/** Fields PUT /user/<id> accepts, edited on the account page. */
export const EDITABLE_PROFILE_FIELDS = ['first_name', 'last_name', 'country', 'country_code', 'phone_number'] as const;

export interface TwoFactorEnrollment {
  secret: string;
  otpauthUri: string;
}

@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly api = inject(ApiClient);

  checkUsername(username: string): Observable<boolean> {
    return this.api.get('/user/check-username', { username }).pipe(map((r) => field(r, 'exists') === true));
  }

  checkEmail(email: string): Observable<boolean> {
    return this.api.get('/user/check-email', { email }).pipe(map((r) => field(r, 'exists') === true));
  }

  /** GET /user/check-phone. Without a country code the number is checked across all codes. */
  checkPhone(phone: string, countryCode?: string): Observable<boolean> {
    return this.api
      .get('/user/check-phone', { phone, country_code: countryCode })
      .pipe(map((r) => field(r, 'exists') === true));
  }

  createUser(form: SignUpForm): Observable<string> {
    return this.api
      .post('/user/create_user', signUpBody(form), { anonymous: true })
      .pipe(map((r) => String(field(r, 'user_id') ?? '')));
  }

  verifyEmail(token: string): Observable<unknown> {
    return this.api.post('/user/verify-email', { token: token.trim() }, { anonymous: true });
  }

  /** POST /user/resend-verification: emails the signed-in user a new code. */
  resendVerification(): Observable<unknown> {
    return this.api.post('/user/resend-verification');
  }

  requestPasswordReset(email: string): Observable<unknown> {
    return this.api.post('/user/request-password-reset', { email: email.trim() }, { anonymous: true });
  }

  resetPassword(token: string, newPassword: string): Observable<unknown> {
    return this.api.post('/user/reset-password', { token: token.trim(), new_password: newPassword }, { anonymous: true });
  }

  /** Returns fresh tokens for this device; every other session ends. `code` is needed when two-step is on. */
  changePassword(oldPassword: string, newPassword: string, code?: string): Observable<unknown> {
    const body: Record<string, string> = { old_password: oldPassword, new_password: newPassword };
    if (code?.trim()) body['code'] = code.trim();
    return this.api.post('/user/change-password', body);
  }

  getUser(id: string): Observable<UserProfile> {
    return this.api.get(`/user/${encodeURIComponent(id)}`).pipe(map(toUser));
  }

  /** PUT /user/<id>. Answers {message}; reload /user/me for the new profile. */
  updateProfile(id: string, changes: Record<string, string>): Observable<unknown> {
    return this.api.put(`/user/${encodeURIComponent(id)}`, changes);
  }

  /** GET /user/search?username= (signed in): up to 50, exact match first. */
  searchUsers(username: string): Observable<UserSummary[]> {
    return this.api.get('/user/search', { username }).pipe(map((r) => toPage(r, toUserSummary).items));
  }

  /** GET /user (admins only). */
  listUsers(): Observable<Page<UserProfile>> {
    return this.api.get('/user').pipe(map((r) => toPage(r, toUser)));
  }

  /** GET /user/<id>/reflections: the public author page. */
  authorPage(id: string, sort: ReflectionSort = 'newest', page = 1, size = 20): Observable<AuthorPage> {
    return this.api
      .get(`/user/${encodeURIComponent(id)}/reflections`, { sort, page, size })
      .pipe(map((r) => toAuthorPage(r, page, size)));
  }

  /* ---------- Profile picture ---------- */

  uploadPicture(userId: string, file: File): Observable<string> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api
      .put(`/user/${encodeURIComponent(userId)}/picture`, form)
      .pipe(map((r) => String(field(r, 'profile_picture') ?? '')));
  }

  removePicture(userId: string): Observable<unknown> {
    return this.api.delete(`/user/${encodeURIComponent(userId)}/picture`);
  }

  /* ---------- Two-factor ---------- */

  enrollTwoFactor(password: string): Observable<TwoFactorEnrollment> {
    return this.api.post('/user/2fa/enroll', { password }).pipe(
      map((r) => ({ secret: String(field(r, 'secret') ?? ''), otpauthUri: String(field(r, 'otpauth_uri') ?? '') })),
    );
  }

  /** Returns {recovery_codes, access_token, refresh_token}. */
  confirmTwoFactor(code: string): Observable<unknown> {
    return this.api.post('/user/2fa/confirm', { code: code.trim() });
  }

  /** Returns new tokens. */
  disableTwoFactor(password: string, code: string): Observable<unknown> {
    return this.api.post('/user/2fa/disable', { password, code: code.trim() });
  }

  /* ---------- Your data ---------- */

  exportData(): Observable<unknown> {
    return this.api.get('/user/export');
  }

  /** `code` is needed when two-step is on. */
  deletePermanently(password: string, code?: string): Observable<unknown> {
    const body: Record<string, string> = { password };
    if (code?.trim()) body['code'] = code.trim();
    return this.api.post('/user/delete-permanently', body);
  }
}
