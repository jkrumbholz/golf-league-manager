import { entryPurse, suggestPlacePayouts } from '../../webapp/src/app/models/payouts';

describe('place payout suggestions', () => {
  test('uses everyone signed up, including players who have not paid yet', () => {
    expect(entryPurse([{ paid: true }, { paid: false }, { paid: false }], 20)).toBe(60);
  });

  test('pays 3rd their entry back and keeps every amount on a $20 bill', () => {
    expect(suggestPlacePayouts(120, 20)).toEqual([
      { place: 1, amount: 60 },
      { place: 2, amount: 40 },
      { place: 3, amount: 20 },
    ]);
  });

  test('gives a twosome their combined entry back', () => {
    expect(suggestPlacePayouts(240, 40)).toEqual([
      { place: 1, amount: 120 },
      { place: 2, amount: 80 },
      { place: 3, amount: 40 },
    ]);
  });

  test('drops 3rd when the pot cannot keep 1st ahead of 2nd', () => {
    expect(suggestPlacePayouts(80, 20)).toEqual([
      { place: 1, amount: 60 },
      { place: 2, amount: 20 },
    ]);
  });

  test('spreads a larger pot without making change', () => {
    expect(suggestPlacePayouts(160, 20)).toEqual([
      { place: 1, amount: 80 },
      { place: 2, amount: 60 },
      { place: 3, amount: 20 },
    ]);
  });
});
