export type EventFormat =
  | 'stroke_play'
  | 'best_ball'
  | 'high_ball'
  | 'vegas'
  | 'up_and_back'
  | 'vegas_up_and_back'
  | 'oceans_6'
  | 'scramble'
  | 'alternate_shot';

export const FORMAT_LABELS: Record<EventFormat, string> = {
  stroke_play: 'Stroke Play (net)',
  best_ball: 'Best Ball',
  high_ball: 'High Ball',
  vegas: 'Vegas',
  up_and_back: 'Team Up & Back',
  vegas_up_and_back: 'Vegas Up & Back',
  oceans_6: "Ocean's 6",
  scramble: 'Scramble',
  alternate_shot: 'Alternate Shot',
};

const OCEANS_QUOTA: Record<number, number> = { 3: 1, 4: 4, 5: 1 };

export function isKnownFormat(value: string): value is EventFormat {
  return Object.prototype.hasOwnProperty.call(FORMAT_LABELS, value);
}

export function isTeamFormat(format: EventFormat): boolean {
  return format !== 'stroke_play' && format !== 'oceans_6';
}

export function isTeamGrossFormat(format: EventFormat): boolean {
  return format === 'scramble' || format === 'alternate_shot';
}

export function usesRunningTee(format: EventFormat): boolean {
  return format === 'up_and_back' || format === 'vegas_up_and_back';
}

export function fixedTeamSize(format: EventFormat): number | null {
  if (format === 'stroke_play' || format === 'oceans_6') return 1;
  if (format === 'vegas' || format === 'vegas_up_and_back' || format === 'alternate_shot') return 2;
  return null;
}

export interface HoleSetup {
  sequence: number;
  par: number;
  strokeIndex: number | null;
  displayHoleNumber: number | null;
  defaultLadderOrder: number;
}

export interface LadderTee {
  ladderOrder: number;
  name: string;
  hexColorCode: string | null;
}

export interface PlayerSetup {
  userId: number;
  displayName: string;
  handicapIndex: number;
  teamId: number | null;
}

export interface TeamSetup {
  teamId: number;
  name: string;
}

export interface HoleGross {
  sequence: number;
  userId: number | null;
  teamId: number | null;
  gross: number | null;
  kept: boolean | null;
}

export interface HoleLine {
  userId: number | null;
  teamId: number | null;
  displayName: string;
  handicapIndex: number;
  gross: number | null;
  strokes: number;
  net: number | null;
  kept: boolean | null;
  /** This team's tee on a running-tee format. Teams in the same group can differ. */
  teeName?: string;
  teeColor?: string | null;
}

export interface HoleView {
  sequence: number;
  par: number;
  strokeIndex: number | null;
  displayHoleNumber: number | null;
  teeName: string;
  teeColor: string | null;
  ladderOrder: number;
  lines: HoleLine[];
  countingScore: number | null;
  complete: boolean;
}

export interface CompetitorTotal {
  id: number;
  name: string;
  kind: 'player' | 'team';
  thru: number;
  total: number | null;
  toPar: number | null;
  currentTeeName: string | null;
  holes: HoleView[];
}

export interface KeepProgress {
  par: number;
  need: number;
  kept: number;
  discarded: number;
}

export interface LeaderboardRow {
  rank: number;
  competitorId: number;
  kind: 'player' | 'team';
  name: string;
  thru: number;
  total: number | null;
  toPar: number | null;
  /** Display number of the last hole with a completed score. Null when none are in. */
  lastHole: number | null;
  /** Every hole on every round has a posted score. */
  finished: boolean;
  currentTeeName: string | null;
  /** Kept and discarded counts for a keep/discard format. Null for every other format. */
  keeps: KeepProgress[] | null;
}

export function defaultDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const initial = lastName.trim().charAt(0);
  return initial ? `${first} ${initial}` : first;
}

export function teamNameFromPlayers(displayNames: string[]): string {
  return displayNames.map(name => name.trim()).filter(name => name.length > 0).join(' / ');
}

export function individualPlayingHandicap(format: EventFormat, handicapIndex: number, holeCount: number): number {
  const rounded = Math.round(Number(handicapIndex) || 0);
  if (holeCount <= 9) return Math.round(rounded / 2);
  return rounded;
}

