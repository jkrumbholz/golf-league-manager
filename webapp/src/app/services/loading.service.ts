import { Injectable, signal } from '@angular/core';

/** Shows the top loading bar while a user-initiated request is in flight. */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  readonly active = signal(false);
  private pending = 0;
  private showTimer = 0;

  track<T>(work: Promise<T>): Promise<T> {
    this.begin();
    return work.finally(() => this.end());
  }

  private begin(): void {
    this.pending += 1;
    if (this.pending === 1) {
      window.clearTimeout(this.showTimer);
      this.showTimer = window.setTimeout(() => {
        if (this.pending > 0) this.active.set(true);
      }, 180);
    }
  }

  private end(): void {
    this.pending = Math.max(0, this.pending - 1);
    if (this.pending === 0) {
      window.clearTimeout(this.showTimer);
      this.active.set(false);
    }
  }
}
