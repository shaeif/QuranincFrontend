import { Component, computed, input } from '@angular/core';
import { toArabicDigits } from '../core/util/format';

/** End-of-ayah marker: the ayah number in Arabic digits inside a small star. */
@Component({
  selector: 'app-ayah-marker',
  template: `{{ digits() }}`,
  host: { role: 'img', '[attr.aria-label]': '"Ayah " + number()' },
  styles: `
    :host {
      display: inline-grid; place-items: center;
      position: relative; vertical-align: middle;
      width: 1.35em; height: 1.35em; margin-inline: .2em;
      font-family: var(--tb-font-body); font-size: .55em; font-weight: 600;
      color: var(--tb-gold); line-height: 1;
    }
    :host::before, :host::after {
      content: ''; position: absolute; inset: .12em;
      border: 1px solid var(--tb-gold-soft); border-radius: 2px;
    }
    :host::after { transform: rotate(45deg); }
  `,
})
export class AyahMarker {
  readonly number = input.required<number>();
  protected readonly digits = computed(() => toArabicDigits(this.number()));
}
