import { createDeck, shuffle, type Card } from './cards';
import type { HandType } from './hands';
import { JOKERS, sellValue, type JokerInstance } from './jokers';
import { PLANET_BY_ID } from './planets';
import { Rng } from './rng';
import { makeCtx, scoreHand, type ScoreResult } from './scoring';
import {
  PACK_COST, REROLL_BASE, VOUCHERS, VOUCHER_COST, rollPackContents, rollShopItem,
  type OpenPack, type PackKind, type Shop, type ShopItem,
} from './shop';

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
  total: number;
}

export interface PlayResult {
  score: ScoreResult;
  cleared: boolean;
  lost: boolean;
}

export function blindTarget(ante: number, kind: BlindKind): number {
  const base = ANTE_BASE[Math.min(ante, MAX_ANTE) - 1];
  return Math.round(base * BLIND_MULT[kind]);
}

export function computeCashout(kind: BlindKind, handsLeft: number, money: number, jokerBonus = 0, interestCap = 5): Cashout {
  const blindReward = BLIND_REWARD[kind];
  const handsBonus = handsLeft;
  const interest = Math.min(interestCap, Math.floor(money / INTEREST_STEP));
  return { blindReward, handsBonus, interest, jokerBonus, total: blindReward + handsBonus + interest + jokerBonus };
}

/** Máquina de estados de una run. Sin dependencias de render ni DOM. */
export class Run {
  phase: Phase = 'blind_select';
  ante = 1;
  blindIndex = 0;
  money = 4;
  maxHands = 4;
  maxDiscards = 4;
  baseHandSize = 8;
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
  vouchers = new Set<string>();
  shop: Shop | null = null;
  openPack: OpenPack | null = null;
  cashout: Cashout | null = null;
  readonly fullDeck: Card[];
  private rng: Rng;
  private nextUid = 1;
  private shopCount = 0;

  constructor(readonly seed: string) {
    this.rng = new Rng(seed);
    this.fullDeck = createDeck();
  }

  get blind(): BlindKind {
    return BLINDS[this.blindIndex];
  }

  get target(): number {
    return blindTarget(this.ante, this.blind);
  }

  get jokerSlots(): number {
    return BASE_JOKER_SLOTS + this.jokers.filter((j) => j.edition === 'negative').length;
  }

  get handSize(): number {
    return this.baseHandSize + this.passive('handSize');
  }

  get interestCap(): number {
    return this.vouchers.has('seed_money') ? 10 : 5;
  }

  private passive(key: 'handSize' | 'hands' | 'discards'): number {
    return this.jokers.reduce((n, j) => n + (JOKERS[j.id].passive?.[key] ?? 0), 0);
  }

  // ---------- Ciega ----------

  selectBlind(): void {
    this.expect('blind_select');
    this.phase = 'playing';
    this.score = 0;
    this.handsLeft = this.maxHands + this.passive('hands');
    this.discardsLeft = this.maxDiscards + this.passive('discards');
    this.drawPile = shuffle(this.fullDeck, this.rng);
    this.discardPile = [];
    this.hand = [];
    this.draw();
  }

  /** Salta Small/Big (el Boss no). Los Tags llegan en la Fase 5. */
  skipBlind(): void {
    this.expect('blind_select');
    if (this.blind === 'boss') throw new Error('El Boss no se puede saltar');
    this.skipped++;
    this.nextBlind();
  }

  /** Puntuación que tendría jugar estas cartas ahora (sin modificar nada). */
  preview(cards: Card[]): ScoreResult {
    return scoreHand(cards, this.scoreOptions(cards));
  }

  private scoreOptions(played: Card[]) {
    const ids = new Set(played.map((c) => c.id));
    return {
      levels: this.levels,
      jokers: this.jokers,
      held: this.hand.filter((c) => !ids.has(c.id)),
      handsLeft: this.handsLeft,
      discardsLeft: this.discardsLeft,
      money: this.money,
      deckLeft: this.drawPile.length,
      handPlays: this.handPlays,
    };
  }

