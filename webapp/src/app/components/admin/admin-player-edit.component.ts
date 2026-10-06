import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { formatHandicapIndex, parseHandicapIndex } from '../../models/handicap';
import { ShellComponent } from '../../ui/shell.component';

interface Member {
  userId: number;
  username: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  handicapIndex: number;
}

@Component({
  selector: 'app-admin-player-edit',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-player-edit.component.html',
})
export class AdminPlayerEditComponent implements OnInit {
  leagueId = 0;
  userId = 0;
  firstName = '';
  lastName = '';
  displayName = '';
  handicapText = '';
  username: string | null = null;
  link = '';
  copied = false;
  loaded = false;
  fieldErrors: Record<string, string> = {};
  error = '';
  saving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private auth: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    this.leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
    this.userId = Number(this.route.snapshot.paramMap.get('userId'));
    try {
      const page = await this.api.post<{ members: Member[] }>('seasons', { leagueId: this.leagueId });
      const member = page.members.find(item => item.userId === this.userId);
      if (!member) {
        this.error = 'That player is not in this league';
        return;
      }
      this.firstName = member.firstName;
      this.lastName = member.lastName;
      this.displayName = member.displayName;
      this.username = member.username;
      this.handicapText = formatHandicapIndex(member.handicapIndex);
      this.loaded = true;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load this player';
    }
  }

  get backTo(): unknown[] {
    return ['/admin/leagues', this.leagueId];
  }

  async save(): Promise<void> {
    this.fieldErrors = {};
    this.error = '';
    if (!this.firstName.trim()) this.fieldErrors['firstName'] = 'First name is required';
    if (!this.lastName.trim()) this.fieldErrors['lastName'] = 'Last name is required';
    if (!this.displayName.trim()) this.fieldErrors['displayName'] = 'Display name is required';
    const handicapIndex = parseHandicapIndex(this.handicapText);
    if (handicapIndex == null) {
      this.fieldErrors['handicapIndex'] = 'Enter a handicap like 10.4 or +1.4';
    }
    if (handicapIndex == null || Object.keys(this.fieldErrors).length > 0) return;

    this.saving = true;
    try {
      const saved = await this.api.put<{
        userId: number;
        firstName: string;
        lastName: string;
        displayName: string;
        handicapIndex: number;
      }>('league', {
        action: 'updatePlayer',
        leagueId: this.leagueId,
        userId: this.userId,
        firstName: this.firstName,
        lastName: this.lastName,
        displayName: this.displayName,
        handicapIndex,
      });
      const me = this.auth.user();
      if (me && me.id === saved.userId) {
        this.auth.replaceUser({
          ...me,
          firstName: saved.firstName,
          lastName: saved.lastName,
          displayName: saved.displayName,
          handicapIndex: saved.handicapIndex,
        });
      }
      await this.router.navigate(this.backTo, { queryParams: { tab: 'players' } });
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save this player';
    } finally {
      this.saving = false;
    }
  }

  get hasLogin(): boolean {
    return this.username != null;
  }

  async copyAccountLink(): Promise<void> {
    this.error = '';
    this.copied = false;
    try {
      const created = await this.api.put<{ token: string }>('league', {
        action: 'accountLink',
        leagueId: this.leagueId,
        userId: this.userId,
        purpose: this.hasLogin ? 'reset' : 'setup',
      });
      this.link = `${location.origin}/welcome/${created.token}`;
      try {
        await navigator.clipboard.writeText(this.link);
        this.copied = true;
      } catch {
        this.copied = false;
      }
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not create that link';
    }
  }
}
