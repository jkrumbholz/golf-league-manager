import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { formatOption } from '../../models/formats';
import { PlacePayout, entryPurse, money as formatMoney, placeName as formatPlace, suggestPlacePayouts, suggestionNote as formatNote } from '../../models/payouts';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-payout-form',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-event-payout-form.component.html',
})
export class AdminEventPayoutFormComponent extends AdminEventScreen implements OnInit {
  private router = inject(Router);
  payoutId: number | null = null;
  place: number | null = 1;
  amount = 0;
  description = '';
  winnerId: number | null = null;
  fieldErrors: Record<string, string> = {};

  async ngOnInit(): Promise<void> {
    const raw = this.route.snapshot.paramMap.get('payoutId');
    this.payoutId = raw ? Number(raw) : null;
    await this.load();
    this.applyIncoming();
  }

  override get backTo(): unknown[] {
    return ['/admin/events', this.eventId, 'payouts'];
  }

  get title(): string {
    return this.payoutId ? 'Edit payout' : 'New payout';
  }

  get teamEvent(): boolean {
    return formatOption(this.dashboard?.event.format || '').team;
  }

  get winnerChoices(): Array<{ id: number; name: string }> {
    const board = this.dashboard?.leaderboard ?? [];
    const rank = new Map(board.filter(row => row.kind === (this.teamEvent ? 'team' : 'player')).map(row => [row.competitorId, row]));
    const choices = this.teamEvent
      ? (this.dashboard?.teams ?? []).map(team => ({ id: team.teamId, name: team.name }))
      : (this.dashboard?.registrations ?? []).map(player => ({ id: player.userId, name: player.displayName }));
    return choices
      .map(choice => {
        const row = rank.get(choice.id);
        const name = row && row.thru > 0 ? `${row.rank} · ${choice.name}` : choice.name;
        return { id: choice.id, name, order: row?.rank ?? 1000 };
      })
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(({ id, name }) => ({ id, name }));
  }

  get placePot(): number {
    if (!this.dashboard) return 0;
    return entryPurse(this.dashboard.registrations, this.dashboard.event.entryFee);
  }

  get stake(): number {
    if (!this.dashboard) return 0;
    const size = this.dashboard.event.teamSize || formatOption(this.dashboard.event.format).teamSize || 1;
    return Number(this.dashboard.event.entryFee) * size;
  }

  get suggestions(): PlacePayout[] {
    return suggestPlacePayouts(this.placePot, this.stake);
  }

  get suggestionNote(): string {
    return formatNote(this.suggestions, this.stake, this.placePot);
  }

  placeName(place: number): string {
    return formatPlace(place);
  }

  money(amount: number): string {
    return formatMoney(amount);
  }

  applySuggestion(item: PlacePayout): void {
    this.place = item.place;
    this.amount = item.amount;
    this.fieldErrors = {};
  }

  async save(): Promise<void> {
    this.fieldErrors = {};
    if (Number(this.amount) <= 0) this.fieldErrors['amount'] = 'Enter an amount above zero';
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.error = '';
    this.busy = true;
    try {
      await this.api.put('payout', {
        id: this.payoutId,
        eventId: this.eventId,
        place: this.place ? Number(this.place) : null,
        amount: Number(this.amount),
        description: this.description,
        userId: this.teamEvent ? null : this.winnerId,
        teamId: this.teamEvent ? this.winnerId : null,
      });
      await this.router.navigate(this.backTo);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the payout';
    } finally {
      this.busy = false;
    }
  }

  private applyIncoming(): void {
    if (!this.dashboard) return;
    if (this.payoutId) {
      const payout = this.dashboard.payouts.find(item => item.id === this.payoutId);
      if (!payout) {
        this.error = 'That payout is not on this event';
        return;
      }
      this.place = payout.place;
      this.amount = Number(payout.amount);
      this.description = payout.description || '';
      this.winnerId = this.teamEvent ? payout.teamId : payout.userId;
      return;
    }

    const place = Number(this.route.snapshot.queryParamMap.get('place'));
    const amount = Number(this.route.snapshot.queryParamMap.get('amount'));
    if (Number.isInteger(place) && place > 0) this.place = place;
    if (Number.isFinite(amount) && amount > 0) this.amount = amount;
  }
}
