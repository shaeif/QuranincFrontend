import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRouterLink,
  IonRouterLinkWithHref,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { Page, Reflection, ReflectionComment } from '../../core/api/models';
import { ReflectionApi, ReportReason } from '../../core/api/reflection-api';
import { AuthService } from '../../core/auth/auth.service';
import { getSurah } from '../../core/quran/surahs';
import { timeAgo } from '../../core/util/format';
import { inputValue } from '../../core/util/forms';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
import { SideColumn } from '../../shared/side-column';
import { StateView } from '../../shared/state-view';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'offensive', label: 'Offensive or hateful' },
  { value: 'incorrect', label: 'Misrepresents the verse' },
  { value: 'other', label: 'Something else' },
];

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
    IonRouterLinkWithHref,
    IonSpinner,
    IonTextarea,
    IonTitle,
    IonToolbar,
    Avatar,
    HeaderActions,
    ReflectionCard,
    SideColumn,
    StateView,
  ],
  templateUrl: './reflection-detail-page.html',
  styleUrl: './reflection-detail-page.scss',
})
export class ReflectionDetailPage {
  readonly id = input('');

  private readonly api = inject(ReflectionApi);
  private readonly library = inject(LibraryApi);
  protected readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly alerts = inject(AlertController);
  private readonly sheets = inject(ActionSheetController);
  private readonly router = inject(Router);
  protected readonly inputValue = inputValue;
  protected readonly timeAgo = timeAgo;

  protected readonly reflection = new Loadable<Reflection>();
  protected readonly comments = new Loadable<Page<ReflectionComment>>();
  protected readonly commentText = signal('');
  protected readonly commentBusy = signal(false);
  protected readonly commentError = signal('');
  protected readonly working = signal(false);
  protected readonly moreBusy = signal(false);
  private commentPage = 1;

  protected readonly surah = computed(() => getSurah(this.reflection.data()?.surah ?? 0));
  protected readonly isAuthor = computed(() => {
    const r = this.reflection.data();
    return !!r?.authorId && r.authorId === this.auth.user()?.id;
  });
  protected readonly canModerate = computed(() => this.auth.isModerator());

  constructor() {
    effect(() => {
      this.auth.user();
      if (this.id()) untracked(() => this.load());
    });
  }

  protected load(): void {
    this.reflection.load(this.api.get(this.id()));
    this.loadComments();
  }

  protected loadComments(): void {
    this.commentPage = 1;
    this.comments.load(this.api.comments(this.id()));
  }

  protected readonly moreComments = computed(() => {
    const p = this.comments.data();
    return !!p && p.items.length < p.total;
  });

