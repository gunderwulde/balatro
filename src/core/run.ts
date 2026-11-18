import { cardIsSuit, createDeck, isFaceCard, shuffle, type Card } from './cards';
import {
  BASE_CONSUMABLE_SLOTS, CONSUMABLES, type ConsumableInstance, type ConsumableKind,
} from './consumables';
import { pickBoss, type BossDef } from './bosses';
import { applyConsumable, type EffectHost } from './effects';
import { evaluateHand, type HandType } from './hands';
import { EDITION_COST, JOKERS, sellValue, type Edition, type JokerInstance } from './jokers';
import { PLANET_BY_ID, PLANETS } from './planets';
import { Rng } from './rng';
import { makeCtx, scoreHand, type ScoreOptions, type ScoreResult } from './scoring';
import {
  REROLL_BASE, openPackOf, rollJoker, rollPackOffer, rollShopItem,
  type CardTemplate, type OpenPack, type RollCtx, type Shop, type ShopItem,
} from './shop';
import { rollTag, TAGS } from './tags';
import { VOUCHER_COST, availableVouchers } from './vouchers';

export type Phase = 'blind_select' | 'playing' | 'cashout' | 'shop' | 'won' | 'lost';
export type BlindKind = 'small' | 'big' | 'boss';
export const BLINDS: BlindKind[] = ['small', 'big', 'boss'];

/** ⚠ verificar (GDD §3): objetivo base por Ante (stake blanco). */
export const ANTE_BASE = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
const BLIND_MULT: Record<BlindKind, number> = { small: 1, big: 1.5, boss: 2 };
export const BLIND_REWARD: Record<BlindKind, number> = { small: 3, big: 4, boss: 5 };
export const MAX_ANTE = 8;
export const MAX_SELECT = 5;
export const BASE_JOKER_SLOTS = 5;
const INTEREST_STEP = 5;

export interface Cashout {
  blindReward: number;
  handsBonus: number;
  interest: number;
  jokerBonus: number;
  /** Cartas Gold en mano. */
  heldBonus: number;
  /** Tags (Investment). */
  tagBonus: number;
  total: number;
}

export interface PlayResult {
  score: ScoreResult;
  cleared: boolean;
  lost: boolean;
}

/** `bossMult` sustituye al ×2 del Boss (The Wall ×4, The Needle ×1…). */
export function blindTarget(ante: number, kind: BlindKind, bossMult = BLIND_MULT.boss): number {
  const base = ANTE_BASE[Math.min(ante, MAX_ANTE) - 1];
  return Math.round(base * (kind === 'boss' ? bossMult : BLIND_MULT[kind]));
}

export function computeCashout(kind: BlindKind, handsLeft: number, money: number, jokerBonus = 0, interestCap = 5): Cashout {
  const blindReward = BLIND_REWARD[kind];
  const handsBonus = handsLeft;
  const interest = Math.max(0, Math.min(interestCap, Math.floor(money / INTEREST_STEP)));
  return { blindReward, handsBonus, interest, jokerBonus, heldBonus: 0, tagBonus: 0, total: blindReward + handsBonus + interest + jokerBonus };
}

