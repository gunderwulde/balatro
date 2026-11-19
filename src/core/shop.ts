import { ENHANCEMENTS, RANKS, SEALS, SUITS, type CardEdition, type Enhancement, type Rank, type Seal, type Suit } from './cards';
import { CONSUMABLES, SPECTRALS, TAROTS, type ConsumableKind } from './consumables';
import type { HandType } from './hands';
import { EDITION_COST, JOKER_LIST, type Edition, type Rarity } from './jokers';
import { PLANETS, PLANET_COST } from './planets';
import type { Rng } from './rng';

export type ShopKind = 'joker' | ConsumableKind | 'card';

export interface CardTemplate {
  rank: Rank;
  suit: Suit;
  enhancement?: Enhancement;
  seal?: Seal;
  edition?: CardEdition;
}

export interface ShopItem {
  kind: ShopKind;
  sticker?: 'eternal' | 'perishable' | 'rental';
  id: string;
  edition?: Edition;
  cost: number;
  /** Solo para `kind: 'card'`. */
  card?: CardTemplate;
}

export type PackKind = 'arcana' | 'celestial' | 'spectral' | 'standard' | 'buffoon';
export type PackSize = 'normal' | 'jumbo' | 'mega';
export const PACK_KINDS: PackKind[] = ['arcana', 'celestial', 'spectral', 'standard', 'buffoon'];

export interface PackOffer {
  kind: PackKind;
  size: PackSize;
  cost: number;
}
export interface OpenPack {
  kind: PackKind;
  size: PackSize;
  choices: ShopItem[];
  picksLeft: number;
}

export interface Shop {
  items: (ShopItem | null)[];
  packs: (PackOffer | null)[];
  vouchers: (string | null)[];
  rerollCost: number;
  rerolls: number;
  /** Relanzamientos gratis restantes (Chaos the Clown). */
  free?: number;
}

export const REROLL_BASE = 5;
export const PACK_COST: Record<PackSize, number> = { normal: 4, jumbo: 6, mega: 8 };
/** [opciones, elecciones] por tipo y tamaño. ⚠ verificar. */
export const PACK_SHAPE: Record<PackKind, Record<PackSize, [number, number]>> = {
  arcana: { normal: [3, 1], jumbo: [5, 1], mega: [5, 2] },
  celestial: { normal: [3, 1], jumbo: [5, 1], mega: [5, 2] },
  spectral: { normal: [2, 1], jumbo: [4, 1], mega: [4, 2] },
  standard: { normal: [3, 1], jumbo: [5, 1], mega: [5, 2] },
  buffoon: { normal: [2, 1], jumbo: [4, 1], mega: [4, 2] },
};
const SIZE_ODDS: [PackSize, number][] = [['normal', 0.6], ['jumbo', 0.3], ['mega', 0.1]];

/** Probabilidades de rareza y edición. ⚠ Edición aumentada respecto al juego base para poder verla en desarrollo. */
const RARITY_ODDS: [Rarity, number][] = [['common', 0.7], ['uncommon', 0.25], ['rare', 0.05]];
export const EDITION_ODDS: [Edition, number][] = [['foil', 0.06], ['holo', 0.04], ['poly', 0.02], ['negative', 0.015]];

/** Contexto de la run que afecta a lo que ofrece la tienda. */
export interface RollCtx {
  handPlays: Partial<Record<HandType, number>>;
  vouchers: Set<string>;
  ownedJokers: Set<string>;
  /** Ghost Deck: aparecen Spectrals en la tienda. */
  spectralShop?: boolean;
  /** Stake actual (1-8): decide los stickers. */
  stake?: number;
}

export function priceMul(vouchers: Set<string>): number {
  return vouchers.has('liquidation') ? 0.5 : vouchers.has('clearance_sale') ? 0.75 : 1;
}
const price = (base: number, v: Set<string>) => Math.max(1, Math.round(base * priceMul(v)));
const editionMul = (v: Set<string>) => (v.has('glow_up') ? 4 : v.has('hone') ? 2 : 1);

function rollRarity(rng: Rng): Rarity {
  let r = rng.next();
  for (const [rar, p] of RARITY_ODDS) {
    if (r < p) return rar;
    r -= p;
  }
  return 'common';
}

