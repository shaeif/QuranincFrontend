/**
 * Development settings, used by `npm start` / `ng serve`.
 * The production build swaps this file for environment.prod.ts.
 */
export const environment = {
  production: false,
  /** Quran Reflections API, dev stack. */
  apiUrl: 'http://192.168.10.94:8000',
  /** Text type used for Arabic in the reader: GET /quran/<type>/<surah>. */
  quranTextType: 'uthmani',
  /** Text type used for the English translation (Sahih International). */
  translationType: 'translation-sahih',
};