/** Máquina de estados de una run. Sin dependencias de render ni DOM. */
export class Run implements EffectHost {
  phase: Phase = 'blind_select';
  ante = 1;
  blindIndex = 0;
  money = 4;
  maxHands = 4;
  maxDiscards = 4;
  baseHandSize = 8;
  handSizePenalty = 0;
  handsLeft = 0;
  discardsLeft = 0;
  score = 0;
  skipped = 0;
  hand: Card[] = [];
  drawPile: Card[] = [];
  discardPile: Card[] = [];
  levels: Partial<Record<HandType, number>> = {};
  handPlays: Partial<Record<HandType, number>> = {};
  jokers: JokerInstance[] = [];
  consumables: ConsumableInstance[] = [];
  vouchers = new Set<string>();
  tags: string[] = [];
  lastConsumed: { kind: ConsumableKind; id: string } | null = null;
  /** Aviso de la última acción (clave i18n), p. ej. `wheel_nope`. */
  message: string | null = null;
  shop: Shop | null = null;
  openPack: OpenPack | null = null;
  cashout: Cashout | null = null;
  /** Joker anulado esta mano (Crimson Heart). */
  disabledJoker: number | null = null;
  /** Tipos de mano jugados en esta ronda (Eye, Mouth). */
  roundHandTypes: HandType[] = [];
  readonly fullDeck: Card[];
  private rng: Rng;
  private scoreRng: Rng;
  private nextUid = 1;
  private nextCardId = 1000;
  private rngCount = 0;
  private shopCount = 0;
  private bossByAnte = new Map<number, BossDef>();
  private bossRerolls = new Map<number, number>();
  private seenBosses = new Set<string>();
  private bossRerollsThisAnte = 0;
  private bossDisabled = false;
  private playedThisAnte = new Set<number>();
  private totalHandsPlayed = 0;
  private totalUnusedDiscards = 0;
  private roundHandSizeBonus = 0;

  constructor(readonly seed: string) {
    this.rng = new Rng(seed);
    this.scoreRng = new Rng(`${seed}:score`);
    this.fullDeck = createDeck();
  }

  // ---------- Derivados ----------

  get blind(): BlindKind {
    return BLINDS[this.blindIndex];
  }

  /** Boss del Ante actual (se decide de forma determinista por semilla). */
  get boss(): BossDef {
    let b = this.bossByAnte.get(this.ante);
    if (!b) {
      b = pickBoss(new Rng(`${this.seed}:boss:${this.ante}:0`), this.ante, this.seenBosses);
      this.bossByAnte.set(this.ante, b);
      this.seenBosses.add(b.id);
    }
    return b;
  }

  /** Boss cuyo efecto está activo ahora (null si no es la ciega Boss o está anulado por Chicot/Verdant Leaf). */
  get activeBoss(): BossDef | null {
    if (this.blind !== 'boss' || this.bossDisabled) return null;
    if (this.jokers.some((j) => JOKERS[j.id].disablesBoss)) return null;
    return this.boss;
  }

  get target(): number {
    return blindTarget(this.ante, this.blind, this.boss.mult);
  }

  get jokerSlots(): number {
    return BASE_JOKER_SLOTS + this.jokers.filter((j) => j.edition === 'negative').length + (this.vouchers.has('antimatter') ? 1 : 0);
  }

  get consumableSlots(): number {
    return BASE_CONSUMABLE_SLOTS + this.consumables.filter((c) => c.edition === 'negative').length + (this.vouchers.has('crystal_ball') ? 1 : 0);
  }

  get handSize(): number {
    return this.baseHandSize + this.passive('handSize') + this.roundHandSizeBonus - this.handSizePenalty - (this.activeBoss?.handSizeMinus ?? 0);
  }

  get interestCap(): number {
    return this.vouchers.has('money_tree') ? 20 : this.vouchers.has('seed_money') ? 10 : 5;
  }

  /** Tag que se obtiene al saltar la ciega actual (null para el Boss). */
  get offeredTag(): string | null {
    if (this.blind === 'boss') return null;
    return rollTag(new Rng(`${this.seed}:tag:${this.ante}:${this.blind}`));
  }

  private passive(key: 'handSize' | 'hands' | 'discards'): number {
    return this.jokers.reduce((n, j) => n + (JOKERS[j.id].passive?.[key] ?? 0), 0);
  }

  consumableSpace(): number {
    return Math.max(0, this.consumableSlots - this.consumables.length);
  }

  jokerSpace(): number {
    return Math.max(0, this.jokerSlots - this.jokers.length);
  }

  rngFor(tag: string): Rng {
    return new Rng(`${this.seed}:${tag}:${this.rngCount++}`);
  }

  // ---------- Ciega ----------

