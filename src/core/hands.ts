import type { Card } from './cards';

export type HandType =
  | 'high_card' | 'pair' | 'two_pair' | 'three_kind' | 'straight' | 'flush'
  | 'full_house' | 'four_kind' | 'straight_flush' | 'five_kind' | 'flush_house' | 'flush_five';

export interface HandResult {
  hand: HandType;
  /** Cartas que puntúan (las demás son kickers). */
  scoring: Card[];
}

function isStraight(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const ranks = new Set(cards.map((c) => c.rank));
  if (ranks.size !== 5) return false;
  const sorted = [...ranks].sort((a, b) => a - b);
  if (sorted[4] - sorted[0] === 4) return true;
  // A-2-3-4-5
  return sorted.join() === '2,3,4,5,14';
}

const isFlush = (cards: Card[]) => cards.length === 5 && cards.every((c) => c.suit === cards[0].suit);

export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length === 0) throw new Error('Mano vacía');
  const groups = new Map<number, Card[]>();
  for (const c of cards) groups.set(c.rank, [...(groups.get(c.rank) ?? []), c]);
  const sizes = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
  const counts = sizes.map((g) => g.length);
  const flush = isFlush(cards);
  const straight = isStraight(cards);

  if (counts[0] === 5 && flush) return { hand: 'flush_five', scoring: cards };
  if (counts[0] === 3 && counts[1] === 2 && flush) return { hand: 'flush_house', scoring: cards };
  if (counts[0] === 5) return { hand: 'five_kind', scoring: cards };
  if (straight && flush) return { hand: 'straight_flush', scoring: cards };
  if (counts[0] === 4) return { hand: 'four_kind', scoring: sizes[0] };
  if (counts[0] === 3 && counts[1] === 2) return { hand: 'full_house', scoring: cards };
  if (flush) return { hand: 'flush', scoring: cards };
  if (straight) return { hand: 'straight', scoring: cards };
  if (counts[0] === 3) return { hand: 'three_kind', scoring: sizes[0] };
  if (counts[0] === 2 && counts[1] === 2) return { hand: 'two_pair', scoring: [...sizes[0], ...sizes[1]] };
  if (counts[0] === 2) return { hand: 'pair', scoring: sizes[0] };
  const high = cards.reduce((a, b) => (b.rank > a.rank ? b : a));
  return { hand: 'high_card', scoring: [high] };
}
