import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonRouterLinkWithHref,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { Revelation, SURAHS } from '../../core/quran/surahs';
import { LastReadService } from '../../core/settings/last-read.service';
import { StarNumber } from '../../shared/star-number';
import { StateView } from '../../shared/state-view';
import { HeaderActions } from '../../shared/header-actions';

type Filter = 'all' | Revelation;

/** Lowercase, no apostrophes/hyphens/spaces: "al-baqarah" and "Baqara" both match. */
function simplify(text: string): string {
  return text.toLowerCase().replace(/['ʿʾ\-\s]/g, '');
}

@Component({
  selector: 'app-quran-page',
  imports: [
    RouterLink,
    IonButtons,
    IonContent,
    IonHeader,
    IonRouterLinkWithHref,
    IonSearchbar,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    StarNumber,
    StateView,
    HeaderActions,
  ],
  templateUrl: './quran-page.html',
  styleUrl: './quran-page.scss',
})
export class QuranPage {
  protected readonly lastRead = inject(LastReadService);
  protected readonly query = signal('');
  protected readonly filter = signal<Filter>('all');

  protected readonly surahs = computed(() => {
    const q = simplify(this.query().trim());
    const f = this.filter();
    return SURAHS.filter((s) => {
      if (f !== 'all' && s.revelation !== f) return false;
      if (!q) return true;
      return (
        String(s.number) === q ||
        simplify(s.name).includes(q) ||
        simplify(s.name.replace(/^(al|an|ar|as|at|ash|adh|ad|az)-/i, '')).startsWith(q) ||
        simplify(s.meaning).includes(q) ||
        s.arabic.includes(this.query().trim())
      );
    });
  });

  protected setFilter(value: unknown): void {
    this.filter.set(value === 'Meccan' || value === 'Medinan' ? value : 'all');
  }
}