  selectBlind(): void {
    this.expect('blind_select');
    this.phase = 'playing';
    this.score = 0;
    this.bossDisabled = false;
    this.roundHandTypes = [];
    this.roundHandSizeBonus = 3 * this.consumeTags((t) => t === 'juggle');
    const boss = this.activeBoss;
    this.handsLeft = boss?.singleHand ? 1 : this.maxHands + this.passive('hands');
    this.discardsLeft = boss?.noDiscards ? 0 : this.maxDiscards + this.passive('discards');
    if (boss?.shuffleJokers) this.jokers = shuffle(this.jokers, this.rngFor('amber'));
    this.drawPile = shuffle(this.fullDeck, this.rng);
    this.discardPile = [];
    this.hand = [];
    this.draw();
    this.rollDisabledJoker();
  }

  /** Salta Small/Big y recibe su Tag. El Boss no se puede saltar. */
  skipBlind(): void {
    this.expect('blind_select');
    if (this.blind === 'boss') throw new Error('El Boss no se puede saltar');
    const tag = this.offeredTag!;
    this.skipped++;
    this.gainTag(tag);
    this.nextBlind();
  }

  /** Relanza el Boss del Ante (Director's Cut: $10 una vez por Ante; Retcon: $10 sin límite). */
  rerollBoss(): void {
    this.expect('blind_select');
    if (this.blind !== 'boss') throw new Error('Solo se puede relanzar la ciega Boss');
    const retcon = this.vouchers.has('retcon');
    if (!retcon && !this.vouchers.has('directors_cut')) throw new Error('Necesitas Director\'s Cut');
    if (!retcon && this.bossRerollsThisAnte >= 1) throw new Error('Ya relanzaste el Boss este Ante');
    this.spend(10);
    this.bossRerollsThisAnte++;
    this.rerollBossFree();
  }

  private rerollBossFree() {
    const current = this.boss;
    const n = (this.bossRerolls.get(this.ante) ?? 0) + 1;
    this.bossRerolls.set(this.ante, n);
    const b = pickBoss(new Rng(`${this.seed}:boss:${this.ante}:${n}`), this.ante, this.seenBosses, current.id);
    this.bossByAnte.set(this.ante, b);
    this.seenBosses.add(b.id);
  }

  // ---------- Puntuación ----------

  isDebuffed(c: Card): boolean {
    const b = this.activeBoss;
    if (!b) return false;
    if (b.debuffAll) return true;
    if (b.debuffSuit && cardIsSuit(c, b.debuffSuit)) return true;
    if (b.debuffFace && isFaceCard(c)) return true;
    return !!b.debuffPlayed && this.playedThisAnte.has(c.id);
  }

  /** Motivo por el que el Boss impide jugar estas cartas (null si se puede). */
  playError(cards: Card[]): string | null {
    const b = this.activeBoss;
    if (!b || !cards.length) return null;
    if (b.mustPlayFive && cards.length !== 5) return 'boss_five';
    const type = evaluateHand(cards).hand;
    if (b.noRepeatHand && this.roundHandTypes.includes(type)) return 'boss_repeat';
    if (b.singleHandType && this.roundHandTypes.length && this.roundHandTypes[0] !== type) return 'boss_single';
    return null;
  }

  /** Puntuación que tendría jugar estas cartas ahora (sin modificar nada ni consumir azar). */
  preview(cards: Card[]): ScoreResult {
    return scoreHand(cards, this.scoreOptions(cards));
  }

  private scoreOptions(played: Card[], rng?: () => number): ScoreOptions {
    const ids = new Set(played.map((c) => c.id));
    const boss = this.activeBoss;
    return {
      levels: this.levels,
      jokers: this.jokers,
      held: this.hand.filter((c) => !ids.has(c.id)),
      handsLeft: this.handsLeft,
      discardsLeft: this.discardsLeft,
      money: this.money,
      deckLeft: this.drawPile.length,
      handPlays: this.handPlays,
      rng,
      debuff: boss ? (c) => this.isDebuffed(c) : undefined,
      flint: !!boss?.flint,
      disabledJoker: this.disabledJoker,
      planetHands: this.vouchers.has('observatory')
        ? new Set(this.consumables.filter((c) => c.kind === 'planet').map((c) => PLANET_BY_ID[c.id].hand))
        : undefined,
    };
  }