  /** The next page of replies, after the ones shown (new ones may have been added here). */
  protected loadMoreComments(): void {
    if (this.moreBusy()) return;
    this.moreBusy.set(true);
    this.api.comments(this.id(), this.commentPage + 1).subscribe({
      next: (res) => {
        this.moreBusy.set(false);
        this.commentPage++;
        this.comments.data.update((p) => {
          if (!p) return p;
          const seen = new Set(p.items.map((c) => c.id));
          const items = [...p.items, ...res.items.filter((c) => !seen.has(c.id))];
          return { ...p, items, total: res.items.length ? res.total : items.length };
        });
      },
      error: (err: unknown) => {
        this.moreBusy.set(false);
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected patch(changes: Partial<Reflection>): void {
    this.reflection.data.update((r) => (r ? { ...r, ...changes } : r));
  }

  /* ---------- Follow and send (likes and bookmarks are on the card) ---------- */

  protected toggleFollow(): void {
    const r = this.reflection.data();
    if (!r || !this.auth.requireLogin()) return;
    const on = !r.followedByMe;
    this.patch({ followedByMe: on });
    this.library.follow('reflection', this.id(), on).subscribe({
      next: () => this.notify.show(on ? "You'll hear about new replies" : 'Unfollowed'),
      error: (err: unknown) => {
        this.patch({ followedByMe: !on });
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected sendInMessage(): void {
    const next = `/messages/new?reflection=${encodeURIComponent(this.id())}`;
    if (this.auth.requireLogin(next)) this.router.navigateByUrl(next);
  }

  /* ---------- Comments ---------- */

  protected addComment(event?: Event): void {
    event?.preventDefault();
    const text = this.commentText().trim();
    if (!text || this.commentBusy() || !this.auth.requireLogin()) return;
    this.commentBusy.set(true);
    this.commentError.set('');
    this.api.addComment(this.id(), text).subscribe({
      next: (c) => {
        this.commentBusy.set(false);
        this.commentText.set('');
        const user = this.auth.user();
        const comment = { ...c, authorName: c.authorName === 'Anonymous' && user ? user.username : c.authorName, authorId: c.authorId ?? user?.id };
        this.comments.data.update((p) => (p ? { ...p, items: [...p.items, comment], total: p.total + 1 } : p));
        this.patch({ commentCount: (this.reflection.data()?.commentCount ?? 0) + 1 });
      },
      error: (err: unknown) => {
        this.commentBusy.set(false);
        this.commentError.set(errorMessage(err));
      },
    });
  }

  protected canDeleteComment(c: ReflectionComment): boolean {
    const me = this.auth.user()?.id;
    return !!me && (c.authorId === me || this.isAuthor() || this.canModerate());
  }

  protected async deleteComment(c: ReflectionComment): Promise<void> {
    if (!(await this.confirm('Delete this reply?', 'This cannot be undone.', 'Delete'))) return;
    this.api.deleteComment(this.id(), c.id).subscribe({
      next: () => {
        this.comments.data.update((p) => (p ? { ...p, items: p.items.filter((x) => x.id !== c.id), total: Math.max(0, p.total - 1) } : p));
        this.patch({ commentCount: Math.max(0, (this.reflection.data()?.commentCount ?? 1) - 1) });
      },
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  /* ---------- Author, moderator, report ---------- */

  protected async remove(): Promise<void> {
    const r = this.reflection.data();
    if (!r) return;
    const who = this.isAuthor() ? 'your' : 'this';
    if (!(await this.confirm(`Delete ${who} reflection?`, 'Its likes, comments and bookmarks go with it. This cannot be undone.', 'Delete'))) return;
    this.working.set(true);
    this.api.remove(r.id).subscribe({
      next: () => {
        this.working.set(false);
        this.notify.show('Reflection deleted');
        this.router.navigateByUrl('/home', { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.working.set(false);
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected moderate(status: 'hidden' | 'published'): void {
    const r = this.reflection.data();
    if (!r) return;
    this.working.set(true);
    this.api.moderate(r.id, status).subscribe({
      next: () => {
        this.working.set(false);
        this.patch({ status });
        this.notify.show(status === 'hidden' ? 'Hidden from everyone but the author and moderators' : 'Restored');
      },
      error: (err: unknown) => {
        this.working.set(false);
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected async report(): Promise<void> {
    if (!this.auth.requireLogin()) return;
    const sheet = await this.sheets.create({
      header: 'Why are you reporting this?',
      buttons: [
        ...REASONS.map((r) => ({ text: r.label, data: r.value })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<ReportReason>();
    if (!data) return;
    const alert = await this.alerts.create({
      header: 'Add a note (optional)',
      message: 'Moderators read every report. Three reports from different people hide a reflection until it is reviewed.',
      inputs: [{ name: 'note', type: 'textarea', placeholder: 'What is wrong with it?', attributes: { maxlength: 500 } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Send report', role: 'confirm' },
      ],
    });
    await alert.present();
    const result = await alert.onDidDismiss<{ values?: { note?: string } }>();
    if (result.role !== 'confirm') return;
    this.api.report(this.id(), data, result.data?.values?.note).subscribe({
      next: () => this.notify.show('Thanks for the report. A moderator will look at it.'),
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  private async confirm(header: string, message: string, action: string): Promise<boolean> {
    const alert = await this.alerts.create({
      header,
      message,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: action, role: 'destructive' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'destructive';
  }
}
