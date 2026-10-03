/** Shown above every surah except Al-Fatihah (where it is ayah 1) and At-Tawbah. */
export const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
export const BISMILLAH_EN = 'In the name of Allah, the Entirely Merciful, the Especially Merciful.';

export function showsBismillah(surah: number): boolean {
  return surah !== 1 && surah !== 9;
}

/** Letters only: drops harakat, Quranic marks and tatweel, and unifies alef forms. */
function bare(text: string): string {
  return text
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا');
}

/**
 * Some Quran text sources prefix ayah 1 with the Bismillah. The reader shows
 * it as a header instead, so it is removed from the ayah to avoid repeating it.
 */
export function stripLeadingBismillah(surah: number, ayah: number, text: string): string {
  if (ayah !== 1 || !showsBismillah(surah)) return text;
  const words = text.trim().split(/\s+/);
  if (words.length > 4 && bare(words.slice(0, 4).join(' ')) === 'بسم الله الرحمن الرحيم') {
    return words.slice(4).join(' ');
  }
  return text;
}