  play(ids: number[]): PlayResult {
    this.expect('playing');
    if (this.handsLeft <= 0) throw new Error('Sin manos');
    const cards = this.pick(ids);
    const err = this.playError(cards);
    if (err) throw new Error(err);
    // La puntuación se calcula con el estado previo a la jugada.
    const opts = this.scoreOptions(cards, () => this.scoreRng.next());
    const score = scoreHand(cards, opts);
    const ctx = makeCtx(cards, opts);
    const boss = this.activeBoss;
    const held = opts.held ?? [];
    this.take(ids);
    this.score += score.total;
    this.money += score.money;
    this.handsLeft--;
    this.totalHandsPlayed++;
    for (const c of cards) this.playedThisAnte.add(c.id);
    this.destroyCards(score.destroyed, false);
    this.discardPile.push(...cards.filter((c) => !score.destroyed.includes(c.id)));
    for (const j of this.jokers) JOKERS[j.id].onHandPlayed?.(j, ctx);
    this.handPlays[score.hand] = (this.handPlays[score.hand] ?? 0) + 1;
    this.roundHandTypes.push(score.hand);

    if (boss?.toothMoney) this.money -= cards.length;
    if (boss?.ox && (this.handPlays[score.hand] ?? 0) >= Math.max(...Object.values(this.handPlays) as number[])) this.money = 0;
    if (boss?.arm) this.levels[score.hand] = Math.max(1, (this.levels[score.hand] ?? 1) - 1);

    if (this.score >= this.target) {
      this.clearRound(score.hand, held);
      return { score, cleared: true, lost: false };
    }
    if (this.handsLeft === 0) {
      this.phase = 'lost';
      return { score, cleared: false, lost: true };
    }
    if (boss?.hook) {
      const pool = [...this.hand];
      for (let i = 0; i < 2 && pool.length; i++) {
        const [c] = pool.splice(this.rngFor('hook').int(pool.length), 1);
        this.take([c.id]);
        this.discardPile.push(c);
      }
    }
    this.draw(boss?.serpent ? 3 : undefined);
    this.rollDisabledJoker();
    return { score, cleared: false, lost: false };
  }

  discard(ids: number[]): void {
    this.expect('playing');
    if (this.discardsLeft <= 0) throw new Error('Sin descartes');
    const cards = this.pick(ids);
    this.take(ids);
    this.discardsLeft--;
    this.discardPile.push(...cards);
    for (const j of this.jokers) JOKERS[j.id].onDiscard?.(j);
    // Sello púrpura: crea un Tarot al descartar.
    for (const c of cards) {
      if (c.seal === 'purple' && this.consumableSpace() > 0) {
        const tarots = Object.values(CONSUMABLES).filter((d) => d.kind === 'tarot');
        this.addConsumable('tarot', tarots[this.rngFor('purple').int(tarots.length)].id);
      }
    }
    this.draw(this.activeBoss?.serpent ? 3 : undefined);
  }

  private clearRound(lastHand: HandType, held: Card[]) {
    const jokerBonus = this.jokers.reduce((n, j) => n + (JOKERS[j.id].roundEndMoney?.(j) ?? 0), 0);
    const cash = computeCashout(this.blind, this.handsLeft, this.money, jokerBonus, this.interestCap);
    cash.heldBonus = 3 * held.filter((c) => c.enhancement === 'gold').length;
    if (this.blind === 'boss') cash.tagBonus = 25 * this.consumeTags((t) => t === 'investment');
    cash.total += cash.heldBonus + cash.tagBonus;
    this.totalUnusedDiscards += this.discardsLeft;
    // Sello azul en mano: Planeta de la última mano jugada.
    const planet = PLANETS.find((p) => p.hand === lastHand);
    for (const c of held) if (c.seal === 'blue' && planet && this.consumableSpace() > 0) this.addConsumable('planet', planet.id);
    this.cashout = cash;
    this.phase = 'cashout';
  }

