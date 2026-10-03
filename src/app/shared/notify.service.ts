import { inject, Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly toasts = inject(ToastController);

  async show(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 2400, position: 'bottom', cssClass: 'tb-toast' });
    await toast.present();
  }

  /** Copies text, telling the user whether it worked. */
  async copy(text: string, done = 'Copied'): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
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
