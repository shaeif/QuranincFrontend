import { Component, inject } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonRange,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { BISMILLAH } from '../../core/quran/bismillah';
import { ARABIC_SCRIPTS } from '../../core/quran/quran-texts';
import { ARABIC_SIZE, ReadingSettingsService } from '../../core/settings/reading-settings.service';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';

interface ThemeOption {
  value: ThemePreference;
  name: string;
  description: string;
}

@Component({
  selector: 'app-settings-page',
  imports: [IonBackButton, IonButtons, IonContent, IonHeader, IonRange, IonTitle, IonToggle, IonToolbar],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
})
export class SettingsPage {
  protected readonly theme = inject(ThemeService);
  protected readonly reading = inject(ReadingSettingsService);
  protected readonly sizes = ARABIC_SIZE;
  protected readonly sample = BISMILLAH;
  protected readonly apiUrl = environment.apiUrl;
  protected readonly scripts = ARABIC_SCRIPTS;

  protected readonly themes: ThemeOption[] = [
    { value: 'pearl', name: 'Pearl & Gold', description: 'Bright pearl, gold geometry and teal. Easy to read in daylight.' },
    { value: 'night', name: 'Celestial Night', description: 'Midnight blue with glowing gold and teal. Gentle at night.' },
    { value: 'system', name: 'Follow my phone', description: 'Pearl when your device is light, Night when it is dark.' },
  ];

  protected onSize(value: unknown): void {
    this.reading.setArabicSize(Number(value));
  }
}
