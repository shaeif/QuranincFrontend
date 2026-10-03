import { Component, computed, inject } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { ThemeService } from '../core/theme/theme.service';

/** Sun/moon header button: switches between Pearl & Gold and Celestial Night. */
@Component({
  selector: 'app-theme-toggle',
  imports: [IonButton, IonIcon],
  template: `
    <ion-button fill="clear" (click)="theme.toggle()" [attr.aria-label]="label()" [title]="label()">
      <ion-icon slot="icon-only" [name]="isNight() ? 'sunny-outline' : 'moon-outline'" />
    </ion-button>
  `,
  styles: `ion-button { --color: var(--tb-gold); }`,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly isNight = computed(() => this.theme.theme() === 'night');
  protected readonly label = computed(() => (this.isNight() ? 'Switch to Pearl (light)' : 'Switch to Night (dark)'));
}
