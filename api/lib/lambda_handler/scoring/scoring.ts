export type EventFormat =
  | 'stroke_play'
  | 'best_ball'
  | 'high_ball'
  | 'vegas'
  | 'up_and_back'
  | 'vegas_up_and_back'
  | 'oceans_6'
  | 'scramble'
  | 'alternate_shot'
  | 'low_high_total';

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
  low_high_total: 'Low / High / Combo',
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
  if (format === 'vegas' || format === 'vegas_up_and_back' || format === 'alternate_shot' || format === 'low_high_total') return 2;
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
  /** Combo holes count both nets. The card shows that total; the round still ranks on to-par. */
  relative?: boolean;
  /** This hole's contribution to the team score versus par. Tiebreakers use it when set. */
  standing?: number | null;
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
  /** Every hole on the card, in course order. The leaderboard reorders this from the starting hole. */
  card?: ScorecardHole[];
  /** How a shared score was broken. Null when this row was not in a tie. */
  tiebreaker?: Tiebreaker | null;
}

export interface TiebreakStep {
  criterion: string;
  description: string;
  scores: Array<{ competitorId: number; name: string; score: number }>;
  result: 'tie' | 'split';
  summary: string;
}

export interface Tiebreaker {
  standing: number;
  steps: TiebreakStep[];
  order: Array<{ competitorId: number; name: string; rank: number }>;
}

export interface ScorecardPlayer {
  name: string;
  gross: number | null;
  net: number | null;
  /** Positive when the player receives a stroke. Negative when they give one. */
  strokes: number;
}

export interface ScorecardHole {
  sequence: number;
  hole: number;
  par: number;
  gross: number | null;
  net: number | null;
  /** Positive when the player receives a stroke. Negative when they give one. */
  strokes: number;
  kept: boolean | null;
  strokeIndex: number | null;
  relative?: boolean;
  standing?: number | null;
  /** One entry per player on a team card. Empty when the hole is a single score. */
  players: ScorecardPlayer[];
}

export function defaultDisplayName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const initial = lastName.trim().charAt(0);
  return initial ? `${first} ${initial}` : first;
}

export function teamNameFromPlayers(displayNames: string[]): string {
  return displayNames.map(name => name.trim()).filter(name => name.length > 0).join(' / ');
}

/**
 * Strokes for one player. A negative result is a plus handicap (strokes given).
 * The index is rounded by magnitude first, so +4.5 and 4.5 both become 5 strokes
 * of the correct direction. Math.round on a negative number would round +4.5 down
 * to +4. A 9-hole card then uses half of that rounded index, rounded again.
 * Allowance is the event percentage applied after that conversion.
 */
export function individualPlayingHandicap(
  format: EventFormat,
  handicapIndex: number,
  holeCount: number,
  allowance = 100
): number {
  const index = Number(handicapIndex) || 0;
  const giving = index < 0;
  let strokes = Math.round(Math.abs(index));
  if (holeCount <= 9) strokes = Math.round(strokes / 2);
  const percent = Number.isFinite(allowance) ? Math.min(100, Math.max(0, allowance)) : 100;
  strokes = Math.round(strokes * (percent / 100));
  return giving && strokes ? -strokes : strokes;
}

export function strokeAllocation(playingHandicap: number, holes: HoleSetup[]): Map<number, number> {
  const allocation = new Map<number, number>();
  const count = holes.length;
  if (count === 0) return allocation;

  const rounded = Math.round(playingHandicap);
  const giving = rounded < 0;
  const handicap = Math.abs(rounded);
  const base = Math.floor(handicap / count);
  const extra = handicap % count;
  const ranked = [...holes].sort((a, b) => {
    const aIndex = a.strokeIndex ?? 99;
    const bIndex = b.strokeIndex ?? 99;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.sequence - b.sequence;
  });
  if (giving) ranked.reverse();

  ranked.forEach((hole, index) => {
    const amount = base + (index < extra ? 1 : 0);
    allocation.set(hole.sequence, giving && amount ? -amount : amount);
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
  grosses: HoleGross[],
  allowance = 100
): CompetitorTotal[] {
  const orderedHoles = [...holes].sort((a, b) => a.sequence - b.sequence);
  if (isTeamFormat(format)) {
    return teams.map(team => scoreTeam(format, orderedHoles, ladder, players.filter(player => player.teamId === team.teamId), team, grosses, allowance));
  }
  return players.map(player => scorePlayer(format, orderedHoles, ladder, player, grosses, allowance));
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
      const card = scorecardHoles(competitor.holes);
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
          card,
        });
        return;
      }

      existing.thru += competitor.thru;
      existing.finished = existing.finished && finished;
      if (lastHole != null) existing.lastHole = lastHole;
      if (card.some(hole => hole.gross != null)) existing.card = card;
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

