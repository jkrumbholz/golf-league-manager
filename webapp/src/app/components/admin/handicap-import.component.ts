import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { formatHandicapIndex } from '../../models/handicap';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

interface HandicapChange {
  userId: number;
  displayName: string;
  from: number;
  to: number;
  profileOnly: boolean;
}

interface HandicapImportResult {
  changed: HandicapChange[];
  unchanged: number;
  duplicates: Array<{ name: string; detail: string }>;
  missing: Array<{ userId: number; displayName: string }>;
  unmatched: string[];
  unreadable: Array<{ name: string; indexText: string }>;
  eventKept: Array<{ displayName: string; eventIndex: number; profileIndex: number }>;
}

@Component({
  selector: 'app-handicap-import',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './handicap-import.component.html',
  styles: [':host { display: block; }'],
})
export class HandicapImportComponent {
  @Input() leagueId = 0;
  @Input() eventId = 0;
  @Input() disabled = false;
  @Output() applied = new EventEmitter<void>();

  open = false;
  paste = '';
  saving = false;
  error = '';
  step: 'paste' | 'review' | 'done' = 'paste';
  result: HandicapImportResult | null = null;
  readonly formatIndex = formatHandicapIndex;

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  changeLabel(change: HandicapChange): string {
    const prefix = change.profileOnly ? 'profile ' : '';
    return `${change.displayName}: ${prefix}${this.formatIndex(change.from)} → ${this.formatIndex(change.to)}`;
  }

  show(): void {
    if (this.disabled) return;
    this.open = true;
    this.error = '';
    this.result = null;
    this.paste = '';
    this.step = 'paste';
  }

  close(): void {
    if (this.saving) return;
    this.open = false;
  }

  back(): void {
    if (this.saving) return;
    this.step = 'paste';
    this.result = null;
    this.error = '';
  }

  async review(): Promise<void> {
    const result = await this.submit(true);
    if (!result) return;
    this.result = result;
    this.step = 'review';
  }

  async confirm(): Promise<void> {
    if (!this.result || this.result.changed.length === 0) return;
    const result = await this.submit(false);
    if (!result) return;
    this.result = result;
    this.step = 'done';
    const me = this.auth.user();
    const mine = result.changed.find(row => row.userId === me?.id);
    if (me && mine) this.auth.replaceUser({ ...me, handicapIndex: mine.to });
    this.applied.emit();
  }

  private async submit(preview: boolean): Promise<HandicapImportResult | null> {
    if (this.saving || !this.paste.trim()) return null;
    this.saving = true;
    this.error = '';
    try {
      return await this.api.put<HandicapImportResult>('league', {
        action: 'importHandicaps',
        leagueId: this.leagueId,
        eventId: this.eventId || undefined,
        paste: this.paste,
        preview,
      });
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not update handicaps';
      return null;
    } finally {
      this.saving = false;
    }
  }
}
