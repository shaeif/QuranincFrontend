import { describe, expect, it } from 'vitest';
import { plainText } from '../util/format';
import { extractArray, safeHighlight, toAuthorPage, toAyahTexts, toComment, toNotification, toPage, toReflection, toSearchVerse } from './normalize';

describe('normalize', () => {
  it('reads a reflection from an Elasticsearch hit', () => {
    const r = toReflection({
      _id: 'abc',
      _source: { reflection: 'Ease travels with hardship', surah_id: 94, ayah_id: 6, tags: ['hope'], like_count: 3, created_at_ms: 1_700_000_000_000 },
      liked_by_me: true,
    });
    expect(r).toMatchObject({ id: 'abc', text: 'Ease travels with hardship', surah: 94, ayah: 6, tags: ['hope'], likeCount: 3, likedByMe: true });
    expect(r.createdAt).toBe(1_700_000_000_000);
    expect(r.authorName).toBe('');
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

describe('author names', () => {
  it('fills reflection authors on the author page from the page author', () => {
    const page = toAuthorPage({
      author: { id: 'u1', username: 'shaeif.thajudheen' },
      stats: { reflections: 1 },
      items: [{ _id: 'r1', _source: { id: 'r1', reflection: 'In the name of Allah', surah_id: 1, ayah_id: 1, created_by_id: 'u1' } }],
    });
    expect(page.reflections.items[0].authorName).toBe('shaeif.thajudheen');
  });

  it('leaves the name empty (to be looked up) when a reflection has only created_by_id', () => {
    expect(toReflection({ id: 'r1', created_by_id: 'u1' }).authorName).toBe('');
  });

  it('reads created_by_username, the author picture and comment authors', () => {
    const r = toReflection({ id: 'r', reflection: 'x', created_by_id: 'u2', created_by_username: 'fe_friend', created_by_profile_picture: '/user/u2/picture?v=1' });
    expect(r).toMatchObject({ authorId: 'u2', authorName: 'fe_friend' });
    expect(r.authorPictureUrl).toMatch(/^https?:\/\/.+\/user\/u2\/picture\?v=1$/);
    const c = toComment({ id: 'k', text: 'So true', author: { id: 'u3', username: 'fe_user', profile_picture: null } });
    expect(c).toMatchObject({ authorId: 'u3', authorName: 'fe_user', authorPictureUrl: undefined });
  });

  it('reads get_surah items by quran_text.aya', () => {
    const texts = toAyahTexts({ data: [{ quran_text: { aya: 7, text: 'seven' } }, { quran_text: { aya: 8, text: 'eight' } }], page: 4, size: 2 }, 6);
    expect([...texts.entries()]).toEqual([[7, 'seven'], [8, 'eight']]);
  });

  it('reads notifications with and without an actor', () => {
    const n = toNotification({
      id: 'n1', kind: 'followed_comment', read: false, actor: { id: 'u5', username: 'fe_admin' }, actor_count: 1,
      reflection: { id: 'r1', surah_id: 2, ayah_id: 255 }, comment: { id: 'k', text: 'So true' }, updated_at: '2026-10-05T08:11:29',
    });
    expect(n).toMatchObject({ kind: 'followed_comment', reflectionId: 'r1', reflectionSurah: 2, reflectionAyah: 255, commentText: 'So true' });
    expect(toNotification({ id: 'n2', kind: 'message_report', actor: null, reflection: null }).actor).toBeUndefined();
  });

  it('turns sanitized HTML into plain text', () => {
    expect(plainText('<p>Ease &amp; hardship</p><p>Line&nbsp;two &#39;ok&#39;</p>')).toBe("Ease & hardship\nLine two 'ok'");
    expect(plainText('a < b')).toBe('a < b');
    expect(plainText('plain')).toBe('plain');
  });
});