/** Players with a score stay on top. Everyone else is in tee-time order, then starting hole. A missing tee time is last. */
export function orderLeaderboard<T extends LeaderboardRow & { teeTimeSort?: string | null; startingHole?: number | null }>(rows: T[]): T[] {
  const ordered = [...rows].sort((a, b) => {
    const aScore = standing(a);
    const bScore = standing(b);
    if ((aScore === null) !== (bScore === null)) return aScore === null ? 1 : -1;
    if (aScore !== null && bScore !== null && aScore !== bScore) return aScore - bScore;
    if (aScore !== null) {
      const broken = compareTiebreak(a, b);
      if (broken !== 0) return broken;
      return a.name.localeCompare(b.name);
    }

    const aTee = a.teeTimeSort || null;
    const bTee = b.teeTimeSort || null;
    if (!aTee && !bTee) return a.name.localeCompare(b.name);
    if (!aTee) return 1;
    if (!bTee) return -1;
    if (aTee !== bTee) return aTee < bTee ? -1 : 1;
    const aHole = a.startingHole ?? 0;
    const bHole = b.startingHole ?? 0;
    if (aHole !== bHole) return aHole - bHole;
    return a.name.localeCompare(b.name);
  });

  let previousScore: number | null = null;
  ordered.forEach((row, index) => {
    const score = standing(row);
    if (score === null) {
      row.rank = index + 1;
      return;
    }
    const previous = index > 0 ? ordered[index - 1] : null;
    if (previous && previousScore !== null && score === previousScore && compareTiebreak(previous, row) === 0) {
      row.rank = previous.rank;
    } else {
      row.rank = index + 1;
    }
    previousScore = score;
  });

  attachTiebreakers(ordered);
  return ordered;
}

function scorePlayer(
  format: EventFormat,
  holes: HoleSetup[],
  ladder: LadderTee[],
  player: PlayerSetup,
  grosses: HoleGross[],
  allowance = 100
): CompetitorTotal {
  const handicap = individualPlayingHandicap(format, player.handicapIndex, holes.length, allowance);
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
  grosses: HoleGross[],
  allowance = 100
): CompetitorTotal {
  const holeCount = holes.length;
  const memberHandicaps = new Map<number, number>();
  members.forEach(member => {
    memberHandicaps.set(member.userId, individualPlayingHandicap(format, member.handicapIndex, holeCount, allowance));
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
  let toParSum = 0;
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
    const needsPair = isVegasFormat(format) || format === 'low_high_total';
    const complete = netsReady && (!needsPair || lines.length === 2);
    let countingScore: number | null = null;
    let relative = false;
    let standing: number | null = null;

    if (complete) {
      const nets = lines.map(line => line.net as number);
      if (format === 'low_high_total') {
        const phase = lowHighPhase(hole, holes);
        if (phase === 'low') countingScore = Math.min(...nets);
        else if (phase === 'high') countingScore = Math.max(...nets);
        else countingScore = nets.reduce((sum, net) => sum + net, 0);
        relative = phase === 'both';
        standing = relative ? countingScore - hole.par * 2 : countingScore - hole.par;
        toParSum += standing;
      } else if (format === 'best_ball') countingScore = Math.min(...nets);
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
      relative,
      standing,
      complete,
    });
  });

  const toPar = format === 'low_high_total'
    ? (counted ? toParSum : null)
    : counted && trackToPar ? total - parSum : null;
  return finishCompetitor(
    team.teamId,
    team.name,
    'team',
    holeViews,
    counted ? total : null,
    toPar,
    thru
  );
}

