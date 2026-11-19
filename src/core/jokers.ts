import { cardIsSuit, isFaceCard, isStone, type Card, type Rank, type Suit } from './cards';
import { containsHand, type HandType } from './hands';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Edition = 'foil' | 'holo' | 'poly' | 'negative';

export interface Effect {
  chips?: number;
  mult?: number;
  xmult?: number;
  money?: number;
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
  /** Mazo completo (Stone/Steel Joker, Cloud 9). */
  deck: Card[];
  /** Tipos de mano jugados antes en esta ronda. */
  roundHands: HandType[];
  /** Tiradas aleatorias [0,1) (en la vista previa nunca ocurre nada). */
  rng: () => number;
}

export interface JokerInstance {
  uid: number;
  id: string;
  edition?: Edition;
  /** Precio pagado/base (la venta es la mitad). */
  cost: number;
  /** Estado para jokers que escalan (p. ej. `mult`). */
  state: Record<string, number>;
  /** Stickers de Stake alto. */
  sticker?: 'eternal' | 'perishable' | 'rental';
  /** Rondas jugadas con el joker (Perishable se debilita a las 5). */
  rounds?: number;
}

export const PERISHABLE_ROUNDS = 5;
/** Un joker Perishable agotado deja de funcionar. */
export const jokerActive = (j: JokerInstance): boolean => !(j.sticker === 'perishable' && (j.rounds ?? 0) >= PERISHABLE_ROUNDS);

export interface JokerDef {
  id: string;
  rarity: Rarity;
  cost: number;
  onCardScored?(j: JokerInstance, ctx: ScoreCtx, card: Card): Effect | undefined;
  onHeld?(j: JokerInstance, ctx: ScoreCtx, card: Card): Effect | undefined;
  onScore?(j: JokerInstance, ctx: ScoreCtx): Effect | undefined;
  /** Tras puntuar la mano (actualiza estado de jokers que escalan). */
  onHandPlayed?(j: JokerInstance, ctx: ScoreCtx): void;
  onDiscard?(j: JokerInstance, count: number): void;
  roundEndMoney?(j: JokerInstance, deck: Card[]): number;
  /** Repeticiones extra de una carta que puntúa. */
  retriggerScored?(j: JokerInstance, ctx: ScoreCtx, card: Card): number;
  /** Repeticiones extra de una carta en mano. */
  retriggerHeld?(j: JokerInstance, ctx: ScoreCtx, card: Card): number;
  /** Copia el efecto de otro joker (Blueprint: el de la derecha; Brainstorm: el primero). */
  copies?: 'right' | 'left';
  /** Al acabar la ronda: true = el joker se destruye (los Eternos son inmunes). */
  onRoundEnd?(j: JokerInstance, rng: () => number): boolean;
  passive?: { handSize?: number; hands?: number; discards?: number };
  /** Anula el efecto del Boss Blind (Chicot). */
  disablesBoss?: boolean;
}

export const isFace = isFaceCard;
const inSet = (set: Rank[]) => (c: Card) => !isStone(c) && set.includes(c.rank);