export function strokeAllocation(playingHandicap: number, holes: HoleSetup[]): Map<number, number> {
  const allocation = new Map<number, number>();
  const count = holes.length;
  if (count === 0) return allocation;

  const handicap = Math.max(0, Math.round(playingHandicap));
  const base = Math.floor(handicap / count);
  const extra = handicap % count;
  const ranked = [...holes].sort((a, b) => {
    const aIndex = a.strokeIndex ?? 99;
    const bIndex = b.strokeIndex ?? 99;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.sequence - b.sequence;
  });

  ranked.forEach((hole, index) => {
    allocation.set(hole.sequence, base + (index < extra ? 1 : 0));
  });
  return allocation;
}

export function scramblePlayingHandicap(playerHandicapsLowToHigh: number[]): number {
  const weights = playerHandicapsLowToHigh.length === 2
    ? [0.35, 0.15]
    : playerHandicapsLowToHigh.length === 3
      ? [0.30, 0.20, 0.10]
      : [0.25, 0.20, 0.15, 0.10];

  const total = playerHandicapsLowToHigh.reduce((sum, handicap, index) => {
    return sum + handicap * (weights[index] ?? 0);
  }, 0);
  return Math.round(total);
}

export function alternateShotPlayingHandicap(playerHandicaps: number[]): number {
  const sum = playerHandicaps.reduce((total, handicap) => total + handicap, 0);
  return Math.round(0.5 * sum);
}

export function vegasHoleScore(netA: number, netB: number, par: number): number {
  const doubleBogey = par + 2;
  const low = Math.min(netA, netB);
  const high = Math.max(netA, netB);
  const flip = netA >= doubleBogey || netB >= doubleBogey;
  const tens = flip ? high : low;
  const ones = flip ? low : high;
  return tens * 10 + ones;
}

export function keepQuotaError(
  holes: HoleSetup[],
  grosses: HoleGross[],
  userId: number,
  sequence: number,
  kept: boolean | null
): string | null {
  if (kept == null) return null;

  const hole = holes.find(item => item.sequence === sequence);
  if (!hole) return 'Hole not found';
  const quota = OCEANS_QUOTA[hole.par];
  if (!quota) return "Ocean's 6 only counts par 3s, par 4s, and par 5s";

  const samePar = (score: HoleGross) => {
    if (score.userId !== userId || score.sequence === sequence) return false;
    const other = holes.find(item => item.sequence === score.sequence);
    return other?.par === hole.par;
  };

  if (kept) {
    const alreadyKept = grosses.filter(score => samePar(score) && score.kept === true).length;
    if (alreadyKept >= quota) {
      if (hole.par === 3) return 'You already kept your par 3';
      if (hole.par === 5) return 'You already kept your par 5';
      return 'You already kept four par 4s';
    }
    return null;
  }

  const stillAvailable = holes.filter(other => {
    if (other.sequence === sequence || other.par !== hole.par) return false;
    const score = grosses.find(item => item.userId === userId && item.sequence === other.sequence);
    return score?.kept !== false;
  }).length;
  if (stillAvailable >= quota) return null;
  if (hole.par === 3) return 'You have to keep one par 3';
  if (hole.par === 5) return 'You have to keep one par 5';
  return 'You have to keep four par 4s';
}

/**
 * Lowest handicap index first. A team stays in one block, and the block is placed
 * by the lowest index on that team so the lowest number on the card still leads.
 */
export function orderScoreLines(lines: HoleLine[]): HoleLine[] {
  const keyOf = (line: HoleLine) => line.teamId != null ? `t${line.teamId}` : `u${line.userId ?? 0}`;
  const low = new Map<string, number>();
  for (const line of lines) {
    const key = keyOf(line);
    const index = Number(line.handicapIndex);
    const current = low.get(key);
    if (current == null || index < current) low.set(key, index);
  }
  return [...lines].sort((a, b) => {
    const aKey = keyOf(a);
    const bKey = keyOf(b);
    const byTeam = (low.get(aKey) ?? 999) - (low.get(bKey) ?? 999);
    if (byTeam !== 0) return byTeam;
    if (aKey !== bKey) return aKey < bKey ? -1 : 1;
    const byIndex = Number(a.handicapIndex) - Number(b.handicapIndex);
    if (byIndex !== 0) return byIndex;
    return a.displayName.localeCompare(b.displayName);
  });
}

/** Lines for everyone sharing a tee time, teams together and low index first. */
export function mergeGroupHoles(competitors: CompetitorTotal[]): HoleView[] {
  if (competitors.length === 0) return [];
  return competitors[0].holes.map((hole, index) => {
    const lines = orderScoreLines(competitors.flatMap(competitor => competitor.holes[index]?.lines ?? []));
    const alone = competitors.length === 1;
    return {
      ...hole,
      lines,
      countingScore: alone ? hole.countingScore : null,
      complete: alone ? hole.complete : competitors.every(competitor => competitor.holes[index]?.complete === true),
    };
  });
}

