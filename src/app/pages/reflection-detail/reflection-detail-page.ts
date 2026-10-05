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
import { Observable } from 'rxjs';
import { errorMessage } from '../../core/api/api-client';
import { LibraryApi } from '../../core/api/library-api';
import { Page, Reflection, ReflectionComment } from '../../core/api/models';
import { ReflectionApi, ReportReason } from '../../core/api/reflection-api';
import { AuthService } from '../../core/auth/auth.service';
import { getSurah, verseRef } from '../../core/quran/surahs';
import { timeAgo } from '../../core/util/format';
import { inputValue } from '../../core/util/forms';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { HeaderActions } from '../../shared/header-actions';
import { NotifyService } from '../../shared/notify.service';
import { ReflectionCard } from '../../shared/reflection-card';
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
    this.comments.load(this.api.comments(this.id()));
  }

  private patch(changes: Partial<Reflection>): void {
    this.reflection.data.update((r) => (r ? { ...r, ...changes } : r));
  }

  /* ---------- Reactions ---------- */

  protected toggleLike(): void {
    const r = this.reflection.data();
    if (!r || !this.auth.requireLogin()) return;
    const on = !r.likedByMe;
    this.patch({ likedByMe: on, likeCount: Math.max(0, r.likeCount + (on ? 1 : -1)) });
    this.api.like(r.id, on).subscribe({
      next: (res) => this.patch({ likedByMe: res.liked, likeCount: res.count }),
      error: (err: unknown) => {
        this.patch({ likedByMe: r.likedByMe, likeCount: r.likeCount });
        // 409 means it was already in that state on the server.
        if ((err as { status?: number }).status === 409) this.patch({ likedByMe: on });
        else this.notify.show(errorMessage(err));
      },
    });
  }

  protected toggleBookmark(): void {
    this.toggle('bookmarkedByMe', (on) => this.library.bookmarkReflection(this.id(), on), 'Saved to bookmarks', 'Removed from bookmarks');
  }

  protected toggleFollow(): void {
    this.toggle('followedByMe', (on) => this.library.follow('reflection', this.id(), on), "You'll hear about new comments", 'Unfollowed');
  }

  private toggle(key: 'bookmarkedByMe' | 'followedByMe', request: (on: boolean) => Observable<unknown>, onText: string, offText: string): void {
    const r = this.reflection.data();
    if (!r || !this.auth.requireLogin()) return;
    const on = !r[key];
    this.patch({ [key]: on });
    request(on).subscribe({
      next: () => this.notify.show(on ? onText : offText),
      error: (err: unknown) => {
        this.patch({ [key]: !on });
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected share(): void {
    const r = this.reflection.data();
    if (!r) return;
    const url = `${location.origin}/reflections/${r.id}`;
    this.notify.share(`Reflection on ${verseRef(r.surah, r.ayah)}`, `${r.text.slice(0, 200)}${r.text.length > 200 ? '…' : ''}\n\n${url}`);
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
    if (!(await this.confirm('Delete this comment?', 'This cannot be undone.', 'Delete'))) return;
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
        this.router.navigateByUrl('/reflections', { replaceUrl: true });
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
