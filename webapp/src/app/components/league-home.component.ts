import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { CourseNameService } from '../services/course-name.service';
import { formatHandicapIndex } from '../models/handicap';
import { money as formatMoney } from '../models/payouts';
import { FaceComponent } from '../ui/face.component';
import { ShellComponent } from '../ui/shell.component';

interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface LeagueEvent {
  id: number;
  name: string;
  formatLabel: string;
  startDate: string;
  status: 'done' | 'live' | 'upcoming';
  facilityId: number | null;
  courseConfigurationId: number | null;
}

interface MoneyLine {
  eventName: string;
  label: string;
  amount: number;
}

interface MoneyRow {
  userId: number;
  displayName: string;
  profilePictureUrl: string | null;
  total: number;
  lines: MoneyLine[];
}

interface MoneyList {
  season: MoneyRow[];
  allTime: MoneyRow[];
}

type Tab = 'events' | 'money' | 'players';

@Component({
  selector: 'app-league-home',
  standalone: true,
  imports: [FormsModule, RouterLink, ShellComponent, FaceComponent],
  templateUrl: './league-home.component.html',
})
export class LeagueHomeComponent implements OnInit {
  leagueId = 0;
  leagueName = '';
  logoImageUrl = '';
  seasons: Season[] = [];
  seasonId = 0;
  tab: Tab = 'events';
  liveEvent: LeagueEvent | null = null;
  upcoming: LeagueEvent[] = [];
  past: LeagueEvent[] = [];
  members: Array<{ userId: number; displayName: string; role: string; handicapIndex: number; profilePictureUrl?: string | null }> = [];
  money: MoneyList | null = null;
  openMoney = '';
  readonly formatIndex = formatHandicapIndex;
  readonly formatMoney = formatMoney;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private courseNames: CourseNameService
  ) {}

  async ngOnInit(): Promise<void> {
    this.leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      this.tab = tab === 'players' || tab === 'money' ? tab : 'events';
    });

    try {
      const page = await this.api.post<{
        league: { name: string; logoImageUrl: string | null };
        seasons: Season[];
        members: Array<{ userId: number; displayName: string; role: string; handicapIndex: number; profilePictureUrl?: string | null }>;
      }>('seasons', { leagueId: this.leagueId });

      this.leagueName = page.league.name;
      this.logoImageUrl = page.league.logoImageUrl || '';
      this.members = page.members;
      this.seasons = [...page.seasons].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const season = this.seasons.find(item => item.isActive) ?? this.seasons[0];
      if (!season) return;
      this.seasonId = season.id;
      await Promise.all([this.loadEvents(), this.loadMoney()]);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load this league';
    }
  }

  get hasFaces(): boolean {
    return this.members.some(member => !!member.profilePictureUrl);
  }

  get moneyFaces(): boolean {
    const rows = [...(this.money?.season ?? []), ...(this.money?.allTime ?? [])];
    return rows.some(row => !!row.profilePictureUrl);
  }

  seasonName(): string {
    return this.seasons.find(season => season.id === this.seasonId)?.name || 'This season';
  }

  moneyLabel(total: number): string {
    return total > 0 ? this.formatMoney(total) : '—';
  }

  toggleMoney(scope: 'season' | 'all', row: MoneyRow): void {
    if (row.lines.length === 0) return;
    const key = `${scope}:${row.userId}`;
    this.openMoney = this.openMoney === key ? '' : key;
  }

  moneyOpen(scope: 'season' | 'all', row: MoneyRow): boolean {
    return this.openMoney === `${scope}:${row.userId}`;
  }

  async changeSeason(seasonId: number): Promise<void> {
    this.seasonId = Number(seasonId);
    this.error = '';
    try {
      await Promise.all([this.loadEvents(), this.loadMoney()]);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load this season';
    }
  }

  private async loadMoney(): Promise<void> {
    this.openMoney = '';
    if (!this.seasonId) {
      this.money = null;
      return;
    }
    this.money = await this.api.post<MoneyList>('money', { leagueId: this.leagueId, seasonId: this.seasonId });
  }

  private async loadEvents(): Promise<void> {
    this.liveEvent = null;
    this.upcoming = [];
    this.past = [];
    const events = await this.api.post<LeagueEvent[]>('events', { seasonId: this.seasonId });
    this.liveEvent = events.find(event => event.status === 'live') ?? null;
    this.upcoming = events.filter(event => event.status === 'upcoming');
    this.past = events.filter(event => event.status === 'done').reverse();
    const facilityIds = [...new Set(events.map(event => event.facilityId).filter((id): id is number => id != null))];
    await Promise.all(facilityIds.map(id => this.courseNames.ensureConfigurations(id)));
  }

  eventMeta(event: LeagueEvent): string {
    const course = this.courseNames.configurationName(event.courseConfigurationId);
    const parts = [event.formatLabel, this.courseNames.shortDate(event.startDate)];
    if (course) parts.push(course);
    return parts.join(' · ');
  }
}
