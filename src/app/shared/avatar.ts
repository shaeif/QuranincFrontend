import { Component, computed, input, signal } from '@angular/core';

/** Profile picture, or the first letter of the name on the accent gradient. */
@Component({
  selector: 'app-avatar',
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" alt="" (error)="failed.set(true)" />
    } @else {
      <span aria-hidden="true">{{ initial() }}</span>
    }
  `,
  host: { '[style.--size.px]': 'size()' },
  styles: `
    :host {
      --size: 32px;
      width: var(--size); height: var(--size); flex: none;
      border-radius: 50%; overflow: hidden;
      display: inline-grid; place-items: center;
      background: var(--tb-accent-gradient); color: #10141f;
      font-weight: 700; font-size: calc(var(--size) * .42); text-transform: uppercase;
      box-shadow: 0 0 0 2px var(--tb-bg), 0 0 0 3px var(--tb-glass-line);
    }
    img { width: 100%; height: 100%; object-fit: cover; }
  `,
})
export class Avatar {
  readonly name = input('');
  readonly src = input<string | undefined>(undefined);
  readonly size = input(32);
  protected readonly failed = signal(false);
  protected readonly initial = computed(() => this.name().replace(/^@/, '').charAt(0) || '?');
}
