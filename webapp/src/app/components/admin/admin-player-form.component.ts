import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { formatHandicapIndex, parseHandicapIndex } from '../../models/handicap';
import { ShellComponent } from '../../ui/shell.component';

interface Match {
  userId: number;
  username: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  handicapIndex: number;
}

@Component({
  selector: 'app-admin-player-form',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-player-form.component.html',
})
export class AdminPlayerFormComponent implements OnInit {
  leagueId = 0;
  mode: 'search' | 'create' = 'search';
  query = '';
  searched = false;
  matches: Match[] = [];
  firstName = '';
  lastName = '';
  handicapText = '0';
  setupLink = '';
  copied = false;
  readonly formatIndex = formatHandicapIndex;
  fieldErrors: Record<string, string> = {};
  error = '';
  saving = false;

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    this.leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
  }

  get backTo(): unknown[] {
    return ['/admin/leagues', this.leagueId];
  }

  async search(): Promise<void> {
    this.error = '';
    this.matches = [];
    this.searched = false;
    try {
      this.matches = await this.api.put<Match[]>('league', {
        action: 'searchPlayers',
        leagueId: this.leagueId,
        query: this.query,
      });
      this.searched = true;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not search players';
    }
  }

  async addExisting(userId: number): Promise<void> {
    this.error = '';
    try {
      await this.api.put('league', { action: 'addPlayer', leagueId: this.leagueId, userId });
      await this.router.navigate(this.backTo, { queryParams: { tab: 'players' } });
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not add that player';
    }
  }

  async createPlayer(): Promise<void> {
    this.fieldErrors = {};
    this.error = '';
    if (!this.firstName.trim()) this.fieldErrors['firstName'] = 'First name is required';
    if (!this.lastName.trim()) this.fieldErrors['lastName'] = 'Last name is required';
    const handicapIndex = parseHandicapIndex(this.handicapText);
    if (handicapIndex == null) this.fieldErrors['handicapIndex'] = 'Enter a handicap like 10.4 or +1.4';
    if (handicapIndex == null || Object.keys(this.fieldErrors).length > 0) return;

    this.saving = true;
    try {
      const created = await this.api.put<{ token: string }>('league', {
        action: 'createPlayer',
        leagueId: this.leagueId,
        firstName: this.firstName,
        lastName: this.lastName,
        handicapIndex,
      });
      this.setupLink = `${location.origin}/welcome/${created.token}`;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not create that player';
    } finally {
      this.saving = false;
    }
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.setupLink);
      this.copied = true;
    } catch {
      this.copied = false;
    }
  }

  done(): void {
    void this.router.navigate(this.backTo, { queryParams: { tab: 'players' } });
  }
}