  play(ids: number[]): PlayResult {
    this.expect('playing');
    if (this.handsLeft <= 0) throw new Error('Sin manos');
    const cards = this.pick(ids);
    // La puntuación se calcula con el estado previo a la jugada.
    const opts = this.scoreOptions(cards);
    const score = scoreHand(cards, opts);
    const ctx = makeCtx(cards, opts);
    this.take(ids);
    this.score += score.total;
    this.handsLeft--;
    this.discardPile.push(...cards);
    for (const j of this.jokers) JOKERS[j.id].onHandPlayed?.(j, ctx);
    this.handPlays[score.hand] = (this.handPlays[score.hand] ?? 0) + 1;

    if (this.score >= this.target) {
      const jokerBonus = this.jokers.reduce((n, j) => n + (JOKERS[j.id].roundEndMoney?.(j) ?? 0), 0);
      this.cashout = computeCashout(this.blind, this.handsLeft, this.money, jokerBonus, this.interestCap);
      this.phase = 'cashout';
      return { score, cleared: true, lost: false };
    }
    if (this.handsLeft === 0) {
      this.phase = 'lost';
      return { score, cleared: false, lost: true };
    }
    this.draw();
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
    this.draw();
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

  // ---------- Tienda ----------

  private openShop() {
    this.phase = 'shop';
    this.shopCount++;
    this.shop = { items: [], packs: [], voucher: null, rerollCost: REROLL_BASE, rerolls: 0 };
    this.fillShopItems();
    const kinds: PackKind[] = ['celestial', 'buffoon'];
    this.shop.packs = kinds.map((kind) => ({ kind, cost: PACK_COST[kind] }));
    const left = VOUCHERS.filter((v) => !this.vouchers.has(v));
    this.shop.voucher = left.length ? left[this.shopRng('voucher').int(left.length)] : null;
  }

  private shopRng(tag: string): Rng {
    return new Rng(`${this.seed}:shop${this.shopCount}:${tag}:${this.shop?.rerolls ?? 0}`);
  }

  private fillShopItems() {
    const rng = this.shopRng('items');
    const slots = 2 + (this.vouchers.has('overstock') ? 1 : 0);
    const taken = new Set(this.jokers.map((j) => j.id));
    this.shop!.items = [];
    for (let i = 0; i < slots; i++) {
      const it = rollShopItem(rng, this.handPlays, taken);
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
    if (item.kind === 'joker') this.assertSlot();
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
    const rng = this.shopRng(`pack${index}`);
    this.openPack = {
      kind: pack.kind,
      choices: rollPackContents(rng, pack.kind, this.handPlays, new Set(this.jokers.map((j) => j.id))),
    };
  }

  /** Elige una carta del pack abierto (gratis). */
  pickFromPack(index: number): void {
    this.expectShop();
    const pack = this.openPack;
    if (!pack) throw new Error('No hay pack abierto');
    const item = pack.choices[index];
    if (!item) throw new Error('Opción inválida');
    if (item.kind === 'joker') this.assertSlot();
    this.gain(item);
    this.openPack = null;
  }

  skipPack(): void {
    this.expectShop();
    this.openPack = null;
  }

  buyVoucher(): void {
    this.expectShop();
    const v = this.shop!.voucher;
    if (!v) throw new Error('Sin voucher');
    this.spend(VOUCHER_COST);
    this.vouchers.add(v);
    this.shop!.voucher = null;
    if (v === 'grabber') this.maxHands++;
    if (v === 'wasteful') this.maxDiscards++;
    if (v === 'overstock') {
      const taken = new Set([...this.jokers.map((j) => j.id), ...this.shop!.items.flatMap((i) => (i?.kind === 'joker' ? [i.id] : []))]);
      this.shop!.items.push(rollShopItem(this.shopRng('overstock'), this.handPlays, taken));
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

  // ---------- Internos ----------

  private gain(item: ShopItem) {
    if (item.kind === 'joker') {
      this.jokers.push({ uid: this.nextUid++, id: item.id, edition: item.edition, cost: item.cost, state: {} });
    } else {
      const hand = PLANET_BY_ID[item.id].hand;
      this.levels[hand] = (this.levels[hand] ?? 1) + 1;
    }
  }

  private assertSlot() {
    if (this.jokers.length >= this.jokerSlots) throw new Error('Sin espacio para jokers');
  }

  private spend(cost: number) {
    if (this.money < cost) throw new Error('Dinero insuficiente');
    this.money -= cost;
  }

  private nextBlind() {
    if (this.blindIndex === BLINDS.length - 1) {
      this.blindIndex = 0;
      this.ante++;
    } else this.blindIndex++;
    this.phase = 'blind_select';
  }

  private draw() {
    const n = Math.max(0, this.handSize - this.hand.length);
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
