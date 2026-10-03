import { Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { LibraryApi } from '../../core/api/library-api';
import { ReadingStatus } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationBadgeService } from '../../core/auth/notification-badge.service';
import { getSurah } from '../../core/quran/surahs';
import { Loadable } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';

interface Tile {
  link: string;
  icon: string;
  label: string;
  hint: string;
}

@Component({
  selector: 'app-you-page',
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRouterLink,
    IonRouterLinkWithHref,
    IonTitle,
    IonToolbar,
    AuthPrompt,
    Avatar,
    HeaderActions,
  ],
  templateUrl: './you-page.html',
  styleUrl: './you-page.scss',
})
export class YouPage {
  protected readonly auth = inject(AuthService);
  protected readonly badge = inject(NotificationBadgeService);
  private readonly library = inject(LibraryApi);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  protected readonly reading = new Loadable<ReadingStatus>();
  protected readonly positionSurah = computed(() => getSurah(this.reading.data()?.position?.surah ?? 0));

  protected readonly tiles: Tile[] = [
    { link: '/feed', icon: 'newspaper-outline', label: 'Your feed', hint: 'From people and verses you follow' },
    { link: '/bookmarks', icon: 'bookmark-outline', label: 'Bookmarks', hint: 'Saved verses and reflections' },
    { link: '/likes', icon: 'heart-outline', label: 'Likes', hint: 'Verses and reflections you loved' },
    { link: '/following', icon: 'people-outline', label: 'Following', hint: 'People, verses, followers' },
    { link: '/reading', icon: 'flame-outline', label: 'Reading', hint: 'Streak and history' },
    { link: '/reflections/new', icon: 'create-outline', label: 'Write a reflection', hint: 'Share what a verse means to you' },
  ];

  constructor() {
    effect(() => {
      if (this.auth.user()) untracked(() => this.reading.load(this.library.reading()));
    });
  }

  protected logout(): void {
    this.auth.logout().subscribe(() => {
      this.notify.show('Logged out');
      this.router.navigateByUrl('/home', { replaceUrl: true });
    });
  }
}
