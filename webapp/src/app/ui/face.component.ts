import { Component, Input } from '@angular/core';

/** One circle. Two or more photos split it into equal slices, left to right. */
@Component({
  selector: 'app-face',
  standalone: true,
  template: `
    @if (shown.length) {
      <span class="face" [class.face-sm]="size === 'sm'" aria-hidden="true">
        @for (url of shown; track url) {
          <img [src]="url" alt="" (error)="drop(url)" />
        }
      </span>
    }
  `,
})
export class FaceComponent {
  @Input() urls: Array<string | null | undefined> | null | undefined = [];
  @Input() size: 'md' | 'sm' = 'md';
  private failed = new Set<string>();

  get shown(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const url of this.urls ?? []) {
      if (!url || this.failed.has(url) || seen.has(url)) continue;
      seen.add(url);
      result.push(url);
    }
    return result;
  }

  drop(url: string): void {
    const next = new Set(this.failed);
    next.add(url);
    this.failed = next;
  }
}
