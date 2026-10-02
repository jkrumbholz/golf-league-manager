import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { ShellComponent } from '../ui/shell.component';

interface HoleLine {
  userId: number | null;
  teamId: number | null;
  displayName: string;
  gross: number | null;
  strokes: number;
  net: number | null;
  kept: boolean | null;
}

interface HoleView {
  sequence: number;
  par: number;
  displayHoleNumber: number | null;
  lines: HoleLine[];
}

interface Scorecard {
  eventId: number;
  eventName: string;
  format: string;
  formatLabel: string;
  competitorName: string | null;
  holes: HoleView[];
  groupId: number | null;
  notice: string | null;
}

interface Column {
  key: string;
  name: string;
}

@Component({
  selector: 'app-scorecard',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './scorecard.component.html',
})
export class ScorecardComponent implements OnInit {
  eventId = 0;
  roundId = 0;
  card: Scorecard | null = null;
  columns: Column[] = [];
  error = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService
  ) {}

  async ngOnInit(): Promise<void> {
    this.eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    this.roundId = Number(this.route.snapshot.paramMap.get('roundId'));
    const requestedGroup = Number(this.route.snapshot.queryParamMap.get('group'));
    try {
      const card = await this.api.post<Scorecard>('scorecard', {
        roundId: this.roundId,
        groupId: Number.isInteger(requestedGroup) && requestedGroup > 0 ? requestedGroup : null,
      });
      this.card = card;
      this.columns = this.players(card);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load the scorecard';
    }
  }

  get backTo(): unknown[] {
    return ['/events', this.eventId];
  }

  get columnsStyle(): string {
    return `44px 40px repeat(${Math.max(this.columns.length, 1)}, minmax(72px, 1fr))`;
  }

  holeNumber(hole: HoleView): number {
    return hole.displayHoleNumber || hole.sequence;
  }

  holeParams(index: number): Record<string, number> {
    const params: Record<string, number> = { hole: index };
    if (this.card?.groupId != null) params['group'] = this.card.groupId;
    return params;
  }

  line(hole: HoleView, key: string): HoleLine | null {
    return hole.lines.find(item => this.lineKey(item) === key) ?? null;
  }

  strokeDots(hole: HoleView, key: string): number[] {
    const count = this.line(hole, key)?.strokes ?? 0;
    return Array.from({ length: count > 0 ? count : 0 }, (_, index) => index);
  }

  showsNet(hole: HoleView, key: string): boolean {
    const line = this.line(hole, key);
    return !!line && line.gross != null && line.kept !== false && line.strokes > 0;
  }

  discarded(hole: HoleView, key: string): boolean {
    return this.line(hole, key)?.kept === false;
  }

  /** Gross against the hole's par. Circles and squares follow the number written on the card. */
  relation(hole: HoleView, key: string): 'under' | 'over' | null {
    const gross = this.line(hole, key)?.gross;
    if (gross == null) return null;
    if (gross < hole.par) return 'under';
    if (gross > hole.par) return 'over';
    return null;
  }

  total(key: string): number | null {
    return this.sum(key, line => line.gross);
  }

  netTotal(key: string): number | null {
    if (!this.card) return null;
    let anyStrokes = false;
    for (const hole of this.card.holes) {
      const line = this.line(hole, key);
      if (line && line.gross != null && line.kept !== false && line.strokes > 0) anyStrokes = true;
    }
    return anyStrokes ? this.sum(key, line => line.net) : null;
  }

  private sum(key: string, value: (line: HoleLine) => number | null): number | null {
    if (!this.card) return null;
    let sum = 0;
    let any = false;
    for (const hole of this.card.holes) {
      const line = this.line(hole, key);
      const amount = line && line.gross != null && line.kept !== false ? value(line) : null;
      if (amount == null) continue;
      sum += amount;
      any = true;
    }
    return any ? sum : null;
  }

  private players(card: Scorecard): Column[] {
    const seen = new Map<string, string>();
    for (const hole of card.holes) {
      for (const line of hole.lines) {
        const key = this.lineKey(line);
        if (!seen.has(key)) seen.set(key, line.displayName);
      }
    }
    return [...seen.entries()].map(([key, name]) => ({ key, name }));
  }

  private lineKey(line: HoleLine): string {
    return line.userId != null ? `u${line.userId}` : `t${line.teamId}`;
  }
}