export function scoreRound(
  format: EventFormat,
  holes: HoleSetup[],
  ladder: LadderTee[],
  players: PlayerSetup[],
  teams: TeamSetup[],
  grosses: HoleGross[]
): CompetitorTotal[] {
  const orderedHoles = [...holes].sort((a, b) => a.sequence - b.sequence);
  if (isTeamFormat(format)) {
    return teams.map(team => scoreTeam(format, orderedHoles, ladder, players.filter(player => player.teamId === team.teamId), team, grosses));
  }
  return players.map(player => scorePlayer(format, orderedHoles, ladder, player, grosses));
}

export function combineRounds(rounds: CompetitorTotal[][], format?: EventFormat): LeaderboardRow[] {
  const byId = new Map<number, LeaderboardRow>();
  const quota = format ? keepQuota(format) : null;

  rounds.forEach(round => {
    round.forEach(competitor => {
      const existing = byId.get(competitor.id);
      const lastHole = lastCompletedHole(competitor.holes);
      const finished = cardFinished(competitor.holes);
      const keeps = quota ? summarizeKeeps(competitor.holes, quota) : null;
      if (!existing) {
        byId.set(competitor.id, {
          rank: 0,
          competitorId: competitor.id,
          kind: competitor.kind,
          name: competitor.name,
          thru: competitor.thru,
          total: competitor.total,
          toPar: competitor.toPar,
          lastHole,
          finished,
          currentTeeName: competitor.currentTeeName,
          keeps,
        });
        return;
      }

      existing.thru += competitor.thru;
      existing.finished = existing.finished && finished;
      if (lastHole != null) existing.lastHole = lastHole;
      existing.currentTeeName = competitor.currentTeeName ?? existing.currentTeeName;
      if (existing.keeps && keeps) existing.keeps = addKeeps(existing.keeps, keeps);
      if (competitor.total === null) return;
      existing.total = (existing.total ?? 0) + competitor.total;
      if (existing.toPar === null || competitor.toPar === null) {
        existing.toPar = existing.toPar === null && competitor.toPar === null ? null : (existing.toPar ?? 0) + (competitor.toPar ?? 0);
      } else {
        existing.toPar += competitor.toPar;
      }
    });
  });

  return orderLeaderboard([...byId.values()]);
}

