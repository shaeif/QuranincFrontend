import { describe, expect, it } from 'vitest';
import { stripLeadingBismillah } from './bismillah';
import { getSurah, SURAHS, TOTAL_AYAHS } from './surahs';

describe('surah metadata', () => {
  it('has 114 surahs and 6,236 ayahs', () => {
    expect(SURAHS).toHaveLength(114);
    expect(SURAHS.reduce((sum, s) => sum + s.ayahs, 0)).toBe(TOTAL_AYAHS);
    expect(getSurah(94)?.name).toBe('Ash-Sharh');
    expect(getSurah(0)).toBeUndefined();
    expect(getSurah(115)).toBeUndefined();
  });
});

describe('stripLeadingBismillah', () => {
  it('removes a Bismillah prefixed to ayah 1', () => {
    expect(stripLeadingBismillah(94, 1, 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ')).toBe('أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ');
    expect(stripLeadingBismillah(2, 1, 'بسم الله الرحمن الرحيم الم')).toBe('الم');
  });

  it('keeps it where it belongs to the text', () => {
    const fatihah = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
    expect(stripLeadingBismillah(1, 1, fatihah)).toBe(fatihah);
    expect(stripLeadingBismillah(27, 30, 'إِنَّهُۥ مِن سُلَيْمَٰنَ وَإِنَّهُۥ بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')).toContain('سُلَيْمَٰنَ');
    expect(stripLeadingBismillah(94, 2, 'وَوَضَعْنَا عَنكَ وِزْرَكَ')).toBe('وَوَضَعْنَا عَنكَ وِزْرَكَ');
  });
});
