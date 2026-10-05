import { describe, expect, it } from 'vitest';
import { mergeNewest, prependOlder, toAttachment, toChat, toChatReport, toChatUnread, toMessage } from './chat-normalize';
import { ChatMessage } from './chat-models';

describe('chat parsing', () => {
  it('reads a chat with the other person, unread, retention and last message', () => {
    const c = toChat(
      {
        id: 'c1',
        other: { id: 'u2', username: 'amina_k' },
        unread: 2,
        retention: '30d',
        last_message: { id: 'm1', sender_id: 'u2', text: 'Salam', created_at: '2026-10-05T07:00:00Z' },
      },
      'u1',
    );
    expect(c).toMatchObject({ id: 'c1', unread: 2, retention: '30d', state: 'active' });
    expect(c.other.username).toBe('amina_k');
    expect(c.lastMessage).toMatchObject({ text: 'Salam', mine: false });
  });

  it('tells incoming and outgoing requests apart', () => {
    expect(toChat({ id: 'c', status: 'request', requested_by: 'u1' }, 'u1').state).toBe('request_out');
    expect(toChat({ id: 'c', status: 'request', requested_by: 'u2' }, 'u1').state).toBe('request_in');
    expect(toChat({ id: 'c', state: 'active' }, 'u1').state).toBe('active');
  });

  it('marks my messages, saves and expiry', () => {
    const m = toMessage({ id: 'm', sender_id: 'u1', text: 'hi', saved_by_me: true, expires_at: null }, 'u1');
    expect(m).toMatchObject({ mine: true, savedByMe: true, saved: true, expiresAt: null, notice: false });
    const notice = toMessage({ id: 'n', kind: 'notice', text: 'Messages are now kept for 30 days' }, 'u1');
    expect(notice.notice).toBe(true);
  });

  it('reads attachments as sent ({kind, ref}) and with a preview', () => {
    expect(toAttachment({ kind: 'ayah', ref: '2:255' })).toMatchObject({ kind: 'ayah', ref: '2:255' });
    expect(toAttachment({ kind: 'reflection', ref: 'r1', preview: { reflection: 'Ease travels with hardship' } })?.text).toBe(
      'Ease travels with hardship',
    );
    expect(toAttachment({ kind: 'video', ref: 'x' })).toBeUndefined();
  });

  it('reads the unread badge', () => {
    expect(toChatUnread({ unread: 3, requests: 1 })).toEqual({ messages: 3, requests: 1 });
  });

  it('reads the API\'s chat item (with, requested_by_me, last_message)', () => {
    const c = toChat({
      id: 'c1', status: 'active', requested_by_me: false, retention: '30d', unread: 2,
      with: { id: 'u2', username: 'fe_friend', profile_picture: '/user/u2/picture?v=3' },
      last_message: {
        id: 'm1', chat_id: 'c1', kind: 'text', mine: false, sender: { id: 'u2', username: 'fe_friend', profile_picture: null },
        text: 'Wa alaikum salam', attachment: null, created_at: '2026-10-05T08:11:30', seen_at: null,
        saved_by_me: false, saved_by_them: false, expires_at: '2026-11-04T08:11:30',
      },
      last_message_at: '2026-10-05T08:11:30',
    });
    expect(c).toMatchObject({ id: 'c1', state: 'active', retention: '30d', unread: 2 });
    expect(c.other).toMatchObject({ id: 'u2', username: 'fe_friend' });
    expect(c.other.pictureUrl).toMatch(/\/user\/u2\/picture\?v=3$/);
    expect(c.lastMessage).toMatchObject({ senderId: 'u2', mine: false, text: 'Wa alaikum salam', saved: false, notice: false });
    expect(toChat({ id: 'r', status: 'request', requested_by_me: true }).state).toBe('request_out');
    expect(toChat({ id: 'r', status: 'request', requested_by_me: false }).state).toBe('request_in');
  });

  it('reads shared ayahs, reflections and comments with their previews', () => {
    const ayah = toAttachment({ kind: 'ayah', surah: 2, ayah: 255, surah_name_en: 'Al-Baqara', text_ar: 'ٱللَّهُ', translation: 'Allah' });
    expect(ayah).toMatchObject({ kind: 'ayah', ref: '2:255', textAr: 'ٱللَّهُ', text: 'Allah' });
    const reflection = toAttachment({
      kind: 'reflection', id: 'r1', surah_id: 2, ayah_id: 255, reflection: '<p>Ease &amp; hardship</p>', author: { username: 'fe_friend' },
    });
    expect(reflection).toMatchObject({ ref: 'r1', text: 'Ease & hardship', authorName: 'fe_friend' });
    const comment = toAttachment({ kind: 'comment', id: 'k1', reflection_id: 'r1', text: 'JazakAllahu khayran', author: { username: 'fe_user' } });
    expect(comment).toMatchObject({ ref: 'k1', reflectionId: 'r1', text: 'JazakAllahu khayran' });
    expect(toAttachment({ kind: 'reflection', id: 'r9', unavailable: true })).toMatchObject({ ref: 'r9', unavailable: true });
  });

  it('counts a message saved by the other person as kept', () => {
    expect(toMessage({ id: 'm', mine: true, saved_by_me: false, saved_by_them: true, expires_at: null })).toMatchObject({
      mine: true, savedByMe: false, saved: true, expiresAt: null,
    });
    expect(toMessage({ id: 'n', kind: 'notice', mine: false, sender: { username: 'fe_friend' }, text: 'Kept 30 days' }).notice).toBe(true);
  });

  it('reads a reported message', () => {
    const r = toChatReport({
      id: 'rep', message_id: 'm9', status: 'open', reason: 'offensive', note: null, text: 'please report me', attachment: null,
      sent_at: '2026-10-05T08:20:36', reported_at: '2026-10-05T08:21:00', reviewed_at: null,
      sender: { id: 'u5', username: 'fe_admin', profile_picture: null },
    });
    expect(r).toMatchObject({ id: 'rep', reason: 'offensive', resolved: false });
    expect(r.message).toMatchObject({ id: 'm9', text: 'please report me', senderId: 'u5' });
    expect(r.sender?.username).toBe('fe_admin');
    expect(toChatReport({ id: 'x', status: 'dismissed' }).resolved).toBe(true);
  });

  it('merges a fresh newest page over loaded history', () => {
    const m = (id: string, t: number): ChatMessage => ({ ...toMessage({ id, created_at: t }), createdAt: t });
    const shown = [m('a', 1), m('b', 2), m('c', 3), m('d', 4)];
    // Page of 2 newest: "d" was unsent, "e" arrived.
    expect(mergeNewest(shown, [m('c', 3), m('e', 5)], false).map((x) => x.id)).toEqual(['a', 'b', 'c', 'e']);
    expect(mergeNewest(shown, [m('e', 5)], true).map((x) => x.id)).toEqual(['e']);
    expect(prependOlder([m('c', 3), m('d', 4)], [m('b', 2), m('c', 3)]).map((x) => x.id)).toEqual(['b', 'c', 'd']);
  });
});
