import { Component, input, output } from '@angular/core';
import { IonButton, IonIcon, IonSkeletonText } from '@ionic/angular';

/** Loading skeleton, error with a retry button, or an empty message. */
@Component({
  selector: 'app-state-view',
  imports: [IonButton, IonIcon, IonSkeletonText],
  template: `
    @switch (state()) {
      @case ('loading') {
        <div class="skeletons" aria-busy="true" aria-label="Loading">
          @for (row of rowsArray(); track $index) {
            <div class="sk tb-tile">
              <ion-skeleton-text [animated]="true" style="width: 38%" />
              <ion-skeleton-text [animated]="true" style="width: 92%" />
              <ion-skeleton-text [animated]="true" style="width: 70%" />
            </div>
          }
        </div>
      }
      @case ('error') {
        <div class="box tb-tile" role="alert">
          <ion-icon name="cloud-offline-outline" aria-hidden="true" />
          <p>{{ message() || 'This could not be loaded.' }}</p>
          <ion-button fill="outline" size="small" (click)="retry.emit()">
            <ion-icon slot="start" name="refresh-outline" />Try again
          </ion-button>
        </div>
      }
      @case ('empty') {
        <div class="box tb-tile">
          <ion-icon name="sparkles-outline" aria-hidden="true" />
          <p>{{ message() }}</p>
          <ng-content />
        </div>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .skeletons { display: grid; gap: 12px; }
    .sk { padding: 16px; display: grid; gap: 6px; }
    .box { padding: 28px 20px; display: grid; justify-items: center; gap: 10px; text-align: center; }
    .box ion-icon { font-size: 28px; color: var(--tb-gold); }
    .box p { margin: 0; color: var(--tb-muted); max-width: 46ch; }
  `,
})
export class StateView {
  readonly state = input.required<'loading' | 'error' | 'empty'>();
  readonly message = input('');
  readonly rows = input(3);
  readonly retry = output<void>();

  protected rowsArray(): number[] {
    return Array.from({ length: this.rows() }, (_, i) => i);
  }
}
