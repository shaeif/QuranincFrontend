import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonLabel,
  IonMenu,
  IonRouterLinkWithHref,
  IonSplitPane,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular';
import { ThemePreference, ThemeService } from '../../core/theme/theme.service';
import { BrandMark } from '../../shared/brand-mark';

interface NavItem {
  tab: string;
  label: string;
  icon: string;
}

/**
 * App frame: bottom tabs on phones; on screens 992px and wider the tab bar
 * hides and a sidebar with the same destinations stays open on the left.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    IonContent,
    IonIcon,
    IonLabel,
    IonMenu,
    IonRouterLinkWithHref,
    IonSplitPane,
    IonTabBar,
    IonTabButton,
    IonTabs,
    BrandMark,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly theme = inject(ThemeService);

  protected readonly nav: NavItem[] = [
    { tab: 'home', label: 'Home', icon: 'home' },
    { tab: 'quran', label: 'Quran', icon: 'book' },
    { tab: 'reflections', label: 'Reflections', icon: 'chatbubbles' },
    { tab: 'search', label: 'Search', icon: 'search' },
  ];

  protected readonly themes: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'pearl', label: 'Pearl', icon: 'sunny-outline' },
    { value: 'night', label: 'Night', icon: 'moon-outline' },
    { value: 'system', label: 'Phone', icon: 'phone-portrait-outline' },
  ];
}
