import type { Rng } from './rng';

export type Suit = 'S' | 'H' | 'D' | 'C';
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
/** 2..10, 11=J, 12=Q, 13=K, 14=A */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export interface Card {
  id: number;
  rank: Rank;
  suit: Suit;
}

export function rankLabel(r: Rank): string {
  if (r <= 10) return String(r);
  return { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r as 11 | 12 | 13 | 14];
}

/** Chips por carta: 2-10 valor, figuras 10, As 11. */
export function chipValue(r: Rank): number {
  return r === 14 ? 11 : r >= 11 ? 10 : r;
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: id++, rank, suit });
  return deck;
}

/** Fisher-Yates determinista. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
