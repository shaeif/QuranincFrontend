import { UserSummary } from '../api/models';

/** How long seen messages stay: 7 days (default), 30 days, or until deleted. */
export type Retention = '7d' | '30d' | 'keep';

export type AttachmentKind = 'ayah' | 'reflection' | 'comment';

/**
 * What a message can carry besides text. `ref` is what is sent: "2:255" for an
 * ayah, else the reflection or comment id. The rest is the preview the API returns.
 */
export interface Attachment {
  kind: AttachmentKind;
  ref: string;
  /** Ayah: Arabic text. */
  textAr?: string;
  /** Ayah: translation. Reflection or comment: its text (plain). */
  text?: string;
  authorName?: string;
  /** A shared comment's reflection, for the link. */
  reflectionId?: string;
  /** Hidden or deleted since it was shared. */
  unavailable?: boolean;
}

export interface ChatMessage {
  id: string;
  /** Empty for system notices (e.g. "kept for 30 days now"). */
  senderId: string;
  mine: boolean;
  text: string;
  attachment?: Attachment;
  /** A system notice rather than something a person wrote. */
  notice: boolean;
  createdAt?: number;
  /** When the recipient saw it (POST /chats/{id}/read). */
  seenAt?: number;
  /** Null when saved or when the chat keeps messages. */
  expiresAt?: number | null;
  savedByMe: boolean;
  /** Saved by either person, so it stays. */
  saved: boolean;
}

/** request_in: someone asked to message you. request_out: you asked, they haven't accepted. */
export type ChatState = 'active' | 'request_in' | 'request_out';

export interface ChatSummary {
  id: string;
  other: UserSummary;
  unread: number;
  retention: Retention;
  state: ChatState;
  lastMessage?: ChatMessage;
  updatedAt?: number;
}

export interface ChatUnread {
  messages: number;
  requests: number;
}

export interface BlockedUser extends UserSummary {
  blockedAt?: number;
}

export interface ChatReport {
  id: string;
  message: ChatMessage;
  sender?: UserSummary;
  reason: string;
  note?: string;
  createdAt?: number;
  resolved: boolean;
}

export type ChatReportReason = 'harassment' | 'spam' | 'offensive' | 'other';
