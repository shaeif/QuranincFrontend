/**
 * Text types served by GET /quran/<type>/<surah>. The Arabic is always shown;
 * the translation and transliteration are optional extra lines under it.
 */
export interface ArabicScript {
  type: string;
  name: string;
  description: string;
}

export const ARABIC_SCRIPTS: readonly ArabicScript[] = [
  { type: 'quran-uthmani', name: 'Uthmani', description: 'The script of the Madinah mushaf, with full marks' },
  { type: 'quran-uthmani-min', name: 'Uthmani (minimal)', description: 'Uthmani with fewer extra marks' },
  { type: 'quran-simple', name: 'Simple', description: 'Modern Arabic spelling with full diacritics' },
  { type: 'quran-simple-min', name: 'Simple (minimal)', description: 'Modern spelling with fewer marks' },
  { type: 'quran-simple-plain', name: 'Simple (plain)', description: 'Modern spelling without pause marks' },
  { type: 'quran-simple-clean', name: 'Simple (clean)', description: 'Letters only, no diacritics' },
];

export const DEFAULT_ARABIC = 'quran-uthmani';
export const TRANSLATION_TYPE = 'quran-translation-sahih';
export const TRANSLITERATION_TYPE = 'quran-transliteration';

export function isArabicScript(type: unknown): type is string {
  return ARABIC_SCRIPTS.some((s) => s.type === type);
}

export function scriptName(type: string): string {
  return ARABIC_SCRIPTS.find((s) => s.type === type)?.name ?? type;
}
