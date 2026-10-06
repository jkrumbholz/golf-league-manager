import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Payout } from '../../models/dashboard';
import { PlacePayout, entryPurse, money as formatMoney, placeName as formatPlace, suggestPlacePayouts, suggestionNote as formatNote } from '../../models/payouts';
import { formatOption } from '../../models/formats';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-payouts',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './admin-event-payouts.component.html',
})
export class AdminEventPayoutsComponent extends AdminEventScreen implements OnInit {
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  get playerCount(): number {
    return this.dashboard?.registrations.length ?? 0;
  }

  get entryFee(): number {
    return Number(this.dashboard?.event.entryFee) || 0;
  }

  /** Every signed-up player pays the event entry fee, paid or not. */
  get pot(): number {
    return entryPurse(this.dashboard?.registrations ?? [], this.entryFee);
  }

  get paidOut(): number {
    return (this.dashboard?.payouts ?? []).reduce((total, payout) => total + payout.amount, 0);
  }

  get placePot(): number {
    return this.pot;
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

  label(payout: Payout): string {
    if (payout.description) return payout.description;
    if (payout.place) return `Place ${payout.place}`;
    return 'Payout';
  }

  winner(payout: Payout): string {
    if (payout.userId) {
      const player = this.dashboard?.registrations.find(item => item.userId === payout.userId);
      if (player) return player.displayName;
    }
    if (payout.teamId) {
      const team = this.dashboard?.teams.find(item => item.teamId === payout.teamId);
      if (team) return team.name;
    }
    return 'Unassigned';
  }

  async remove(id: number): Promise<void> {
    await this.run(() => this.api.delete('payout', { id }));
  }

  add(): void {
    void this.router.navigate(['/admin/events', this.eventId, 'payouts', 'new']);
  }

  useSuggestion(item: PlacePayout): void {
    void this.router.navigate(['/admin/events', this.eventId, 'payouts', 'new'], {
      queryParams: { place: item.place, amount: item.amount },
    });
  }
}
