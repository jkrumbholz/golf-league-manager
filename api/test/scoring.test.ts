import {
  alternateShotPlayingHandicap,
  combineRounds,
  orderLeaderboard,
  keepQuotaError,
  mergeGroupHoles,
  scramblePlayingHandicap,
  scoreRound,
  strokeAllocation,
  vegasHoleScore,
  HoleSetup,
  LadderTee,
} from '../lib/lambda_handler/scoring/scoring';

const holes: HoleSetup[] = [
  { sequence: 1, par: 4, strokeIndex: 1, displayHoleNumber: 1, defaultLadderOrder: 2 },
  { sequence: 2, par: 3, strokeIndex: 3, displayHoleNumber: 2, defaultLadderOrder: 2 },
  { sequence: 3, par: 5, strokeIndex: 2, displayHoleNumber: 3, defaultLadderOrder: 2 },
];

const ladder: LadderTee[] = [
  { ladderOrder: 1, name: 'White', hexColorCode: '#ffffff' },
  { ladderOrder: 2, name: 'Blue', hexColorCode: '#2255aa' },
  { ladderOrder: 3, name: 'Black', hexColorCode: '#111111' },
];

describe('nine hole handicap', () => {
  test('uses half the index on a 9-hole card and the full index on 18', () => {
    const nine = Array.from({ length: 9 }, (_, index) => ({
      sequence: index + 1,
      par: 4,
      strokeIndex: index + 1,
      displayHoleNumber: index + 1,
      defaultLadderOrder: 1,
    }));
    const eighteen = [
      ...nine,
      ...nine.map(hole => ({
        ...hole,
        sequence: hole.sequence + 9,
        displayHoleNumber: (hole.displayHoleNumber ?? 0) + 9,
        strokeIndex: hole.strokeIndex + 9,
      })),
    ];
    const player = [{ userId: 1, displayName: 'Ann A', handicapIndex: 11, teamId: null }];
    const gross = (card: HoleSetup[]) => card.map(hole => ({
      sequence: hole.sequence, userId: 1, teamId: null, gross: 4, kept: null as boolean | null,
    }));
    const strokes = (card: { holes: Array<{ lines: Array<{ strokes: number }> }> }) =>
      card.holes.reduce((sum, hole) => sum + hole.lines[0].strokes, 0);

    const [short] = scoreRound('stroke_play', nine, ladder.slice(0, 1), player, [], gross(nine));
    const [full] = scoreRound('stroke_play', eighteen, ladder.slice(0, 1), player, [], gross(eighteen));
    expect(strokes(short)).toBe(6);
    expect(strokes(full)).toBe(11);
  });
});

describe('stroke allocation', () => {
  test('gives extra strokes to the hardest holes on the card', () => {
    const allocation = strokeAllocation(2, holes);
    expect(allocation.get(1)).toBe(1);
    expect(allocation.get(3)).toBe(1);
    expect(allocation.get(2)).toBe(0);
  });
});

