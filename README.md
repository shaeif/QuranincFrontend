# Tadabbur

*Tadabbur* (تدبّر) means reflecting deeply on the Quran. This is the web and mobile frontend for the Quran
Reflections backend: read the Quran in Arabic with English, search it, and read what others reflect on.

Built with **Ionic 9** and **Angular 21** (standalone components, signals), ready for **Capacitor 8** native builds,
with error reporting through **Sentry**.

## Design

Two themes, switchable at any time:

| Theme | Look | Fonts |
|---|---|---|
| **Pearl & Gold** (default) | Bright pearl, fine gold geometry, deep teal | Scheherazade New · Italiana · Manrope |
| **Celestial Night** | Midnight blue, glowing gold and teal, frosted glass | Amiri Quran · Marcellus · Sora |

Users pick Pearl, Night, or *Follow my phone* in Settings. The sun/moon button in each header switches between Pearl and Night.
The choice is saved on the device and applied before first paint, so there is no flash of the wrong theme.

- All colours are tokens in [`src/theme/variables.scss`](src/theme/variables.scss): `--tb-*` for the design, `--ion-*` for Ionic.
  Pearl lives on `:root`, Night on `html.ion-palette-dark`. Every text colour pair meets WCAG AA.
- Shared building blocks (glass cards, chips, Quran text, section headings, star pattern) are in [`src/global.scss`](src/global.scss).
- Fonts are self-hosted from npm (`@fontsource`), so they also work offline in the native app.

## Features

**Everyone (no account needed)**

| Screen | Route | API |
|---|---|---|
| Home: verse of the day, continue reading, an intro for curious visitors, most-loved verses | `/home` | `GET /quran/verse-of-the-day`, `/quran/most-liked` |
| Surah list with filter (name, meaning, number, Meccan/Medinan) | `/quran` | none (metadata ships with the app) |
| Reader: choice of Arabic script, optional English and transliteration lines, text size | `/quran/:surah?ayah=` | `GET /quran/<type>/<surah>` |
| Reflections: sort, topics, by verse, by tag, infinite scroll | `/reflections?surah=&ayah=&tag=` | `GET /reflection/list`, `/by_surah_ayah`, `/by_surah`, `/search?tag=`, `/tags` |
| One reflection with comments | `/reflections/:id` | `GET /reflection/<id>`, `/<id>/comments` |
| Author page with stats | `/users/:id` | `GET /user/<id>/reflections` |
| Search: verses, reflections, topics (and people when signed in) | `/search?q=` | `GET /search`, `/quran/search` |
| Settings: theme, Quran text, size | `/settings` | none |

**Accounts**

| Screen | Route | API |
|---|---|---|
| Log in, with the two-step code when it's on | `/login` | `POST /user/login`, `/user/login/2fa` |
| Sign up (checks username and email as you type) | `/signup` | `POST /user/create_user`, `GET /user/check-username`, `/check-email` |
| Verify email, resend the code | `/verify-email?token=` | `POST /user/verify-email`, `/resend-verification` |
| Forgot / reset password | `/forgot-password`, `/reset-password?token=` | `POST /user/request-password-reset`, `/reset-password` |
| Account: profile, picture, password, two-step (QR code + recovery codes), log out everywhere, download data, delete forever | `/account` | `GET /user/me`, `PUT /user/<id>`, `PUT·DELETE /user/<id>/picture`, `POST /user/change-password`, `/2fa/*`, `/logout-all`, `GET /user/export`, `POST /user/delete-permanently` |

**Signed in**

| Screen | Route | API |
|---|---|---|
| You: profile, streak, shortcuts | `/you` | `GET /user/reading-progress` |
| Write / edit a reflection, with a live verse preview | `/reflections/new?surah=&ayah=`, `/reflections/:id/edit` | `POST /reflection/create`, `PUT /reflection/<id>` |
| Like, bookmark, follow, comment, report, delete | on the reflection page | `/reflection/<id>/like`, `/comments`, `/report`, `DELETE /reflection/delete`, `/user/bookmarks/…`, `/user/follows/…` |
| Ayah like, bookmark, follow, reflect | in the reader | `/user/likes/ayahs/…`, `/user/bookmarks/ayahs/…`, `/user/follows/ayahs/…` |
| Feed | `/feed` | `GET /user/feed` |
| Bookmarks, likes, following / followers | `/bookmarks`, `/likes`, `/following` | `GET /user/bookmarks`, `/user/likes`, `/user/likes/ayahs`, `/user/follows`, `/user/followers` |
| Notifications (bell with unread count, refreshed each minute) | `/notifications` | `GET /user/notifications`, `/unread-count`, `PUT …/read`, `DELETE …/<id>` |
| Reading streak and history (the reader saves your place every few seconds) | `/reading` | `PUT·GET·DELETE /user/reading-progress`, `GET …/history` |
| Moderation queue: hide, restore, dismiss, delete | `/moderation` | `GET /reflection/reports`, `PUT /reflection/<id>/moderation` |
| All users (admins) | `/admin/users` | `GET /user` |

