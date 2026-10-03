import { Component, input } from '@angular/core';

/** A number inside an eight-pointed star: surah numbers in lists. */
@Component({
  selector: 'app-star-number',
  template: `<span>{{ value() }}</span>`,
  host: { '[attr.aria-label]': '"Surah " + value()' },
  styles: `
    :host {
      position: relative; flex: none;
      width: 42px; height: 42px;
      display: grid; place-items: center;
      font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
      color: var(--tb-gold);
    }
    :host::before, :host::after {
      content: ''; position: absolute; inset: 7px;
      border: 1.5px solid var(--tb-gold-soft);
      border-radius: 3px; opacity: .75;
      transition: transform .4s ease;
    }
    :host::after { transform: rotate(45deg); }
    :host-context(.tb-hover:hover)::before { transform: rotate(45deg); }
    :host-context(.tb-hover:hover)::after { transform: rotate(90deg); }
    span { position: relative; }
  `,
})
export class StarNumber {
  readonly value = input.required<number>();
}