// ---- Fábricas ----
const suitMult = (id: string, suit: Suit, mult: number): JokerDef => ({
  id, rarity: 'common', cost: 5,
  onCardScored: (_j, _c, card) => (cardIsSuit(card, suit) ? { mult } : undefined),
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
  { id: 'scholar', rarity: 'common', cost: 4, onCardScored: (_j, _c, card) => (card.rank === 14 && !isStone(card) ? { chips: 20, mult: 4 } : undefined) },
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
    onScore: (_j, c) => (c.held.every((h) => cardIsSuit(h, 'S') || cardIsSuit(h, 'C')) ? { xmult: 3 } : undefined),
  },
  { id: 'baron', rarity: 'rare', cost: 8, onHeld: (_j, _c, card) => (card.rank === 13 ? { xmult: 1.5 } : undefined) },
  {
    id: 'triboulet', rarity: 'legendary', cost: 20,
    onCardScored: (_j, _c, card) => (!isStone(card) && (card.rank === 12 || card.rank === 13) ? { xmult: 2 } : undefined),
  },
  { id: 'chicot', rarity: 'legendary', cost: 20, disablesBoss: true },
  { id: 'bull', rarity: 'uncommon', cost: 6, onScore: (_j, c) => ({ chips: 2 * Math.max(0, c.money) }) },
  // ---- Lote 2 de Fase 7: motor (repeticiones, copia, destrucción, dinero por carta, mazo) ⚠ verificar ----
  { id: 'mime', rarity: 'uncommon', cost: 5, retriggerHeld: () => 1 },
  { id: 'hanging_chad', rarity: 'common', cost: 4, retriggerScored: (_j, c, card) => (card === c.scoring[0] ? 2 : 0) },
  { id: 'hack', rarity: 'uncommon', cost: 6, retriggerScored: (_j, _c, card) => (inSet([2, 3, 4, 5])(card) ? 1 : 0) },
  { id: 'dusk', rarity: 'uncommon', cost: 5, retriggerScored: (_j, c) => (c.handsLeft === 1 ? 1 : 0) },
  { id: 'sock_and_buskin', rarity: 'uncommon', cost: 6, retriggerScored: (_j, _c, card) => (isFace(card) ? 1 : 0) },
  {
    id: 'seltzer', rarity: 'uncommon', cost: 6,
    retriggerScored: () => 1,
    onHandPlayed: (j) => { j.state.hands = (j.state.hands ?? 0) + 1; },
    onRoundEnd: (j) => (j.state.hands ?? 0) >= 10,
  },
  { id: 'blueprint', rarity: 'rare', cost: 10, copies: 'right' },
  { id: 'brainstorm', rarity: 'rare', cost: 10, copies: 'left' },
  { id: 'rough_gem', rarity: 'uncommon', cost: 7, onCardScored: (_j, _c, card) => (cardIsSuit(card, 'D') ? { money: 1 } : undefined) },
  { id: 'golden_ticket', rarity: 'common', cost: 5, onCardScored: (_j, _c, card) => (card.enhancement === 'gold' ? { money: 4 } : undefined) },
  {
    id: 'bloodstone', rarity: 'uncommon', cost: 7,
    onCardScored: (_j, c, card) => (cardIsSuit(card, 'H') && c.rng() < 0.5 ? { xmult: 1.5 } : undefined),
  },
  { id: 'gros_michel', rarity: 'common', cost: 5, onScore: () => ({ mult: 15 }), onRoundEnd: (_j, rng) => rng() < 1 / 6 },
  { id: 'cavendish', rarity: 'common', cost: 4, onScore: () => ({ xmult: 3 }), onRoundEnd: (_j, rng) => rng() < 1 / 1000 },
  {
    id: 'ice_cream', rarity: 'common', cost: 5,
    onScore: (j) => ({ chips: Math.max(0, 100 - 5 * (j.state.spent ?? 0)) }),
    onHandPlayed: (j) => { j.state.spent = (j.state.spent ?? 0) + 1; },
    onRoundEnd: (j) => 100 - 5 * (j.state.spent ?? 0) <= 0,
  },
  {
    id: 'popcorn', rarity: 'common', cost: 5,
    onScore: (j) => ({ mult: Math.max(0, 20 - 4 * (j.state.rounds ?? 0)) }),
    onRoundEnd: (j) => { j.state.rounds = (j.state.rounds ?? 0) + 1; return 20 - 4 * j.state.rounds <= 0; },
  },
  { id: 'stone_joker', rarity: 'uncommon', cost: 6, onScore: (_j, c) => ({ chips: 25 * c.deck.filter(isStone).length }) },
  {
    id: 'steel_joker', rarity: 'uncommon', cost: 7,
    onScore: (_j, c) => {
      const n = c.deck.filter((x) => x.enhancement === 'steel').length;
      return n ? { xmult: 1 + 0.2 * n } : undefined;
    },
  },
  // ---- Lote 3 de Fase 7 ⚠ verificar ----
  {
    id: 'wee_joker', rarity: 'rare', cost: 8,
    onScore: (j) => ({ chips: j.state.chips ?? 0 }),
    onHandPlayed: (j, c) => { j.state.chips = (j.state.chips ?? 0) + 8 * c.scoring.filter((x) => !isStone(x) && x.rank === 2).length; },
  },
  {
    id: 'seeing_double', rarity: 'uncommon', cost: 6,
    onScore: (_j, c) => (c.scoring.some((x) => cardIsSuit(x, 'C')) && c.scoring.some((x) => !cardIsSuit(x, 'C')) ? { xmult: 2 } : undefined),
  },
  {
    id: 'flower_pot', rarity: 'uncommon', cost: 6,
    onScore: (_j, c) => (c.scoring.length >= 4 && (['S', 'H', 'D', 'C'] as Suit[]).every((s) => c.scoring.some((x) => cardIsSuit(x, s))) ? { xmult: 3 } : undefined),
  },
  {
    id: 'loyalty_card', rarity: 'uncommon', cost: 5,
    onScore: (_j, c) => ((Object.values(c.handPlays).reduce((a, b) => a + (b ?? 0), 0) + 1) % 6 === 0 ? { xmult: 4 } : undefined),
  },
  {
    id: 'drivers_license', rarity: 'rare', cost: 7,
    onScore: (_j, c) => (c.deck.filter((x) => x.enhancement).length >= 16 ? { xmult: 3 } : undefined),
  },
  { id: 'erosion', rarity: 'uncommon', cost: 6, onScore: (_j, c) => ({ mult: 4 * Math.max(0, 52 - c.deck.length) }) },
  { id: 'reserved_parking', rarity: 'common', cost: 6, onHeld: (_j, c, card) => (isFace(card) && c.rng() < 0.5 ? { money: 1 } : undefined) },
  { id: 'business_card', rarity: 'common', cost: 4, onCardScored: (_j, c, card) => (isFace(card) && c.rng() < 0.5 ? { money: 2 } : undefined) },
  { id: 'card_sharp', rarity: 'uncommon', cost: 6, onScore: (_j, c) => (c.roundHands.includes(c.handType) ? { xmult: 3 } : undefined) },
  {
    id: 'obelisk', rarity: 'rare', cost: 8,
    onScore: (j, c) => ({ xmult: 1 + 0.2 * ((j.state.streak ?? 0) + (isMostPlayed(c) ? 0 : 1)) }),
    onHandPlayed: (j, c) => { j.state.streak = isMostPlayed(c) ? 0 : (j.state.streak ?? 0) + 1; },
  },
  {
    id: 'ramen', rarity: 'uncommon', cost: 6,
    onScore: (j) => ({ xmult: Math.max(1, 2 - 0.01 * (j.state.lost ?? 0)) }),
    onDiscard: (j, n) => { j.state.lost = (j.state.lost ?? 0) + n; },
    onRoundEnd: (j) => 2 - 0.01 * (j.state.lost ?? 0) <= 1,
  },
  {
    id: 'hiker', rarity: 'uncommon', cost: 5,
    onHandPlayed: (_j, c) => { for (const x of c.scoring) x.perma = (x.perma ?? 0) + 5; },
  },
  {
    id: 'egg', rarity: 'common', cost: 4,
    onRoundEnd: (j) => { j.state.sell = (j.state.sell ?? 0) + 3; return false; },
  },
  { id: 'cloud_9', rarity: 'uncommon', cost: 7, roundEndMoney: (_j, deck) => deck.filter((x) => !isStone(x) && x.rank === 9).length },
  // ---- Lote 1 de Fase 7 ⚠ verificar valores ----
  {
    id: 'walkie_talkie', rarity: 'common', cost: 4,
    onCardScored: (_j, _c, card) => (inSet([10, 4])(card) ? { chips: 10, mult: 4 } : undefined),
  },
  { id: 'smiley_face', rarity: 'common', cost: 4, onCardScored: (_j, _c, card) => (isFace(card) ? { mult: 5 } : undefined) },
  { id: 'shoot_the_moon', rarity: 'common', cost: 5, onHeld: (_j, _c, card) => (inSet([12])(card) ? { mult: 13 } : undefined) },
  { id: 'arrowhead', rarity: 'uncommon', cost: 7, onCardScored: (_j, _c, card) => (cardIsSuit(card, 'S') ? { chips: 50 } : undefined) },
  { id: 'onyx_agate', rarity: 'uncommon', cost: 7, onCardScored: (_j, _c, card) => (cardIsSuit(card, 'C') ? { mult: 7 } : undefined) },
  { id: 'stuntman', rarity: 'rare', cost: 7, onScore: () => ({ chips: 250 }), passive: { handSize: -2 } },
  { id: 'bootstraps', rarity: 'uncommon', cost: 7, onScore: (_j, c) => ({ mult: 2 * Math.floor(Math.max(0, c.money) / 5) }) },
  { id: 'merry_andy', rarity: 'uncommon', cost: 7, passive: { discards: 3, handSize: -1 } },
  { id: 'troubadour', rarity: 'uncommon', cost: 6, passive: { handSize: 2, hands: -1 } },
  {
    id: 'square_joker', rarity: 'common', cost: 4,
    onScore: (j, c) => ({ chips: (j.state.chips ?? 0) + (c.played.length === 4 ? 4 : 0) }),
    onHandPlayed: (j, c) => { if (c.played.length === 4) j.state.chips = (j.state.chips ?? 0) + 4; },
  },
  {
    id: 'runner', rarity: 'common', cost: 5,
    onScore: (j, c) => ({ chips: (j.state.chips ?? 0) + (containsHand(c.played, 'straight') ? 15 : 0) }),
    onHandPlayed: (j, c) => { if (containsHand(c.played, 'straight')) j.state.chips = (j.state.chips ?? 0) + 15; },
  },
  {
    id: 'spare_trousers', rarity: 'uncommon', cost: 6,
    onScore: (j, c) => ({ mult: (j.state.mult ?? 0) + (containsHand(c.played, 'two_pair') ? 2 : 0) }),
    onHandPlayed: (j, c) => { if (containsHand(c.played, 'two_pair')) j.state.mult = (j.state.mult ?? 0) + 2; },
  },
  {
    id: 'raised_fist', rarity: 'common', cost: 5,
    onScore: (_j, c) => {
      const ranks = c.held.filter((h) => !isStone(h)).map((h) => h.rank);
      if (!ranks.length) return undefined;
      const low = Math.min(...ranks);
      return { mult: 2 * (low === 14 ? 11 : Math.min(low, 10)) };
    },
  },
];

export const JOKERS: Record<string, JokerDef> = Object.fromEntries(JOKER_LIST.map((d) => [d.id, d]));

export const EDITION_COST: Record<Edition, number> = { foil: 2, holo: 3, poly: 5, negative: 5 };

export function sellValue(j: JokerInstance): number {
  return Math.max(1, Math.floor(j.cost / 2)) + (j.state.sell ?? 0);
}

/** ¿La mano jugada es (o empata como) la más jugada hasta ahora? (Obelisk) */
function isMostPlayed(c: ScoreCtx): boolean {
  const n = c.handPlays[c.handType] ?? 0;
  return n > 0 && n === Math.max(...Object.values(c.handPlays).map((v) => v ?? 0));
}
