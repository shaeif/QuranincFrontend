import { Component, effect, inject, signal, untracked } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { LibraryApi } from '../../core/api/library-api';
import { LikedVerse, Page, Reflection } from '../../core/api/models';
import { AuthService } from '../../core/auth/auth.service';
import { Loadable } from '../../core/util/loadable';
import { AuthPrompt } from '../../shared/auth-prompt';
import { HeaderActions } from '../../shared/header-actions';
import { ReflectionCard } from '../../shared/reflection-card';
import { StateView } from '../../shared/state-view';
import { VerseRow } from '../../shared/verse-row';

/** Verses (GET /user/likes/ayahs) and reflections (GET /user/likes) you liked. */
@Component({
  selector: 'app-likes-page',
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    AuthPrompt,
    HeaderActions,
    ReflectionCard,
    StateView,
    VerseRow,
  ],
  template: `
    <ion-header class="ion-no-border tb-header">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/you" text="" /></ion-buttons>
        <ion-title>Likes</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt next="/likes" />
        } @else {
          <section class="tb-page-intro tb-pattern">
            <p class="tb-eyebrow">What you loved</p>
            <h1 class="tb-display">Likes</h1>
            <ion-segment class="tb-segment" [value]="kind()" (ionChange)="kind.set($event.detail.value === 'reflection' ? 'reflection' : 'ayah')">
              <ion-segment-button value="ayah">Verses</ion-segment-button>
              <ion-segment-button value="reflection">Reflections</ion-segment-button>
            </ion-segment>
            <p class="tb-muted note">Nobody else can see which verses you like. They only add to each verse's count.</p>
          </section>
          @if (kind() === 'ayah') {
            @switch (ayahs.status()) {
              @case ('ready') {
                <div class="list">
                  @for (v of ayahs.data()!.items; track v.surah + ':' + v.ayah) {
                    <app-verse-row [verse]="v" />
                  } @empty {
                    <app-state-view state="empty" message="No liked verses yet. Tap the heart on an ayah in the reader." />
                  }
                </div>
              }
              @case ('error') { <app-state-view state="error" [message]="ayahs.error()" (retry)="load()" /> }
              @default { <app-state-view state="loading" /> }
            }
          } @else {
            @switch (reflections.status()) {
              @case ('ready') {
                <div class="list">
                  @for (r of reflections.data()!.items; track r.id) {
                    <app-reflection-card [reflection]="r" />
                  } @empty {
                    <app-state-view state="empty" message="No liked reflections yet." />
                  }
                </div>
              }
              @case ('error') { <app-state-view state="error" [message]="reflections.error()" (retry)="load()" /> }
              @default { <app-state-view state="loading" /> }
            }
          }
        }
      </div>
    </ion-content>
  `,
  styles: `.list { display: grid; gap: 10px; } .note { font-size: 12.5px; }`,
})
export class LikesPage {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(LibraryApi);
  protected readonly kind = signal<'ayah' | 'reflection'>('ayah');
  protected readonly ayahs = new Loadable<Page<LikedVerse>>();
  protected readonly reflections = new Loadable<Page<Reflection>>();

  constructor() {
    effect(() => {
      if (this.auth.user()) untracked(() => this.load());
    });
  }

  ionViewWillEnter(): void {
    if (this.auth.user()) this.load();
  }

  protected load(): void {
    this.ayahs.load(this.api.likedAyahs());
    this.reflections.load(this.api.likedReflections());
  }
}
