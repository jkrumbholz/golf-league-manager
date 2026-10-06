import { NgClass } from '@angular/common';
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

interface CardPlayer {
  name: string;
  gross: number | null;
  net: number | null;
  strokes: number;
}

interface PlayedHole {
  sequence: number;
  hole: number;
  par: number;
  gross: number | null;
  net: number | null;
  strokes: number;
  kept: boolean | null;
  relative?: boolean;
  players?: CardPlayer[];
}

interface Tiebreaker {
  standing: number;
  steps: Array<{
    criterion: string;
    description: string;
    scores: Array<{ competitorId: number; name: string; score: number }>;
    result: 'tie' | 'split';
    summary: string;
  }>;
  order: Array<{ competitorId: number; name: string; rank: number }>;
}

interface BoardRow {
  competitorId: number;
  rank: number;
  name: string;
  detailName?: string;
  thru: number;
  total: number | null;
  toPar: number | null;
  lastHole: number | null;
  finished?: boolean;
  teeTime: string | null;
  startingHole?: number | null;
  currentTeeName: string | null;
  memberUserIds: number[];
  keeps?: KeepProgress[] | null;
  card?: PlayedHole[];
  tiebreaker?: Tiebreaker | null;
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
  imports: [NgClass, RouterLink, ShellComponent],
  templateUrl: './leaderboard.component.html',
})
export class LeaderboardComponent implements OnInit, OnDestroy {
  eventId = 0;
  /** The public broadcast view drops the app chrome so it can live on a TV. */
  broadcast = false;
  board: Board | null = null;
  error = '';
  private expandedId: number | null = null;
  tieRow: BoardRow | null = null;
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
    if (!row.teeTime) return 'No Tee Time';
    if (row.startingHole && row.startingHole > 1) return `${row.teeTime} · ${row.startingHole}`;
    return row.teeTime;
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

  playedHoles(row: BoardRow): PlayedHole[] {
    return row.card ?? [];
  }

  teamCard(row: BoardRow): boolean {
    return this.cardPlayers(row).length > 1;
  }

  cardPlayers(row: BoardRow): CardPlayer[] {
    return this.playedHoles(row).find(hole => (hole.players?.length ?? 0) > 0)?.players ?? [];
  }

  playerCountClass(row: BoardRow): string {
    return `players-${this.cardPlayers(row).length}`;
  }

  strokeDots(count: number): number[] {
    const dots = Math.max(0, count);
    return Array.from({ length: dots }, (_, index) => index);
  }

  givenMarks(count: number): string {
    return '+'.repeat(Math.abs(count));
  }

  grossTotal(row: BoardRow): number {
    return this.playedHoles(row).reduce((sum, hole) => sum + (hole.kept === false ? 0 : hole.gross ?? 0), 0);
  }

  netTotal(row: BoardRow): number {
    return this.playedHoles(row).reduce((sum, hole) => {
      if (hole.kept === false) return sum;
      return sum + (hole.net ?? hole.gross ?? 0);
    }, 0);
  }

  playerGrossTotal(row: BoardRow, index: number): number {
    return this.playedHoles(row).reduce((sum, hole) => sum + (hole.players?.[index]?.gross ?? 0), 0);
  }

  playerNetTotal(row: BoardRow, index: number): number {
    return this.playedHoles(row).reduce((sum, hole) => {
      const player = hole.players?.[index];
      if (!player || player.gross == null) return sum;
      return sum + (player.net ?? player.gross);
    }, 0);
  }

  teamTotal(row: BoardRow): number {
    return this.playedHoles(row).reduce((sum, hole) => sum + (hole.gross ?? 0), 0);
  }

  teamScore(hole: PlayedHole): string {
    if (hole.gross == null) return '–';
    return String(hole.gross);
  }

  teamColumnTotal(row: BoardRow): string {
    if (this.playedHoles(row).some(hole => hole.relative)) return this.scoreLabel(row);
    return String(this.teamTotal(row));
  }

  isOpen(row: BoardRow): boolean {
    return this.expandedId === row.competitorId;
  }

  toggle(row: BoardRow): void {
    this.expandedId = this.isOpen(row) ? null : row.competitorId;
  }

  showTiebreaker(row: BoardRow): void {
    this.tieRow = row;
  }

  closeTiebreaker(): void {
    this.tieRow = null;
  }

  tieNames(row: BoardRow): string {
    const names = row.tiebreaker?.order.map(item => item.name) ?? [];
    if (names.length < 2) return names[0] ?? '';
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  tieIntro(row: BoardRow): string {
    const count = row.tiebreaker?.order.length ?? 0;
    const verb = count === 2 ? 'both finished' : 'all finished';
    return `${this.tieNames(row)} ${verb} at ${this.scoreLabel(row)}.`;
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
