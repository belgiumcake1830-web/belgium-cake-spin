import { randomInt } from 'node:crypto';

// ---- EDIT HERE: discount rules -------------------------------------------
// The earlier the customer orders, the bigger the possible discount.
// "minDays" = days between today and the date they need the cake.
// Check your margin before raising any max value!
export const TIERS = [
  { minDays: 7, min: 10, max: 20 },
  { minDays: 4, min: 7, max: 15 },
  { minDays: 2, min: 4, max: 10 },
  { minDays: 0, min: 1, max: 5 },
];

export const CODE_VALID_DAYS = 7; // how long a won code stays valid
export const MAX_DAYS_AHEAD = 60; // furthest event date accepted
// ---------------------------------------------------------------------------

export function tierFor(daysAhead) {
  return TIERS.find((t) => daysAhead >= t.minDays);
}

export function pickPercent(tier) {
  return randomInt(tier.min, tier.max + 1); // secure random, server side
}

// No 0/O/1/I so codes are easy to read out at the counter.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function makeCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `BC-${s}`;
}