  /** Cobra la recompensa; tras el Boss del Ante 8 se gana, si no se abre la tienda. */
  collectCashout(): void {
    this.expect('cashout');
    this.money += this.cashout!.total;
    this.cashout = null;
    if (this.blind === 'boss' && this.ante >= MAX_ANTE) {
      this.phase = 'won';
      return;
    }
    this.openShop();
  }

  // ---------- Consumibles ----------

  /** Usa un Tarot/Planeta/Spectral. `cardIds` son cartas de la mano (si el consumible las necesita). */
  useConsumable(uid: number, cardIds: number[] = []): void {
    if (!['playing', 'shop', 'blind_select'].includes(this.phase)) throw new Error('No puedes usar consumibles ahora');
    const idx = this.consumables.findIndex((c) => c.uid === uid);
    if (idx < 0) throw new Error('Consumible no encontrado');
    const inst = this.consumables[idx];
    const def = CONSUMABLES[inst.id];
    if (def.needsHand && this.phase !== 'playing') throw new Error('Solo se puede usar durante una ronda');
    if (new Set(cardIds).size !== cardIds.length) throw new Error('Cartas repetidas');
    if (cardIds.length < def.min || cardIds.length > def.max) {
      throw new Error(def.min === def.max ? `Selecciona ${def.min} carta(s)` : `Selecciona entre ${def.min} y ${def.max} cartas`);
    }
    const cards = this.hand.filter((c) => cardIds.includes(c.id));
    if (cards.length !== cardIds.length) throw new Error('Carta fuera de la mano');
    this.message = null;
    this.consumables.splice(idx, 1);
    try {
      applyConsumable(this, inst.id, cards);
    } catch (e) {
      this.consumables.splice(idx, 0, inst);
      throw e;
    }
    if (inst.kind !== 'spectral' && inst.id !== 'fool') this.lastConsumed = { kind: inst.kind, id: inst.id };
  }

  sellConsumable(uid: number): void {
    if (this.phase === 'won' || this.phase === 'lost') throw new Error('Run terminada');
    const i = this.consumables.findIndex((c) => c.uid === uid);
    if (i < 0) throw new Error('Consumible no encontrado');
    this.money += Math.max(1, Math.floor(this.consumables[i].cost / 2));
    this.consumables.splice(i, 1);
  }

  // ---------- Tags ----------

  private gainTag(id: string) {
    const copies = this.tags.includes('double') && id !== 'double' ? 2 : 1;
    if (copies === 2) this.tags.splice(this.tags.indexOf('double'), 1);
    for (let i = 0; i < copies; i++) {
      const def = TAGS[id];
      if (def.trigger !== 'instant') {
        this.tags.push(id);
        continue;
      }
      if (id === 'economy') this.money += Math.min(Math.max(0, this.money), 40);
      else if (id === 'handy') this.money += this.totalHandsPlayed;
      else if (id === 'garbage') this.money += this.totalUnusedDiscards;
      else if (id === 'speed') this.money += 5 * this.skipped;
      else if (id === 'boss') this.rerollBossFree();
    }
  }

  /** Quita (y cuenta) los tags que cumplen el predicado. */
  private consumeTags(match: (id: string) => boolean): number {
    const before = this.tags.length;
    this.tags = this.tags.filter((t) => !match(t));
    return before - this.tags.length;
  }

  // ---------- Tienda ----------

  private rollCtx(): RollCtx {
    return { handPlays: this.handPlays, vouchers: this.vouchers, ownedJokers: new Set(this.jokers.map((j) => j.id)) };
  }

  private get shopSlots(): number {
    return 2 + (this.vouchers.has('overstock') ? 1 : 0) + (this.vouchers.has('overstock_plus') ? 1 : 0);
  }

  private baseRerollCost(): number {
    return Math.max(0, REROLL_BASE - (this.vouchers.has('reroll_surplus') ? 2 : 0) - (this.vouchers.has('reroll_glut') ? 2 : 0));
  }

