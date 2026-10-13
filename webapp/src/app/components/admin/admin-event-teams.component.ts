import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';
import { formatOption, supportsVirtualPartner } from '../../models/formats';

interface DrawPlayer {
  userId: number;
  displayName: string;
}

type DrawPhase = 'idle' | 'shuffling' | 'dealing' | 'ready' | 'saving';

@Component({
  selector: 'app-admin-event-teams',
  standalone: true,
  imports: [ShellComponent, RouterLink],
  templateUrl: './admin-event-teams.component.html',
})
export class AdminEventTeamsComponent extends AdminEventScreen implements OnInit, OnDestroy {
  /** The team a tapped player will join. Null means start a new team. */
  targetTeamId: number | null = null;

  drawOpen = false;
  phase: DrawPhase = 'idle';
  drawStatus = '';
  spotlight: DrawPlayer | null = null;
  spotlightLocked = false;
  held: DrawPlayer[] = [];
  pool: DrawPlayer[] = [];
  revealed: DrawPlayer[][] = [];
  leftover: DrawPlayer[] = [];

  private drawToken = 0;
  private pendingWaits: Array<() => void> = [];

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  ngOnDestroy(): void {
    this.stopDraw();
  }

  get teamSize(): number {
    return this.dashboard?.event.teamSize ?? formatOption(this.dashboard?.event.format || '').teamSize ?? 2;
  }

  get virtualPartnerFormat(): boolean {
    return supportsVirtualPartner(this.dashboard?.event.format || '');
  }

  get virtualPartnerTeam() {
    return this.dashboard?.teams.find(team => team.virtualPartner) ?? null;
  }

  get unassigned(): DrawPlayer[] {
    const onTeam = new Set(
      (this.dashboard?.teams ?? []).flatMap(team => team.members.map(member => member.userId))
    );
    return (this.dashboard?.registrations ?? [])
      .filter(player => !onTeam.has(player.userId))
      .map(player => ({ userId: player.userId, displayName: player.displayName }));
  }

  get openSlots(): number[] {
    const open = Math.max(0, this.teamSize - this.held.length);
    return Array.from({ length: open }, (_, index) => index);
  }

  get leftoverNames(): string {
    return this.leftover.map(player => player.displayName).join(', ');
  }

  isFull(teamId: number): boolean {
    const team = this.dashboard?.teams.find(item => item.teamId === teamId);
    return !!team && (team.virtualPartner || team.members.length >= this.teamSize);
  }

  async makeVirtualPartner(userId: number): Promise<void> {
    if (this.busy || !this.virtualPartnerFormat || this.virtualPartnerTeam) return;
    if (!window.confirm('Give this player a virtual partner? Their teammate is drawn after the round, and they stay on this team.')) return;
    await this.run(() => this.api.put('team', {
      action: 'virtualPartner',
      eventId: this.eventId,
      userId,
    }));
  }

  async clearVirtualPartner(): Promise<void> {
    const teamId = this.virtualPartnerTeam?.teamId ?? null;
    if (!window.confirm('Remove the virtual partner and keep this team? You can then add a player to the open spot.')) return;
    await this.run(() => this.api.put('team', {
      action: 'clearVirtualPartner',
      eventId: this.eventId,
    }));
    if (!this.error && teamId != null) this.targetTeamId = teamId;
  }

  startDraw(): void {
    if (this.busy || this.unassigned.length < this.teamSize) return;
    this.drawOpen = true;
    void this.play();
  }

  tryAgain(): void {
    if (this.phase !== 'ready' || this.busy) return;
    void this.play();
  }

  closeDraw(): void {
    this.stopDraw();
    this.drawOpen = false;
    this.phase = 'idle';
    this.drawStatus = '';
    this.spotlight = null;
    this.spotlightLocked = false;
    this.held = [];
    this.pool = [];
    this.revealed = [];
    this.leftover = [];
  }

