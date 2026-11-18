import type { Card, Rank, Suit } from './cards';
import { containsHand, type HandType } from './hands';

export type Rarity = 'common' | 'uncommon' | 'rare';
export type Edition = 'foil' | 'holo' | 'poly' | 'negative';

export interface Effect {
  chips?: number;
  mult?: number;
  xmult?: number;
}

/** Contexto que ven los jokers al puntuar una mano. */
export interface ScoreCtx {
  handType: HandType;
  played: Card[];
  scoring: Card[];
  held: Card[];
  handsLeft: number;
  discardsLeft: number;
  money: number;
  deckLeft: number;
  jokerCount: number;
  handPlays: Partial<Record<HandType, number>>;
}

export interface JokerInstance {
  uid: number;
  id: string;
  edition?: Edition;
  /** Precio pagado/base (la venta es la mitad). */
  cost: number;
  /** Estado para jokers que escalan (p. ej. `mult`). */
  state: Record<string, number>;
}

export interface JokerDef {
  id: string;
  rarity: Rarity;
  cost: number;
  onCardScored?(j: JokerInstance, ctx: ScoreCtx, card: Card): Effect | undefined;
  onHeld?(j: JokerInstance, ctx: ScoreCtx, card: Card): Effect | undefined;
  onScore?(j: JokerInstance, ctx: ScoreCtx): Effect | undefined;
  /** Tras puntuar la mano (actualiza estado de jokers que escalan). */
  onHandPlayed?(j: JokerInstance, ctx: ScoreCtx): void;
  onDiscard?(j: JokerInstance): void;
  roundEndMoney?(j: JokerInstance): number;
  passive?: { handSize?: number; hands?: number; discards?: number };
}

export const isFace = (c: Card) => c.rank >= 11 && c.rank <= 13;
const inSet = (set: Rank[]) => (c: Card) => set.includes(c.rank);

// ---- Fábricas ----
const suitMult = (id: string, suit: Suit, mult: number): JokerDef => ({
  id, rarity: 'common', cost: 5,
  onCardScored: (_j, _c, card) => (card.suit === suit ? { mult } : undefined),
});
const handMult = (id: string, type: HandType, mult: number, cost: number): JokerDef => ({
  id, rarity: 'common', cost,
  onScore: (_j, c) => (containsHand(c.played, type) ? { mult } : undefined),
});
const handChips = (id: string, type: HandType, chips: number, cost: number): JokerDef => ({
  id, rarity: 'common', cost,
  onScore: (_j, c) => (containsHand(c.played, type) ? { chips } : undefined),
});
const handX = (id: string, type: HandType, xmult: number): JokerDef => ({
  id, rarity: 'rare', cost: 8,
  onScore: (_j, c) => (containsHand(c.played, type) ? { xmult } : undefined),
});

const EVEN: Rank[] = [2, 4, 6, 8, 10];
const ODD: Rank[] = [3, 5, 7, 9, 14];
const FIB: Rank[] = [14, 2, 3, 5, 8];

