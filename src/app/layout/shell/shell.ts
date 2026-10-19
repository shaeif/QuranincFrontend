import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonBadge,
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
import { ChatSyncService } from '../../core/chat/chat-sync.service';
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
    IonBadge,
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
  protected readonly chats = inject(ChatSyncService);

  /** Sidebar (desktop). */
  protected readonly nav: NavItem[] = [
    { tab: 'home', label: 'Home', icon: 'home' },
    { tab: 'reflections', label: 'Explore', icon: 'compass' },
    { tab: 'quran', label: 'Quran', icon: 'book' },
    { tab: 'search', label: 'Search', icon: 'search' },
    { tab: 'messages', label: 'Messages', icon: 'mail' },
  ];

  /** Bottom tabs (phones). Search lives in every header instead. */
  protected readonly tabs: NavItem[] = [
    { tab: 'home', label: 'Home', icon: 'home' },
    { tab: 'reflections', label: 'Explore', icon: 'compass' },
    { tab: 'quran', label: 'Quran', icon: 'book' },
    { tab: 'messages', label: 'Messages', icon: 'mail' },
    { tab: 'you', label: 'You', icon: 'person' },
  ];

  /** Sidebar, signed in. */
  protected readonly mine: NavItem[] = [
    { tab: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
    { tab: 'reading', label: 'Reading', icon: 'flame' },
  ];

}
