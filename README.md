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
| Reader: choice of Arabic script, optional English and transliteration lines, text size | `/quran/:surah?ayah=` | `GET /quran/get_surah` |
| Reflections: sort, topics, by verse, by tag, infinite scroll | `/reflections?surah=&ayah=&tag=` | `GET /reflection/list`, `/by_surah_ayah`, `/by_surah`, `/search?tag=`, `/tags` |
| One reflection with comments | `/reflections/:id` | `GET /reflection/<id>`, `/<id>/comments` |
| Author page with stats | `/users/:id` | `GET /user/<id>/reflections` |
| Search: verses, reflections, topics (and people when signed in) | `/search?q=` | `GET /search`, `/quran/search` |
| Settings: theme, Quran text, size | `/settings` | none |

**Accounts**

| Screen | Route | API |
|---|---|---|
| Log in, with the two-step code when it's on | `/login` | `POST /user/login`, `/user/login/2fa` |
| Sign up (checks username, email and phone as you go) | `/signup` | `POST /user/create_user`, `GET /user/check-username`, `/check-email`, `/check-phone` |
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

**Messages**

| Screen | Route | API |
|---|---|---|
| Chats and message requests (tab, with unread badge) | `/messages` | `GET /chats`, `?box=requests`, `/chats/unread-count` |
| A chat: bubbles, shared ayahs/reflections, seen, save, unsend, report, accept/decline, keep 7d/30d/always, clear, block | `/messages/:id` | `GET /chats/{id}`, `/messages`, `POST …/messages`, `/read`, `/accept`, `/decline`, `/clear`, `PUT …/retention`, `PUT·DELETE …/save`, `DELETE …/{message}`, `POST …/report`, `PUT /chats/blocks/{user}` |
| New message / share an ayah or reflection / "Message" on a profile | `/messages/new?to=&ayah=&reflection=` | `POST /chats` |
| Blocked people (Account page), reported messages (Moderation) | `/account`, `/moderation` | `GET /chats/blocks`, `GET·PUT /chats/reports` |

### Realtime

The app keeps one WebSocket open per signed-in user (`core/realtime/realtime.service.ts`) for new messages,
message requests, unsends, seen receipts, typing, blocks, notifications and moderation reports:

- It signs in with the first message (`{"type":"auth","token":…}`), never in the URL, and sends a fresh access
  token before the `expires_at` in the server's `ready` reply.
- It pings every 25 s and reconnects after 1, 2, 5, 10 then 30 s (plus jitter), and straight away when the app
  comes back to the foreground or the network returns.
- On close code 4401 it refreshes the session first. On 4429 (more than 10 connections) it stops and polls instead.
- Events carry ids only, and nothing is replayed, so screens re-fetch after every (re)connect.

While connected, polling pauses (the badges are still re-checked every few minutes in case an event was lost).
When it isn't, chats fall back to polling: the open chat every 5 s, the list every 15 s, badges every 30 to 60 s,
all paused in the background. Browsers block `ws://` from an `https://` page, so the realtime URL must be
`wss://` once the app is served over HTTPS (the app logs a warning and polls if it isn't).


### Sessions

Tokens are kept on the device so people stay signed in. Before each request the app refreshes an access
token that is about to expire (`POST /user/refresh`, one refresh at a time however many requests need it),
stores the rotated refresh token, and retries once if the server still says "expired". A session that has
ended (logged out elsewhere, password changed, refresh token reused) signs the app out with a message.

### Quran text

The Arabic is always shown. Readers pick its script (Uthmani, Uthmani minimal, Simple, Simple minimal,
Simple plain, Simple clean) and turn the English translation and the transliteration on or off, in the
reader's toolbar or in Settings. The choices are saved on the device.

### Matching the backend

Requests follow the backend's Insomnia export (`scripts/export_insomnia.py`). Worth knowing:

- Whole surahs come from `GET /quran/get_surah?quran_type=&surah_id=&page=&size=100`, several pages in
  parallel for long surahs (the path form `/quran/<type>/<surah>` only returns the first 10 ayahs). Each item's
  text is `quran_text.text`.
- Sign-up sends `country_code` (required) and `phone_number` (optional, without the code), plus optional
  `country`, `gender` and `date_of_birth`. The account page edits `first_name`, `last_name`, `country`,
  `country_code` and `phone_number`.
- Roles come from `privilege` on `/user/me`. Resending the verification email needs a login and has no body.
- Follows are listed per kind (`GET /user/follows?kind=user|ayah|reflection`).
- Listings return 10 items unless asked: the app asks for 100 (the maximum), pages through whole lists it
  needs (likes, bookmarks, follows), and loads chat messages 50 at a time with "Load earlier messages".
- Reflection text arrives as sanitized HTML and is shown as plain text. `created_by_username` and
  `created_by_profile_picture` are used when present (the dev API has them); otherwise the author is looked up.
- Picture URLs are relative (`/user/<id>/picture?v=…`) and are prefixed with the API address.

If the backend changes a field, its 400 `details` appear next to the form and name the field.

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

| Build | File | API | Realtime |
|---|---|---|---|
| `npm start`, `npm run build:dev` | [`src/environments/environment.ts`](src/environments/environment.ts) | `http://192.168.10.94:8000` (dev stack) | `ws://192.168.10.94:8001/ws` |
| `npm run build` | [`src/environments/environment.prod.ts`](src/environments/environment.prod.ts) | `http://192.168.10.94:5000` (production) | `ws://192.168.10.94:5001/ws` |

The same files set the default Arabic type (`quranTextType: 'quran-uthmani'`, i.e. `GET /quran/quran-uthmani/94`)
and the translation type (`translationType: 'quran-translation-sahih'`).

The backend allows any origin (CORS), so the app works from `localhost:8100`, the LAN address and Capacitor.
Verification and password-reset emails link to `<FRONTEND_URL>/verify-email?token=` and `/reset-password?token=`,
which are this app's routes; set the backend's `FRONTEND_URL` to wherever the app is served.

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
    realtime/   the WebSocket (auth, renewal, ping, reconnect) and its event stream
    chat/       ChatApi, chat models and parsing, ChatSyncService (realtime or polling)
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
