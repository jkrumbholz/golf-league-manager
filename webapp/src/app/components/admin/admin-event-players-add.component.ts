import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { formatHandicapIndex } from '../../models/handicap';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-players-add',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './admin-event-players-add.component.html',
})
export class AdminEventPlayersAddComponent extends AdminEventScreen implements OnInit {
  private router = inject(Router);
  selected: number[] = [];
  readonly formatIndex = formatHandicapIndex;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  get available(): Array<{ userId: number; displayName: string; handicapIndex: number }> {
    const signedUp = new Set((this.dashboard?.registrations ?? []).map(player => player.userId));
    return (this.dashboard?.leagueMembers ?? []).filter(player => !signedUp.has(player.userId));
  }

  isSelected(userId: number): boolean {
    return this.selected.includes(userId);
  }

  toggle(userId: number): void {
    this.selected = this.isSelected(userId)
      ? this.selected.filter(id => id !== userId)
      : [...this.selected, userId];
  }

  async save(): Promise<void> {
    const ids = [...this.selected];
    this.error = '';
    this.busy = true;
    try {
      for (const userId of ids) {
        await this.api.put('registration', { eventId: this.eventId, userId, addPlayer: true });
      }
      await this.router.navigate(['/admin/events', this.eventId, 'players']);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not add those players';
    } finally {
      this.busy = false;
    }
  }
}