  private openShop() {
    this.phase = 'shop';
    this.shopCount++;
    const d6 = this.consumeTags((t) => t === 'd6') > 0;
    this.shop = { items: [], packs: [], vouchers: [], rerollCost: d6 ? 0 : this.baseRerollCost(), rerolls: 0 };
    this.fillShopItems();
    const prng = this.shopRng('packs');
    this.shop.packs = [rollPackOffer(prng), rollPackOffer(prng)];
    const free = this.consumeTags((t) => t === 'coupon') > 0;
    if (free) {
      for (const it of this.shop.items) if (it) it.cost = 0;
      for (const p of this.shop.packs) if (p) p.cost = 0;
    }
    this.pickShopVouchers(1 + this.consumeTags((t) => t === 'voucher'));
    // Tags que dan packs o jokers gratuitos.
    for (const id of [...this.tags]) {
      const def = TAGS[id];
      if (def.trigger !== 'shop') continue;
      if (def.freePack) this.shop.packs.push({ kind: def.freePack.kind, size: def.freePack.size, cost: 0 });
      if (def.freeJoker) {
        const j = rollJoker(this.shopRng(`tag${id}`), new Set(this.jokers.map((x) => x.id)), this.vouchers, def.freeJoker);
        if (j) this.shop.items.push({ ...j, cost: 0 });
      }
    }
    this.consumeTags((t) => TAGS[t].trigger === 'shop');
  }

  private pickShopVouchers(n: number) {
    const rng = this.shopRng('voucher');
    const left = availableVouchers(this.vouchers);
    for (let i = 0; i < n && left.length; i++) this.shop!.vouchers.push(left.splice(rng.int(left.length), 1)[0]);
  }

  private shopRng(tag: string): Rng {
    return new Rng(`${this.seed}:shop${this.shopCount}:${tag}:${this.shop?.rerolls ?? 0}`);
  }

  private fillShopItems() {
    const rng = this.shopRng('items');
    const taken = new Set(this.jokers.map((j) => j.id));
    this.shop!.items = [];
    for (let i = 0; i < this.shopSlots; i++) {
      const it = rollShopItem(rng, this.rollCtx(), taken);
      if (it?.kind === 'joker') taken.add(it.id);
      this.shop!.items.push(it);
    }
  }

  reroll(): void {
    this.expectShop();
    const s = this.shop!;
    this.spend(s.rerollCost);
    s.rerolls++;
    s.rerollCost++;
    this.fillShopItems();
  }

  buy(index: number): void {
    this.expectShop();
    const item = this.shop!.items[index];
    if (!item) throw new Error('Casilla vacía');
    this.assertRoom(item);
    this.spend(item.cost);
    this.shop!.items[index] = null;
    this.gain(item);
  }

  buyPack(index: number): void {
    this.expectShop();
    const pack = this.shop!.packs[index];
    if (!pack) throw new Error('Pack no disponible');
    if (this.openPack) throw new Error('Ya hay un pack abierto');
    this.spend(pack.cost);
    this.shop!.packs[index] = null;
    this.openPack = openPackOf(this.shopRng(`pack${index}`), pack, this.rollCtx());
  }

  /** Elige una carta del pack abierto (gratis). Los Mega permiten elegir dos. */
  pickFromPack(index: number): void {
    this.expectShop();
    const pack = this.openPack;
    if (!pack) throw new Error('No hay pack abierto');
    const item = pack.choices[index];
    if (!item) throw new Error('Opción inválida');
    this.assertRoom(item);
    this.gain(item);
    pack.choices.splice(index, 1);
    pack.picksLeft--;
    if (pack.picksLeft <= 0 || !pack.choices.length) this.openPack = null;
  }

  skipPack(): void {
    this.expectShop();
    this.openPack = null;
  }

  buyVoucher(index = 0): void {
    this.expectShop();
    const v = this.shop!.vouchers[index];
    if (!v) throw new Error('Sin voucher');
    this.spend(VOUCHER_COST);
    this.vouchers.add(v);
    this.shop!.vouchers[index] = null;
    this.applyVoucher(v);
  }

