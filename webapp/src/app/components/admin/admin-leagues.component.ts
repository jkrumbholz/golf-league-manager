import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LeagueSummary, MembershipService } from '../../services/membership.service';
import { ShellComponent } from '../../ui/shell.component';

@Component({
  selector: 'app-admin-leagues',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './admin-leagues.component.html',
})
export class AdminLeaguesComponent implements OnInit {
  leagues: LeagueSummary[] = [];
  error = '';

  constructor(private membership: MembershipService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    try {
      const all = await this.membership.leagues(true);
      this.leagues = all.filter(league => league.role === 'organizer');
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load your leagues';
    }
  }

  meta(league: LeagueSummary): string {
    const seasons = `${league.seasonCount} season${league.seasonCount === 1 ? '' : 's'}`;
    const players = `${league.playerCount} player${league.playerCount === 1 ? '' : 's'}`;
    return `${seasons} · ${players}`;
  }

  add(): void {
    void this.router.navigate(['/admin/leagues/new']);
  }
}
