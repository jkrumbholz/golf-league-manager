import { combineRounds, orderLeaderboard, scoreRound, HoleSetup, LadderTee } from '../lib/lambda_handler/scoring/scoring';
import { eligiblePartnerIds, supportsVirtualPartner, virtualPartnerTeamName } from '../lib/lambda_handler/scoring/virtual-partner';

const hole: HoleSetup = { sequence: 1, par: 4, strokeIndex: 1, displayHoleNumber: 1, defaultLadderOrder: 1 };
const ladder: LadderTee[] = [{ ladderOrder: 1, name: 'White', hexColorCode: '#ffffff' }];

describe('virtual partner eligibility', () => {
  test('supports the team formats that score two existing balls', () => {
    expect(supportsVirtualPartner('best_ball')).toBe(true);
    expect(supportsVirtualPartner('high_ball')).toBe(true);
    expect(supportsVirtualPartner('low_high_total')).toBe(true);
    expect(supportsVirtualPartner('vegas')).toBe(false);
    expect(supportsVirtualPartner('stroke_play')).toBe(false);
  });

  test('excludes the designated player and keeps everyone else once', () => {
    expect(eligiblePartnerIds([4, 4, 9, 2, 9], 9)).toEqual([4, 2]);
    expect(eligiblePartnerIds([9], 9)).toEqual([]);
  });

  test('uses a placeholder name until a partner has been drawn', () => {
    expect(virtualPartnerTeamName(['Ann A'], false)).toBe('Ann A / Virtual Partner');
    expect(virtualPartnerTeamName(['Ann A', 'Cam C'], true)).toBe('Ann A / Cam C');
  });
});

describe('virtual partner scoring', () => {
  test('scores the extra team from the two existing balls and leaves the original teams in place', () => {
    const players = [
      { userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: 10 },
      { userId: 2, displayName: 'Bob B', handicapIndex: 0, teamId: 10 },
      { userId: 3, displayName: 'Cam C', handicapIndex: 0, teamId: 11 },
      { userId: 4, displayName: 'Dee D', handicapIndex: 0, teamId: 11 },
    ];
    const teams = [
      { teamId: 10, name: 'Ann / Bob', memberIds: [1, 2] },
      { teamId: 11, name: 'Cam / Dee', memberIds: [3, 4] },
      { teamId: 12, name: 'Ann / Cam', memberIds: [1, 3] },
    ];
    const grosses = [
      { sequence: 1, userId: 1, teamId: null, gross: 5, kept: null },
      { sequence: 1, userId: 2, teamId: null, gross: 4, kept: null },
      { sequence: 1, userId: 3, teamId: null, gross: 3, kept: null },
      { sequence: 1, userId: 4, teamId: null, gross: 6, kept: null },
    ];

    const scored = scoreRound('best_ball', [hole], ladder, players, teams, grosses);
    const original = scored.find(row => row.id === 10);
    const other = scored.find(row => row.id === 11);
    const virtual = scored.find(row => row.id === 12);

    expect(original?.total).toBe(4);
    expect(other?.total).toBe(3);
    expect(virtual?.total).toBe(3);
    expect(virtual?.holes[0].lines.map(line => line.userId).sort()).toEqual([1, 3]);
    expect(virtual?.holes[0].lines.every(line => line.teamId === 12)).toBe(true);
    expect(scored.filter(row => row.holes.some(item => item.lines.some(line => line.userId === 1)))).toHaveLength(2);
    expect(scored.filter(row => row.holes.some(item => item.lines.some(line => line.userId === 3)))).toHaveLength(2);

    const board = orderLeaderboard(combineRounds([scored], 'best_ball'));
    expect(board.find(row => row.competitorId === 12)?.rank).toBe(1);
    expect(board.find(row => row.competitorId === 11)?.rank).toBe(1);
    expect(board.find(row => row.competitorId === 10)?.rank).toBe(3);
    expect(board).toHaveLength(3);
  });

  test('high ball uses the same extra team without a second scoring path', () => {
    const players = [
      { userId: 1, displayName: 'Ann A', handicapIndex: 0, teamId: 10 },
      { userId: 3, displayName: 'Cam C', handicapIndex: 0, teamId: 11 },
    ];
    const [virtual] = scoreRound(
      'high_ball',
      [hole],
      ladder,
      players,
      [{ teamId: 12, name: 'Ann / Cam', memberIds: [1, 3] }],
      [
        { sequence: 1, userId: 1, teamId: null, gross: 5, kept: null },
        { sequence: 1, userId: 3, teamId: null, gross: 3, kept: null },
      ]
    );
    expect(virtual.total).toBe(5);
  });
});
