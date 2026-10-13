/** First and last initials, so "Ann A" becomes "AA". */
export function playerInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(part => part.length > 0);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}
