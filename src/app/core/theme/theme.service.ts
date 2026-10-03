import { computed, effect, Injectable, signal } from '@angular/core';
import { readStored, writeStored } from '../storage/local-store';

/** Pearl & Gold is the light theme, Celestial Night the dark one. */
export type ThemeName = 'pearl' | 'night';
export type ThemePreference = ThemeName | 'system';

const STORAGE_KEY = 'theme';
const DARK_CLASS = 'ion-palette-dark';
const BAR_COLOR: Record<ThemeName, string> = { pearl: '#F7F5EF', night: '#070B1A' };

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media.matches);

  readonly preference = signal<ThemePreference>(validPreference(readStored(STORAGE_KEY, 'pearl')));
  readonly theme = computed<ThemeName>(() => {
    const pref = this.preference();
    if (pref === 'system') return this.systemDark() ? 'night' : 'pearl';
    return pref;
  });

  constructor() {
    this.media.addEventListener('change', (e) => this.systemDark.set(e.matches));
    effect(() => applyTheme(this.theme()));
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    writeStored(STORAGE_KEY, pref);
  }

  /** Header button: flips to the other theme and stops following the phone. */
  toggle(): void {
    this.setPreference(this.theme() === 'night' ? 'pearl' : 'night');
  }
}

function validPreference(value: unknown): ThemePreference {
  return value === 'night' || value === 'system' ? value : 'pearl';
}

function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.classList.toggle(DARK_CLASS, theme === 'night');
  root.dataset['theme'] = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[theme]);
}
