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
  authorName: string;
  likeCount: number;
  commentCount: number;
  /** Milliseconds since epoch. */
  createdAt?: number;
  edited: boolean;
  status?: string;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
}

export interface ReflectionComment {
  id: string;
  text: string;
  authorName: string;
  authorId?: string;
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
