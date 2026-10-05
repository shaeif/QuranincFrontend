export const environment = {
  production: true,
  /** Quran Reflections API, production stack. */
  apiUrl: 'http://192.168.10.94:5000',
  /** Realtime WebSocket (production stack): chats, notifications, moderation. Must be wss:// when the app is served over https. Empty turns it off (the app polls). */
  realtimeUrl: 'ws://192.168.10.94:5001/ws',
  quranTextType: 'quran-uthmani',
  translationType: 'quran-translation-sahih',
  /** Sentry project DSN (Settings → Client Keys). Empty turns error reporting off. */
  sentryDsn: 'https://2b65acf4be13e743b2984fb424211ab2@o1037254.ingest.us.sentry.io/4512191602163712',
  sentryEnvironment: 'production',
  /** Share of page loads and navigations sent as performance traces (0 to 1). */
  sentryTracesSampleRate: 0.1,
  release: 'tadabbur@0.1.0',
};
