import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  teeName?: string;
  teeColor?: string | null;
}

interface HoleView {
  sequence: number;
  par: number;
  displayHoleNumber: number | null;
  teeName: string;
  teeColor: string | null;
  lines: HoleLine[];
  countingScore: number | null;
  complete: boolean;
}

interface ScoreGroup {
  groupId: number;
  label: string;
}

interface Scorecard {
  eventId: number;
  eventName: string;
  format: string;
  formatLabel: string;
  teamGross: boolean;
  runningTee: boolean;
  oceans6: boolean;
  organizer: boolean;
  roundNumber: number;
  competitorId: number | null;
  competitorName: string | null;
  holes: HoleView[];
  teams: Array<{ teamId: number; name: string }>;
  groups: ScoreGroup[];
  canPickGroup: boolean;
  groupId: number | null;
  groupLabel: string | null;
  notice: string | null;
}

@Component({
  selector: 'app-score',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './score.component.html',
})
export class ScoreComponent implements OnInit {
  roundId = 0;
  teamId: number | null = null;
  groupId: number | null = null;
  card: Scorecard | null = null;
  holeIndex = 0;
  error = '';
  saving = false;
  /** Scores on this hole when it was opened, so Cancel can put them back. */
  private baseline: Array<{ gross: number | null; kept: boolean | null; net: number | null }> = [];

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    this.roundId = Number(this.route.snapshot.paramMap.get('roundId'));
    const requestedGroup = Number(this.route.snapshot.queryParamMap.get('group'));
    if (Number.isInteger(requestedGroup) && requestedGroup > 0) this.groupId = requestedGroup;
    const holeParam = this.route.snapshot.queryParamMap.get('hole');
    const requestedHole = holeParam == null ? Number.NaN : Number(holeParam);
    await this.load();
    const explicit = !!this.card
      && Number.isInteger(requestedHole)
      && requestedHole >= 0
      && requestedHole < this.card.holes.length;
    if (explicit) this.holeIndex = requestedHole;
    else this.holeIndex = this.nextOpenHole();
    const undecided = this.firstUndecidedIndex();
    if (undecided != null && this.holeIndex > undecided) this.holeIndex = undecided;
    this.capture();
    this.applyForced();
  }

  get hole(): HoleView | null {
    return this.card?.holes[this.holeIndex] ?? null;
  }

  get backTo(): unknown[] {
    return this.card ? ['/events', this.card.eventId] : ['/leagues'];
  }

  get title(): string {
    const hole = this.hole;
    return hole ? `Hole ${hole.displayHoleNumber || hole.sequence}` : 'Scores';
  }

  async load(): Promise<void> {
    this.error = '';
    try {
      this.applyCard(await this.api.post<Scorecard>('scorecard', {
        roundId: this.roundId,
        teamId: this.teamId,
        groupId: this.groupId,
      }));
      if (this.card && this.holeIndex >= this.card.holes.length) this.holeIndex = 0;
      this.capture();
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load the card';
    }
  }

  async changeTeam(teamId: number): Promise<void> {
    const nextId = Number(teamId);
    if (nextId === this.teamId) return;
    if (!(await this.persist())) return;
    this.revertUnsavedForced();
    this.teamId = nextId;
    await this.load();
    this.applyForced();
  }

  async changeGroup(groupId: number): Promise<void> {
    const nextId = Number(groupId);
    if (nextId === this.groupId) return;
    if (!(await this.persist())) return;
    this.revertUnsavedForced();
    this.groupId = nextId;
    await this.load();
    this.applyForced();
  }

  async openScorecard(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.card || !(await this.persist())) return;
    const queryParams = this.card.groupId ? { group: this.card.groupId } : {};
    await this.router.navigate(['/events', this.card.eventId, 'score', this.roundId, 'card'], { queryParams });
  }

  async previous(): Promise<void> {
    if (this.holeIndex === 0 || this.saving) return;
    if (!(await this.persist())) return;
    this.revertUnsavedForced();
    this.holeIndex -= 1;
    this.capture();
    this.applyForced();
  }

  get needsDecision(): boolean {
    return this.holeNeedsDecision(this.hole);
  }

  /** First hole on this card that still has a blank score. The last hole when every score is in. */
  private nextOpenHole(): number {
    if (!this.card || this.card.holes.length === 0) return 0;
    const blank = this.card.holes.findIndex(hole => hole.lines.some(line => line.gross == null));
    return blank >= 0 ? blank : this.card.holes.length - 1;
  }

  private firstUndecidedIndex(): number | null {
    if (!this.card?.oceans6) return null;
    const index = this.card.holes.findIndex(hole => this.holeNeedsDecision(hole));
    return index >= 0 ? index : null;
  }

  private holeNeedsDecision(hole: HoleView | null): boolean {
    if (!this.card?.oceans6 || !hole) return false;
    return hole.lines.some(line => line.gross != null && line.kept == null);
  }

  get onLastHole(): boolean {
    return !!this.card && this.holeIndex >= this.card.holes.length - 1;
  }

  get nextLabel(): string {
    return this.onLastHole ? 'Save' : 'Next hole';
  }

  async next(): Promise<void> {
    if (this.saving || !this.card || this.needsDecision) return;
    if (this.onLastHole && !this.dirty) return;
    if (!(await this.persist())) return;
    if (this.onLastHole) return;
    this.revertUnsavedForced();
    this.holeIndex += 1;
    this.capture();
    this.applyForced();
  }

  /** One block per team so a running tee can differ inside the same group. */
  scoreGroups(hole: HoleView): Array<{ key: string; teeName: string; teeColor: string | null; lines: HoleLine[]; score: number | null }> {
    const groups: Array<{ key: string; teeName: string; teeColor: string | null; lines: HoleLine[] }> = [];
    for (const line of hole.lines) {
      const key = line.teamId != null ? `t${line.teamId}` : `u${line.userId ?? 0}`;
      let group = groups.find(item => item.key === key);
      if (!group) {
        group = {
          key,
          teeName: line.teeName || hole.teeName,
          teeColor: line.teeColor ?? hole.teeColor,
          lines: [],
        };
        groups.push(group);
      }
      group.lines.push(line);
    }
    return groups.map(group => ({ ...group, score: this.vegasHole(group.lines, hole.par) }));
  }

  showTeamTees(hole: HoleView): boolean {
    return !!this.card?.runningTee && this.scoreGroups(hole).length > 1;
  }

  hasVegasScore(hole: HoleView): boolean {
    return this.scoreGroups(hole).some(group => group.score != null);
  }

  private vegasHole(lines: HoleLine[], par: number): number | null {
    if (this.card?.format !== 'vegas' && this.card?.format !== 'vegas_up_and_back') return null;
    if (lines.length !== 2 || lines.some(line => line.net == null)) return null;
    const low = Math.min(lines[0].net as number, lines[1].net as number);
    const high = Math.max(lines[0].net as number, lines[1].net as number);
    const doubleBogey = par + 2;
    const flip = lines.some(line => (line.net as number) >= doubleBogey);
    const tens = flip ? high : low;
    const ones = flip ? low : high;
    return tens * 10 + ones;
  }

  strokeDots(line: HoleLine): number[] {
    const count = line.strokes > 0 ? line.strokes : 0;
    return Array.from({ length: count }, (_, index) => index);
  }

  bump(line: HoleLine, delta: number): void {
    const par = this.hole?.par ?? 4;
    const next = line.gross == null ? par : line.gross + delta;
    if (next < 1 || next > 20) return;
    line.gross = next;
    line.net = next - line.strokes;
  }

  get hasScores(): boolean {
    return !!this.hole?.lines.some(line => line.gross != null);
  }

  get clearLabel(): string {
    return (this.hole?.lines.length ?? 0) === 2 ? 'Clear both scores' : 'Clear scores';
  }

  decisionLocked(line: HoleLine): boolean {
    if (!this.card?.oceans6 || this.card.organizer) return false;
    const index = this.hole?.lines.indexOf(line) ?? -1;
    return index >= 0 && this.baseline[index]?.kept != null;
  }

  get clearLocked(): boolean {
    return !!this.hole?.lines.some(line => this.decisionLocked(line));
  }

    get dirty(): boolean {
    return !!this.hole?.lines.some((line, index) => {
      const saved = this.baseline[index];
      if (!saved) return line.gross != null || line.kept != null;
      if (saved.gross !== line.gross) return true;
      if (saved.kept === line.kept) return false;
      // A forced choice with no score yet is only a preview. It saves with the gross.
      return !(line.gross == null && saved.gross == null && saved.kept == null);
    });
  }

  cancel(): void {
    if (!this.hole) return;
    this.hole.lines.forEach((line, index) => {
      const saved = this.baseline[index];
      if (!saved) return;
      line.gross = saved.gross;
      line.kept = saved.kept;
      line.net = saved.net;
    });
    this.error = '';
    this.applyForced();
  }

  clearScores(): void {
    if (!this.hole || !this.hasScores || this.clearLocked) return;
    for (const line of this.hole.lines) {
      line.gross = null;
      line.net = null;
      line.kept = null;
    }
    this.applyForced();
  }

  setKept(line: HoleLine, kept: boolean): void {
    if (this.decisionLocked(line)) return;
    if (line.gross == null) {
      this.error = 'Enter the gross score first.';
      return;
    }
    this.error = '';
    line.kept = kept;
  }

  keptCount(par: number, userId: number | null): number {
    if (!this.card) return 0;
    return this.card.holes.filter(hole => hole.par === par && hole.lines.some(line => line.userId === userId && line.kept)).length;
  }

  keepTally(userId: number | null): Array<{ par: number; need: number; kept: number; discarded: number }> {
    return [3, 4, 5].map(par => ({
      par,
      need: this.quota(par),
      kept: this.keptCount(par, userId),
      discarded: this.discardedCount(par, userId),
    }));
  }

  private discardedCount(par: number, userId: number | null): number {
    if (!this.card) return 0;
    return this.card.holes.filter(hole => hole.par === par && hole.lines.some(line => line.userId === userId && line.kept === false)).length;
  }

  canKeep(par: number, userId: number | null): boolean {
    const quota = this.quota(par);
    return quota > 0 && this.keptCount(par, userId) < quota;
  }

  canDiscard(par: number, sequence: number, userId: number | null): boolean {
    const quota = this.quota(par);
    if (!quota || !this.card || userId == null) return false;
    const stillAvailable = this.card.holes.filter(hole => {
      if (hole.par !== par || hole.sequence === sequence) return false;
      const line = hole.lines.find(item => item.userId === userId);
      return line?.kept !== false;
    }).length;
    return stillAvailable >= quota;
  }

  mustKeep(hole: HoleView, line: HoleLine): boolean {
    if (line.userId == null || line.kept === false) return false;
    return !this.canDiscard(hole.par, hole.sequence, line.userId);
  }

  cantKeep(hole: HoleView, line: HoleLine): boolean {
    if (line.userId == null || line.kept === true) return false;
    return !this.canKeep(hole.par, line.userId);
  }

  /** Selects Keep or Discard when that is the only legal choice. */
  private applyForced(): void {
    if (!this.card?.oceans6 || !this.hole) return;
    for (const line of this.hole.lines) {
      if (line.kept != null || line.userId == null) continue;
      if (this.cantKeep(this.hole, line)) line.kept = false;
      else if (this.mustKeep(this.hole, line)) line.kept = true;
    }
  }

  /** Drops a previewed choice that was never saved, so the next hole is not affected. */
  private revertUnsavedForced(): void {
    if (!this.hole) return;
    this.hole.lines.forEach((line, index) => {
      const saved = this.baseline[index];
      if (!saved) return;
      if (line.gross == null && saved.gross == null && saved.kept == null) line.kept = null;
    });
  }

  private applyCard(card: Scorecard): void {
    this.card = {
      ...card,
      groups: card.groups ?? [],
      organizer: !!card.organizer,
      canPickGroup: !!card.canPickGroup,
      groupId: card.groupId ?? null,
      groupLabel: card.groupLabel ?? null,
      notice: card.notice ?? null,
    };
    this.groupId = this.card.groupId;
    if (this.card.groupId == null) this.teamId = this.card.competitorId;
  }

  private quota(par: number): number {
    if (par === 3 || par === 5) return 1;
    if (par === 4) return 4;
    return 0;
  }

  private capture(): void {
    this.baseline = (this.hole?.lines ?? []).map(line => ({
      gross: line.gross,
      kept: line.kept,
      net: line.net,
    }));
  }

  /** Writes this hole when something changed. Stays put and keeps the edits if the save fails. */
  private async persist(): Promise<boolean> {
    if (!this.hole || !this.dirty) return true;
    if (this.saving) return false;
    this.saving = true;
    this.error = '';
    const sequence = this.hole.sequence;
    const scores = this.hole.lines.flatMap((line, index) => {
      const saved = this.baseline[index];
      if (saved && saved.gross === line.gross && saved.kept === line.kept) return [];
      return [{
        sequence,
        userId: line.userId,
        teamId: line.teamId,
        gross: line.gross,
        kept: line.kept,
      }];
    });
    try {
      const saved = await this.api.put<Scorecard>('score', {
        roundId: this.roundId,
        teamId: this.teamId,
        groupId: this.groupId,
        scores,
      });
      const index = this.holeIndex;
      this.applyCard(saved);
      this.holeIndex = index;
      this.capture();
      return true;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the score';
      return false;
    } finally {
      this.saving = false;
    }
  }
}