/** Players with a score stay on top. Everyone else is in tee-time order, and a missing tee time is last. */
export function orderLeaderboard<T extends LeaderboardRow & { teeTimeSort?: string | null }>(rows: T[]): T[] {
  const ordered = [...rows].sort((a, b) => {
    const aScore = standing(a);
    const bScore = standing(b);
    if ((aScore === null) !== (bScore === null)) return aScore === null ? 1 : -1;
    if (aScore !== null && bScore !== null && aScore !== bScore) return aScore - bScore;
    if (aScore !== null) return a.name.localeCompare(b.name);

    const aTee = a.teeTimeSort || null;
    const bTee = b.teeTimeSort || null;
    if (!aTee && !bTee) return a.name.localeCompare(b.name);
    if (!aTee) return 1;
    if (!bTee) return -1;
    if (aTee !== bTee) return aTee < bTee ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  let previousScore: number | null = null;
  ordered.forEach((row, index) => {
    const score = standing(row);
    if (score === null) {
      row.rank = index + 1;
      return;
    }
    if (previousScore !== null && score === previousScore) {
      row.rank = ordered[index - 1].rank;
    } else {
      row.rank = index + 1;
    }
    previousScore = score;
  });

  return ordered;
}

function scorePlayer(
  format: EventFormat,
  holes: HoleSetup[],
  ladder: LadderTee[],
  player: PlayerSetup,
  grosses: HoleGross[]
): CompetitorTotal {
  const handicap = individualPlayingHandicap(format, player.handicapIndex, holes.length);
  const strokes = strokeAllocation(handicap, holes);
  const holeViews: HoleView[] = [];
  let total = 0;
  let parSum = 0;
  let thru = 0;
  let counted = false;

  holes.forEach(hole => {
    const gross = grosses.find(score => score.sequence === hole.sequence && score.userId === player.userId);
    const received = strokes.get(hole.sequence) ?? 0;
    const net = gross?.gross == null ? null : gross.gross - received;
    const kept = gross?.kept ?? null;
    const counts = format === 'oceans_6' ? kept === true && net !== null : net !== null;
    const decided = format !== 'oceans_6' || kept !== null;
    const tee = teeByOrder(ladder, hole.defaultLadderOrder);

    if (counts && net !== null) {
      total += net;
      parSum += hole.par;
      thru += 1;
      counted = true;
    }

    holeViews.push({
      sequence: hole.sequence,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
      displayHoleNumber: hole.displayHoleNumber,
      teeName: tee?.name ?? '',
      teeColor: tee?.hexColorCode ?? null,
      ladderOrder: tee?.ladderOrder ?? hole.defaultLadderOrder,
      lines: [{
        userId: player.userId,
        teamId: null,
        displayName: player.displayName,
        handicapIndex: player.handicapIndex,
        gross: gross?.gross ?? null,
        strokes: received,
        net,
        kept,
      }],
      countingScore: counts ? net : null,
      complete: net !== null && decided,
    });
  });

  return finishCompetitor(player.userId, player.displayName, 'player', holeViews, counted ? total : null, counted && format !== 'vegas' ? total - parSum : null, thru);
}

function scoreTeam(
  format: EventFormat,
  holes: HoleSetup[],
  ladder: LadderTee[],
  members: PlayerSetup[],
  team: TeamSetup,
  grosses: HoleGross[]
): CompetitorTotal {
  const holeCount = holes.length;
  const memberHandicaps = new Map<number, number>();
  members.forEach(member => {
    memberHandicaps.set(member.userId, individualPlayingHandicap(format, member.handicapIndex, holeCount));
  });

  const sortedHandicaps = [...memberHandicaps.values()].sort((a, b) => a - b);
  const teamHandicap = format === 'scramble'
    ? scramblePlayingHandicap(sortedHandicaps)
    : format === 'alternate_shot'
      ? alternateShotPlayingHandicap(sortedHandicaps)
      : 0;
  const teamStrokes = strokeAllocation(teamHandicap, holes);
  const playerStrokes = new Map<number, Map<number, number>>();
  members.forEach(member => {
    playerStrokes.set(member.userId, strokeAllocation(memberHandicaps.get(member.userId) ?? 0, holes));
  });

  const holeViews: HoleView[] = [];
  let ladderOrder = holes[0]?.defaultLadderOrder ?? ladder[0]?.ladderOrder ?? 1;
  let total = 0;
  let parSum = 0;
  let thru = 0;
  let counted = false;
  const trackToPar = !isVegasFormat(format);

  holes.forEach(hole => {
    const teeOrder = usesRunningTee(format) ? ladderOrder : hole.defaultLadderOrder;
    const tee = teeByOrder(ladder, teeOrder);
    const lowIndex = members.reduce((low, member) => Math.min(low, Number(member.handicapIndex)), Number.POSITIVE_INFINITY);
    const lines = orderScoreLines(isTeamGrossFormat(format)
      ? teamGrossLine(team, hole, teamStrokes, grosses, Number.isFinite(lowIndex) ? lowIndex : 0)
      : members.map(member => playerLine(member, hole, playerStrokes.get(member.userId), grosses)));
    lines.forEach(line => {
      line.teeName = tee?.name ?? '';
      line.teeColor = tee?.hexColorCode ?? null;
    });

    const netsReady = lines.length > 0 && lines.every(line => line.gross !== null && line.net !== null);
    const complete = netsReady && (!isVegasFormat(format) || lines.length === 2);
    let countingScore: number | null = null;

    if (complete) {
      const nets = lines.map(line => line.net as number);
      if (format === 'best_ball') countingScore = Math.min(...nets);
      else if (format === 'high_ball') countingScore = Math.max(...nets);
      else if (isVegasFormat(format)) countingScore = vegasHoleScore(nets[0], nets[1], hole.par);
      else if (format === 'up_and_back') countingScore = nets.reduce((sum, net) => sum + net, 0);
      else countingScore = nets[0];

      total += countingScore;
      const parTarget = format === 'up_and_back' ? hole.par * lines.length : hole.par;
      parSum += parTarget;
      thru += 1;
      counted = true;

      if (usesRunningTee(format)) {
        const netSum = nets.reduce((sum, net) => sum + net, 0);
        const target = hole.par * lines.length;
        const direction = netSum < target ? -1 : netSum > target ? 1 : 0;
        ladderOrder = moveLadder(ladder, ladderOrder, direction);
      }
    }

    holeViews.push({
      sequence: hole.sequence,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
      displayHoleNumber: hole.displayHoleNumber,
      teeName: tee?.name ?? '',
      teeColor: tee?.hexColorCode ?? null,
      ladderOrder: tee?.ladderOrder ?? teeOrder,
      lines,
      countingScore,
      complete,
    });
  });

  return finishCompetitor(
    team.teamId,
    team.name,
    'team',
    holeViews,
    counted ? total : null,
    counted && trackToPar ? total - parSum : null,
    thru
  );
}

function isVegasFormat(format: EventFormat): boolean {
  return format === 'vegas' || format === 'vegas_up_and_back';
}

function playerLine(
  member: PlayerSetup,
  hole: HoleSetup,
  strokes: Map<number, number> | undefined,
  grosses: HoleGross[]
): HoleLine {
  const received = strokes?.get(hole.sequence) ?? 0;
  const gross = grosses.find(score => score.sequence === hole.sequence && score.userId === member.userId);
  const net = gross?.gross == null ? null : gross.gross - received;
  return {
    userId: member.userId,
    teamId: member.teamId,
    displayName: member.displayName,
    handicapIndex: member.handicapIndex,
    gross: gross?.gross ?? null,
    strokes: received,
    net,
    kept: gross?.kept ?? null,
  };
}

function teamGrossLine(
  team: TeamSetup,
  hole: HoleSetup,
  strokes: Map<number, number>,
  grosses: HoleGross[],
  handicapIndex: number
): HoleLine[] {
  const received = strokes.get(hole.sequence) ?? 0;
  const gross = grosses.find(score => score.sequence === hole.sequence && score.teamId === team.teamId);
  const net = gross?.gross == null ? null : gross.gross - received;
  return [{
    userId: null,
    teamId: team.teamId,
    displayName: team.name,
    handicapIndex,
    gross: gross?.gross ?? null,
    strokes: received,
    net,
    kept: null,
  }];
}

/** Score to par when the format has one. Vegas keeps a raw total, and a lower number still wins. */
export function keepQuota(format: EventFormat): Record<number, number> | null {
  if (format === 'oceans_6') return OCEANS_QUOTA;
  return null;
}

function summarizeKeeps(holes: HoleView[], quota: Record<number, number>): KeepProgress[] {
  return Object.keys(quota).map(Number).sort((a, b) => a - b).map(par => ({
    par,
    need: quota[par],
    kept: holes.filter(hole => hole.par === par && hole.lines.some(line => line.kept === true)).length,
    discarded: holes.filter(hole => hole.par === par && hole.lines.some(line => line.kept === false)).length,
  }));
}

function addKeeps(current: KeepProgress[], extra: KeepProgress[]): KeepProgress[] {
  return current.map((item, index) => ({
    par: item.par,
    need: item.need + (extra[index]?.need ?? 0),
    kept: item.kept + (extra[index]?.kept ?? 0),
    discarded: item.discarded + (extra[index]?.discarded ?? 0),
  }));
}

function standing(row: LeaderboardRow): number | null {
  if (row.total === null) return null;
  return row.toPar ?? row.total;
}

function finishCompetitor(
  id: number,
  name: string,
  kind: 'player' | 'team',
  holes: HoleView[],
  total: number | null,
  toPar: number | null,
  thru: number
): CompetitorTotal {
  const pending = holes.find(hole => !hole.complete);
  const current = pending ?? holes[holes.length - 1];
  return {
    id,
    name,
    kind,
    thru,
    total,
    toPar,
    currentTeeName: current?.teeName ?? null,
    holes,
  };
}

function cardFinished(holes: HoleView[]): boolean {
  return holes.length > 0 && holes.every(hole =>
    hole.lines.length > 0 && hole.lines.every(line => line.gross != null)
  );
}

function lastCompletedHole(holes: HoleView[]): number | null {
  let last: number | null = null;
  for (const hole of holes) {
    if (!hole.complete) continue;
    last = hole.displayHoleNumber ?? hole.sequence;
  }
  return last;
}

function teeByOrder(ladder: LadderTee[], order: number): LadderTee | null {
  if (ladder.length === 0) return null;
  const sorted = [...ladder].sort((a, b) => a.ladderOrder - b.ladderOrder);
  return sorted.find(tee => tee.ladderOrder === order) ?? sorted[0];
}

function moveLadder(ladder: LadderTee[], order: number, direction: -1 | 0 | 1): number {
  const sorted = [...ladder].sort((a, b) => a.ladderOrder - b.ladderOrder);
  if (sorted.length === 0) return order;
  const index = Math.max(0, sorted.findIndex(tee => tee.ladderOrder === order));
  const nextIndex = Math.min(sorted.length - 1, Math.max(0, index + direction));
  return sorted[nextIndex].ladderOrder;
}