### Sessions

Tokens are kept on the device so people stay signed in. Before each request the app refreshes an access
token that is about to expire (`POST /user/refresh`, one refresh at a time however many requests need it),
stores the rotated refresh token, and retries once if the server still says "expired". A session that has
ended (logged out elsewhere, password changed, refresh token reused) signs the app out with a message.

### Quran text

The Arabic is always shown. Readers pick its script (Uthmani, Uthmani minimal, Simple, Simple minimal,
Simple plain, Simple clean) and turn the English translation and the transliteration on or off, in the
reader's toolbar or in Settings. The choices are saved on the device.

### Fields to check against the backend

These request bodies follow the docs, but the exact field names weren't visible, so each lives in one place:

| What | Sent as | Where to change |
|---|---|---|
| Sign-up | `username, email, password, first_name, last_name` (+ `country_code, phone` when given) | `signUpBody()` in `core/api/account-api.ts` |
| Profile edit | only the fields `/user/me` returns among `first_name, last_name, bio, country_code, phone` | `EDITABLE_PROFILE_FIELDS` in the same file |
| Resend verification | `{ email }` | `resendVerification()` in the same file |
| Profile picture upload | multipart field `file` | `uploadPicture()` in the same file |

If one is wrong, the backend's 400 `details` are shown next to the form, which names the field to fix.

## Error reporting (Sentry)

Uncaught errors and API server errors (5xx) go to [Sentry](https://sentry.io) once a DSN is set:

- The DSN is set in both environment files. Events are tagged `development` (from `npm start`) or
  `production` (from `npm run build`), so you can filter them in Sentry. Set `sentryDsn` to `''` to turn reporting off.
- `sentryTracesSampleRate` is the share of page loads and navigations sent as performance traces
  (0.2 in dev, 0.1 in production). Bump `release` when you deploy so errors are grouped by version.
- A DSN is a public client key; it is safe in browser code.

What is sent: the error, stack trace, page path, and the signed-in user's **id** only. What isn't: no IP
address, cookies, headers, request bodies, emails or usernames. `token`, `code`, `challenge` and password values
are removed from URLs. 4xx answers (wrong password, not found) and dropped connections aren't reported. No
trace headers are added to API calls, so the backend's CORS settings don't need changing.

## Getting started

Requires Node 20.19+ or 22.12+.

```bash
npm install        # with npm 11 (npm 10 hits an internal bug resolving vitest: use `npx npm@11 install`)
npm start          # http://localhost:8100, talks to the dev API
npm test           # unit tests (Vitest)
npm run build      # production build in dist/tadabbur/browser, talks to the production API
```

### API address

| Build | File | API |
|---|---|---|
| `npm start`, `npm run build:dev` | [`src/environments/environment.ts`](src/environments/environment.ts) | `http://192.168.10.94:8000` (dev stack) |
| `npm run build` | [`src/environments/environment.prod.ts`](src/environments/environment.prod.ts) | `http://192.168.10.94:5000` (production) |

The same files set the default Arabic type (`quranTextType: 'quran-uthmani'`, i.e. `GET /quran/quran-uthmani/94`)
and the translation type (`translationType: 'quran-translation-sahih'`).

The backend's CORS settings must allow the origin the app is served from (for example `http://localhost:8100`).

### Native apps (later)

```bash
npm run build
npx cap add android   # or ios
npx cap sync
```

## Code layout

```
src/app/
  core/
    api/        ApiClient (errors → readable messages), QuranApi, ReflectionApi, SearchApi,
                AccountApi, LibraryApi, models.ts (app shapes), normalize.ts (raw JSON → models)
    auth/       AuthService (session, refresh), interceptor, guards, LibraryService (liked /
                bookmarked / followed state), NotificationBadgeService
    monitoring/ Sentry setup
    quran/      surah metadata (114 surahs), Quran text types, Bismillah handling
    theme/      ThemeService (Pearl / Night / follow phone)
    settings/   reading settings, last-read position
    util/       formatting, form helpers, Loadable
  layout/shell/ tabs + desktop sidebar
  pages/        home, quran, surah, reflections, reflection-detail, compose, search, settings,
                auth/ (login, signup, verify, forgot, reset), you, account, library/ (feed,
                bookmarks, likes, following, notifications, reading), author, moderation
  shared/       header actions, avatar, auth prompt, reflection card, verse row, state view, …
```

`normalize.ts` is deliberately tolerant: it accepts plain documents or Elasticsearch hits (`{_id, _source}`)
and the likely field-name variants, so a small backend change doesn't blank a screen. Search highlights are
escaped and only `<em>` is let back in.
