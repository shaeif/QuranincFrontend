import { signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { errorMessage } from '../api/api-client';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Holds one request's data, status and error message as signals. */
export class Loadable<T> {
  readonly data = signal<T | undefined>(undefined);
  readonly status = signal<LoadStatus>('idle');
  readonly error = signal('');
  private sub?: Subscription;

  load(source: Observable<T>, onDone?: () => void): void {
    this.sub?.unsubscribe();
    this.status.set('loading');
    this.sub = source.subscribe({
      next: (value) => {
        this.data.set(value);
        this.status.set('ready');
        onDone?.();
      },
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.status.set('error');
        onDone?.();
      },
    });
  }

  cancel(): void {
    this.sub?.unsubscribe();
  }
}