  private applyVoucher(v: string) {
    const s = this.shop!;
    switch (v) {
      case 'grabber': case 'nacho_tong': this.maxHands++; break;
      case 'wasteful': case 'recyclomancy': this.maxDiscards++; break;
      case 'paint_brush': case 'palette': this.baseHandSize++; break;
      case 'hieroglyph': this.ante = Math.max(1, this.ante - 1); this.maxHands = Math.max(1, this.maxHands - 1); break;
      case 'petroglyph': this.ante = Math.max(1, this.ante - 1); this.maxDiscards = Math.max(0, this.maxDiscards - 1); break;
      case 'reroll_surplus': case 'reroll_glut': s.rerollCost = Math.max(0, s.rerollCost - 2); break;
      case 'overstock': case 'overstock_plus': {
        const taken = new Set([...this.jokers.map((j) => j.id), ...s.items.flatMap((i) => (i?.kind === 'joker' ? [i.id] : []))]);
        s.items.push(rollShopItem(this.shopRng(`overstock${v}`), this.rollCtx(), taken));
        break;
      }
      case 'clearance_sale': case 'liquidation': {
        const mul = v === 'liquidation' ? 0.5 / 0.75 : 0.75;
        for (const it of s.items) if (it) it.cost = it.cost ? Math.max(1, Math.round(it.cost * mul)) : 0;
        for (const p of s.packs) if (p) p.cost = p.cost ? Math.max(1, Math.round(p.cost * mul)) : 0;
        break;
      }
      default: break;
    }
  }

  leaveShop(): void {
    this.expectShop();
    if (this.openPack) throw new Error('Termina de elegir el pack');
    this.shop = null;
    this.nextBlind();
  }

  sellJoker(uid: number): void {
    if (this.phase === 'won' || this.phase === 'lost') throw new Error('Run terminada');
    const i = this.jokers.findIndex((j) => j.uid === uid);
    if (i < 0) throw new Error('Joker no encontrado');
    this.money += sellValue(this.jokers[i]);
    this.jokers.splice(i, 1);
    // Verdant Leaf: vender un joker levanta el efecto.
    if (this.phase === 'playing' && this.activeBoss?.debuffAll) this.bossDisabled = true;
  }

  /** Reordena la mano (arrastre). Debe contener exactamente las mismas cartas. */
  reorderHand(ids: number[]): void {
    this.expect('playing');
    const same = ids.length === this.hand.length && this.hand.every((c) => ids.includes(c.id)) && new Set(ids).size === ids.length;
    if (!same) throw new Error('Orden de mano inválido');
    this.hand = ids.map((id) => this.hand.find((c) => c.id === id)!);
  }

  /** Ordena la mano por rango (mayor primero) o por palo. */
  sortHand(mode: 'rank' | 'suit'): void {
    this.expect('playing');
    const suitOrder = { S: 0, H: 1, C: 2, D: 3 } as const;
    this.hand.sort((a, b) =>
      mode === 'rank'
        ? b.rank - a.rank || suitOrder[a.suit] - suitOrder[b.suit]
        : suitOrder[a.suit] - suitOrder[b.suit] || b.rank - a.rank,
    );
  }

  moveJoker(from: number, to: number): void {
    if (from < 0 || from >= this.jokers.length || to < 0 || to >= this.jokers.length) throw new Error('Posición inválida');
    const [j] = this.jokers.splice(from, 1);
    this.jokers.splice(to, 0, j);
  }

  // ---------- API para efectos (EffectHost) ----------

  addConsumable(kind: ConsumableKind, id: string, edition?: 'negative'): void {
    this.consumables.push({ uid: this.nextUid++, id, kind, edition, cost: CONSUMABLES[id].cost });
  }

  addJoker(id: string, edition?: Edition): JokerInstance {
    const j: JokerInstance = { uid: this.nextUid++, id, edition, cost: JOKERS[id].cost + (edition ? EDITION_COST[edition] : 0), state: {} };
    this.jokers.push(j);
    return j;
  }

