import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { errorMessage } from '../core/api/api-client';
import { LibraryApi } from '../core/api/library-api';
import { Reflection } from '../core/api/models';
import { ReflectionApi } from '../core/api/reflection-api';
import { AuthService } from '../core/auth/auth.service';
import { UserNamesService } from '../core/auth/user-names.service';
import { verseRef } from '../core/quran/surahs';
import { timeAgo } from '../core/util/format';
import { AyahQuote } from './ayah-quote';
import { Avatar } from './avatar';
import { NotifyService } from './notify.service';

/**
 * A reflection as a post: author, text, the quoted ayah, tags, and reply,
 * like, bookmark and share actions. Likes and bookmarks are sent from here;
 * `changed` reports the new state to pages that keep their own copy.
 */
@Component({
  selector: 'app-reflection-card',
  imports: [RouterLink, IonIcon, AyahQuote, Avatar],
  template: `
    @let r = post();
    <article class="post" [class.large]="large()" [class.hidden-r]="r.status === 'hidden'">
      @if (link()) {
        <a class="cover" [routerLink]="['/reflections', r.id]" [attr.aria-label]="'Open reflection by ' + handle()"></a>
      }
      <div class="side">
        @if (r.authorId) {
          <a class="lift" [routerLink]="['/users', r.authorId]" [attr.aria-label]="handle() + ', profile'">
            <app-avatar [name]="author()" [src]="picture()" [size]="large() ? 46 : 40" />
          </a>
        } @else {
          <app-avatar [name]="author()" [src]="picture()" [size]="large() ? 46 : 40" />
        }
      </div>
      <div class="main">
        <header>
          @if (r.authorId) {
            <a class="author lift" [routerLink]="['/users', r.authorId]">{{ handle() }}</a>
          } @else {
            <b class="author">{{ handle() }}</b>
          }
          <span class="tb-muted" aria-hidden="true">·</span>
          <time class="tb-muted" [attr.datetime]="iso()" [title]="full()">{{ ago() }}</time>
          @if (r.edited) {
            <span class="tb-muted edited">· edited</span>
          }
        </header>
        @if (r.status === 'hidden') {
          <p class="flag"><ion-icon name="eye-off-outline" aria-hidden="true" /> Hidden from others after reports</p>
        }
        <p class="text" [class.clamp]="clamp()">{{ r.text }}</p>
        @if (r.highlightText) {
          <blockquote>“{{ r.highlightText }}”</blockquote>
        }
        @if (showAyah()) {
          <app-ayah-quote [surah]="r.surah" [ayah]="r.ayah" [clamp]="clamp()" />
        }
        @if (r.tags.length) {
          <div class="tags">
            @for (tag of r.tags.slice(0, clamp() ? 4 : 20); track tag) {
              <a class="tb-chip lift" [routerLink]="['/reflections']" [queryParams]="{ tag }">{{ tag }}</a>
            }
          </div>
        }
        <footer role="group" aria-label="Actions">
          <a class="act lift" [routerLink]="['/reflections', r.id]" [attr.aria-label]="r.commentCount + ' replies'" title="Reply">
            <ion-icon name="chatbubble-outline" aria-hidden="true" /><span>{{ r.commentCount || '' }}</span>
          </a>
          <button type="button" class="act lift like" [class.on]="r.likedByMe" (click)="toggleLike()"
            [attr.aria-pressed]="r.likedByMe" [attr.aria-label]="r.likeCount + ' likes'" title="Like">
            <ion-icon [name]="r.likedByMe ? 'heart' : 'heart-outline'" aria-hidden="true" /><span>{{ r.likeCount || '' }}</span>
          </button>
          <button type="button" class="act lift" [class.on]="r.bookmarkedByMe" (click)="toggleBookmark()"
            [attr.aria-pressed]="r.bookmarkedByMe" [attr.aria-label]="r.bookmarkedByMe ? 'Remove bookmark' : 'Bookmark'" title="Bookmark">
            <ion-icon [name]="r.bookmarkedByMe ? 'bookmark' : 'bookmark-outline'" aria-hidden="true" />
          </button>
          <button type="button" class="act lift" (click)="share()" aria-label="Share" title="Share">
            <ion-icon name="share-social-outline" aria-hidden="true" />
          </button>
        </footer>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    /* Standalone it is a card; inside .tb-timeline it is a row between dividers. */
    .post {
      position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px;
      padding: 14px 16px 6px;
      background: var(--tb-post-bg, var(--tb-glass));
      border: var(--tb-post-border, 1px solid var(--tb-glass-line));
      border-radius: var(--tb-post-radius, var(--tb-radius-card));
      transition: background-color .2s ease;
    }
    .post:has(.cover):hover { background: var(--tb-post-hover, var(--tb-glass-strong)); }
    .hidden-r { outline: 1px dashed var(--tb-gold-soft); outline-offset: -4px; }
    .cover { position: absolute; inset: 0; border-radius: inherit; z-index: 0; }
    .lift { position: relative; z-index: 1; }
    .main { display: grid; gap: 8px; min-width: 0; }
    header { display: flex; align-items: baseline; gap: 6px; font-size: 14px; min-width: 0; }
    .author { color: var(--tb-fg); font-weight: 700; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    a.author:hover { text-decoration: underline; }
    time, .edited { font-size: 13px; white-space: nowrap; }
    .flag { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--tb-gold); }
    .text { margin: 0; font-size: 15px; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
    .large .text { font-size: 17px; }
    .clamp { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
    blockquote {
      margin: 0; padding-inline-start: 12px; border-inline-start: 2px solid var(--tb-gold-soft);
      color: var(--tb-muted); font-style: italic; font-size: 14px;
    }
    .tags { display: flex; flex-wrap: wrap; gap: 6px; }
    footer { display: flex; justify-content: space-between; max-width: 360px; margin-inline-start: -8px; }
    .act {
      display: inline-flex; align-items: center; gap: 4px; min-width: 44px; min-height: 36px; padding: 0 8px;
      border: 0; border-radius: 999px; background: none; color: var(--tb-muted); font: inherit; font-size: 13px;
      font-variant-numeric: tabular-nums; text-decoration: none; cursor: pointer;
      transition: color .15s ease, background-color .15s ease;
    }
    .act ion-icon { font-size: 18px; }
    .act:hover { color: var(--tb-gold); background: var(--tb-chip-bg); }
    .act.on { color: var(--tb-gold); }
  `,
})
export class ReflectionCard {
  readonly reflection = input.required<Reflection>();
  readonly clamp = input(true);
  /** Whether the card opens the reflection (off on the reflection's own page). */
  readonly link = input(true);
  /** Off where the ayah is already shown above, like the ayah page. */
  readonly showAyah = input(true);
  /** Bigger text, for the reflection's own page. */
  readonly large = input(false);
  readonly changed = output<Reflection>();

