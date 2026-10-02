/** People pay the entry with $20 bills, so suggested payouts stay on that increment. */
const BILL = 20;

export interface PlacePayout {
  place: number;
  amount: number;
}

/** Everyone signed up, whether or not the entry has been collected yet. */
export function entryPurse(players: readonly unknown[], entryFee: number): number {
  return players.length * Number(entryFee);
}

export function collectedTotal(
  players: Array<{ ctpPaid: boolean; longDrivePaid: boolean }>,
  event: { entryFee: number; ctpEnabled: boolean; ctpEntryFee: number; longDriveEnabled: boolean; longDriveEntryFee: number }
): number {
  const entry = entryPurse(players, event.entryFee);
  return players.reduce((total, player) => {
    let amount = 0;
    if (event.ctpEnabled && player.ctpPaid) amount += Number(event.ctpEntryFee);
    if (event.longDriveEnabled && player.longDrivePaid) amount += Number(event.longDriveEntryFee);
    return total + amount;
  }, entry);
}

export function suggestPlacePayouts(pot: number, stake: number): PlacePayout[] {
  const purse = Math.floor(Number(pot) / BILL) * BILL;
  const buyback = Math.ceil(Number(stake) / BILL) * BILL;
  if (purse < BILL) return [];
  if (buyback <= 0) return [{ place: 1, amount: purse }];

  const third = buyback;
  const secondFloor = buyback + BILL;
  const firstFloor = buyback + BILL * 2;
  if (purse >= firstFloor + secondFloor + third) {
    let first = purse - secondFloor - third;
    let second = secondFloor;
    while (first - second > second - third + BILL && first - BILL > second + BILL) {
      first -= BILL;
      second += BILL;
    }
    return [
      { place: 1, amount: first },
      { place: 2, amount: second },
      { place: 3, amount: third },
    ];
  }

  if (purse >= buyback + buyback + BILL) {
    return [
      { place: 1, amount: purse - buyback },
      { place: 2, amount: buyback },
    ];
  }

  return [{ place: 1, amount: purse }];
}

export function money(amount: number): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '$0';
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function placeName(place: number): string {
  if (place === 1) return '1st';
  if (place === 2) return '2nd';
  if (place === 3) return '3rd';
  return `${place}th`;
}

export function suggestionNote(places: PlacePayout[], stake: number, pot: number): string {
  const back = money(Math.ceil(Number(stake) / BILL) * BILL);
  const leftover = Number(pot) - Math.floor(Number(pot) / BILL) * BILL;
  const change = leftover > 0 ? ` ${money(leftover)} is left over.` : '';
  if (places.length >= 3) {
    return `3rd gets ${back} back. 1st gets more than 2nd, and 2nd gets more than 3rd. Paid in $20 bills.${change}`;
  }
  if (places.length === 2) {
    return `2nd gets ${back} back. The pot cannot cover a 3rd place and still pay 1st more than 2nd. Paid in $20 bills.${change}`;
  }
  if (places.length === 1) return `The pot only covers one payout, in $20 bills.${change}`;
  return '';
}