describe('vegas', () => {
  test('uses the higher digit first on a double bogey or worse', () => {
    expect(vegasHoleScore(4, 5, 3)).toBe(54);
    expect(vegasHoleScore(4, 5, 4)).toBe(45);
  });

  test('sums two-digit hole scores for the team', () => {
    const [team] = scoreRound(
      'vegas',
      holes.slice(0, 2),
      ladder,
      [
        { userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: 10 },
        { userId: 2, displayName: 'Bob B', handicapIndex: 0, teamId: 10 },
      ],
      [{ teamId: 10, name: 'Ann A / Bob B' }],
      [
        { sequence: 1, userId: 1, teamId: null, gross: 4, kept: null },
        { sequence: 1, userId: 2, teamId: null, gross: 5, kept: null },
        { sequence: 2, userId: 1, teamId: null, gross: 4, kept: null },
        { sequence: 2, userId: 2, teamId: null, gross: 5, kept: null },
      ]
    );

    expect(team.holes[0].countingScore).toBe(45);
    expect(team.holes[1].countingScore).toBe(54);
    expect(team.total).toBe(99);
    expect(team.toPar).toBeNull();
  });

  test('scores vegas up and back as two-digit team totals and keeps each team on its own tee', () => {
    const card: HoleSetup[] = [
      { sequence: 1, par: 5, strokeIndex: 1, displayHoleNumber: 1, defaultLadderOrder: 2 },
      { sequence: 2, par: 4, strokeIndex: 2, displayHoleNumber: 2, defaultLadderOrder: 2 },
    ];
    const scored = scoreRound(
      'vegas_up_and_back',
      card,
      ladder,
      [
        { userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: 10 },
        { userId: 2, displayName: 'Bob B', handicapIndex: 0, teamId: 10 },
        { userId: 3, displayName: 'Cam C', handicapIndex: 0, teamId: 11 },
        { userId: 4, displayName: 'Dee D', handicapIndex: 0, teamId: 11 },
      ],
      [
        { teamId: 10, name: 'Ann A / Bob B' },
        { teamId: 11, name: 'Cam C / Dee D' },
      ],
      [
        { sequence: 1, userId: 1, teamId: null, gross: 5, kept: null },
        { sequence: 1, userId: 2, teamId: null, gross: 6, kept: null },
        { sequence: 1, userId: 3, teamId: null, gross: 4, kept: null },
        { sequence: 1, userId: 4, teamId: null, gross: 4, kept: null },
        { sequence: 2, userId: 1, teamId: null, gross: 4, kept: null },
        { sequence: 2, userId: 2, teamId: null, gross: 4, kept: null },
        { sequence: 2, userId: 3, teamId: null, gross: 4, kept: null },
        { sequence: 2, userId: 4, teamId: null, gross: 4, kept: null },
      ]
    );
    const under = scored.find(team => team.id === 11);
    const over = scored.find(team => team.id === 10);
    expect(over?.holes[0].countingScore).toBe(56);
    expect(vegasHoleScore(7, 5, 5)).toBe(75);
    expect(over?.holes[1].teeName).toBe('Black');
    expect(under?.holes[1].teeName).toBe('White');
    expect(over?.holes[1].lines[0].teeName).toBe('Black');
    expect(under?.holes[1].lines[0].teeName).toBe('White');

    const merged = mergeGroupHoles(scored);
    expect(merged[1].lines.find(line => line.userId === 1)?.teeName).toBe('Black');
    expect(merged[1].lines.find(line => line.userId === 3)?.teeName).toBe('White');

    const [row] = combineRounds([[over!]], 'vegas_up_and_back');
    expect(row.kind).toBe('team');
    expect(row.toPar).toBeNull();
    expect(row.total).toBe(100);
  });
});

describe('up and back', () => {
  test('moves back on the ladder when the team is net under par', () => {
    const [team] = scoreRound(
      'up_and_back',
      holes,
      ladder,
      [
        { userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: 10 },
        { userId: 2, displayName: 'Bob B', handicapIndex: 0, teamId: 10 },
      ],
      [{ teamId: 10, name: 'Ann A / Bob B' }],
      [
        { sequence: 1, userId: 1, teamId: null, gross: 3, kept: null },
        { sequence: 1, userId: 2, teamId: null, gross: 4, kept: null },
        { sequence: 2, userId: 1, teamId: null, gross: 4, kept: null },
        { sequence: 2, userId: 2, teamId: null, gross: 4, kept: null },
        { sequence: 3, userId: 1, teamId: null, gross: 5, kept: null },
        { sequence: 3, userId: 2, teamId: null, gross: 5, kept: null },
      ]
    );

    expect(team.holes[0].teeName).toBe('Blue');
    expect(team.holes[1].teeName).toBe('White');
    expect(team.holes[2].teeName).toBe('Blue');
    expect(team.holes[0].countingScore).toBe(7);
    expect(team.total).toBe(7 + 8 + 10);
  });
});

