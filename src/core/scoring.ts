import { chipValue, type Card } from './cards';
import { evaluateHand, type HandType } from './hands';

interface HandBase { chips: number; mult: number; chipsPerLevel: number; multPerLevel: number }

/** ⚠ verificar contra la fuente oficial (GDD §5). */
export const HAND_BASE: Record<HandType, HandBase> = {
  high_card: { chips: 5, mult: 1, chipsPerLevel: 10, multPerLevel: 1 },
  pair: { chips: 10, mult: 2, chipsPerLevel: 15, multPerLevel: 1 },
  two_pair: { chips: 20, mult: 2, chipsPerLevel: 20, multPerLevel: 1 },
  three_kind: { chips: 30, mult: 3, chipsPerLevel: 20, multPerLevel: 2 },
  straight: { chips: 30, mult: 4, chipsPerLevel: 30, multPerLevel: 3 },
  flush: { chips: 35, mult: 4, chipsPerLevel: 15, multPerLevel: 2 },
  full_house: { chips: 40, mult: 4, chipsPerLevel: 25, multPerLevel: 2 },
  four_kind: { chips: 60, mult: 7, chipsPerLevel: 30, multPerLevel: 3 },
  straight_flush: { chips: 100, mult: 8, chipsPerLevel: 40, multPerLevel: 4 },
  five_kind: { chips: 120, mult: 12, chipsPerLevel: 35, multPerLevel: 3 },
  flush_house: { chips: 140, mult: 14, chipsPerLevel: 40, multPerLevel: 4 },
  flush_five: { chips: 160, mult: 16, chipsPerLevel: 50, multPerLevel: 3 },
};

export type ScoreEvent =
  | { type: 'hand'; hand: HandType; chips: number; mult: number }
  | { type: 'chips'; source: number; value: number };

export interface ScoreResult {
  hand: HandType;
  chips: number;
  mult: number;
  total: number;
  scoring: Card[];
  events: ScoreEvent[];
}

/** Niveles: 1 = base. Jokers y enhancements se añaden en Fases 4-5. */
export function scoreHand(cards: Card[], levels: Partial<Record<HandType, number>> = {}): ScoreResult {
  const { hand, scoring } = evaluateHand(cards);
  const b = HAND_BASE[hand];
  const lvl = (levels[hand] ?? 1) - 1;
  let chips = b.chips + b.chipsPerLevel * lvl;
  const mult = b.mult + b.multPerLevel * lvl;
  const events: ScoreEvent[] = [{ type: 'hand', hand, chips, mult }];
  for (const c of scoring) {
    const v = chipValue(c.rank);
    chips += v;
    events.push({ type: 'chips', source: c.id, value: v });
  }
  return { hand, chips, mult, total: chips * mult, scoring, events };
}
