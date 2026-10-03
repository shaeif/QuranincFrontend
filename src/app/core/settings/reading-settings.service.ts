import { Injectable, signal } from '@angular/core';
import { readStored, writeStored } from '../storage/local-store';

export const ARABIC_SIZE = { min: 22, max: 44, step: 2, default: 30 };

/** How the Quran text is shown in the reader. Saved on this device. */
@Injectable({ providedIn: 'root' })
export class ReadingSettingsService {
  readonly arabicSize = signal(clampSize(readStored('arabicSize', ARABIC_SIZE.default)));
  readonly showTranslation = signal(readStored<unknown>('showTranslation', true) !== false);

  setArabicSize(size: number): void {
    const value = clampSize(size);
    this.arabicSize.set(value);
    writeStored('arabicSize', value);
  }

  setShowTranslation(show: boolean): void {
    this.showTranslation.set(show);
    writeStored('showTranslation', show);
  }
}

function clampSize(size: unknown): number {
  const n = Number(size);
  if (!Number.isFinite(n)) return ARABIC_SIZE.default;
  return Math.min(ARABIC_SIZE.max, Math.max(ARABIC_SIZE.min, Math.round(n)));
}