/** ⚠ verificar valores/costes contra la fuente oficial (GDD §7). */
export const JOKER_LIST: JokerDef[] = [
  { id: 'joker', rarity: 'common', cost: 2, onScore: () => ({ mult: 4 }) },
  suitMult('greedy_joker', 'D', 3),
  suitMult('lusty_joker', 'H', 3),
  suitMult('wrathful_joker', 'S', 3),
  suitMult('gluttonous_joker', 'C', 3),
  handMult('jolly_joker', 'pair', 8, 3),
  handMult('zany_joker', 'three_kind', 12, 4),
  handMult('mad_joker', 'two_pair', 10, 4),
  handMult('crazy_joker', 'straight', 12, 4),
  handMult('droll_joker', 'flush', 10, 4),
  handChips('sly_joker', 'pair', 50, 3),
  handChips('wily_joker', 'three_kind', 100, 4),
  handChips('clever_joker', 'two_pair', 80, 4),
  handChips('devious_joker', 'straight', 100, 4),
  handChips('crafty_joker', 'flush', 80, 4),
  { id: 'half_joker', rarity: 'common', cost: 5, onScore: (_j, c) => (c.played.length <= 3 ? { mult: 20 } : undefined) },
  { id: 'banner', rarity: 'common', cost: 5, onScore: (_j, c) => ({ chips: 30 * c.discardsLeft }) },
  { id: 'mystic_summit', rarity: 'common', cost: 5, onScore: (_j, c) => (c.discardsLeft === 0 ? { mult: 15 } : undefined) },
  { id: 'scary_face', rarity: 'common', cost: 4, onCardScored: (_j, _c, card) => (isFace(card) ? { chips: 30 } : undefined) },
  { id: 'even_steven', rarity: 'common', cost: 4, onCardScored: (_j, _c, card) => (inSet(EVEN)(card) ? { mult: 4 } : undefined) },
  { id: 'odd_todd', rarity: 'common', cost: 4, onCardScored: (_j, _c, card) => (inSet(ODD)(card) ? { chips: 31 } : undefined) },
  { id: 'scholar', rarity: 'common', cost: 4, onCardScored: (_j, _c, card) => (card.rank === 14 ? { chips: 20, mult: 4 } : undefined) },
  { id: 'fibonacci', rarity: 'uncommon', cost: 8, onCardScored: (_j, _c, card) => (inSet(FIB)(card) ? { mult: 8 } : undefined) },
  { id: 'abstract_joker', rarity: 'common', cost: 4, onScore: (_j, c) => ({ mult: 3 * c.jokerCount }) },
  { id: 'golden_joker', rarity: 'common', cost: 6, roundEndMoney: () => 4 },
  {
    id: 'green_joker', rarity: 'common', cost: 4,
    onScore: (j) => ({ mult: (j.state.mult ?? 0) + 1 }),
    onHandPlayed: (j) => { j.state.mult = (j.state.mult ?? 0) + 1; },
    onDiscard: (j) => { j.state.mult = Math.max(0, (j.state.mult ?? 0) - 1); },
  },
  {
    id: 'ride_the_bus', rarity: 'common', cost: 6,
    onScore: (j, c) => ({ mult: c.scoring.some(isFace) ? 0 : (j.state.mult ?? 0) + 1 }),
    onHandPlayed: (j, c) => { j.state.mult = c.scoring.some(isFace) ? 0 : (j.state.mult ?? 0) + 1; },
  },
  { id: 'supernova', rarity: 'common', cost: 5, onScore: (_j, c) => ({ mult: (c.handPlays[c.handType] ?? 0) + 1 }) },
  {
    id: 'photograph', rarity: 'common', cost: 5,
    onCardScored: (_j, c, card) => (card === c.scoring.find(isFace) ? { xmult: 2 } : undefined),
  },
  handX('the_duo', 'pair', 2),
  handX('the_trio', 'three_kind', 3),
  handX('the_family', 'four_kind', 4),
  handX('the_order', 'straight', 3),
  handX('the_tribe', 'flush', 2),
  { id: 'blue_joker', rarity: 'common', cost: 5, onScore: (_j, c) => ({ chips: 2 * c.deckLeft }) },
  { id: 'juggler', rarity: 'common', cost: 4, passive: { handSize: 1 } },
  { id: 'drunkard', rarity: 'common', cost: 4, passive: { discards: 1 } },
  { id: 'acrobat', rarity: 'uncommon', cost: 6, onScore: (_j, c) => (c.handsLeft === 1 ? { xmult: 3 } : undefined) },
  {
    id: 'blackboard', rarity: 'uncommon', cost: 6,
    onScore: (_j, c) => (c.held.every((h) => h.suit === 'S' || h.suit === 'C') ? { xmult: 3 } : undefined),
  },
  { id: 'baron', rarity: 'rare', cost: 8, onHeld: (_j, _c, card) => (card.rank === 13 ? { xmult: 1.5 } : undefined) },
  { id: 'bull', rarity: 'uncommon', cost: 6, onScore: (_j, c) => ({ chips: 2 * Math.max(0, c.money) }) },
];

export const JOKERS: Record<string, JokerDef> = Object.fromEntries(JOKER_LIST.map((d) => [d.id, d]));

export const EDITION_COST: Record<Edition, number> = { foil: 2, holo: 3, poly: 5, negative: 5 };

export function sellValue(j: JokerInstance): number {
  return Math.max(1, Math.floor(j.cost / 2));
}
