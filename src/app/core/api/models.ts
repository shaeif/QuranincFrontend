/** App-side shapes. Raw API responses are mapped to these in normalize.ts. */

export interface Verse {
  surah: number;
  ayah: number;
  textAr: string;
  translation: string;
  transliteration?: string;
}

export interface SearchVerse extends Verse {
  /** Safe HTML: escaped text with only <em> tags around the matches. */
  highlightAr?: string;
  highlightEn?: string;
}

export interface LikedVerse extends Verse {
  likeCount: number;
}

export interface Reflection {
  id: string;
  text: string;
  surah: number;
  ayah: number;
  highlightText?: string;
  tags: string[];
  authorId?: string;
  /** Empty when the API sends only created_by_id; UserNamesService looks it up. */
  authorName: string;
  authorPictureUrl?: string;
  likeCount: number;
  commentCount: number;
  /** Milliseconds since epoch. */
  createdAt?: number;
  edited: boolean;
  status?: string;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  followedByMe: boolean;
}

export interface ReflectionComment {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
  authorPictureUrl?: string;
  createdAt?: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type ReflectionSort = 'activity' | 'newest' | 'oldest' | 'likes' | 'comments';

export type Role = 'user' | 'moderator' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  role: Role;
  emailVerified?: boolean;
  pictureUrl?: string;
  twoFactorEnabled?: boolean;
  /** How many two-step recovery codes are still unused. */
  recoveryCodesLeft?: number;
  createdAt?: number;
  /** The profile exactly as the API sent it (used to know which fields can be edited). */
  raw: Record<string, unknown>;
}

export interface UserSummary {
  id: string;
  username: string;
  pictureUrl?: string;
}

export interface AuthorPage {
  author: UserSummary & { followedByMe: boolean; deleted?: boolean };
  stats: { reflections: number; likesReceived: number; followers: number; following: number | null };
  reflections: Page<Reflection>;
}

export interface AppNotification {
  id: string;
  kind: string;
  actor?: UserSummary;
  actorCount: number;
  reflectionId?: string;
  reflectionSurah?: number;
  reflectionAyah?: number;
  commentText?: string;
  read: boolean;
  createdAt?: number;
}

export interface ReadingStreak {
  current: number;
  longest: number;
  lastReadDate?: string;
  readToday: boolean;
  timeZone?: string;
}

export interface ReadingStatus {
  position?: { surah: number; ayah: number; quranType?: string; textAr?: string; translation?: string };
  streak: ReadingStreak;
}

export interface ReadingHistoryEntry {
  surah: number;
  ayah: number;
  at?: number;
}

export interface ReportGroup {
  reflection: Reflection;
  reports: number;
  reasons: string[];
  notes: string[];
}

export type FollowKind = 'user' | 'ayah' | 'reflection';

export interface FollowEntry {
  kind: FollowKind;
  target: string;
  label: string;
  unavailable?: boolean;
}

export interface FeedItem {
  reflection: Reflection;
  because: string[];
}

export interface Session {
  accessToken: string;
  refreshToken: string;
}

export interface TwoFactorChallenge {
  challenge: string;
}