describe('best ball and high ball', () => {
  test('keeps the lowest net for best ball and the highest net for high ball', () => {
    const players = [
      { userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: 10 },
      { userId: 2, displayName: 'Bob B', handicapIndex: 0, teamId: 10 },
    ];
    const teams = [{ teamId: 10, name: 'Ann A / Bob B' }];
    const grosses = [
      { sequence: 1, userId: 1, teamId: null, gross: 4, kept: null },
      { sequence: 1, userId: 2, teamId: null, gross: 6, kept: null },
    ];

    const [best] = scoreRound('best_ball', holes.slice(0, 1), ladder, players, teams, grosses);
    const [high] = scoreRound('high_ball', holes.slice(0, 1), ladder, players, teams, grosses);
    expect(best.total).toBe(4);
    expect(high.total).toBe(6);
  });
});

describe('scramble and alternate shot', () => {
  test('applies the 9-hole percentage blends', () => {
    const nine = Array.from({ length: 9 }, (_, index) => ({
      sequence: index + 1,
      par: 4,
      strokeIndex: index + 1,
      displayHoleNumber: index + 1,
      defaultLadderOrder: 1,
    }));
    expect(scramblePlayingHandicap([5, 10])).toBe(3);
    expect(scramblePlayingHandicap([4, 8, 12, 16])).toBe(Math.round(4 * 0.25 + 8 * 0.20 + 12 * 0.15 + 16 * 0.10));
    expect(alternateShotPlayingHandicap([5, 10])).toBe(8);

    const [team] = scoreRound(
      'scramble',
      nine,
      [{ ladderOrder: 1, name: 'Blue', hexColorCode: null }],
      [
        { userId: 1, displayName: 'Ann A', handicapIndex: 10, teamId: 10 },
        { userId: 2, displayName: 'Bob B', handicapIndex: 20, teamId: 10 },
      ],
      [{ teamId: 10, name: 'Ann A / Bob B' }],
      nine.map(hole => ({ sequence: hole.sequence, userId: null, teamId: 10, gross: 4, kept: null }))
    );

    expect(team.holes[0].lines[0].strokes + team.holes[1].lines[0].strokes).toBeGreaterThan(0);
    expect(team.total).toBe(9 * 4 - 3);
  });
});

