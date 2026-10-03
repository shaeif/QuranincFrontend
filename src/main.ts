import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { initSentry } from './app/core/monitoring/sentry';

initSentry();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
