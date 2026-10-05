import { inject, Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly toasts = inject(ToastController);

  async show(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 2400, position: 'top', cssClass: 'tb-toast' });
    await toast.present();
  }

  /** Copies text, telling the user whether it worked. */
  async copy(text: string, done = 'Copied'): Promise<void> {
    try {
      // The Clipboard API exists only on https (and localhost); plain-http pages use the older way.
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else if (!copyWithSelection(text)) throw new Error('copy failed');
      await this.show(done);
    } catch {
      await this.show("Couldn't copy on this device.");
    }
  }

  /** Native share sheet where available, otherwise copy. */
  async share(title: string, text: string): Promise<void> {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    await this.copy(text, 'Verse copied to share');
  }
}

/** Copies through a hidden text area and execCommand, which works without https. */
function copyWithSelection(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
