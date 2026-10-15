import {
  parseGhinPaste,
  parseImportedIndex,
  planHandicapImport,
  reportHandicapImport,
  HandicapMember,
} from '../lib/lambda_handler/services/handicap-import';

const sample = `
Taylor Blanchard
Stonebridge Ranch Country Club
9.1
Giovanni Boschetti
Stonebridge Ranch Country Club
14.0
Cooper Hicks
Stonebridge Ranch Country Club
+3.0
`;

function member(
  userId: number,
  firstName: string,
  lastName: string,
  handicapIndex: number,
  displayName = `${firstName} ${lastName}`,
  ghinName: string | null = null
): HandicapMember {
  return { userId, firstName, lastName, displayName, handicapIndex, ghinName };
}

test('reads a GHIN paste as name, course, and index', () => {
  const rows = parseGhinPaste(sample);
  expect(rows.map(row => [row.name, row.handicapIndex])).toEqual([
    ['Taylor Blanchard', 9.1],
    ['Giovanni Boschetti', 14],
    ['Cooper Hicks', -3],
  ]);
});

test('stores a plus index as a negative number', () => {
  expect(parseImportedIndex('+3.0')).toBe(-3);
  expect(parseImportedIndex('9.1')).toBe(9.1);
  expect(parseImportedIndex('nope')).toBeNull();
});

test('updates a unique first and last name and reports the change', () => {
  const plan = planHandicapImport(
    [member(1, 'Taylor', 'Blanchard', 10.4), member(2, 'Cooper', 'Hicks', -2)],
    sample
  );
  const report = reportHandicapImport(plan, null);
  expect(report.changed).toEqual([
    { userId: 2, displayName: 'Cooper Hicks', from: -2, to: -3, profileOnly: false },
    { userId: 1, displayName: 'Taylor Blanchard', from: 10.4, to: 9.1, profileOnly: false },
  ]);
  expect(report.unmatched).toEqual(['Giovanni Boschetti']);
  expect(report.missing).toEqual([]);
});

test('skips a name that matches more than one league player', () => {
  const plan = planHandicapImport(
    [
      member(1, 'Taylor', 'Blanchard', 10, 'Taylor Blanchard'),
      member(2, 'Taylor', 'Blanchard', 8, 'Taylor B'),
      member(3, 'Cooper', 'Hicks', 1),
    ],
    sample
  );
  const report = reportHandicapImport(plan, null);
  expect(report.changed.map(row => row.userId)).toEqual([3]);
  expect(report.duplicates).toEqual([
    { name: 'Taylor Blanchard', detail: 'matches Taylor Blanchard and Taylor B' },
  ]);
});

test('skips a name listed more than once in the paste', () => {
  const paste = `Taylor Blanchard
Club
9.1
Taylor Blanchard
Club
8.0
`;
  const plan = planHandicapImport([member(1, 'Taylor', 'Blanchard', 10)], paste);
  const report = reportHandicapImport(plan, null);
  expect(report.changed).toEqual([]);
  expect(report.duplicates).toEqual([
    { name: 'Taylor Blanchard', detail: 'listed more than once in the paste' },
  ]);
});

test('lists league players who were not in the paste', () => {
  const plan = planHandicapImport(
    [member(1, 'Taylor', 'Blanchard', 9.1), member(4, 'Jane', 'Doe', 12)],
    sample
  );
  const report = reportHandicapImport(plan, null);
  expect(report.missing).toEqual([{ userId: 4, displayName: 'Jane Doe' }]);
  expect(report.unchanged).toBe(1);
});

test('matches a GHIN name when the first name is a nickname', () => {
  const paste = `David Costlow
Bushwood Country Club
9.0
Matthew Smith
Bushwood Country Club
11.2
`;
  const plan = planHandicapImport(
    [
      member(1, 'Dave', 'Costlow', 8, 'Dave Costlow', 'David Costlow'),
      member(2, 'Matt', 'Smith', 10, 'Matt Smith'),
    ],
    paste
  );
  const report = reportHandicapImport(plan, null);
  expect(report.changed.map(row => row.displayName)).toEqual(['Dave Costlow']);
  expect(report.missing.map(row => row.displayName)).toEqual(['Matt Smith']);
  expect(report.unmatched).toEqual(['Matthew Smith']);
});

test('matches names without caring about case', () => {
  const plan = planHandicapImport([member(1, 'taylor', 'blanchard', 9.1)], sample);
  expect(plan.matches).toHaveLength(1);
  expect(reportHandicapImport(plan, null).unchanged).toBe(1);
});

test('reports an index it cannot read and still updates the others', () => {
  const paste = `Taylor Blanchard
Club
NH
Cooper Hicks
Club
+3.0
`;
  const plan = planHandicapImport(
    [member(1, 'Taylor', 'Blanchard', 9), member(2, 'Cooper', 'Hicks', 1)],
    paste
  );
  const report = reportHandicapImport(plan, null);
  expect(report.unreadable).toEqual([{ name: 'Taylor Blanchard', indexText: 'NH' }]);
  expect(report.changed.map(row => row.displayName)).toEqual(['Cooper Hicks']);
  expect(report.missing).toEqual([]);
});

test('rejects a paste that is not groups of three lines', () => {
  expect(() => parseGhinPaste('Taylor Blanchard\n9.1')).toThrow('Each player needs three lines');
});

test('on an event, reports the event index change and keeps a posted score', () => {
  const plan = planHandicapImport(
    [member(1, 'Taylor', 'Blanchard', 10), member(2, 'Cooper', 'Hicks', 4)],
    sample
  );
  const report = reportHandicapImport(plan, new Map([
    [1, { handicapIndex: 11, scored: false }],
    [2, { handicapIndex: 4, scored: true }],
  ]));
  expect(report.changed).toEqual([
    { userId: 2, displayName: 'Cooper Hicks', from: 4, to: -3, profileOnly: true },
    { userId: 1, displayName: 'Taylor Blanchard', from: 11, to: 9.1, profileOnly: false },
  ]);
  expect(report.eventKept).toEqual([
    { displayName: 'Cooper Hicks', eventIndex: 4, profileIndex: -3 },
  ]);
});
