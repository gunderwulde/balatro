import type { HandType } from './hands';
import { EDITION_COST, JOKER_LIST, type Edition, type Rarity } from './jokers';
import { PLANETS, PLANET_COST } from './planets';
import type { Rng } from './rng';

export interface ShopItem {
  kind: 'joker' | 'planet';
  id: string;
  edition?: Edition;
  cost: number;
}

export type PackKind = 'celestial' | 'buffoon';
export interface PackOffer {
  kind: PackKind;
  cost: number;
}
export interface OpenPack {
  kind: PackKind;
  choices: ShopItem[];
}

export interface Shop {
  items: (ShopItem | null)[];
  packs: (PackOffer | null)[];
  voucher: string | null;
  rerollCost: number;
  rerolls: number;
}

export const REROLL_BASE = 5;
export const PACK_COST: Record<PackKind, number> = { celestial: 4, buffoon: 4 };
export const PACK_CHOICES: Record<PackKind, number> = { celestial: 3, buffoon: 2 };

/** ⚠ verificar. Vouchers del MVP; la lista completa llega en la Fase 5. */
export const VOUCHERS = ['overstock', 'grabber', 'wasteful', 'seed_money'] as const;
export const VOUCHER_COST = 10;

/** Probabilidades de rareza y edición. ⚠ Edición aumentada respecto al juego base para poder verla en desarrollo. */
const RARITY_ODDS: [Rarity, number][] = [['common', 0.7], ['uncommon', 0.25], ['rare', 0.05]];
export const EDITION_ODDS: [Edition, number][] = [['foil', 0.06], ['holo', 0.04], ['poly', 0.02], ['negative', 0.015]];

function rollRarity(rng: Rng): Rarity {
  let r = rng.next();
  for (const [rar, p] of RARITY_ODDS) {
    if (r < p) return rar;
    r -= p;
  }
  return 'common';
}

function rollEdition(rng: Rng): Edition | undefined {
  let r = rng.next();
  for (const [ed, p] of EDITION_ODDS) {
    if (r < p) return ed;
    r -= p;
  }
  return undefined;
}

/** Joker aleatorio sin repetir los de `exclude`. Devuelve null si no queda ninguno. */
export function rollJoker(rng: Rng, exclude: Set<string>): ShopItem | null {
  const rarity = rollRarity(rng);
  let pool = JOKER_LIST.filter((d) => d.rarity === rarity && !exclude.has(d.id));
  if (!pool.length) pool = JOKER_LIST.filter((d) => !exclude.has(d.id));
  if (!pool.length) return null;
  const def = pool[rng.int(pool.length)];
  const edition = rollEdition(rng);
  return { kind: 'joker', id: def.id, edition, cost: def.cost + (edition ? EDITION_COST[edition] : 0) };
}

export function rollPlanet(rng: Rng, handPlays: Partial<Record<HandType, number>>, exclude: Set<string>): ShopItem | null {
  const pool = PLANETS.filter((p) => (!p.secret || (handPlays[p.hand] ?? 0) > 0) && !exclude.has(p.id));
  if (!pool.length) return null;
  return { kind: 'planet', id: pool[rng.int(pool.length)].id, cost: PLANET_COST };
}

/** Casilla de tienda: 20 jokers : 4 planetas (sin Tarots hasta la Fase 5). */
export function rollShopItem(rng: Rng, handPlays: Partial<Record<HandType, number>>, taken: Set<string>): ShopItem | null {
  const wantJoker = rng.next() < 20 / 24;
  const item = wantJoker ? rollJoker(rng, taken) : rollPlanet(rng, handPlays, new Set());
  return item ?? rollJoker(rng, taken);
}

export function rollPackContents(rng: Rng, kind: PackKind, handPlays: Partial<Record<HandType, number>>, ownedJokers: Set<string>): ShopItem[] {
  const out: ShopItem[] = [];
  const taken = new Set(ownedJokers);
  const taken2 = new Set<string>();
  for (let i = 0; i < PACK_CHOICES[kind]; i++) {
    const it = kind === 'buffoon' ? rollJoker(rng, taken) : rollPlanet(rng, handPlays, taken2);
    if (!it) continue;
    (kind === 'buffoon' ? taken : taken2).add(it.id);
    out.push(it);
  }
  return out;
}
