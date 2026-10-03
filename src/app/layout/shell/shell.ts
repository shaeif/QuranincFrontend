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
import { AuthService } from '../../core/auth/auth.service';
import { NotificationBadgeService } from '../../core/auth/notification-badge.service';
import { Avatar } from '../../shared/avatar';
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
    Avatar,
    BrandMark,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly badge = inject(NotificationBadgeService);

  protected readonly nav: NavItem[] = [
    { tab: 'home', label: 'Home', icon: 'home' },
    { tab: 'quran', label: 'Quran', icon: 'book' },
    { tab: 'reflections', label: 'Reflections', icon: 'chatbubbles' },
    { tab: 'search', label: 'Search', icon: 'search' },
  ];

  protected readonly tabs: NavItem[] = [...this.nav, { tab: 'you', label: 'You', icon: 'person' }];

  protected readonly mine: NavItem[] = [
    { tab: 'feed', label: 'Your feed', icon: 'newspaper' },
    { tab: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
    { tab: 'reading', label: 'Reading', icon: 'flame' },
  ];

}
