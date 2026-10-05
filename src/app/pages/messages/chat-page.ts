import { Component, computed, DestroyRef, effect, ElementRef, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonToolbar,
} from '@ionic/angular';
import { errorMessage } from '../../core/api/api-client';
import { AuthService } from '../../core/auth/auth.service';
import { UserNamesService } from '../../core/auth/user-names.service';
import { ChatApi } from '../../core/chat/chat-api';
import { Attachment, ChatMessage, ChatReportReason, ChatSummary, Retention } from '../../core/chat/chat-models';
import { ChatSyncService } from '../../core/chat/chat-sync.service';
import { getSurah, SURAHS } from '../../core/quran/surahs';
import { inputValue } from '../../core/util/forms';
import { AttachmentCard } from '../../shared/attachment-card';
import { Avatar } from '../../shared/avatar';
import { NotifyService } from '../../shared/notify.service';
import { StateView } from '../../shared/state-view';

const RETENTION_LABEL: Record<Retention, string> = {
  '7d': 'Messages disappear 7 days after they’re seen',
  '30d': 'Messages disappear 30 days after they’re seen',
  keep: 'Messages in this chat are kept',
};

const POLL_MS = 5000;

interface DayGroup {
  label: string;
  messages: ChatMessage[];
}

@Component({
  selector: 'app-chat-page',
  imports: [
    RouterLink,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonTextarea,
    IonToolbar,
    AttachmentCard,
    Avatar,
    StateView,
  ],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
})
export class ChatPage {
  readonly id = input('');

  private readonly api = inject(ChatApi);
  protected readonly auth = inject(AuthService);
  private readonly names = inject(UserNamesService);
  private readonly sync = inject(ChatSyncService);
  private readonly notify = inject(NotifyService);
  private readonly sheets = inject(ActionSheetController);
  private readonly alerts = inject(AlertController);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly content = viewChild(IonContent);
  protected readonly inputValue = inputValue;
  protected readonly surahs = SURAHS;

  protected readonly chat = signal<ChatSummary | null>(null);
  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly error = signal('');
  protected readonly draft = signal('');
  protected readonly attachment = signal<Attachment | null>(null);
  protected readonly sending = signal(false);
  protected readonly picking = signal(false);
  protected readonly pickSurah = signal(1);
  protected readonly pickAyah = signal(1);

  protected readonly other = computed(() => {
    const c = this.chat();
    if (!c) return null;
    const known = c.other.username && c.other.username !== 'Anonymous' ? c.other : null;
    return known ?? (c.other.id ? this.names.get(c.other.id)() : null) ?? c.other;
  });
  protected readonly retentionText = computed(() => RETENTION_LABEL[this.chat()?.retention ?? '7d']);
  protected readonly myMessagesInRequest = computed(() => this.messages().filter((m) => m.mine).length);
  protected readonly canSend = computed(() => {
    const c = this.chat();
    return !(c?.state === 'request_out' && this.myMessagesInRequest() >= 3);
  });
  protected readonly lastSeenMine = computed(() => [...this.messages()].reverse().find((m) => m.mine && m.seenAt)?.id);
  protected readonly groups = computed<DayGroup[]>(() => {
    const out: DayGroup[] = [];
    for (const m of this.messages()) {
      const label = dayLabel(m.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.messages.push(m);
      else out.push({ label, messages: [m] });
    }
    return out;
  });
  protected readonly ayahOptions = computed(() => Array.from({ length: getSurah(this.pickSurah())?.ayahs ?? 0 }, (_, i) => i + 1));

  constructor() {
    effect(() => {
      const id = this.id();
      if (id && this.auth.user()) untracked(() => this.load(id));
    });
    const destroy = inject(DestroyRef);
    this.sync.pulse(POLL_MS).pipe(takeUntilDestroyed(destroy)).subscribe(() => this.poll());
    this.sync.changed.pipe(takeUntilDestroyed(destroy)).subscribe((chatId) => (!chatId || chatId === this.id()) && this.poll());
  }

  private load(id: string): void {
    this.status.set('loading');
    this.api.get(id).subscribe({
      next: (c) => this.chat.set(c),
      error: () => undefined,
    });
    this.api.messages(id).subscribe({
      next: (page) => {
        this.messages.set(page.items);
        this.status.set('ready');
        this.afterNewMessages(true);
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.status.set('error');
      },
    });
  }

  protected retry(): void {
    this.load(this.id());
  }

  /** Picks up new messages, unsends and seen receipts. */
  private poll(): void {
    const id = this.id();
    if (!id || this.status() !== 'ready') return;
    this.api.messages(id).subscribe({
      next: (page) => {
        const before = this.messages();
        const changed =
          page.items.length !== before.length ||
          page.items.some((m, i) => m.id !== before[i]?.id || m.seenAt !== before[i]?.seenAt || m.saved !== before[i]?.saved);
        if (!changed) return;
        const grew = page.items.length > before.length;
        this.messages.set(page.items);
        if (grew) this.afterNewMessages(false);
      },
      error: () => undefined,
    });
    this.api.get(id).subscribe({ next: (c) => this.chat.set(c), error: () => undefined });
  }

  /** Scroll to the newest and tell the server we've seen the other person's messages. */
  private afterNewMessages(instant: boolean): void {
    setTimeout(() => this.content()?.scrollToBottom(instant ? 0 : 300), 30);
    const hasUnseen = this.messages().some((m) => !m.mine && !m.notice && !m.seenAt);
    if (hasUnseen && this.chat()?.state !== 'request_in' && document.visibilityState === 'visible') {
      this.api.markSeen(this.id()).subscribe({ next: () => this.sync.refreshBadge(), error: () => undefined });
    }
  }

  /* ---------- Sending ---------- */

  protected send(event?: Event): void {
    event?.preventDefault();
    const text = this.draft().trim();
    const attachment = this.attachment();
    if ((!text && !attachment) || this.sending() || !this.canSend()) return;
    this.sending.set(true);
    this.api.send(this.id(), { text, attachment: attachment ?? undefined }).subscribe({
      next: (m) => {
        this.sending.set(false);
        this.draft.set('');
        this.attachment.set(null);
        const sent = { ...m, mine: true, text: m.text || text, attachment: m.attachment ?? attachment ?? undefined };
        this.messages.update((list) => [...list, sent]);
        // Replying to a request accepts it.
        this.chat.update((c) => (c && c.state === 'request_in' ? { ...c, state: 'active' } : c));
        setTimeout(() => this.content()?.scrollToBottom(300), 30);
      },
      error: (err: unknown) => {
        this.sending.set(false);
        this.notify.show(errorMessage(err));
      },
    });
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !('ontouchstart' in window)) {
      event.preventDefault();
      this.send();
    }
  }