  removeJokers(uids: number[]): void {
    this.jokers = this.jokers.filter((j) => !uids.includes(j.uid));
  }

  /** Elimina cartas de la partida (mano, mazo y descarte). */
  destroyCards(ids: number[], fromHand = true): void {
    if (!ids.length) return;
    const gone = new Set(ids);
    const keep = (c: Card) => !gone.has(c.id);
    if (fromHand) this.hand = this.hand.filter(keep);
    this.drawPile = this.drawPile.filter(keep);
    this.discardPile = this.discardPile.filter(keep);
    const rest = this.fullDeck.filter(keep);
    this.fullDeck.length = 0;
    this.fullDeck.push(...rest);
  }

  addCard(t: CardTemplate, toHand: boolean): Card {
    const card: Card = { id: this.nextCardId++, rank: t.rank, suit: t.suit };
    if (t.enhancement) card.enhancement = t.enhancement;
    if (t.seal) card.seal = t.seal;
    if (t.edition) card.edition = t.edition;
    this.fullDeck.push(card);
    if (toHand && this.phase === 'playing') this.hand.push(card);
    else if (this.phase === 'playing') this.drawPile.push(card);
    return card;
  }

  levelUp(hand: HandType): void {
    this.levels[hand] = (this.levels[hand] ?? 1) + 1;
  }

  // ---------- Internos ----------

  private gain(item: ShopItem) {
    switch (item.kind) {
      case 'joker': this.addJoker(item.id, item.edition).cost = item.cost || JOKERS[item.id].cost; break;
      case 'card': this.addCard(item.card!, false); break;
      default: this.addConsumable(item.kind, item.id, item.edition === 'negative' ? 'negative' : undefined);
    }
  }

  private assertRoom(item: ShopItem) {
    if (item.kind === 'joker') {
      if (this.jokers.length >= this.jokerSlots && item.edition !== 'negative') throw new Error('Sin espacio para jokers');
    } else if (item.kind !== 'card' && this.consumableSpace() <= 0) throw new Error('Sin espacio para consumibles');
  }

  private rollDisabledJoker() {
    this.disabledJoker = null;
    if (this.activeBoss?.disableJoker && this.jokers.length) {
      this.disabledJoker = this.jokers[this.rngFor('crimson').int(this.jokers.length)].uid;
    }
  }

  private spend(cost: number) {
    if (this.money < cost) throw new Error('Dinero insuficiente');
    this.money -= cost;
  }

  private nextBlind() {
    if (this.blindIndex === BLINDS.length - 1) {
      this.blindIndex = 0;
      this.ante++;
      this.bossRerollsThisAnte = 0;
      this.playedThisAnte = new Set();
    } else this.blindIndex++;
    this.roundHandSizeBonus = 0;
    this.phase = 'blind_select';
  }

  /** Roba hasta llenar la mano, o exactamente `exact` cartas (The Serpent). */
  private draw(exact?: number) {
    const n = exact ?? Math.max(0, this.handSize - this.hand.length);
    this.hand.push(...this.drawPile.splice(0, n));
  }

  private pick(ids: number[]): Card[] {
    if (ids.length < 1 || ids.length > MAX_SELECT) throw new Error('Selecciona entre 1 y 5 cartas');
    if (new Set(ids).size !== ids.length) throw new Error('Cartas repetidas');
    return ids.map((id) => {
      const c = this.hand.find((h) => h.id === id);
      if (!c) throw new Error(`La carta ${id} no está en la mano`);
      return c;
    });
  }

  private take(ids: number[]) {
    this.hand = this.hand.filter((h) => !ids.includes(h.id));
  }

  private expect(p: Phase) {
    if (this.phase !== p) throw new Error(`Acción inválida en fase "${this.phase}" (se esperaba "${p}")`);
  }

  private expectShop() {
    this.expect('shop');
    if (!this.shop) throw new Error('Tienda cerrada');
  }
}