function rollEdition(rng: Rng, mul = 1): Edition | undefined {
  let r = rng.next();
  for (const [ed, p] of EDITION_ODDS) {
    const q = ed === 'negative' ? p : p * mul;
    if (r < q) return ed;
    r -= q;
  }
  return undefined;
}

/** Joker aleatorio (sin repetir `exclude`); `opts` fija rareza/edición (Tags) o ignora el descuento. */
export function rollJoker(
  rng: Rng,
  exclude: Set<string>,
  vouchers: Set<string> = new Set(),
  opts: { rarity?: Rarity; edition?: Edition; noLegendary?: boolean; stake?: number } = {},
): ShopItem | null {
  const rarity = opts.rarity ?? rollRarity(rng);
  let pool = JOKER_LIST.filter((d) => d.rarity === rarity && !exclude.has(d.id));
  if (!pool.length) pool = JOKER_LIST.filter((d) => d.rarity !== 'legendary' && !exclude.has(d.id));
  if (!pool.length) return null;
  const def = pool[rng.int(pool.length)];
  const edition = opts.edition ?? rollEdition(rng, editionMul(vouchers));
  const item: ShopItem = { kind: 'joker', id: def.id, edition, cost: price(def.cost + (edition ? EDITION_COST[edition] : 0), vouchers) };
  const stake = opts.stake ?? 1;
  if (stake >= 4) {
    // Stickers (30 %): Eternal (Stake 4+), Perishable (7+), Rental (8+).
    const kinds: NonNullable<ShopItem['sticker']>[] = ['eternal'];
    if (stake >= 7) kinds.push('perishable');
    if (stake >= 8) kinds.push('rental');
    if (rng.next() < 0.3) {
      item.sticker = kinds[rng.int(kinds.length)];
      if (item.sticker === 'rental') item.cost = 1;
    }
  }
  return item;
}

export function legendaryJokerId(rng: Rng, exclude: Set<string>): string | null {
  const pool = JOKER_LIST.filter((d) => d.rarity === 'legendary' && !exclude.has(d.id));
  return pool.length ? pool[rng.int(pool.length)].id : null;
}

export function rollPlanet(rng: Rng, handPlays: Partial<Record<HandType, number>>, exclude: Set<string>, vouchers: Set<string> = new Set()): ShopItem | null {
  const pool = PLANETS.filter((p) => (!p.secret || (handPlays[p.hand] ?? 0) > 0) && !exclude.has(p.id));
  if (!pool.length) return null;
  return { kind: 'planet', id: pool[rng.int(pool.length)].id, cost: price(PLANET_COST, vouchers) };
}

export function rollTarot(rng: Rng, exclude: Set<string>, vouchers: Set<string> = new Set()): ShopItem | null {
  const pool = TAROTS.filter((c) => !exclude.has(c.id));
  if (!pool.length) return null;
  const def = pool[rng.int(pool.length)];
  return { kind: 'tarot', id: def.id, cost: price(def.cost, vouchers) };
}

export function rollSpectral(rng: Rng, exclude: Set<string>, vouchers: Set<string> = new Set()): ShopItem | null {
  const pool = SPECTRALS.filter((c) => !exclude.has(c.id));
  if (!pool.length) return null;
  const def = pool[rng.int(pool.length)];
  return { kind: 'spectral', id: def.id, cost: price(def.cost, vouchers) };
}

export function rollCardTemplate(rng: Rng, enhanced: boolean): CardTemplate {
  const card: CardTemplate = { rank: RANKS[rng.int(RANKS.length)], suit: SUITS[rng.int(SUITS.length)] };
  if (enhanced) {
    if (rng.next() < 0.4) card.enhancement = ENHANCEMENTS[rng.int(ENHANCEMENTS.length)];
    if (rng.next() < 0.12) card.edition = (['foil', 'holo', 'poly'] as const)[rng.int(3)];
    if (rng.next() < 0.2) card.seal = SEALS[rng.int(SEALS.length)];
  }
  return card;
}

