import { Component, OnInit } from '@angular/core';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';
import { formatOption } from '../../models/formats';

@Component({
  selector: 'app-admin-event-teams',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './admin-event-teams.component.html',
})
export class AdminEventTeamsComponent extends AdminEventScreen implements OnInit {
  /** The team a tapped player will join. Null means start a new team. */
  targetTeamId: number | null = null;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  get teamSize(): number {
    return this.dashboard?.event.teamSize ?? formatOption(this.dashboard?.event.format || '').teamSize ?? 2;
  }

  get unassigned(): Array<{ userId: number; displayName: string }> {
    const onTeam = new Set(
      (this.dashboard?.teams ?? []).flatMap(team => team.members.map(member => member.userId))
    );
    return (this.dashboard?.registrations ?? [])
      .filter(player => !onTeam.has(player.userId))
      .map(player => ({ userId: player.userId, displayName: player.displayName }));
  }

  isFull(teamId: number): boolean {
    const team = this.dashboard?.teams.find(item => item.teamId === teamId);
    return !!team && team.members.length >= this.teamSize;
  }

  async place(userId: number): Promise<void> {
    const teamId = this.targetTeamId;
    await this.run(() => this.api.put('team', {
      action: 'create',
      eventId: this.eventId,
      teamId,
      userId,
    }));
  }

  async removeTeam(teamId: number): Promise<void> {
    if (this.targetTeamId === teamId) this.targetTeamId = null;
    await this.run(() => this.api.put('team', {
      action: 'delete',
      eventId: this.eventId,
      teamId,
    }));
  }

  async removeFromTeam(teamId: number, userId: number): Promise<void> {
    await this.run(() => this.api.put('team', {
      action: 'removeMember',
      eventId: this.eventId,
      teamId,
      userId,
    }));
  }
}
