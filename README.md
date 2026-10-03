# Tadabbur

*Tadabbur* (تدبّر) means reflecting deeply on the Quran. This is the web and mobile frontend for the Quran
Reflections backend: read the Quran in Arabic with English, search it, and read what others reflect on.

Built with **Ionic 9** and **Angular 21** (standalone components, signals), ready for **Capacitor 8** native builds.

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

## What's in this first milestone

Everything public, no account needed:

| Screen | Route | API |
|---|---|---|
| Home: verse of the day, continue reading, an intro for curious visitors, most-loved verses | `/home` | `GET /quran/verse-of-the-day`, `GET /quran/most-liked` |
| Surah list with filter (name, meaning, number, Meccan/Medinan) | `/quran` | none (metadata ships with the app) |
| Reader: Arabic + Sahih International, text size, translation on/off, prev/next | `/quran/:surah?ayah=` | `GET /quran/<type>/<surah>` |
| Reflections: sort, popular topics, by verse, by tag, infinite scroll | `/reflections?surah=&ayah=&tag=` | `GET /reflection/list`, `/by_surah_ayah`, `/by_surah`, `/search?tag=`, `/tags` |
| One reflection with its comments | `/reflections/:id` | `GET /reflection/<id>`, `/<id>/comments` |
| Search everything, or only verses / only reflections | `/search?q=` | `GET /search`, `GET /quran/search` |
| Settings: theme, Arabic size, translation | `/settings` | none |

Phones get bottom tabs; at 992px and wider the tabs become a fixed sidebar. The reader remembers the first
ayah on screen, and Home offers *Continue reading* from there (saved on the device).

Liking, commenting, posting and sign-up arrive in the next milestone. For now those buttons show a short
note that accounts are coming.

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

The same files set which text types the reader asks for (`quranTextType: 'quran-uthmani'`,
`translationType: 'quran-translation-sahih'`, i.e. `GET /quran/quran-uthmani/94`). Change them there if the backend
names its types differently.

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
                models.ts (app shapes), normalize.ts (raw JSON → models)
    quran/      surah metadata (114 surahs), Bismillah handling
    theme/      ThemeService (Pearl / Night / follow phone)
    settings/   reading settings, last-read position
    util/       formatting (Arabic digits, relative time, Hijri date), Loadable
  layout/shell/ tabs + desktop sidebar
  pages/        home, quran, surah, reflections, reflection-detail, search, settings
  shared/       brand mark, theme toggle, star number, ayah marker, reflection card, state view, toasts
```

`normalize.ts` is deliberately tolerant: it accepts plain documents or Elasticsearch hits (`{_id, _source}`)
and the likely field-name variants, so a small backend change doesn't blank a screen. Search highlights are
escaped and only `<em>` is let back in.