function rollPlayingCard(rng: Rng, vouchers: Set<string>, enhanced: boolean): ShopItem {
  const card = rollCardTemplate(rng, enhanced);
  return { kind: 'card', id: `card_${card.rank}${card.suit}`, cost: price(1, vouchers), card };
}

/** Casilla de tienda: jokers 20, tarots 4, planetas 4 (+ Merchants/Tycoon) y cartas con Magic Trick. */
export function rollShopItem(rng: Rng, ctx: RollCtx, taken: Set<string>): ShopItem | null {
  const v = ctx.vouchers;
  const tarotW = 4 * (v.has('tarot_tycoon') ? 8 : v.has('tarot_merchant') ? 2.4 : 1);
  const planetW = 4 * (v.has('planet_tycoon') ? 8 : v.has('planet_merchant') ? 2.4 : 1);
  const cardW = v.has('magic_trick') || v.has('illusion') ? 4 : 0;
  const weights: [ShopKind, number][] = [['joker', 20], ['tarot', tarotW], ['planet', planetW], ['card', cardW], ['spectral', ctx.spectralShop ? 2 : 0]];
  let r = rng.next() * weights.reduce((n, [, w]) => n + w, 0);
  let kind: ShopKind = 'joker';
  for (const [k, w] of weights) {
    if (r < w) { kind = k; break; }
    r -= w;
  }
  let item: ShopItem | null = null;
  if (kind === 'joker') item = rollJoker(rng, taken, v, { stake: ctx.stake });
  else if (kind === 'spectral') item = rollSpectral(rng, new Set(), v);
  else if (kind === 'tarot') item = rollTarot(rng, new Set(), v);
  else if (kind === 'planet') item = rollPlanet(rng, ctx.handPlays, new Set(), v);
  else item = rollPlayingCard(rng, v, v.has('illusion'));
  return item ?? rollJoker(rng, taken, v, { stake: ctx.stake });
}

export function rollPackOffer(rng: Rng): PackOffer {
  const kind = PACK_KINDS[rng.int(PACK_KINDS.length)];
  let r = rng.next();
  let size: PackSize = 'normal';
  for (const [s, p] of SIZE_ODDS) {
    if (r < p) { size = s; break; }
    r -= p;
  }
  return { kind, size, cost: PACK_COST[size] };
}

export function openPackOf(rng: Rng, offer: { kind: PackKind; size: PackSize }, ctx: RollCtx): OpenPack {
  const [n, picks] = PACK_SHAPE[offer.kind][offer.size];
  const v = new Set(ctx.vouchers);
  const free = new Set<string>(); // en los packs el precio no importa
  const taken = new Set(ctx.ownedJokers);
  const choices: ShopItem[] = [];
  for (let i = 0; i < n; i++) {
    let it: ShopItem | null = null;
    switch (offer.kind) {
      case 'arcana':
        it = ctx.vouchers.has('omen_globe') && rng.next() < 0.2 ? rollSpectral(rng, free, v) : rollTarot(rng, free, v);
        break;
      case 'celestial': {
        const best = (Object.entries(ctx.handPlays) as [HandType, number][]).sort((a, b) => b[1] - a[1])[0]?.[0];
        const favourite = PLANETS.find((p) => p.hand === best);
        it = i === 0 && ctx.vouchers.has('telescope') && favourite
          ? { kind: 'planet', id: favourite.id, cost: PLANET_COST }
          : rollPlanet(rng, ctx.handPlays, free, v);
        break;
      }
      case 'spectral': it = rollSpectral(rng, free, v); break;
      case 'standard': it = rollPlayingCard(rng, v, true); break;
      case 'buffoon': it = rollJoker(rng, taken, v, { stake: ctx.stake }); break;
    }
    if (!it) continue;
    if (it.kind === 'joker') taken.add(it.id);
    else if (it.kind !== 'card') free.add(it.id);
    choices.push(it);
  }
  return { kind: offer.kind, size: offer.size, choices, picksLeft: Math.min(picks, choices.length) };
}

/** Coste base de un consumible (para ventas y precios). */
export function consumableCost(id: string): number {
  return CONSUMABLES[id]?.cost ?? 3;
}
