import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { Page, Reflection, ReflectionComment } from '../../core/api/models';
import { ReflectionApi } from '../../core/api/reflection-api';
import { getSurah } from '../../core/quran/surahs';
import { timeAgo } from '../../core/util/format';
import { Loadable } from '../../core/util/loadable';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { StateView } from '../../shared/state-view';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-reflection-detail-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRouterLink,
    IonTitle,
    IonToolbar,
    ReflectionCard,
    StateView,
    ThemeToggle,
  ],
  templateUrl: './reflection-detail-page.html',
  styleUrl: './reflection-detail-page.scss',
})
export class ReflectionDetailPage {
  readonly id = input('');

  private readonly api = inject(ReflectionApi);
  private readonly notify = inject(NotifyService);

  protected readonly reflection = new Loadable<Reflection>();
  protected readonly comments = new Loadable<Page<ReflectionComment>>();
  protected readonly surah = computed(() => getSurah(this.reflection.data()?.surah ?? 0));
  protected readonly timeAgo = timeAgo;

  constructor() {
    effect(() => {
      if (this.id()) untracked(() => this.load());
    });
  }

  protected load(): void {
    this.reflection.load(this.api.get(this.id()));
    this.loadComments();
  }

  protected loadComments(): void {
    this.comments.load(this.api.comments(this.id()));
  }

  protected join(action: string): void {
    this.notify.show(`Sign in to ${action}. Accounts open in the next update.`);
  }
}
