import { Injectable, signal } from '@angular/core';
import { getSurah } from '../quran/surahs';
import { readStored, writeStored } from '../storage/local-store';

export interface LastRead {
  surah: number;
  ayah: number;
  at: number;
}

/** Where the reader left off, kept on this device (no account needed). */
@Injectable({ providedIn: 'root' })
export class LastReadService {
  readonly position = signal<LastRead | null>(valid(readStored<unknown>('lastRead', null)));

  save(surah: number, ayah: number): void {
    const current = this.position();
    if (current && current.surah === surah && current.ayah === ayah) return;
    const value: LastRead = { surah, ayah, at: Date.now() };
    this.position.set(value);
    writeStored('lastRead', value);
  }
}

function valid(value: unknown): LastRead | null {
  if (!value || typeof value !== 'object') return null;
  const { surah, ayah, at } = value as Partial<LastRead>;
  const s = getSurah(Number(surah));
  if (!s || !Number.isInteger(ayah) || ayah! < 1 || ayah! > s.ayahs) return null;
  return { surah: s.number, ayah: ayah!, at: Number(at) || 0 };
}
