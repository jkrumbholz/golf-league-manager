import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ConfigService } from '../services/config.service';
import { CourseNameService } from '../services/course-name.service';
import { ShellComponent } from '../ui/shell.component';

interface KeepProgress {
  par: number;
  need: number;
  kept: number;
  discarded: number;
}

interface BoardRow {
  competitorId: number;
  rank: number;
  name: string;
  thru: number;
  total: number | null;
  toPar: number | null;
  lastHole: number | null;
  finished?: boolean;
  teeTime: string | null;
  currentTeeName: string | null;
  memberUserIds: number[];
  keeps?: KeepProgress[] | null;
}

interface Board {
  eventId: number;
  eventName: string;
  leagueId: number;
  formatLabel: string;
  usesRunningTee: boolean;
  facilityId: number | null;
  courseConfigurationId: number | null;
  startDate: string;
  status: 'done' | 'live' | 'upcoming';
  thru: number;
  holeCount: number;
  firstRoundId: number | null;
  rows: BoardRow[];
  sideGames?: Array<{ label: string; name: string }>;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './leaderboard.component.html',
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  eventId = 0;
  /** The public broadcast view drops the app chrome so it can live on a TV. */
  broadcast = false;
  board: Board | null = null;
  error = '';
  private expandedId: number | null = null;
  private timer = 0;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private auth: AuthService,
    private config: ConfigService,
    private courseNames: CourseNameService
  ) {}

  ngOnInit(): void {
    this.eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    this.broadcast = this.route.snapshot.data['broadcast'] === true;
    void this.refresh();
    this.timer = window.setInterval(() => void this.refresh(true), this.config.leaderboardRefreshMs());
  }

  ngOnDestroy(): void {
    window.clearInterval(this.timer);
  }

  holeLabel(row: BoardRow): string {
    if (this.isFinished(row)) return 'F';
    if (row.lastHole != null) return String(row.lastHole);
    return row.teeTime || 'No Tee Time';
  }

  missingTeeTime(row: BoardRow): boolean {
    return !this.isFinished(row) && row.lastHole == null && !row.teeTime;
  }

  private isFinished(row: BoardRow): boolean {
    if (row.finished != null) return row.finished;
    return !!this.board && this.board.holeCount > 0 && row.thru >= this.board.holeCount;
  }

  scoreLabel(row: BoardRow): string {
    if (row.toPar != null) return this.toPar(row.toPar);
    if (row.total != null) return String(row.total);
    if (this.noScore(row)) return 'NS';
    return '';
  }

  noScore(row: BoardRow): boolean {
    if (row.toPar != null || row.total != null) return false;
    if (row.lastHole != null || row.finished) return true;
    return !!row.keeps?.some(item => item.discarded > 0);
  }

  private toPar(value: number | null): string {
    if (value === null) return '';
    if (value === 0) return 'E';
    return value > 0 ? `+${value}` : `${value}`;
  }

  headline(): string {
    if (!this.board) return 'Leaderboard';
    return `${this.board.eventName} · ${this.board.formatLabel}`;
  }

  /** "White/Blue · Thru 12 · Live" under the header. */
  subtitle(): string {
    if (!this.board) return '';
    const parts: string[] = [];
    const course = this.courseNames.configurationName(this.board.courseConfigurationId);
    if (course) parts.push(course);
    if (this.board.thru > 0) parts.push(`Thru ${this.board.thru}`);
    else parts.push(this.courseNames.shortDate(this.board.startDate));
    if (this.board.status === 'live') parts.push('Live');
    if (this.board.status === 'done') parts.push('Final');
    return parts.join(' · ');
  }

  hasKeeps(row: BoardRow): boolean {
    return !!row.keeps && row.keeps.length > 0;
  }

  isOpen(row: BoardRow): boolean {
    return this.expandedId === row.competitorId;
  }

  toggle(row: BoardRow): void {
    if (!this.hasKeeps(row)) return;
    this.expandedId = this.isOpen(row) ? null : row.competitorId;
  }

  isMe(row: BoardRow): boolean {
    const id = this.auth.user()?.id;
    return id != null && row.memberUserIds.includes(id);
  }

  get sideGames(): Array<{ label: string; name: string }> {
    return this.board?.sideGames ?? [];
  }

  backTo(): unknown[] {
    return this.board ? ['/leagues', this.board.leagueId] : ['/leagues'];
  }

  private async refresh(quiet = false): Promise<void> {
    try {
      const board = await this.api.post<Board>('leaderboard', { eventId: this.eventId }, { quiet });
      await this.courseNames.ensureConfigurations(board.facilityId);
      this.board = board;
      this.error = '';
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Leaderboard unavailable';
    }
  }
}