  protected openAyahPicker(): void {
    this.picking.set(!this.picking());
  }

  protected setPickSurah(value: unknown): void {
    const s = getSurah(Number(value));
    if (!s) return;
    this.pickSurah.set(s.number);
    if (this.pickAyah() > s.ayahs) this.pickAyah.set(1);
  }

  protected attachAyah(): void {
    this.attachment.set({ kind: 'ayah', ref: `${this.pickSurah()}:${this.pickAyah()}` });
    this.picking.set(false);
  }

  /* ---------- Requests ---------- */

  protected accept(): void {
    this.api.accept(this.id()).subscribe({
      next: () => {
        this.chat.update((c) => (c ? { ...c, state: 'active' } : c));
        this.sync.refreshBadge();
        this.afterNewMessages(true);
      },
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  protected decline(): void {
    this.api.decline(this.id()).subscribe({
      next: () => {
        this.sync.refreshBadge();
        this.notify.show('Request declined');
        this.router.navigateByUrl('/messages', { replaceUrl: true });
      },
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  /* ---------- One message ---------- */

  protected async messageActions(m: ChatMessage): Promise<void> {
    if (m.notice) return;
    const buttons: { text: string; role?: string; data?: string; icon?: string }[] = [
      { text: m.savedByMe ? 'Unsave' : 'Save (keep it)', data: 'save', icon: m.savedByMe ? 'bookmark' : 'bookmark-outline' },
    ];
    if (m.text) buttons.push({ text: 'Copy text', data: 'copy', icon: 'copy-outline' });
    if (m.mine) buttons.push({ text: 'Unsend for both', data: 'unsend', role: 'destructive', icon: 'trash-outline' });
    else buttons.push({ text: 'Report', data: 'report', role: 'destructive', icon: 'flag-outline' });
    buttons.push({ text: 'Cancel', role: 'cancel' });
    const sheet = await this.sheets.create({ buttons });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<string>();
    if (data === 'save') this.toggleSave(m);
    else if (data === 'copy') this.notify.copy(m.text, 'Copied');
    else if (data === 'unsend') this.unsend(m);
    else if (data === 'report') this.report(m);
  }

  private patch(id: string, changes: Partial<ChatMessage>): void {
    this.messages.update((list) => list.map((x) => (x.id === id ? { ...x, ...changes } : x)));
  }

  private toggleSave(m: ChatMessage): void {
    const on = !m.savedByMe;
    this.patch(m.id, { savedByMe: on, saved: on || m.saved, expiresAt: on ? null : m.expiresAt });
    this.api.save(this.id(), m.id, on).subscribe({
      next: () => this.notify.show(on ? 'Saved. It stays until you unsave it.' : 'Unsaved'),
      error: (err: unknown) => {
        this.patch(m.id, { savedByMe: m.savedByMe, saved: m.saved, expiresAt: m.expiresAt });
        this.notify.show(errorMessage(err));
      },
    });
  }

  private async unsend(m: ChatMessage): Promise<void> {
    if (!(await this.confirm('Unsend this message?', 'It will be removed for both of you.', 'Unsend'))) return;
    this.api.unsend(this.id(), m.id).subscribe({
      next: () => this.messages.update((list) => list.filter((x) => x.id !== m.id)),
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  private async report(m: ChatMessage): Promise<void> {
    const reasons: { value: ChatReportReason; label: string }[] = [
      { value: 'harassment', label: 'Harassment or bullying' },
      { value: 'spam', label: 'Spam or scam' },
      { value: 'offensive', label: 'Offensive or hateful' },
      { value: 'other', label: 'Something else' },
    ];
    const alert = await this.alerts.create({
      header: 'Report this message',
      message: 'Moderators get a copy. They never see who reported it.',
      inputs: [
        ...reasons.map((r, i) => ({ type: 'radio' as const, label: r.label, value: r.value, checked: i === 0 })),
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Report', role: 'confirm' },
      ],
    });
    await alert.present();
    const res = await alert.onDidDismiss<{ values?: ChatReportReason }>();
    if (res.role !== 'confirm' || !res.data?.values) return;
    this.api.report(this.id(), m.id, res.data.values).subscribe({
      next: () => this.notify.show('Reported. Thank you.'),
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  /* ---------- Chat menu ---------- */

  protected async chatMenu(): Promise<void> {
    const c = this.chat();
    const other = this.other();
    const sheet = await this.sheets.create({
      header: other?.username ? '@' + other.username : 'Chat',
      buttons: [
        { text: 'Disappear 7 days after seen', data: 'r7', icon: c?.retention === '7d' ? 'checkmark' : undefined },
        { text: 'Disappear 30 days after seen', data: 'r30', icon: c?.retention === '30d' ? 'checkmark' : undefined },
        { text: 'Keep all messages', data: 'rkeep', icon: c?.retention === 'keep' ? 'checkmark' : undefined },
        { text: 'View profile', data: 'profile', icon: 'person-outline' },
        { text: 'Clear chat for me', data: 'clear', icon: 'trash-outline' },
        { text: `Block ${other?.username ? '@' + other.username : 'this person'}`, data: 'block', role: 'destructive', icon: 'close-circle' },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
    const { data } = await sheet.onDidDismiss<string>();
    if (data === 'r7') this.setRetention('7d');
    else if (data === 'r30') this.setRetention('30d');
    else if (data === 'rkeep') this.setRetention('keep');
    else if (data === 'profile' && other?.id) this.router.navigate(['/users', other.id]);
    else if (data === 'clear') this.clear();
    else if (data === 'block') this.block();
  }

  private setRetention(r: Retention): void {
    const before = this.chat()?.retention;
    this.chat.update((c) => (c ? { ...c, retention: r } : c));
    this.api.setRetention(this.id(), r).subscribe({
      next: () => this.poll(),
      error: (err: unknown) => {
        this.chat.update((c) => (c && before ? { ...c, retention: before } : c));
        this.notify.show(errorMessage(err));
      },
    });
  }

  private async clear(): Promise<void> {
    if (!(await this.confirm('Clear this chat?', 'Messages so far are hidden for you only. The other person still has them.', 'Clear'))) return;
    this.api.clear(this.id()).subscribe({
      next: () => {
        this.notify.show('Chat cleared');
        this.router.navigateByUrl('/messages', { replaceUrl: true });
      },
      error: (err: unknown) => this.notify.show(errorMessage(err)),
    });
  }

  private async block(): Promise<void> {
    const other = this.other();
    if (!other?.id) return;
    if (!(await this.confirm(`Block @${other.username}?`, 'Neither of you can message the other, and this chat is deleted for both. They aren’t told.', 'Block'))) return;
    this.api.block(other.id, true).subscribe({
      next: () => {
        this.notify.show(`Blocked @${other.username}`);
        this.router.navigateByUrl('/messages', { replaceUrl: true });
      },
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

  /* ---------- Display helpers ---------- */

  protected time(ms?: number): string {
    return ms ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(ms) : '';
  }

  protected expiry(m: ChatMessage): string {
    if (!m.expiresAt) return '';
    const days = Math.ceil((m.expiresAt - Date.now()) / 86_400_000);
    return days <= 1 ? 'goes today' : `goes in ${days} days`;
  }
}

function dayLabel(ms?: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
