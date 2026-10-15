import { HttpError } from '../util/http';

/** GHIN copies come across as name, course, then index, one player after another. */

export interface HandicapMember {
  userId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  handicapIndex: number;
  ghinName?: string | null;
}

export interface HandicapMatch {
  userId: number;
  displayName: string;
  from: number;
  to: number;
}

export interface HandicapChange {
  userId: number;
  displayName: string;
  from: number;
  to: number;
  /** Profile change while this event's index stays put. */
  profileOnly: boolean;
}

export interface HandicapDuplicate {
  name: string;
  detail: string;
}

export interface EventIndexKept {
  displayName: string;
  eventIndex: number;
  profileIndex: number;
}

export interface HandicapImportPlan {
  matches: HandicapMatch[];
  duplicates: HandicapDuplicate[];
  missing: Array<{ userId: number; displayName: string }>;
  unmatched: string[];
  unreadable: Array<{ name: string; indexText: string }>;
}

export interface HandicapImportReport {
  changed: HandicapChange[];
  unchanged: number;
  duplicates: HandicapDuplicate[];
  missing: Array<{ userId: number; displayName: string }>;
  unmatched: string[];
  unreadable: Array<{ name: string; indexText: string }>;
  eventKept: EventIndexKept[];
}

interface ParsedRow {
  name: string;
  key: string;
  indexText: string;
  handicapIndex: number | null;
}

export function nameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ');
}

/** A GHIN name wins over first and last, so Dave can match David. */
export function memberMatchKey(member: HandicapMember): string {
  const ghinName = String(member.ghinName || '').trim();
  return nameKey(ghinName || `${member.firstName} ${member.lastName}`);
}

/** Accepts 10.4 and +1.4. A leading minus is the same plus handicap. */
export function parseImportedIndex(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const signed = text.startsWith('+') || text.startsWith('-');
  const body = signed ? text.slice(1).trim() : text;
  if (!/^\d+(\.\d)?$/.test(body)) return null;
  const magnitude = Math.round(Number(body) * 10) / 10;
  if (signed) {
    if (magnitude === 0) return 0;
    if (magnitude > 10) return null;
    return -magnitude;
  }
  if (magnitude > 54) return null;
  return magnitude;
}

export function sameIndex(left: number, right: number): boolean {
  return Math.round(Number(left) * 10) === Math.round(Number(right) * 10);
}

export function parseGhinPaste(text: string): ParsedRow[] {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
  if (lines.length === 0) throw new HttpError('Paste the list from GHIN first');
  if (lines.length % 3 !== 0) {
    throw new HttpError('Each player needs three lines: name, course, then index');
  }

  const rows: ParsedRow[] = [];
  for (let index = 0; index < lines.length; index += 3) {
    const name = lines[index].replace(/\s+/g, ' ');
    rows.push({
      name,
      key: nameKey(name),
      indexText: lines[index + 2],
      handicapIndex: parseImportedIndex(lines[index + 2]),
    });
  }
  return rows;
}

export function planHandicapImport(members: HandicapMember[], text: string): HandicapImportPlan {
  const rows = parseGhinPaste(text);
  const membersByKey = new Map<string, HandicapMember[]>();
  for (const member of members) {
    const key = memberMatchKey(member);
    const group = membersByKey.get(key) ?? [];
    group.push(member);
    membersByKey.set(key, group);
  }

  const pasteByKey = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const group = pasteByKey.get(row.key) ?? [];
    group.push(row);
    pasteByKey.set(row.key, group);
  }

  const matches: HandicapMatch[] = [];
  const duplicates: HandicapDuplicate[] = [];
  const unmatched: string[] = [];
  const unreadable: Array<{ name: string; indexText: string }> = [];

  for (const [key, pasted] of pasteByKey) {
    const found = membersByKey.get(key) ?? [];
    const readable = pasted.filter(row => row.handicapIndex != null);
    for (const row of pasted) {
      if (row.handicapIndex == null) unreadable.push({ name: row.name, indexText: row.indexText });
    }
    if (pasted.length > 1 || found.length > 1) {
      duplicates.push({ name: pasted[0].name, detail: duplicateDetail(pasted.length, found) });
      continue;
    }
    if (found.length === 0) {
      if (readable.length === 1) unmatched.push(pasted[0].name);
      continue;
    }
    if (readable.length !== 1) continue;
    const member = found[0];
    matches.push({
      userId: member.userId,
      displayName: member.displayName,
      from: Number(member.handicapIndex),
      to: readable[0].handicapIndex as number,
    });
  }

  const missing = members
    .filter(member => !pasteByKey.has(memberMatchKey(member)))
    .map(member => ({ userId: member.userId, displayName: member.displayName }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  matches.sort((left, right) => left.displayName.localeCompare(right.displayName));
  duplicates.sort((left, right) => left.name.localeCompare(right.name));
  unmatched.sort((left, right) => left.localeCompare(right));
  unreadable.sort((left, right) => left.name.localeCompare(right.name));

  return { matches, duplicates, missing, unmatched, unreadable };
}

function duplicateDetail(pasteCount: number, found: HandicapMember[]): string {
  const listed = joinNames(found.map(member => member.displayName));
  if (pasteCount > 1 && found.length > 1) {
    return `listed more than once, and matches ${listed}`;
  }
  if (pasteCount > 1 && found.length === 0) {
    return 'listed more than once in the paste, and not in this league';
  }
  if (pasteCount > 1) return 'listed more than once in the paste';
  return `matches ${listed}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export function reportHandicapImport(
  plan: HandicapImportPlan,
  eventRows: ReadonlyMap<number, { handicapIndex: number; scored: boolean }> | null
): HandicapImportReport {
  const changed: HandicapChange[] = [];
  const eventKept: EventIndexKept[] = [];
  let unchanged = 0;

  for (const match of plan.matches) {
    const event = eventRows?.get(match.userId) ?? null;
    const profileChanged = !sameIndex(match.from, match.to);
    if (event?.scored) {
      if (profileChanged) {
        changed.push({ ...match, profileOnly: true });
      }
      if (!sameIndex(event.handicapIndex, match.to)) {
        eventKept.push({
          displayName: match.displayName,
          eventIndex: Number(event.handicapIndex),
          profileIndex: match.to,
        });
      } else if (!profileChanged) {
        unchanged += 1;
      }
      continue;
    }

    if (event && !sameIndex(event.handicapIndex, match.to)) {
      changed.push({
        userId: match.userId,
        displayName: match.displayName,
        from: Number(event.handicapIndex),
        to: match.to,
        profileOnly: false,
      });
      continue;
    }

    if (profileChanged) {
      changed.push({ ...match, profileOnly: Boolean(event) });
      continue;
    }
    unchanged += 1;
  }

  changed.sort((left, right) => left.displayName.localeCompare(right.displayName));
  eventKept.sort((left, right) => left.displayName.localeCompare(right.displayName));

  return {
    changed,
    unchanged,
    duplicates: plan.duplicates,
    missing: plan.missing,
    unmatched: plan.unmatched,
    unreadable: plan.unreadable,
    eventKept,
  };
}