describe("ocean's 6", () => {
  test('a discarded hole still advances the last hole on the leaderboard', () => {
    const card: HoleSetup[] = [
      { sequence: 1, par: 4, strokeIndex: 1, displayHoleNumber: 1, defaultLadderOrder: 1 },
      { sequence: 2, par: 4, strokeIndex: 2, displayHoleNumber: 2, defaultLadderOrder: 1 },
    ];
    const player = [{ userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: null }];
    const [result] = scoreRound('oceans_6', card, ladder.slice(0, 1), player, [], [
      { sequence: 1, userId: 1, teamId: null, gross: 4, kept: true },
      { sequence: 2, userId: 1, teamId: null, gross: 6, kept: false },
    ]);
    const [row] = combineRounds([[result]], 'oceans_6');
    expect(row.toPar).toBe(0);
    expect(row.lastHole).toBe(2);
    expect(row.keeps).toEqual([
      { par: 3, need: 1, kept: 0, discarded: 0 },
      { par: 4, need: 4, kept: 1, discarded: 1 },
      { par: 5, need: 1, kept: 0, discarded: 0 },
    ]);
  });

  test('counts only kept holes and blocks a second par 3', () => {
    const card: HoleSetup[] = [
      { sequence: 1, par: 3, strokeIndex: 1, displayHoleNumber: 1, defaultLadderOrder: 1 },
      { sequence: 2, par: 4, strokeIndex: 2, displayHoleNumber: 2, defaultLadderOrder: 1 },
      { sequence: 3, par: 3, strokeIndex: 3, displayHoleNumber: 3, defaultLadderOrder: 1 },
    ];
    const player = [{ userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: null }];
    const grosses = [
      { sequence: 1, userId: 1, teamId: null, gross: 3, kept: true },
      { sequence: 2, userId: 1, teamId: null, gross: 5, kept: true },
      { sequence: 3, userId: 1, teamId: null, gross: 4, kept: false },
    ];
    const [result] = scoreRound('oceans_6', card, ladder.slice(0, 1), player, [], grosses);
    expect(result.thru).toBe(2);
    expect(result.total).toBe(8);
    expect(combineRounds([[result]])[0].lastHole).toBe(3);
    expect(result.holes[2].complete).toBe(true);
    expect(result.holes[2].countingScore).toBeNull();
    expect(keepQuotaError(card, grosses, 1, 3, true)).toMatch(/par 3/);
    expect(keepQuotaError(card, [
      { sequence: 1, userId: 1, teamId: null, gross: 3, kept: false },
      { sequence: 3, userId: 1, teamId: null, gross: 4, kept: null },
    ], 1, 1, false)).toBeNull();
    expect(keepQuotaError(card, [
      { sequence: 1, userId: 1, teamId: null, gross: 3, kept: false },
      { sequence: 3, userId: 1, teamId: null, gross: 4, kept: false },
    ], 1, 3, false)).toMatch(/keep one par 3/);
  });

  test('blocks discarding the last par 5 or a par 4 still needed for the four', () => {
    const card: HoleSetup[] = [
      { sequence: 1, par: 5, strokeIndex: 1, displayHoleNumber: 1, defaultLadderOrder: 1 },
      { sequence: 2, par: 5, strokeIndex: 2, displayHoleNumber: 2, defaultLadderOrder: 1 },
      { sequence: 3, par: 4, strokeIndex: 3, displayHoleNumber: 3, defaultLadderOrder: 1 },
      { sequence: 4, par: 4, strokeIndex: 4, displayHoleNumber: 4, defaultLadderOrder: 1 },
      { sequence: 5, par: 4, strokeIndex: 5, displayHoleNumber: 5, defaultLadderOrder: 1 },
      { sequence: 6, par: 4, strokeIndex: 6, displayHoleNumber: 6, defaultLadderOrder: 1 },
      { sequence: 7, par: 4, strokeIndex: 7, displayHoleNumber: 7, defaultLadderOrder: 1 },
    ];
    const bothParFivesOut = [
      { sequence: 1, userId: 1, teamId: null, gross: 5, kept: false },
      { sequence: 2, userId: 1, teamId: null, gross: 6, kept: false },
    ];
    expect(keepQuotaError(card, bothParFivesOut, 1, 2, false)).toMatch(/keep one par 5/);

    const oneParFourOut = [3, 4, 5, 6, 7].map(sequence => ({
      sequence, userId: 1, teamId: null, gross: 4, kept: sequence === 3 ? false : null,
    }));
    expect(keepQuotaError(card, oneParFourOut, 1, 4, false)).toMatch(/four par 4s/);

    const spareParFour = [3, 4, 5, 6, 7].map(sequence => ({
      sequence, userId: 1, teamId: null, gross: 4, kept: null,
    }));
    expect(keepQuotaError(card, spareParFour, 1, 7, false)).toBeNull();
  });
});

describe('tee groups', () => {
  test('puts a foursome on one card', () => {
    const players = [1, 2].map(userId => ({ userId, displayName: `P${userId}`, handicapIndex: 0, teamId: null }));
    const grosses = players.flatMap(player => holes.map(hole => ({
      sequence: hole.sequence, userId: player.userId, teamId: null, gross: 4, kept: null as boolean | null,
    })));
    const scored = scoreRound('stroke_play', holes, ladder, players, [], grosses);
    const merged = mergeGroupHoles(scored);
    expect(merged[0].lines.map(line => line.userId)).toEqual([1, 2]);
    expect(merged[0].countingScore).toBeNull();
    expect(mergeGroupHoles(scored.slice(0, 1))[0].countingScore).not.toBeNull();
  });

  test('keeps a team together and lists the lowest index first', () => {
    const players = [
      { userId: 1, displayName: 'High A', handicapIndex: 18, teamId: 10 },
      { userId: 2, displayName: 'Low A', handicapIndex: 8, teamId: 10 },
      { userId: 3, displayName: 'Mid B', handicapIndex: 12, teamId: 20 },
      { userId: 4, displayName: 'Low B', handicapIndex: 4, teamId: 20 },
    ];
    const teams = [
      { teamId: 10, name: 'A' },
      { teamId: 20, name: 'B' },
    ];
    const merged = mergeGroupHoles(scoreRound('best_ball', holes, ladder, players, teams, []));
    expect(merged[0].lines.map(line => line.displayName)).toEqual(['Low B', 'Mid B', 'Low A', 'High A']);

    const solos = scoreRound('stroke_play', holes, ladder, [
      { userId: 1, displayName: 'High', handicapIndex: 20, teamId: null },
      { userId: 2, displayName: 'Low', handicapIndex: 3, teamId: null },
    ], [], []);
    expect(mergeGroupHoles(solos)[0].lines.map(line => line.displayName)).toEqual(['Low', 'High']);
  });
});

