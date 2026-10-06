import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Registration, Team, TeeGroup } from '../../models/dashboard';
import { formatOption } from '../../models/formats';
import { parseHandicapIndex } from '../../models/handicap';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

type SheetSelection =
  | { kind: 'player'; userId: number; name: string }
  | { kind: 'team'; teamId: number; name: string }
  | { kind: 'slot'; groupId: number; label: string };

@Component({
  selector: 'app-admin-event-groups',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-event-groups.component.html',
})
export class AdminEventGroupsComponent extends AdminEventScreen implements OnInit {
  private router = inject(Router);

  selection: SheetSelection | null = null;
  addingGuest = false;
  guestFirst = '';
  guestLast = '';
  guestIndex = '';

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

  slots(group: TeeGroup): number {
    return this.teamFormat ? group.members.filter(member => member.teamId != null).length * this.teamSize : group.members.filter(member => member.userId != null).length;
  }

  teamOf(teamId: number | null): Team | undefined {
    if (teamId == null) return undefined;
    return this.dashboard?.teams.find(team => team.teamId === teamId);
  }

  get benchPlayers(): Registration[] {
    if (this.teamFormat) return [];
    const seated = new Set(this.groups.flatMap(group => group.members.map(member => member.userId).filter((id): id is number => id != null)));
    return (this.dashboard?.registrations ?? []).filter(player => !seated.has(player.userId));
  }

  get benchTeams(): Team[] {
    if (!this.teamFormat) return [];
    const placed = new Set(this.groups.flatMap(group => group.members.map(member => member.teamId).filter((id): id is number => id != null)));
    return (this.dashboard?.teams ?? []).filter(team => !placed.has(team.teamId));
  }

  slotLabel(group: TeeGroup): string {
    return `${this.formatTime(group.teeTime)} · Hole ${group.startingHole}`;
  }

  formatTime(value: string): string {
    const match = /^(\d{2}):(\d{2})/.exec(value);
    if (!match) return value || 'No time';
    let hour = Number(match[1]);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${match[2]} ${suffix}`;
  }

  pickedPlayer(userId: number): boolean {
    return this.selection?.kind === 'player' && this.selection.userId === userId;
  }

  pickedTeam(teamId: number): boolean {
    return this.selection?.kind === 'team' && this.selection.teamId === teamId;
  }

  pickedSlot(groupId: number): boolean {
    return this.selection?.kind === 'slot' && this.selection.groupId === groupId;
  }

  get barText(): string {
    const selection = this.selection;
    if (!selection) return '';
    if (selection.kind === 'player') return `${selection.name}. Tap a player to swap, or an open seat to move.`;
    if (selection.kind === 'team') return `${selection.name}. Tap another team to swap, or a tee time with room to move.`;
    return `${selection.label}. Tap another tee time to trade times and starting holes.`;
  }

  get canBench(): boolean {
    const selection = this.selection;
    if (!selection || !this.dashboard) return false;
    if (selection.kind === 'player') {
      return this.groups.some(group => group.members.some(member => member.userId === selection.userId));
    }
    if (selection.kind === 'team') return this.groups.some(group => group.members.some(member => member.teamId === selection.teamId));
    return false;
  }

  add(): void {
    void this.router.navigate(['/admin/events', this.eventId, 'groups', 'new']);
  }

  async tapPlayer(userId: number, name: string): Promise<void> {
    const selection = this.selection;
    if (selection?.kind === 'player' && selection.userId !== userId) {
      await this.finish(() => this.api.put('group', {
        action: 'swapPlayers',
        eventId: this.eventId,
        userId: selection.userId,
        otherUserId: userId,
      }));
      return;
    }
    this.selection = selection?.kind === 'player' && selection.userId === userId ? null : { kind: 'player', userId, name };
  }

  async tapTeam(team: Team): Promise<void> {
    const selection = this.selection;
    if (selection?.kind === 'team' && selection.teamId !== team.teamId) {
      const placed = (teamId: number) => this.groups.some(group => group.members.some(member => member.teamId === teamId));
      if (!placed(selection.teamId) && !placed(team.teamId)) {
        this.error = 'Tap a tee time to place this team.';
        return;
      }
      await this.finish(() => this.api.put('group', {
        action: 'swapTeams',
        eventId: this.eventId,
        teamId: selection.teamId,
        otherTeamId: team.teamId,
      }));
      return;
    }
    this.selection = selection?.kind === 'team' && selection.teamId === team.teamId ? null : { kind: 'team', teamId: team.teamId, name: team.name };
  }

  async tapSlot(group: TeeGroup): Promise<void> {
    const selection = this.selection;
    if (selection?.kind === 'slot' && selection.groupId !== group.groupId) {
      await this.finish(() => this.api.put('group', {
        action: 'swapSlots',
        eventId: this.eventId,
        groupId: selection.groupId,
        otherGroupId: group.groupId,
      }));
      return;
    }
    if (selection?.kind === 'player' && !this.teamFormat) {
      if (group.members.some(member => member.userId === selection.userId)) {
        this.selection = null;
        return;
      }
      if (this.slots(group) >= 4) {
        this.error = 'That tee time is full. Tap a player there to swap.';
        return;
      }
      await this.finish(() => this.api.put('group', {
        action: 'movePlayer',
        eventId: this.eventId,
        userId: selection.userId,
        groupId: group.groupId,
      }));
      return;
    }
    if (selection?.kind === 'team') {
      if (group.members.some(member => member.teamId === selection.teamId)) {
        this.selection = null;
        return;
      }
      if (this.slots(group) + this.teamSize > 4) {
        this.error = 'That tee time is full. Tap a team there to swap.';
        return;
      }
      await this.finish(() => this.api.put('group', {
        action: 'moveTeam',
        eventId: this.eventId,
        teamId: selection.teamId,
        groupId: group.groupId,
      }));
      return;
    }
    this.selection = selection?.kind === 'slot' && selection.groupId === group.groupId
      ? null
      : { kind: 'slot', groupId: group.groupId, label: this.slotLabel(group) };
  }

  async toBench(): Promise<void> {
    const selection = this.selection;
    if (selection?.kind === 'player') {
      await this.finish(() => this.api.put('group', {
        action: 'movePlayer',
        eventId: this.eventId,
        userId: selection.userId,
        groupId: null,
        teamId: null,
      }));
    } else if (selection?.kind === 'team') {
      await this.finish(() => this.api.put('group', {
        action: 'moveTeam',
        eventId: this.eventId,
        teamId: selection.teamId,
        groupId: null,
      }));
    }
  }

  async drop(): Promise<void> {
    const selection = this.selection;
    if (selection?.kind !== 'player') return;
    if (!window.confirm(`Take ${selection.name} off tonight's event? Their account stays. Scores posted for them tonight are removed.`)) return;
    await this.finish(() => this.api.put('group', {
      action: 'dropPlayer',
      eventId: this.eventId,
      userId: selection.userId,
    }));
  }

