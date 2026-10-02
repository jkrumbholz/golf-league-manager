import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Registration } from '../../models/dashboard';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-players',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './admin-event-players.component.html',
})
export class AdminEventPlayersComponent extends AdminEventScreen implements OnInit {
  private router = inject(Router);

  notice = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  staleIndex(player: Registration): boolean {
    return player.profileHandicapIndex != null && player.profileHandicapIndex !== player.handicapIndex;
  }

  async refreshIndexes(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.put<{ updated: number; locked: number }>('registration', {
        eventId: this.eventId,
        refreshHandicaps: true,
      });
      const updated = `${result.updated} updated`;
      this.notice = result.locked > 0
        ? `${updated}. ${result.locked} already posted a score and kept this event's index.`
        : result.updated > 0
          ? `${updated}.`
          : 'Indexes already match profiles.';
    });
  }

  async togglePaid(player: Registration): Promise<void> {
    await this.run(() => this.api.put('registration', {
      eventId: this.eventId,
      userId: player.userId,
      paid: !player.paid,
    }));
  }

  async toggleCtp(player: Registration): Promise<void> {
    await this.run(() => this.api.put('registration', {
      eventId: this.eventId,
      userId: player.userId,
      ctpPaid: !player.ctpPaid,
    }));
  }

  async toggleLongDrive(player: Registration): Promise<void> {
    await this.run(() => this.api.put('registration', {
      eventId: this.eventId,
      userId: player.userId,
      longDrivePaid: !player.longDrivePaid,
    }));
  }

  add(): void {
    void this.router.navigate(['/admin/events', this.eventId, 'players', 'add']);
  }
}
