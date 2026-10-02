import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Registration } from '../../models/dashboard';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-side-games',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-event-side-games.component.html',
})
export class AdminEventSideGamesComponent extends AdminEventScreen implements OnInit {
  ctpWinner: number | null = null;
  longDriveWinner: number | null = null;

  async ngOnInit(): Promise<void> {
    await this.load();
    const ctp = this.dashboard?.sideGames.closestToPinWinnerUserId ?? null;
    const drive = this.dashboard?.sideGames.longDriveWinnerUserId ?? null;
    this.ctpWinner = this.ctpPlayers.some(player => player.userId === ctp) ? ctp : null;
    this.longDriveWinner = this.longDrivePlayers.some(player => player.userId === drive) ? drive : null;
  }

  get ctpPlayers(): Registration[] {
    return (this.dashboard?.registrations ?? []).filter(player => player.ctpPaid);
  }

  get longDrivePlayers(): Registration[] {
    return (this.dashboard?.registrations ?? []).filter(player => player.longDrivePaid);
  }

  async save(): Promise<void> {
    await this.run(async () => {
      if (this.dashboard?.event.ctpEnabled) {
        await this.api.put('sidegame', {
          eventId: this.eventId,
          competition: 'closest_to_pin',
          winnerUserId: this.ctpWinner,
        });
      }
      if (this.dashboard?.event.longDriveEnabled) {
        await this.api.put('sidegame', {
          eventId: this.eventId,
          competition: 'long_drive',
          winnerUserId: this.longDriveWinner,
        });
      }
    });
  }
}
