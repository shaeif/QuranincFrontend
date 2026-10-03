/**
 * Development settings, used by `npm start` / `ng serve`.
 * The production build swaps this file for environment.prod.ts.
 */
export const environment = {
  production: false,
  /** Quran Reflections API, dev stack. */
  apiUrl: 'http://192.168.10.94:8000',
  /** Text type for Arabic in the reader: GET /quran/<type>/<surah>. Backend types: quran-simple, quran-uthmani,
   *  quran-uthmani-min, quran-simple-min, quran-simple-plain, quran-simple-clean, quran-transliteration,
   *  quran-translation-sahih. */
  quranTextType: 'quran-uthmani',
  /** Text type used for the English translation (Sahih International). */
  translationType: 'quran-translation-sahih',
};
