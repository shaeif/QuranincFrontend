import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { DisplayChoices } from '../../shared/display-choices';

@Component({
  selector: 'app-settings-page',
  imports: [IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, DisplayChoices],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  protected readonly apiUrl = environment.apiUrl;

  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly content = viewChild(IonContent);

  /** /settings#quran-text (from the reader) opens at that section. */
  async ionViewDidEnter(): Promise<void> {
    const id = this.route.snapshot.fragment;
    const target = id ? this.host.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null;
    const content = this.content();
    if (!target || !content) return;
    // Scroll ion-content itself; scrollIntoView would also shift Ionic's outer containers.
    const scroller = await content.getScrollElement();
    const y = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 12;
    content.scrollToPoint(0, Math.max(0, y), 400);
  }
}
