import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { FaceComponent } from '../ui/face.component';

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
  teeTime: string;
  names: string;
  thru: number;
  currentHole: number;
  own: boolean;
}

interface ScoreTeam {
  teamId: number;
  name: string;
  members?: Array<{ userId: number }>;
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
  teams: ScoreTeam[];
  groups: ScoreGroup[];
  canPickGroup: boolean;
  groupId: number | null;
  ownGroupId: number | null;
  groupLabel: string | null;
  startingHole: number | null;
  notice: string | null;
}

interface BoardRow {
  competitorId: number;
  rank: number;
  name: string;
  thru: number;
  total: number | null;
  toPar: number | null;
  lastHole: number | null;
  memberUserIds: number[];
  photos?: string[];
}

interface Board {
  rows: BoardRow[];
}

interface LineGroup {
  key: string;
  teeName: string;
  teeColor: string | null;
  lines: HoleLine[];
}

@Component({
  selector: 'app-score',
  standalone: true,
  imports: [RouterLink, FaceComponent],
  templateUrl: './score.component.html',
})
export class ScoreComponent implements OnInit {
  roundId = 0;
  teamId: number | null = null;
  groupId: number | null = null;
  card: Scorecard | null = null;
  board: Board | null = null;
  holeIndex = 0;
  error = '';
  saving = false;
  picking = false;
  menuOpen = false;
  sheet: 'leaderboard' | 'scorecard' | null = null;
  /** Remembered on this device until the player turns the ticker back on. */
  tickerOn = this.rememberedTicker();
  private ownHoleIndex: number | null = null;
  private chain: Promise<boolean> = Promise.resolve(true);
  /** Scores on this hole when it was last saved, so a newer tap is not overwritten. */
  private baseline: Array<{ gross: number | null; kept: boolean | null; net: number | null }> = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private auth: AuthService
  ) {}

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
    if (undecided != null) {
      const order = this.playOrder();
      const at = order.indexOf(this.holeIndex);
      const undecidedAt = order.indexOf(undecided);
      if (undecidedAt >= 0 && (at < 0 || at > undecidedAt)) this.holeIndex = undecided;
    }
    this.capture();
    this.applyForced();
    void this.loadBoard(true);
  }

  get hole(): HoleView | null {
    return this.card?.holes[this.holeIndex] ?? null;
  }

  get backTo(): unknown[] {
    return this.card ? ['/events', this.card.eventId] : ['/leagues'];
  }

  get otherGroup(): boolean {
    return !!this.card
      && this.card.organizer
      && this.card.ownGroupId != null
      && this.card.groupId !== this.card.ownGroupId;
  }

  pickerNames(group: ScoreGroup): string {
    const direct = group.names.trim();
    if (direct) return direct;
    const parts = group.label.split(' · ').map(part => part.trim()).filter(part => part.length > 0);
    const holeAt = parts.findIndex(part => /^hole \d+$/i.test(part));
    if (holeAt >= 0) return parts.slice(holeAt + 1).join(', ');
    return parts.length > 1 ? parts.slice(1).join(', ') : '';
  }

  pickerHole(group: ScoreGroup): number {
    if (group.currentHole > 1 || group.thru > 0) return group.currentHole;
    const match = /Hole (\d+)/i.exec(group.label);
    return match ? Number(match[1]) : group.currentHole;
  }

  get activeGroup(): ScoreGroup | null {
    if (!this.card?.groupId) return null;
    return this.card.groups.find(group => group.groupId === this.card?.groupId) ?? null;
  }

  get tickerRows(): BoardRow[] {
    return this.board?.rows ?? [];
  }

  get hasFaces(): boolean {
    return this.tickerRows.some(row => (row.photos?.length ?? 0) > 0);
  }

  /** Same pace as the old five-name scroll, with a short wait after the last name. */
  get tickerDuration(): string {
    const seconds = Math.max(36, this.tickerRows.length * 7);
    return `${seconds}s`;
  }

  placeLabel(row: BoardRow): string {
    const tied = (this.board?.rows ?? []).some(item => item !== row && item.rank === row.rank && (item.toPar != null || item.total != null));
    return tied ? `T${row.rank})` : `${row.rank})`;
  }

  get onFirstHole(): boolean {
    const order = this.playOrder();
    return order.length === 0 || this.holeIndex === order[0];
  }

  get onLastHole(): boolean {
    const order = this.playOrder();
    return order.length === 0 || this.holeIndex === order[order.length - 1];
  }

  get nextLabel(): string {
    return this.onLastHole ? 'Finish round' : 'Next hole';
  }

  get needsDecision(): boolean {
    return this.holeNeedsDecision(this.hole);
  }

  courseHole(hole: HoleView): number {
    return hole.displayHoleNumber ?? hole.sequence;
  }

  teeDot(color: string | null): string {
    const match = /^#?([0-9a-f]{6})$/i.exec(color?.trim() ?? '');
    if (!match) return 'var(--text-muted)';
    const value = parseInt(match[1], 16);
    const lift = (channel: number) => Math.round(channel + (255 - channel) * 0.55);
    const red = lift((value >> 16) & 255);
    const green = lift((value >> 8) & 255);
    const blue = lift(value & 255);
    return `rgb(${red}, ${green}, ${blue})`;
  }

  teeLabel(name: string | null | undefined): string {
    const text = (name || '').trim();
    if (!text) return 'Tee';
    return /tees$/i.test(text) ? text : `${text} tees`;
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

  async changeGroup(groupId: number): Promise<void> {
    const nextId = Number(groupId);
    if (nextId === this.groupId) return;
    if (!(await this.flush())) return;
    this.revertUnsavedForced();
    this.groupId = nextId;
    await this.load();
    this.holeIndex = this.nextOpenHole();
    this.capture();
    this.applyForced();
    void this.loadBoard(true);
  }

  async previous(): Promise<void> {
    if (this.onFirstHole) return;
    if (!(await this.flush())) return;
    this.revertUnsavedForced();
    const order = this.playOrder();
    const at = order.indexOf(this.holeIndex);
    if (at > 0) this.holeIndex = order[at - 1];
    this.capture();
    this.applyForced();
  }

  async next(): Promise<void> {
    if (!this.card || this.needsDecision) return;
    if (!(await this.flush())) return;
    if (this.onLastHole) {
      await this.router.navigate(['/events', this.card.eventId]);
      return;
    }
    this.revertUnsavedForced();
    const order = this.playOrder();
    const at = order.indexOf(this.holeIndex);
    if (at >= 0 && at < order.length - 1) this.holeIndex = order[at + 1];
    this.capture();
    this.applyForced();
  }

  toggleTicker(): void {
    this.tickerOn = !this.tickerOn;
    this.menuOpen = false;
    try {
      localStorage.setItem('golf-league-manager.score-ticker', this.tickerOn ? 'shown' : 'hidden');
    } catch {
      // A private browser can refuse storage. The choice still applies until reload.
    }
  }

  private rememberedTicker(): boolean {
    try {
      return localStorage.getItem('golf-league-manager.score-ticker') !== 'hidden';
    } catch {
      return true;
    }
  }

  openSheet(tab: 'leaderboard' | 'scorecard'): void {
    this.menuOpen = false;
    this.sheet = tab;
    void this.loadBoard(true);
  }

  closeSheet(): void {
    this.sheet = null;
  }

  gripDown(event: PointerEvent): void {
    const start = event.clientY;
    const move = (pointer: PointerEvent) => {
      if (pointer.clientY - start > 70) {
        this.closeSheet();
        window.removeEventListener('pointermove', move);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  async jumpTo(hole: HoleView): Promise<void> {
    const index = this.card?.holes.indexOf(hole) ?? -1;
    if (index < 0 || !(await this.flush())) return;
    this.holeIndex = index;
    this.sheet = null;
    this.capture();
    this.applyForced();
  }

  openPicker(): void {
    this.menuOpen = false;
    this.picking = true;
  }

  async pickGroup(groupId: number): Promise<void> {
    if (this.card?.groupId != null && this.card.groupId === this.card.ownGroupId) {
      this.ownHoleIndex = this.holeIndex;
    }
    this.picking = false;
    await this.changeGroup(groupId);
  }

  async backToMine(): Promise<void> {
    const id = this.card?.ownGroupId;
    if (id == null) return;
    const hole = this.ownHoleIndex;
    await this.changeGroup(id);
    if (hole != null && this.card && hole >= 0 && hole < this.card.holes.length) {
      this.holeIndex = hole;
      this.capture();
      this.applyForced();
    }
  }

  nines(): HoleView[][] {
    if (!this.card) return [];
    const front = this.card.holes.filter(hole => this.courseHole(hole) <= 9);
    const back = this.card.holes.filter(hole => this.courseHole(hole) > 9);
    return [front, back].filter(nine => nine.length > 0);
  }

  nineColumns(nine: HoleView[]): string {
    return `88px repeat(${nine.length}, 44px)`;
  }

  sheetRows(): Array<{ key: string; name: string }> {
    if (!this.card) return [];
    const seen = new Map<string, string>();
    for (const hole of this.card.holes) {
      for (const line of hole.lines) {
        const key = this.lineKey(line);
        if (!seen.has(key)) seen.set(key, line.displayName);
      }
    }
    return [...seen.entries()].map(([key, name]) => ({ key, name }));
  }

  lineOn(hole: HoleView, key: string): HoleLine | null {
    return hole.lines.find(line => this.lineKey(line) === key) ?? null;
  }

  isUnder(hole: HoleView, key: string): boolean {
    const gross = this.lineOn(hole, key)?.gross;
    return gross != null && gross < hole.par;
  }

  isOver(hole: HoleView, key: string): boolean {
    const gross = this.lineOn(hole, key)?.gross;
    return gross != null && gross > hole.par;
  }

  sheetDots(hole: HoleView, key: string): number[] {
    return this.strokeDots(this.lineOn(hole, key));
  }

  sheetGive(hole: HoleView, key: string): string {
    const strokes = this.lineOn(hole, key)?.strokes ?? 0;
    return strokes < 0 ? this.givenMarks(strokes) : '';
  }

  private lineKey(line: HoleLine): string {
    return line.userId != null ? `u${line.userId}` : `t${line.teamId ?? 0}`;
  }

  scoreGroups(hole: HoleView): LineGroup[] {
    const groups: LineGroup[] = [];
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
    return groups;
  }

  showTeamTees(hole: HoleView): boolean {
    return !!this.card?.runningTee && this.scoreGroups(hole).length > 1;
  }

  cardName(group: LineGroup): string {
    if (group.lines.length === 1) return group.lines[0].displayName;
    const teamId = group.lines[0]?.teamId;
    const team = this.card?.teams.find(item => item.teamId === teamId);
    return team?.name || group.lines[0]?.displayName || 'Team';
  }

  groupHasScore(group: LineGroup): boolean {
    return group.lines.some(line => line.gross != null);
  }

  resultLabel(line: HoleLine): string {
    if (line.gross == null || !this.hole) return 'Tap + to start at par';
    const diff = line.gross - this.hole.par;
    if (diff === 0) return 'Par';
    if (diff === -1) return 'Birdie';
    if (diff === -2) return 'Eagle';
    if (diff <= -3) return 'Albatross';
    if (diff === 1) return 'Bogey';
    if (diff === 2) return 'Double bogey';
    if (diff === 3) return 'Triple bogey';
    return `${diff} over`;
  }

  strokeDots(line: HoleLine | null): number[] {
    const count = line && line.strokes > 0 ? line.strokes : 0;
    return Array.from({ length: count }, (_, index) => index);
  }

  givenMarks(count: number): string {
    return '+'.repeat(Math.abs(count));
  }

  bump(line: HoleLine, delta: number): void {
    const par = this.hole?.par ?? 4;
    const next = line.gross == null ? par : line.gross + delta;
    if (next < 1 || next > 20) return;
    line.gross = next;
    line.net = next - line.strokes;
  }

  clearGroup(group: LineGroup): void {
    if (group.lines.some(line => this.decisionLocked(line))) return;
    for (const line of group.lines) {
      line.gross = null;
      line.net = null;
      line.kept = null;
    }
    this.applyForced();
  }

  clearBoth(): void {
    this.menuOpen = false;
    if (!this.hole || this.clearLocked) return;
    for (const line of this.hole.lines) {
      line.gross = null;
      line.net = null;
      line.kept = null;
    }
    this.applyForced();
  }

  decisionLocked(line: HoleLine): boolean {
    if (!this.card?.oceans6 || this.card.organizer) return false;
    const index = this.hole?.lines.indexOf(line) ?? -1;
    return index >= 0 && this.baseline[index]?.kept != null;
  }

  get clearLocked(): boolean {
    return !!this.hole?.lines.some(line => this.decisionLocked(line));
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

  isMe(row: BoardRow): boolean {
    const id = this.auth.user()?.id;
    return id != null && row.memberUserIds.includes(id);
  }

  toPar(value: number | null): string {
    if (value == null || value === 0) return 'E';
    return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
  }

  rowScore(row: BoardRow): string {
    if (row.toPar != null) return this.toPar(row.toPar);
    if (row.total != null) return String(row.total);
    return '–';
  }

  /** Holes in the order this group plays them, beginning at its starting hole. */
  private playOrder(): number[] {
    const count = this.card?.holes.length ?? 0;
    if (count === 0) return [];
    const start = this.startIndex();
    return Array.from({ length: count }, (_, offset) => (start + offset) % count);
  }

  private startIndex(): number {
    const start = this.card?.startingHole;
    if (!this.card || start == null || start < 1) return 0;
    const index = this.card.holes.findIndex(hole => this.courseHole(hole) === start);
    return index >= 0 ? index : 0;
  }

  private nextOpenHole(): number {
    const order = this.playOrder();
    if (order.length === 0 || !this.card) return 0;
    let lastPlayed = -1;
    order.forEach((index, step) => {
      if (this.holePlayed(this.card!.holes[index])) lastPlayed = step;
    });
    if (lastPlayed < 0) return order[0];
    if (lastPlayed >= order.length - 1) return order[lastPlayed];
    return order[lastPlayed + 1];
  }

  private holePlayed(hole: HoleView): boolean {
    return hole.lines.some(line => line.gross != null);
  }

  private firstUndecidedIndex(): number | null {
    if (!this.card?.oceans6) return null;
    const index = this.playOrder().find(holeIndex => this.holeNeedsDecision(this.card!.holes[holeIndex]));
    return index ?? null;
  }

  private holeNeedsDecision(hole: HoleView | null): boolean {
    if (!this.card?.oceans6 || !hole) return false;
    return hole.lines.some(line => line.gross != null && line.kept == null);
  }

  private applyForced(): void {
    if (!this.card?.oceans6 || !this.hole) return;
    for (const line of this.hole.lines) {
      if (line.kept != null || line.userId == null) continue;
      if (this.cantKeep(this.hole, line)) line.kept = false;
      else if (this.mustKeep(this.hole, line)) line.kept = true;
    }
  }

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
      groups: (card.groups ?? []).map(group => ({
        groupId: group.groupId,
        label: group.label ?? '',
        teeTime: group.teeTime ?? '',
        names: group.names ?? '',
        thru: group.thru ?? 0,
        currentHole: group.currentHole ?? 1,
        own: !!group.own,
      })),
      teams: card.teams ?? [],
      organizer: !!card.organizer,
      canPickGroup: !!card.canPickGroup,
      groupId: card.groupId ?? null,
      ownGroupId: card.ownGroupId ?? null,
      groupLabel: card.groupLabel ?? null,
      startingHole: card.startingHole ?? null,
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

  private discardedCount(par: number, userId: number | null): number {
    if (!this.card) return 0;
    return this.card.holes.filter(hole => hole.par === par && hole.lines.some(line => line.userId === userId && line.kept === false)).length;
  }

  private capture(): void {
    this.baseline = (this.hole?.lines ?? []).map(line => ({
      gross: line.gross,
      kept: line.kept,
      net: line.net,
    }));
  }

  private get dirty(): boolean {
    return !!this.hole?.lines.some((line, index) => {
      const saved = this.baseline[index];
      if (!saved) return line.gross != null || line.kept != null;
      if (saved.gross !== line.gross) return true;
      if (saved.kept === line.kept) return false;
      return !(line.gross == null && saved.gross == null && saved.kept == null);
    });
  }

  private queueSave(): void {
    this.chain = this.chain.then(() => this.writeHole());
  }

  private async flush(): Promise<boolean> {
    const ok = await this.chain;
    if (!ok) return false;
    if (!this.dirty) return true;
    this.queueSave();
    return this.chain;
  }

  /** Writes this hole when something changed. A tap that lands mid-save is written next. */
  private async writeHole(): Promise<boolean> {
    if (!this.hole || !this.dirty) return true;
    this.saving = true;
    this.error = '';
    const holeIndex = this.holeIndex;
    const sequence = this.hole.sequence;
    const local = this.hole.lines.map(line => ({
      gross: line.gross,
      kept: line.kept,
      net: line.net,
      userId: line.userId,
      teamId: line.teamId,
    }));
    const scores = local.flatMap((line, index) => {
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
      this.applyCard(saved);
      this.holeIndex = holeIndex;
      this.capture();
      this.hole?.lines.forEach((line, index) => {
        const want = local[index];
        if (!want) return;
        if (want.gross !== line.gross || want.kept !== line.kept) {
          line.gross = want.gross;
          line.kept = want.kept;
          line.net = want.net;
        }
      });
      void this.loadBoard(true);
      return true;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the score';
      return false;
    } finally {
      this.saving = false;
    }
  }

  private async loadBoard(quiet: boolean): Promise<void> {
    if (!this.card) return;
    try {
      this.board = await this.api.post<Board>('leaderboard', { eventId: this.card.eventId }, { quiet });
    } catch {
      // The peek strip still opens the sheet if the board cannot be loaded.
    }
  }
}