/** First three holes of each nine: low net. Next three: high net. Last three: both nets against double par. */
function lowHighPhase(hole: HoleSetup, holes: HoleSetup[]): 'low' | 'high' | 'both' {
  const ordered = [...holes].sort((a, b) => courseHoleNumber(a) - courseHoleNumber(b) || a.sequence - b.sequence);
  const index = Math.max(0, ordered.findIndex(item => item.sequence === hole.sequence));
  const place = index % 9;
  if (place < 3) return 'low';
  if (place < 6) return 'high';
  return 'both';
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

function canTiebreak(row: LeaderboardRow): boolean {
  return row.finished === true && (row.card?.length ?? 0) > 0;
}

function countingHoleScore(hole: ScorecardHole): number | null {
  if (hole.kept === false) return null;
  if (hole.standing != null) return hole.standing;
  if (hole.players.length > 1) return hole.gross;
  return hole.net ?? hole.gross;
}

function sumPhysicalHoles(row: LeaderboardRow, numbers: number[]): number | null {
  let sum = 0;
  for (const number of numbers) {
    const hole = row.card?.find(item => item.hole === number);
    const score = hole ? countingHoleScore(hole) : null;
    if (score == null) return null;
    sum += score;
  }
  return sum;
}

interface TieCriterion {
  id: string;
  description: string;
  score: (row: LeaderboardRow) => number | null;
}

function lastPlayedHoles(card: ScorecardHole[], count: number): number[] {
  return [...card]
    .sort((a, b) => a.hole - b.hole || a.sequence - b.sequence)
    .slice(Math.max(0, card.length - count))
    .map(hole => hole.hole);
}

function tieCriteria(rows: LeaderboardRow[]): TieCriterion[] {
  const card = rows[0]?.card ?? [];
  const criteria: TieCriterion[] = [];
  const addSum = (count: number, id: string, label: string) => {
    const numbers = lastPlayedHoles(card, count);
    if (numbers.length < count) return;
    criteria.push({
      id,
      description: `${label} (${numbers.join(', ')})`,
      score: row => sumPhysicalHoles(row, numbers),
    });
  };
  addSum(4, 'last_4_holes', 'Last 4 holes');
  addSum(3, 'last_3_holes', 'Last 3 holes');
  const ranked = [...card]
    .filter(hole => hole.strokeIndex != null)
    .sort((a, b) => (a.strokeIndex! - b.strokeIndex!) || a.hole - b.hole);
  ranked.forEach(hole => {
    criteria.push({
      id: `handicap_${hole.strokeIndex}`,
      description: `Handicap #${hole.strokeIndex} — Hole ${hole.hole}`,
      score: row => {
        const match = row.card?.find(item => item.sequence === hole.sequence);
        return match ? countingHoleScore(match) : null;
      },
    });
  });
  return criteria;
}

function tieSummary(scores: TiebreakStep['scores']): { result: 'tie' | 'split'; summary: string } {
  const low = Math.min(...scores.map(item => item.score));
  const ahead = scores.filter(item => item.score === low);
  if (ahead.length === scores.length) return { result: 'tie', summary: 'Still tied.' };
  const names = (items: TiebreakStep['scores']) => items.map(item => item.name).join(' and ');
  const parts: string[] = [];
  if (ahead.length === 1) parts.push(`${ahead[0].name} finishes ahead.`);
  else parts.push(`${names(ahead)} remain tied.`);
  const rest = scores.filter(item => item.score !== low);
  const seen = new Set<number>();
  rest.forEach(item => {
    if (seen.has(item.score)) return;
    seen.add(item.score);
    const cluster = rest.filter(other => other.score === item.score);
    if (cluster.length > 1) parts.push(`${names(cluster)} remain tied.`);
  });
  return { result: 'split', summary: parts.join(' ') };
}

function buildTieSteps(rows: LeaderboardRow[]): TiebreakStep[] {
  const steps: TiebreakStep[] = [];
  let groups: LeaderboardRow[][] = [rows];
  for (const criterion of tieCriteria(rows)) {
    const next: LeaderboardRow[][] = [];
    for (const group of groups) {
      if (group.length < 2) {
        next.push(group);
        continue;
      }
      const scored = group.map(row => ({ row, score: criterion.score(row) }));
      if (scored.some(item => item.score == null)) {
        next.push(group);
        continue;
      }
      const buckets = new Map<number, LeaderboardRow[]>();
      scored.forEach(item => {
        const list = buckets.get(item.score as number) ?? [];
        list.push(item.row);
        buckets.set(item.score as number, list);
      });
      const outcome = tieSummary(scored.map(item => ({
        competitorId: item.row.competitorId,
        name: item.row.name,
        score: item.score as number,
      })));
      steps.push({
        criterion: criterion.id,
        description: criterion.description,
        scores: scored.map(item => ({
          competitorId: item.row.competitorId,
          name: item.row.name,
          score: item.score as number,
        })),
        result: outcome.result,
        summary: outcome.summary,
      });
      [...buckets.keys()].sort((a, b) => a - b).forEach(score => next.push(buckets.get(score) ?? []));
    }
    groups = next;
    if (groups.every(group => group.length < 2)) break;
  }
  return steps;
}

function compareTiebreak(a: LeaderboardRow, b: LeaderboardRow): number {
  if (!canTiebreak(a) || !canTiebreak(b)) return 0;
  for (const step of buildTieSteps([a, b])) {
    if (step.result !== 'split') continue;
    const aScore = step.scores.find(item => item.competitorId === a.competitorId)?.score;
    const bScore = step.scores.find(item => item.competitorId === b.competitorId)?.score;
    if (aScore == null || bScore == null || aScore === bScore) continue;
    return aScore - bScore;
  }
  return 0;
}

function attachTiebreakers(rows: LeaderboardRow[]): void {
  let index = 0;
  while (index < rows.length) {
    const score = standing(rows[index]);
    let end = index + 1;
    while (end < rows.length && standing(rows[end]) === score) end += 1;
    const group = rows.slice(index, end);
    const tied = score !== null && group.length > 1 && group.every(canTiebreak);
    const payload: Tiebreaker | null = tied
      ? {
          standing: score as number,
          steps: buildTieSteps(group),
          order: group.map(row => ({ competitorId: row.competitorId, name: row.name, rank: row.rank })),
        }
      : null;
    group.forEach(row => {
      row.tiebreaker = payload;
    });
    index = end;
  }
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
  return latestPlayedHole(scorecardHoles(holes), null);
}

export function courseHoleNumber(hole: { displayHoleNumber: number | null; sequence: number }): number {
  return hole.displayHoleNumber ?? hole.sequence;
}

export function scorecardHoles(holes: HoleView[]): ScorecardHole[] {
  return holes.map(hole => {
    const single = hole.lines.length <= 1;
    const line = hole.lines[0];
    return {
      sequence: hole.sequence,
      hole: courseHoleNumber(hole),
      par: hole.par,
      gross: single ? (line?.gross ?? null) : hole.countingScore,
      net: single ? (line?.net ?? null) : null,
      strokes: single ? (line?.strokes ?? 0) : 0,
      kept: single ? (line?.kept ?? null) : null,
      strokeIndex: hole.strokeIndex,
      relative: hole.relative === true,
      standing: hole.standing ?? null,
      players: single ? [] : hole.lines.map(item => ({
        name: item.displayName,
        gross: item.gross,
        net: item.net,
        strokes: item.strokes,
      })),
    };
  });
}

/** Course order, rotated so the group's starting hole is first. */
export function orderFromStartingHole<T extends { hole: number }>(holes: T[], startingHole: number | null): T[] {
  if (startingHole == null) return holes;
  const start = holes.findIndex(hole => hole.hole === startingHole);
  if (start <= 0) return holes;
  return [...holes.slice(start), ...holes.slice(0, start)];
}

/** Last course hole with a score, walking from the starting hole and wrapping. */
export function latestPlayedHole(holes: ScorecardHole[], startingHole: number | null): number | null {
  let last: number | null = null;
  for (const hole of orderFromStartingHole(holes, startingHole)) {
    if (hole.gross == null) continue;
    last = hole.hole;
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
