/** Stored indexes use a negative number for a plus handicap. The screen always shows the plus sign. */

export function formatHandicapIndex(index: number | null | undefined): string {
  const value = Number(index);
  if (!Number.isFinite(value)) return '';
  const magnitude = Math.round(Math.abs(value) * 10) / 10;
  return value < 0 ? `+${magnitude}` : String(magnitude);
}

/** Accepts 10.4 and +1.4. A leading minus is the same plus handicap, for values already stored that way. */
export function parseHandicapIndex(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const signed = text.startsWith('+') || text.startsWith('-');
  const body = signed ? text.slice(1) : text;
  if (!/^\d+(\.\d)?$/.test(body)) return null;
  const magnitude = Number(body);
  if (magnitude > 54) return null;
  if (signed && magnitude > 10) return null;
  return signed && magnitude !== 0 ? -magnitude : magnitude;
}
