export const environment = {
  production: true,
  /** Quran Reflections API, production stack. */
  apiUrl: 'http://192.168.10.94:5000',
  quranTextType: 'quran-uthmani',
  translationType: 'quran-translation-sahih',
  /** Sentry project DSN (Settings → Client Keys). Empty turns error reporting off. */
  sentryDsn: '',
  sentryEnvironment: 'production',
  /** Share of page loads and navigations sent as performance traces (0 to 1). */
  sentryTracesSampleRate: 0.1,
  release: 'tadabbur@0.1.0',
};
