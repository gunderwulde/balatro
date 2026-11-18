import { cardChips, type Card } from './cards';
import { evaluateHand, type HandType } from './hands';
import { JOKERS, type Effect, type JokerInstance, type ScoreCtx } from './jokers';

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

export const FOIL_CHIPS = 50;
export const HOLO_MULT = 10;
export const POLY_XMULT = 1.5;
export const BONUS_CHIPS = 30;
export const MULT_BONUS = 4;
export const STONE_CHIPS = 50;
export const GLASS_XMULT = 2;
export const STEEL_XMULT = 1.5;
export const LUCKY_MULT = 20;
export const LUCKY_MONEY = 20;
export const GOLD_SEAL_MONEY = 3;
export const GLASS_BREAK_CHANCE = 0.25;
export const LUCKY_MULT_CHANCE = 1 / 5;
export const LUCKY_MONEY_CHANCE = 1 / 15;
export const OBSERVATORY_XMULT = 1.5;

export function handStats(hand: HandType, level = 1): { chips: number; mult: number } {
  const b = HAND_BASE[hand];
  return { chips: b.chips + b.chipsPerLevel * (level - 1), mult: b.mult + b.multPerLevel * (level - 1) };
}

export type EventSource =
  | { kind: 'card'; id: number }
  | { kind: 'joker'; id: number }
  | { kind: 'edition'; id: number }
  | { kind: 'held'; id: number }
  | { kind: 'planet'; id: number };

export type ScoreEvent =
  | { type: 'hand'; hand: HandType; chips: number; mult: number }
  | { type: 'chips' | 'mult' | 'xmult' | 'money'; value: number; source: EventSource; chips: number; mult: number };

export interface ScoreResult {
  hand: HandType;
  chips: number;
  mult: number;
  total: number;
  scoring: Card[];
  events: ScoreEvent[];
  /** Dinero ganado puntuando (Gold Seal, Lucky). */
  money: number;
  /** Cartas de cristal que se rompen. */
  destroyed: number[];
}

export interface ScoreOptions {
  levels?: Partial<Record<HandType, number>>;
  jokers?: JokerInstance[];
  held?: Card[];
  handsLeft?: number;
  discardsLeft?: number;
  money?: number;
  deckLeft?: number;
  handPlays?: Partial<Record<HandType, number>>;
  /** Tiradas aleatorias [0,1). Por defecto nunca ocurre nada (vista previa determinista). */
  rng?: () => number;
  /** Cartas debilitadas por un Boss: no puntúan ni activan efectos. */
  debuff?: (c: Card) => boolean;
  /** The Flint: fichas y mult base a la mitad. */
  flint?: boolean;
  /** Joker anulado por Crimson Heart. */
  disabledJoker?: number | null;
  /** Manos cuyo Planeta tienes en consumibles (Observatory). */
  planetHands?: Set<HandType>;
}

export function makeCtx(played: Card[], opts: ScoreOptions = {}): ScoreCtx {
  const { hand, scoring } = evaluateHand(played);
  return {
    handType: hand,
    played,
    scoring,
    held: opts.held ?? [],
    handsLeft: opts.handsLeft ?? 1,
    discardsLeft: opts.discardsLeft ?? 0,
    money: opts.money ?? 0,
    deckLeft: opts.deckLeft ?? 0,
    jokerCount: opts.jokers?.length ?? 0,
    handPlays: opts.handPlays ?? {},
  };
}

/**
 * Pipeline de puntuación (GDD §6), puro:
 * base → cartas que puntúan (valor, enhancement, edición, jokers; Red Seal repite) →
 * cartas en mano (Steel, jokers) → jokers (izq→der, con ediciones) → Observatory.
 */
export function scoreHand(played: Card[], opts: ScoreOptions = {}): ScoreResult {
  const ctx = makeCtx(played, opts);
  const jokers = (opts.jokers ?? []).filter((j) => j.uid !== opts.disabledJoker);
  const rng = opts.rng ?? (() => 1);
  const debuffed = opts.debuff ?? (() => false);
  const base = handStats(ctx.handType, opts.levels?.[ctx.handType] ?? 1);
  let chips = opts.flint ? Math.max(1, Math.floor(base.chips / 2)) : base.chips;
  let mult = opts.flint ? Math.max(1, Math.floor(base.mult / 2)) : base.mult;
  const events: ScoreEvent[] = [{ type: 'hand', hand: ctx.handType, chips, mult }];
  let money = 0;
  const destroyed: number[] = [];

  const push = (type: 'chips' | 'mult' | 'xmult' | 'money', value: number, source: EventSource) => {
    if (type === 'chips') chips += value;
    else if (type === 'mult') mult += value;
    else if (type === 'xmult') mult *= value;
    else money += value;
    events.push({ type, value, source, chips, mult });
  };
  const apply = (e: Effect | undefined, source: EventSource) => {
    if (!e) return;
    if (e.chips) push('chips', e.chips, source);
    if (e.mult) push('mult', e.mult, source);
    if (e.xmult && e.xmult !== 1) push('xmult', e.xmult, source);
  };

  for (const card of ctx.scoring) {
    if (debuffed(card)) continue;
    const src: EventSource = { kind: 'card', id: card.id };
    const times = card.seal === 'red' ? 2 : 1;
    for (let rep = 0; rep < times; rep++) {
      const rankChips = cardChips(card);
      if (rankChips) push('chips', rankChips, src);
      switch (card.enhancement) {
        case 'bonus': push('chips', BONUS_CHIPS, src); break;
        case 'mult': push('mult', MULT_BONUS, src); break;
        case 'stone': push('chips', STONE_CHIPS, src); break;
        case 'glass': push('xmult', GLASS_XMULT, src); break;
        case 'lucky':
          if (rng() < LUCKY_MULT_CHANCE) push('mult', LUCKY_MULT, src);
          if (rng() < LUCKY_MONEY_CHANCE) push('money', LUCKY_MONEY, src);
          break;
        default: break;
      }
      if (card.edition === 'foil') push('chips', FOIL_CHIPS, src);
      if (card.edition === 'holo') push('mult', HOLO_MULT, src);
      if (card.edition === 'poly') push('xmult', POLY_XMULT, src);
      for (const j of jokers) apply(JOKERS[j.id].onCardScored?.(j, ctx, card), { kind: 'joker', id: j.uid });
    }
    if (card.seal === 'gold') push('money', GOLD_SEAL_MONEY, src);
    if (card.enhancement === 'glass' && rng() < GLASS_BREAK_CHANCE) destroyed.push(card.id);
  }

  for (const card of ctx.held) {
    if (debuffed(card)) continue;
    if (card.enhancement === 'steel') push('xmult', STEEL_XMULT, { kind: 'card', id: card.id });
    for (const j of jokers) apply(JOKERS[j.id].onHeld?.(j, ctx, card), { kind: 'held', id: j.uid });
  }

  for (const j of jokers) {
    if (j.edition === 'foil') push('chips', FOIL_CHIPS, { kind: 'edition', id: j.uid });
    if (j.edition === 'holo') push('mult', HOLO_MULT, { kind: 'edition', id: j.uid });
    apply(JOKERS[j.id].onScore?.(j, ctx), { kind: 'joker', id: j.uid });
    if (j.edition === 'poly') push('xmult', POLY_XMULT, { kind: 'edition', id: j.uid });
  }

  if (opts.planetHands?.has(ctx.handType)) push('xmult', OBSERVATORY_XMULT, { kind: 'planet', id: 0 });

  return { hand: ctx.handType, chips, mult, total: Math.floor(chips * mult), scoring: ctx.scoring, events, money, destroyed };
}
