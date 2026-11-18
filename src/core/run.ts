import { createDeck, shuffle, type Card } from './cards';
import type { HandType } from './hands';
import { Rng } from './rng';
import { scoreHand, type ScoreResult } from './scoring';

export type Phase = 'blind_select' | 'playing' | 'cashout' | 'won' | 'lost';
export type BlindKind = 'small' | 'big' | 'boss';
export const BLINDS: BlindKind[] = ['small', 'big', 'boss'];

/** ⚠ verificar (GDD §3): objetivo base por Ante (stake blanco). */
export const ANTE_BASE = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
const BLIND_MULT: Record<BlindKind, number> = { small: 1, big: 1.5, boss: 2 };
export const BLIND_REWARD: Record<BlindKind, number> = { small: 3, big: 4, boss: 5 };
export const MAX_ANTE = 8;
export const MAX_SELECT = 5;
const INTEREST_STEP = 5;
const INTEREST_CAP = 5;

export interface Cashout {
  blindReward: number;
  handsBonus: number;
  interest: number;
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

export function computeCashout(kind: BlindKind, handsLeft: number, money: number): Cashout {
  const blindReward = BLIND_REWARD[kind];
  const handsBonus = handsLeft;
  const interest = Math.min(INTEREST_CAP, Math.floor(money / INTEREST_STEP));
  return { blindReward, handsBonus, interest, total: blindReward + handsBonus + interest };
}

/** Máquina de estados de una run. Sin dependencias de render ni DOM. */
export class Run {
  phase: Phase = 'blind_select';
  ante = 1;
  blindIndex = 0;
  money = 4;
  maxHands = 4;
  maxDiscards = 4;
  handSize = 8;
  handsLeft = 0;
  discardsLeft = 0;
  score = 0;
  skipped = 0;
  hand: Card[] = [];
  drawPile: Card[] = [];
  discardPile: Card[] = [];
  levels: Partial<Record<HandType, number>> = {};
  cashout: Cashout | null = null;
  readonly fullDeck: Card[];
  private rng: Rng;

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

  /** Empieza la ciega actual. */
  selectBlind(): void {
    this.expect('blind_select');
    this.phase = 'playing';
    this.score = 0;
    this.handsLeft = this.maxHands;
    this.discardsLeft = this.maxDiscards;
    this.drawPile = shuffle(this.fullDeck, this.rng);
    this.discardPile = [];
    this.hand = [];
    this.draw();
  }

  /** Salta Small/Big (el Boss no se puede saltar). Los Tags llegan en la Fase 5. */
  skipBlind(): void {
    this.expect('blind_select');
    if (this.blind === 'boss') throw new Error('El Boss no se puede saltar');
    this.skipped++;
    this.nextBlind();
  }

  play(ids: number[]): PlayResult {
    this.expect('playing');
    if (this.handsLeft <= 0) throw new Error('Sin manos');
    const cards = this.take(ids);
    const score = scoreHand(cards, this.levels);
    this.score += score.total;
    this.handsLeft--;
    this.discardPile.push(...cards);

    if (this.score >= this.target) {
      this.cashout = computeCashout(this.blind, this.handsLeft, this.money);
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
    const cards = this.take(ids);
    this.discardsLeft--;
    this.discardPile.push(...cards);
    this.draw();
  }

  /** Cobra la recompensa y avanza (la tienda se inserta aquí en la Fase 4). */
  collectCashout(): void {
    this.expect('cashout');
    this.money += this.cashout!.total;
    this.cashout = null;
    if (this.blind === 'boss' && this.ante >= MAX_ANTE) {
      this.phase = 'won';
      return;
    }
    this.nextBlind();
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

  /** Valida y extrae cartas de la mano por id. */
  private take(ids: number[]): Card[] {
    if (ids.length < 1 || ids.length > MAX_SELECT) throw new Error('Selecciona entre 1 y 5 cartas');
    if (new Set(ids).size !== ids.length) throw new Error('Cartas repetidas');
    const cards = ids.map((id) => {
      const c = this.hand.find((h) => h.id === id);
      if (!c) throw new Error(`La carta ${id} no está en la mano`);
      return c;
    });
    this.hand = this.hand.filter((h) => !ids.includes(h.id));
    return cards;
  }

  private expect(p: Phase) {
    if (this.phase !== p) throw new Error(`Acción inválida en fase "${this.phase}" (se esperaba "${p}")`);
  }
}
