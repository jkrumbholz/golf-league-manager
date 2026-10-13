import { Component, Input } from '@angular/core';
import { playerInitials } from '../models/initials';

export interface FacePerson {
  name?: string | null;
  photo?: string | null;
}

/** One circle. Two or more people split it into equal slices, left to right. */
@Component({
  selector: 'app-face',
  standalone: true,
  template: `
    @if (slots.length) {
      <span class="face" [class.face-sm]="size === 'sm'" aria-hidden="true">
        @for (slot of slots; track $index) {
          @if (slot.url) {
            <img [src]="slot.url" alt="" (error)="drop(slot.url)" />
          } @else {
            <span class="face-initials">{{ slot.initials }}</span>
          }
        }
      </span>
    }
  `,
})
export class FaceComponent {
  @Input() urls: Array<string | null | undefined> | null | undefined = [];
  /** One player, or a team name joined with " / ". */
  @Input() name: string | null | undefined;
  /** Each person in order, including those without a photo. */
  @Input() faces: FacePerson[] | null | undefined;
  /** Same order as the names in a team, so a photo can be matched to one person. */
  @Input() ids: Array<number | null | undefined> | null | undefined;
  @Input() size: 'md' | 'sm' = 'md';
  private failed = new Set<string>();

  get slots(): Array<{ url: string | null; initials: string }> {
    if (this.faces?.length) {
      return this.faces
        .map(face => this.slot(face.name, face.photo))
        .filter(slot => slot.url || slot.initials);
    }
    const names = this.splitName(this.name);
    const urls = this.cleanUrls(this.urls);
    const ids = (this.ids ?? []).map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0);
    if (names.length > 1 && ids.length === names.length) {
      const paired = names.map((person, index) => ({
        person,
        photo: urls.find(url => this.userIdInPhoto(url) === ids[index]) ?? null,
      }));
      if (paired.some(item => item.photo) || urls.length === 0) {
        return this.keep(paired.map(item => this.slot(item.person, item.photo)));
      }
    }
    if (names.length > 1 && urls.length === names.length) {
      return names.map((person, index) => this.slot(person, urls[index]));
    }
    if (urls.length === 0) {
      return this.keep(names.map(person => this.slot(person, null)));
    }
    if (names.length <= 1) {
      return urls.map(url => this.slot(names[0], url));
    }
    return this.keep(names.map((person, index) => this.slot(person, urls[index] ?? null)));
  }

  private keep(slots: Array<{ url: string | null; initials: string }>): Array<{ url: string | null; initials: string }> {
    return slots.filter(slot => slot.url || slot.initials);
  }

  private userIdInPhoto(url: string): number | null {
    const match = /\/users\/(\d+)\//.exec(url);
    return match ? Number(match[1]) : null;
  }

  drop(url: string): void {
    if (this.failed.has(url)) return;
    const next = new Set(this.failed);
    next.add(url);
    this.failed = next;
  }

  private slot(name: string | null | undefined, photo: string | null | undefined): { url: string | null; initials: string } {
    const url = photo && !this.failed.has(photo) ? photo : null;
    return { url, initials: url ? '' : playerInitials(name) };
  }

  private splitName(name: string | null | undefined): string[] {
    return (name ?? '').split(/\s*\/\s*/).map(part => part.trim()).filter(part => part.length > 0);
  }

  private cleanUrls(urls: Array<string | null | undefined> | null | undefined): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const url of urls ?? []) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      result.push(url);
    }
    return result;
  }
}
