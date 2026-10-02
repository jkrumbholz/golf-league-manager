import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LeagueSummary, MembershipService } from '../services/membership.service';
import { ShellComponent } from '../ui/shell.component';

@Component({
  selector: 'app-leagues',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './leagues.component.html',
})
export class LeaguesComponent implements OnInit {
  leagues: LeagueSummary[] = [];
  loading = true;
  organizer = false;
  error = '';

  constructor(private membership: MembershipService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    try {
      this.leagues = await this.membership.leagues(true);
      this.organizer = this.leagues.some(league => league.role === 'organizer');
      if (this.leagues.length === 1) {
        await this.router.navigate(['/leagues', this.leagues[0].id], { replaceUrl: true });
        return;
      }
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load your leagues';
    } finally {
      this.loading = false;
    }
  }

  meta(league: LeagueSummary): string {
    const players = `${league.playerCount} player${league.playerCount === 1 ? '' : 's'}`;
    return league.currentSeasonName ? `${league.currentSeasonName} · ${players}` : players;
  }
}