describe('leaderboard', () => {
  test('ranks low scores first and shares a tie', () => {
    const rows = combineRounds([[
      { id: 1, name: 'Ann', kind: 'player', thru: 1, total: 5, toPar: 1, currentTeeName: 'Blue', holes: [] },
      { id: 2, name: 'Bob', kind: 'player', thru: 1, total: 4, toPar: 0, currentTeeName: 'Blue', holes: [] },
      { id: 3, name: 'Cam', kind: 'player', thru: 1, total: 4, toPar: 0, currentTeeName: 'Blue', holes: [] },
    ]]);
    expect(rows.map(row => row.name)).toEqual(['Bob', 'Cam', 'Ann']);
    expect(rows.map(row => row.rank)).toEqual([1, 1, 3]);
    expect(rows.map(row => row.lastHole)).toEqual([null, null, null]);
  });

  test('puts a player under par ahead of a player who is even through fewer holes', () => {
    const card = Array.from({ length: 15 }, (_, index) => ({
      sequence: index + 1,
      par: 4,
      strokeIndex: ((index % 18) + 1),
      displayHoleNumber: index + 1,
      defaultLadderOrder: 1,
    }));
    const players = [
      { userId: 1, displayName: 'Under', handicapIndex: 0, teamId: null },
      { userId: 2, displayName: 'Even', handicapIndex: 0, teamId: null },
    ];
    const grosses = [
      ...card.map(hole => ({
        sequence: hole.sequence,
        userId: 1,
        teamId: null,
        gross: hole.sequence === 15 ? 3 : 4,
        kept: null as boolean | null,
      })),
      ...card.filter(hole => hole.sequence <= 14).map(hole => ({
        sequence: hole.sequence,
        userId: 2,
        teamId: null,
        gross: 4,
        kept: null as boolean | null,
      })),
    ];
    const rows = combineRounds([scoreRound('stroke_play', card, ladder.slice(0, 1), players, [], grosses)]);
    expect(rows.map(row => row.name)).toEqual(['Under', 'Even']);
    expect(rows.map(row => row.toPar)).toEqual([-1, 0]);
    expect(rows.map(row => row.rank)).toEqual([1, 2]);
    expect(rows.map(row => row.finished)).toEqual([true, false]);
  });

  test('keeps scored players first, then tee time, then players with no tee time', () => {
    const row = (name: string, toPar: number | null, teeTimeSort: string | null) => ({
      rank: 0,
      competitorId: name.charCodeAt(0),
      kind: 'player' as const,
      name,
      thru: toPar === null ? 0 : 1,
      total: toPar === null ? null : 4,
      toPar,
      lastHole: toPar === null ? null : 1,
      finished: false,
      currentTeeName: null,
      keeps: null,
      teeTimeSort,
    });
    const rows = orderLeaderboard([
      row('Late', null, '10:00'),
      row('No time', null, null),
      row('Early', null, '08:00'),
      row('Started', -1, '14:00'),
    ]);
    expect(rows.map(item => item.name)).toEqual(['Started', 'Early', 'Late', 'No time']);
  });
});
