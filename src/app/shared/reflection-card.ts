import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { Reflection } from '../core/api/models';
import { verseRef } from '../core/quran/surahs';
import { timeAgo } from '../core/util/format';

/** A reflection in a list: author, verse, text (clamped), tags and counts. */
@Component({
  selector: 'app-reflection-card',
  imports: [RouterLink, IonIcon],
  template: `
    @let r = reflection();
    <article class="card tb-glass">
      <a class="cover" [routerLink]="['/reflections', r.id]" [attr.aria-label]="'Read reflection by ' + r.authorName">
      </a>
      <header>
        <span class="avatar" aria-hidden="true">{{ initial() }}</span>
        <span class="who"><b>{{ '@' + r.authorName }}</b><span class="tb-muted"> on </span>
          <a class="ref" [routerLink]="['/quran', r.surah]" [queryParams]="{ ayah: r.ayah }">{{ ref() }}</a></span>
        <time class="tb-muted" [attr.datetime]="iso()">{{ ago() }}</time>
      </header>
      @if (r.highlightText) {
        <blockquote>“{{ r.highlightText }}”</blockquote>
      }
      <p class="text" [class.clamp]="clamp()">{{ r.text }}</p>
      <footer>
        <div class="tb-chip-row">
          @for (tag of r.tags.slice(0, 4); track tag) {
            <a class="tb-chip" [routerLink]="['/reflections']" [queryParams]="{ tag }">{{ tag }}</a>
          }
        </div>
        <span class="counts tb-muted">
          <span><ion-icon name="heart-outline" aria-label="Likes" /> {{ r.likeCount }}</span>
          <span><ion-icon name="chatbubble-outline" aria-label="Comments" /> {{ r.commentCount }}</span>
        </span>
      </footer>
    </article>
  `,
  styles: `
    :host { display: block; }
    .card { position: relative; padding: 16px; display: grid; gap: 10px; transition: transform .2s ease, border-color .2s ease; }
    .card:hover { transform: translateY(-2px); border-color: var(--tb-gold-soft); }
    .cover { position: absolute; inset: 0; border-radius: inherit; z-index: 0; }
    header, footer, .ref, .tb-chip { position: relative; z-index: 1; }
    header { display: flex; align-items: center; gap: 10px; font-size: 13px; min-width: 0; }
    .avatar {
      width: 30px; height: 30px; border-radius: 50%; flex: none;
      display: grid; place-items: center; font-weight: 700; font-size: 13px;
      background: var(--tb-accent-gradient); color: #10141f; text-transform: uppercase;
    }
    .who { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ref { color: var(--tb-gold); text-decoration: none; font-weight: 600; }
    time { font-size: 12px; white-space: nowrap; }
    blockquote {
      margin: 0; padding-inline-start: 12px; border-inline-start: 2px solid var(--tb-gold-soft);
      color: var(--tb-muted); font-style: italic; font-size: 14px;
    }
    .text { margin: 0; line-height: 1.6; white-space: pre-line; overflow-wrap: anywhere; }
    .clamp { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .counts { display: inline-flex; gap: 14px; font-size: 13px; font-variant-numeric: tabular-nums; }
    .counts span { display: inline-flex; align-items: center; gap: 4px; }
  `,
})
export class ReflectionCard {
  readonly reflection = input.required<Reflection>();
  readonly clamp = input(true);

  protected readonly initial = computed(() => this.reflection().authorName.charAt(0) || '?');
  protected readonly ref = computed(() => verseRef(this.reflection().surah, this.reflection().ayah));
  protected readonly ago = computed(() => timeAgo(this.reflection().createdAt));
  protected readonly iso = computed(() => {
    const t = this.reflection().createdAt;
    return t ? new Date(t).toISOString() : null;
  });
}
