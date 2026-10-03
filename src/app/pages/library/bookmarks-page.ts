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

/** Saved verses and reflections (GET /user/bookmarks?kind=). */
@Component({
  selector: 'app-bookmarks-page',
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
        <ion-title>Bookmarks</ion-title>
        <ion-buttons slot="end"><app-header-actions /></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="tb-content">
      <div class="tb-container tb-container--narrow">
        @if (!auth.isLoggedIn()) {
          <app-auth-prompt title="Save what moves you" message="Log in to bookmark verses and reflections and find them here." next="/bookmarks" />
        } @else {
          <section class="tb-page-intro tb-pattern">
            <p class="tb-eyebrow">Saved for later</p>
            <h1 class="tb-display">Bookmarks</h1>
            <ion-segment class="tb-segment" [value]="kind()" (ionChange)="kind.set($event.detail.value === 'reflection' ? 'reflection' : 'ayah')">
              <ion-segment-button value="ayah">Verses</ion-segment-button>
              <ion-segment-button value="reflection">Reflections</ion-segment-button>
            </ion-segment>
          </section>
          @if (kind() === 'ayah') {
            @switch (ayahs.status()) {
              @case ('ready') {
                <div class="list">
                  @for (v of ayahs.data()!.items; track v.surah + ':' + v.ayah) {
                    <app-verse-row [verse]="v" />
                  } @empty {
                    <app-state-view state="empty" message="No saved verses yet. Tap the bookmark on any ayah in the reader." />
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
                    <app-state-view state="empty" message="No saved reflections yet." />
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
  styles: `.list { display: grid; gap: 10px; }`,
})
export class BookmarksPage {
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
    this.ayahs.load(this.api.bookmarkedAyahs());
    this.reflections.load(this.api.bookmarkedReflections());
  }
}
