import { Component, inject, input } from '@angular/core';
import { IonRange, IonToggle } from '@ionic/angular';
import { BISMILLAH } from '../core/quran/bismillah';
import { ARABIC_SCRIPTS } from '../core/quran/quran-texts';
import { ARABIC_SIZE, ReadingSettingsService } from '../core/settings/reading-settings.service';
import { ThemePreference, ThemeService } from '../core/theme/theme.service';

interface ThemeOption {
  value: ThemePreference;
  name: string;
  description: string;
}

/**
 * Theme, Quran text (script, English, transliteration) and text size.
 * The same choices in Settings and at sign-up; each takes effect at once and is saved on this device.
 */
@Component({
  selector: 'app-display-choices',
  imports: [IonRange, IonToggle],
  templateUrl: './display-choices.html',
  styleUrl: './display-choices.scss',
})
export class DisplayChoices {
  /** Smaller headings, for use inside a form. */
  readonly compact = input(false);

  protected readonly theme = inject(ThemeService);
  protected readonly reading = inject(ReadingSettingsService);
  protected readonly sizes = ARABIC_SIZE;
  protected readonly sample = BISMILLAH;
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