  async setTime(group: TeeGroup, event: Event): Promise<void> {
    const teeTime = (event.target as HTMLInputElement).value;
    if (!teeTime || teeTime === group.teeTime) return;
    await this.saveSlot(group, teeTime, group.startingHole);
  }

  async setHole(group: TeeGroup, event: Event): Promise<void> {
    const startingHole = Number((event.target as HTMLInputElement).value);
    if (!Number.isInteger(startingHole) || startingHole < 1 || startingHole === group.startingHole) return;
    await this.saveSlot(group, group.teeTime, startingHole);
  }

  private async saveSlot(group: TeeGroup, teeTime: string, startingHole: number): Promise<void> {
    await this.run(() => this.api.put('group', {
      action: 'setTime',
      eventId: this.eventId,
      groupId: group.groupId,
      teeTime,
      startingHole,
    }));
  }

  async removeGroup(groupId: number): Promise<void> {
    if (this.selection?.kind === 'slot' && this.selection.groupId === groupId) this.selection = null;
    await this.run(() => this.api.put('group', { action: 'delete', eventId: this.eventId, groupId }));
  }

  async addGuest(): Promise<void> {
    const raw = this.guestIndex.trim();
    const handicapIndex = raw ? parseHandicapIndex(raw) : 0;
    if (raw && handicapIndex == null) {
      this.error = 'Enter a handicap from 0 to 54, or a plus index up to +10';
      return;
    }
    await this.run(() => this.api.put('group', {
      action: 'addGuest',
      eventId: this.eventId,
      firstName: this.guestFirst,
      lastName: this.guestLast,
      handicapIndex,
    }));
    if (!this.error) {
      this.addingGuest = false;
      this.guestFirst = '';
      this.guestLast = '';
      this.guestIndex = '';
    }
  }

  private async finish(work: () => Promise<unknown>): Promise<void> {
    await this.run(work);
    if (!this.error) this.selection = null;
  }
}