  async createDrawnTeams(): Promise<void> {
    if (this.phase !== 'ready' || this.busy || this.revealed.length === 0) return;
    const teams = this.revealed.map(group => group.slice());
    this.phase = 'saving';
    await this.run(async () => {
      for (const members of teams) {
        let teamId: number | null = null;
        for (const player of members) {
          const result: { teamId: number } = await this.api.put('team', {
            action: 'create',
            eventId: this.eventId,
            teamId,
            userId: player.userId,
          }, { quiet: true });
          teamId = result.teamId;
        }
      }
    });
    const failed = this.error.length > 0;
    this.closeDraw();
    if (failed) {
      try {
        await this.reload();
      } catch {
        // The create error is already on screen.
      }
    }
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

  async refreshNames(): Promise<void> {
    if (!window.confirm('Rebuild every team name from the players\' current display names?')) return;
    await this.run(() => this.api.put('team', {
      action: 'refreshNames',
      eventId: this.eventId,
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

  private async play(): Promise<void> {
    const token = ++this.drawToken;
    this.stopWaits();
    const { teams, leftover, order } = this.deal(this.unassigned.map(player => ({ ...player })));
    this.phase = 'shuffling';
    this.drawStatus = 'Shuffling the field';
    this.spotlight = null;
    this.spotlightLocked = false;
    this.held = [];
    this.revealed = [];
    this.leftover = leftover;
    this.pool = order;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.revealed = teams;
      this.pool = leftover.slice();
      this.phase = 'ready';
      this.drawStatus = 'Here\'s the draw';
      return;
    }

    let previous: DrawPlayer | undefined;
    for (let step = 0; step < 12; step++) {
      previous = this.flash(this.pool, previous);
      this.spotlight = previous;
      this.spotlightLocked = false;
      if (!await this.wait(48, token)) return;
    }

    for (let index = 0; index < teams.length; index++) {
      this.phase = 'dealing';
      this.drawStatus = `Picking team ${index + 1} of ${teams.length}`;
      this.held = [];
      for (const player of teams[index]) {
        const spinning = this.pool.filter(item => !this.held.some(held => held.userId === item.userId));
        for (let step = 0; step < 7; step++) {
          previous = this.flash(spinning, previous);
          this.spotlight = previous;
          this.spotlightLocked = false;
          if (!await this.wait(26 + step * 18, token)) return;
        }
        this.spotlight = player;
        this.spotlightLocked = true;
        if (!await this.wait(280, token)) return;
        this.held = [...this.held, player];
      }
      this.revealed = [...this.revealed, teams[index]];
      const taken = new Set(teams[index].map(player => player.userId));
      this.pool = this.pool.filter(player => !taken.has(player.userId));
      this.held = [];
      this.spotlight = null;
      this.spotlightLocked = false;
      if (!await this.wait(240, token)) return;
    }

    if (token !== this.drawToken) return;
    this.phase = 'ready';
    this.drawStatus = 'Here\'s the draw';
  }

  private deal(players: DrawPlayer[]): { teams: DrawPlayer[][]; leftover: DrawPlayer[]; order: DrawPlayer[] } {
    const order = this.shuffle(players);
    const size = this.teamSize;
    const teams: DrawPlayer[][] = [];
    for (let index = 0; index + size <= order.length; index += size) {
      teams.push(order.slice(index, index + size));
    }
    return { teams, leftover: order.slice(teams.length * size), order };
  }

  private shuffle(players: DrawPlayer[]): DrawPlayer[] {
    const copy = players.slice();
    for (let index = copy.length - 1; index > 0; index--) {
      const swap = Math.floor(Math.random() * (index + 1));
      const current = copy[index];
      copy[index] = copy[swap];
      copy[swap] = current;
    }
    return copy;
  }

  private flash(pool: DrawPlayer[], avoid?: DrawPlayer): DrawPlayer {
    if (pool.length === 0) return avoid ?? { userId: 0, displayName: '' };
    if (pool.length === 1) return pool[0];
    let pick = pool[Math.floor(Math.random() * pool.length)];
    if (avoid && pick.userId === avoid.userId) {
      const others = pool.filter(player => player.userId !== avoid.userId);
      pick = others[Math.floor(Math.random() * others.length)];
    }
    return pick;
  }

  private wait(ms: number, token: number): Promise<boolean> {
    return new Promise(resolve => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      const id = window.setTimeout(() => {
        this.pendingWaits = this.pendingWaits.filter(item => item !== cancel);
        finish(token === this.drawToken);
      }, ms);
      const cancel = () => {
        window.clearTimeout(id);
        finish(false);
      };
      this.pendingWaits.push(cancel);
    });
  }

  private stopDraw(): void {
    this.drawToken++;
    this.stopWaits();
  }

  private stopWaits(): void {
    const pending = this.pendingWaits.splice(0);
    for (const cancel of pending) cancel();
  }
}