  private readonly names = inject(UserNamesService);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ReflectionApi);
  private readonly library = inject(LibraryApi);
  private readonly notify = inject(NotifyService);

  /** What is shown: the input, plus likes and bookmarks made here. */
  protected readonly post = linkedSignal(() => this.reflection());

  /** The API's name if it sent one, else the looked-up username. */
  private readonly resolved = computed(() => {
    const r = this.post();
    return !r.authorName && r.authorId ? this.names.get(r.authorId)() : null;
  });
  protected readonly author = computed(() => this.post().authorName || this.resolved()?.username || '');
  protected readonly handle = computed(() => {
    const name = this.author();
    if (name === 'deleted user') return 'Deleted account';
    return name ? '@' + name : 'A member';
  });
  protected readonly picture = computed(() => this.post().authorPictureUrl ?? this.resolved()?.pictureUrl);

  protected readonly ago = computed(() => timeAgo(this.post().createdAt));
  protected readonly iso = computed(() => {
    const t = this.post().createdAt;
    return t ? new Date(t).toISOString() : null;
  });
  protected readonly full = computed(() => {
    const t = this.post().createdAt;
    return t ? new Date(t).toLocaleString() : '';
  });

  private patch(changes: Partial<Reflection>): void {
    this.post.update((r) => ({ ...r, ...changes }));
    this.changed.emit(this.post());
  }

  protected toggleLike(): void {
    const r = this.post();
    if (!this.auth.requireLogin()) return;
    const on = !r.likedByMe;
    this.patch({ likedByMe: on, likeCount: Math.max(0, r.likeCount + (on ? 1 : -1)) });
    this.api.like(r.id, on).subscribe({
      next: (res) => this.patch({ likedByMe: res.liked, likeCount: res.count }),
      error: (err: unknown) => {
        // 409 means it was already in that state on the server.
        if ((err as { status?: number }).status === 409) return;
        this.patch({ likedByMe: r.likedByMe, likeCount: r.likeCount });
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected toggleBookmark(): void {
    const r = this.post();
    if (!this.auth.requireLogin()) return;
    const on = !r.bookmarkedByMe;
    this.patch({ bookmarkedByMe: on });
    this.library.bookmarkReflection(r.id, on).subscribe({
      next: () => this.notify.show(on ? 'Saved to bookmarks' : 'Removed from bookmarks'),
      error: (err: unknown) => {
        this.patch({ bookmarkedByMe: !on });
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected share(): void {
    const r = this.post();
    const url = `${location.origin}/reflections/${r.id}`;
    const text = `${r.text.slice(0, 200)}${r.text.length > 200 ? '…' : ''}`;
    this.notify.share(`Reflection on ${verseRef(r.surah, r.ayah)}`, `${text}\n\n${url}`);
  }
}
