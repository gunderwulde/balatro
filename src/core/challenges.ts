import type { Card, Enhancement, Rank, Suit } from './cards';
import type { ConsumableKind } from './consumables';

/** Transformaciones del mazo de partida para un desafío. */
export type DeckTransform = 'no_face' | 'all_spades' | `all_${Enhancement}`;

/**
 * Desafío: una run con mazo y reglas fijas. Los números no están equilibrados contra el juego original
 * (son diseños propios inspirados en el género); ajustar tras playtest.
 */
export interface ChallengeDef {
  id: string;
  jokers?: { id: string; eternal?: boolean }[];
  consumables?: { kind: ConsumableKind; id: string }[];
  vouchers?: string[];
  /** Dinero inicial (sustituye a $4). */
  money?: number;
  hands?: number;
  discards?: number;
  handSize?: number;
  jokerSlots?: number;
  consumableSlots?: number;
  deck?: DeckTransform;
  /** No hay interés al final de la ronda. */
  noInterest?: boolean;
}

export const CHALLENGE_LIST: ChallengeDef[] = [
  { id: 'omelette', jokers: [{ id: 'egg', eternal: true }, { id: 'gros_michel' }], money: 0, discards: 1 },
  { id: 'no_faces', deck: 'no_face', jokers: [{ id: 'hack', eternal: true }], handSize: 1 },
  { id: 'monochrome', deck: 'all_spades', jokers: [{ id: 'arrowhead', eternal: true }] },
  { id: 'rich_get_richer', money: 100, noInterest: true, jokerSlots: -2 },
  { id: 'single_shot', hands: -3, discards: 4, handSize: 3, jokers: [{ id: 'dusk', eternal: true }] },
  { id: 'jokerless', jokerSlots: -5, money: 12, consumableSlots: 2, consumables: [{ kind: 'tarot', id: 'hermit' }, { kind: 'tarot', id: 'strength' }] },
  { id: 'glass_cannon', deck: 'all_glass', handSize: -1, jokers: [{ id: 'glass_joker', eternal: true }] },
  { id: 'gold_rush', deck: 'all_gold', money: 0, jokers: [{ id: 'golden_ticket', eternal: true }] },
  { id: 'stone_age', deck: 'all_stone', jokers: [{ id: 'stone_joker', eternal: true }], handSize: -2 },
  { id: 'lucky_break', deck: 'all_lucky', jokers: [{ id: 'oops_all_6s', eternal: true }] },
  { id: 'deep_debt', money: 0, noInterest: true, jokers: [{ id: 'credit_card', eternal: true }] },
  { id: 'marathon', hands: 2, discards: -4, handSize: -2, jokers: [{ id: 'juggler' }] },
];

export const CHALLENGES: Record<string, ChallengeDef> = Object.fromEntries(CHALLENGE_LIST.map((c) => [c.id, c]));

/** Aplica la transformación de mazo a las 52 cartas. */
export function transformDeck(cards: Card[], t: DeckTransform | undefined): Card[] {
  if (!t) return cards;
  if (t === 'no_face') return cards.filter((c) => c.rank < 11 || c.rank > 13);
  if (t === 'all_spades') return cards.map((c) => ({ ...c, suit: 'S' as Suit }));
  const enh = t.slice(4) as Enhancement;
  return cards.map((c) => ({ ...c, enhancement: enh }));
}

export type { Rank };
