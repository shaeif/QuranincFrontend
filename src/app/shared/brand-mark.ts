import { Component, input } from '@angular/core';

/** تدبّر wordmark with its Latin name. */
@Component({
  selector: 'app-brand-mark',
  template: `
    <span class="mark" aria-hidden="true">
      <svg viewBox="0 0 40 40">
        <rect x="11" y="11" width="18" height="18" />
        <rect x="11" y="11" width="18" height="18" transform="rotate(45 20 20)" />
        <circle cx="20" cy="20" r="3.2" />
      </svg>
    </span>
    <span class="words">
      <span class="latin">Tadabbur</span>
      @if (!compact()) {
        <span class="arabic" lang="ar">تَدَبُّر</span>
      }
    </span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; color: var(--tb-fg); }
    .mark { width: 34px; height: 34px; display: grid; place-items: center; flex: none; }
    svg { width: 100%; height: 100%; overflow: visible; }
    rect { fill: none; stroke: var(--tb-gold); stroke-width: 1.8; }
    circle { fill: var(--tb-teal); filter: drop-shadow(0 0 4px var(--tb-teal)); }
    .words { display: grid; line-height: 1.05; }
    .latin {
      font-family: var(--tb-font-display);
      font-size: calc(21px * var(--tb-display-scale));
      letter-spacing: var(--tb-display-tracking);
    }
    .arabic { font-family: var(--tb-font-quran); font-size: 14px; color: var(--tb-gold); line-height: 1.3; }
  `,
})
export class BrandMark {
  readonly compact = input(false);
}
