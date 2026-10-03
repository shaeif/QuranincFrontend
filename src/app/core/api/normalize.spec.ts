import { describe, expect, it } from 'vitest';
import { extractArray, safeHighlight, toAyahTexts, toPage, toReflection, toSearchVerse } from './normalize';

describe('normalize', () => {
  it('reads a reflection from an Elasticsearch hit', () => {
    const r = toReflection({
      _id: 'abc',
      _source: { reflection: 'Ease travels with hardship', surah_id: 94, ayah_id: 6, tags: ['hope'], like_count: 3, created_at_ms: 1_700_000_000_000 },
      liked_by_me: true,
    });
    expect(r).toMatchObject({ id: 'abc', text: 'Ease travels with hardship', surah: 94, ayah: 6, tags: ['hope'], likeCount: 3, likedByMe: true });
    expect(r.createdAt).toBe(1_700_000_000_000);
    expect(r.authorName).toBe('Anonymous');
  });

  it('reads a plain reflection with an author object', () => {
    const r = toReflection({ id: 'x', text: 'hi', surah: 2, ayah: 153, author: { id: 'u1', username: 'amina_k' } });
    expect(r).toMatchObject({ id: 'x', surah: 2, ayah: 153, authorId: 'u1', authorName: 'amina_k' });
  });

  it('finds lists under items, results or hits.hits', () => {
    expect(extractArray({ items: [1, 2] })).toEqual([1, 2]);
    expect(extractArray({ results: [3] })).toEqual([3]);
    expect(extractArray({ hits: { hits: [4] } })).toEqual([4]);
    expect(extractArray(null)).toEqual([]);
    expect(toPage({ total: 9, page: 2, size: 1, items: [{}] }, (x) => x)).toMatchObject({ total: 9, page: 2, size: 1 });
  });

  it('keeps only <em> in highlights', () => {
    expect(safeHighlight('seek <em>patience</em> <script>x</script> & "prayer"')).toBe(
      'seek <em>patience</em> &lt;script&gt;x&lt;/script&gt; &amp; &quot;prayer&quot;',
    );
    expect(safeHighlight(['a <em>b</em>', 'c'])).toBe('a <em>b</em> … c');
    expect(safeHighlight(undefined)).toBeUndefined();
  });

  it('splits search highlights into Arabic and English', () => {
    const v = toSearchVerse({ surah: 2, ayah: 153, text_ar: 'ا', translation: 't', highlight: { 'text_ar.stem': ['<em>ا</em>'], translation: ['<em>t</em>'] } });
    expect(v.highlightAr).toBe('<em>ا</em>');
    expect(v.highlightEn).toBe('<em>t</em>');
  });

  it('reads surah text as a list or as an object keyed by ayah', () => {
    expect([...toAyahTexts([{ ayah: 2, text: 'b' }, { ayah: 1, text: 'a' }])]).toEqual([[2, 'b'], [1, 'a']]);
    expect([...toAyahTexts({ hits: { hits: [{ _id: '94:1', _source: { text: 'x' } }] } })]).toEqual([[1, 'x']]);
    expect([...toAyahTexts({ '1': 'a', '94:2': 'b' })]).toEqual([[1, 'a'], [2, 'b']]);
    expect([...toAyahTexts(['a', 'b'])]).toEqual([[1, 'a'], [2, 'b']]);
  });
});

describe('backend shapes from the API export', () => {
  it('reads GET /quran/get_surah pages ({data: [{quran_text: {text}}]})', () => {
    const page1 = { data: [{ quran_text: { text: 'In the name of Allah' } }, { quran_text: { text: 'All praise' } }] };
    expect([...toAyahTexts(page1)]).toEqual([[1, 'In the name of Allah'], [2, 'All praise']]);
    // Second page of 100: numbering continues from the offset when items don't carry an ayah number.
    expect([...toAyahTexts({ data: [{ quran_text: { text: 'x' } }] }, 100)]).toEqual([[101, 'x']]);
    // An ayah number on the item wins over the position.
    expect([...toAyahTexts({ data: [{ ayah_id: 7, quran_text: { text: 'y' } }] })]).toEqual([[7, 'y']]);
  });

  it('puts a plain-string highlight under the language it is written in', () => {
    const en = toSearchVerse({ surah: 1, ayah: 3, text_ar: 'ٱلرَّحْمَٰنِ', translation: 'The Entirely Merciful', highlight: 'The Entirely <em>Merciful</em>' });
    expect(en.highlightEn).toBe('The Entirely <em>Merciful</em>');
    expect(en.highlightAr).toBeUndefined();
    const ar = toSearchVerse({ surah: 55, ayah: 1, highlight: '<em>ٱلرَّحْمَٰنُ</em>' });
    expect(ar.highlightAr).toBe('<em>ٱلرَّحْمَٰنُ</em>');
    expect(ar.highlightEn).toBeUndefined();
  });

  it('reads reflection hits from listings and the author page', () => {
    const page = toPage({ page: 1, size: 20, total: 1, items: [{ _id: 'r1', _source: { id: 'r1', reflection: 'Text', surah_id: 94, ayah_id: 6, liked_by_me: true } }] }, toReflection);
    expect(page.items[0]).toMatchObject({ id: 'r1', text: 'Text', surah: 94, ayah: 6, likedByMe: true });
  });
});
