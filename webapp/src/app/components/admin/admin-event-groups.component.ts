import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TeeGroup, TeeGroupMember } from '../../models/dashboard';
import { formatOption } from '../../models/formats';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-groups',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './admin-event-groups.component.html',
})
export class AdminEventGroupsComponent extends AdminEventScreen implements OnInit {
  private router = inject(Router);
  /** The group a tapped player or team will join. */
  targetGroupId: number | null = null;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  get teamFormat(): boolean {
    return formatOption(this.dashboard?.event.format || '').team;
  }

  get teamSize(): number {
    return this.dashboard?.event.teamSize || formatOption(this.dashboard?.event.format || '').teamSize || 1;
  }

  get groups(): TeeGroup[] {
    return this.dashboard?.groups ?? [];
  }

  memberKey(member: TeeGroupMember): string {
    return member.userId != null ? `user-${member.userId}` : `team-${member.teamId}`;
  }

  slots(group: TeeGroup): number {
    return this.teamFormat ? group.members.length * this.teamSize : group.members.length;
  }

  isFull(groupId: number): boolean {
    const group = this.groups.find(item => item.groupId === groupId);
    if (!group) return true;
    return this.slots(group) + (this.teamFormat ? this.teamSize : 1) > 4;
  }

  get unassignedPlayers(): Array<{ userId: number; displayName: string }> {
    const taken = new Set(this.groups.flatMap(group => group.members.map(member => member.userId)));
    return (this.dashboard?.registrations ?? [])
      .filter(player => !taken.has(player.userId))
      .map(player => ({ userId: player.userId, displayName: player.displayName }));
  }

  get unassignedTeams(): Array<{ teamId: number; name: string }> {
    const taken = new Set(this.groups.flatMap(group => group.members.map(member => member.teamId)));
    return (this.dashboard?.teams ?? [])
      .filter(team => !taken.has(team.teamId))
      .map(team => ({ teamId: team.teamId, name: team.name }));
  }

  get hasUnassigned(): boolean {
    return this.teamFormat ? this.unassignedTeams.length > 0 : this.unassignedPlayers.length > 0;
  }

  add(): void {
    void this.router.navigate(['/admin/events', this.eventId, 'groups', 'new']);
  }

  async setTime(groupId: number, event: Event): Promise<void> {
    const teeTime = (event.target as HTMLInputElement).value;
    const current = this.groups.find(group => group.groupId === groupId)?.teeTime;
    if (!teeTime || teeTime === current) return;
    await this.run(() => this.api.put('group', { action: 'setTime', eventId: this.eventId, groupId, teeTime }));
  }

  async removeGroup(groupId: number): Promise<void> {
    if (this.targetGroupId === groupId) this.targetGroupId = null;
    await this.run(() => this.api.put('group', { action: 'delete', eventId: this.eventId, groupId }));
  }

  async removeMember(group: TeeGroup, member: TeeGroupMember): Promise<void> {
    await this.run(() => this.api.put('group', {
      action: member.teamId != null ? 'removeTeam' : 'removePlayer',
      eventId: this.eventId,
      groupId: group.groupId,
      userId: member.userId,
      teamId: member.teamId,
    }));
  }

  async place(id: number): Promise<void> {
    const groupId = this.targetGroupId;
    if (groupId == null) return;
    await this.run(() => this.api.put('group', this.teamFormat
      ? { action: 'addTeam', eventId: this.eventId, groupId, teamId: id }
      : { action: 'addPlayer', eventId: this.eventId, groupId, userId: id }));
  }
}
