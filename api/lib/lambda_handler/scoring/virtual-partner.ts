/** Team formats that can leave one player with a partner drawn after the round. */
const VIRTUAL_PARTNER_FORMATS = new Set(['best_ball', 'high_ball', 'low_high_total']);

export function supportsVirtualPartner(format: string): boolean {
  return VIRTUAL_PARTNER_FORMATS.has(format);
}

/** Everyone in the field except the player who is waiting on a partner. */
export function eligiblePartnerIds(participantIds: number[], designatedUserId: number): number[] {
  const seen = new Set<number>();
  const eligible: number[] = [];
  for (const id of participantIds) {
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0 || userId === designatedUserId || seen.has(userId)) continue;
    seen.add(userId);
    eligible.push(userId);
  }
  return eligible;
}

/** Placeholder name until the draw, then the two players. */
export function virtualPartnerTeamName(memberNames: string[], drawn: boolean): string {
  const names = memberNames.map(name => name.trim()).filter(name => name.length > 0);
  if (!drawn) return `${names[0] || 'Player'} / Virtual Partner`;
  return names.join(' / ') || 'Virtual Partner';
}
