import { describe, expect, it } from 'vitest';
import { toAttachment, toChat, toChatUnread, toMessage } from './chat-normalize';

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
});
