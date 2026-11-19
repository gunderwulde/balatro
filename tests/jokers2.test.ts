import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/core/cards';
import { JOKER_LIST, type JokerInstance } from '../src/core/jokers';
import { JOKER_TEXT } from '../src/i18n/content.es';
import { Run } from '../src/core/run';
import { scoreHand } from '../src/core/scoring';

let n = 500;
const mk = (s: string): Card[] =>
  s.split(' ').map((t) => {
    const r = t.slice(0, -1);
    const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
    return { id: n++, rank: rank as Rank, suit: t.slice(-1) as Suit };
  });
let uid = 1;
const joker = (id: string, state: Record<string, number> = {}): JokerInstance => ({ uid: uid++, id, cost: 4, state });
const total = (cards: string, id: string, extra: object = {}, state: Record<string, number> = {}) =>
  scoreHand(mk(cards), { jokers: [joker(id, state)], ...extra }).total;

describe('jokers lote 1', () => {
  it('todos los jokers tienen texto', () => {
    for (const d of JOKER_LIST) expect(JOKER_TEXT[d.id], d.id).toBeDefined();
  });
  it('Walkie-Talkie: 10 y 4 dan +10 fichas y +4 mult', () => {
    // carta alta 10: (5+10+10)*(1+4)
    expect(total('10S', 'walkie_talkie')).toBe(25 * 5);
    expect(total('9S', 'walkie_talkie')).toBe(14);
  });
  it('Smiley Face: figuras +5 mult', () => {
    expect(total('KS', 'smiley_face')).toBe(15 * 6);
    expect(total('9S', 'smiley_face')).toBe(14);
  });
  it('Shoot the Moon: Reinas en mano +13 mult', () => {
    expect(scoreHand(mk('9S'), { jokers: [joker('shoot_the_moon')], held: mk('QH QD 2C') }).total).toBe(14 * (1 + 26));
  });
  it('Arrowhead y Onyx Agate', () => {
    expect(total('9S', 'arrowhead')).toBe(64);
    expect(total('9C', 'onyx_agate')).toBe(14 * 8);
    expect(total('9H', 'arrowhead')).toBe(14);
  });
  it('Stuntman: +250 fichas y -2 mano', () => {
    expect(total('9S', 'stuntman')).toBe(264);
    const r = new Run('ST7');
    const before = r.handSize;
    r.addJoker('stuntman');
    expect(r.handSize).toBe(before - 2);
  });
  it('Bootstraps: +2 mult por $5', () => {
    expect(total('9S', 'bootstraps', { money: 14 })).toBe(14 * 5);
  });
  it('Merry Andy y Troubadour (pasivos)', () => {
    const r = new Run('MA');
    const [d, h, s] = [r.maxDiscards, r.maxHands, r.handSize];
    r.addJoker('merry_andy');
    r.addJoker('troubadour');
    r.selectBlind();
    expect(r.discardsLeft).toBe(d + 3);
    expect(r.handsLeft).toBe(h - 1);
    expect(r.handSize).toBe(s + 1);
  });
  it('Square Joker, Runner y Spare Trousers escalan', () => {
    expect(total('2S 3H 5D 9C', 'square_joker')).toBe((5 + 9 + 4) * 1);
    expect(total('9S', 'square_joker', {}, { chips: 8 })).toBe((5 + 9 + 8) * 1);
    expect(total('2S 3H 4D 5C 6S', 'runner')).toBeGreaterThan(total('2S 3H 4D 5C 6S', 'runner', {}, {}) - 1);
    expect(total('9S', 'runner', {}, { chips: 30 })).toBe(5 + 9 + 30);
    expect(total('9S', 'spare_trousers', {}, { mult: 4 })).toBe(14 * 5);
  });
  it('Raised Fist: doble de la carta más baja en mano', () => {
    expect(scoreHand(mk('9S'), { jokers: [joker('raised_fist')], held: mk('5H KD') }).total).toBe(14 * (1 + 10));
    expect(scoreHand(mk('9S'), { jokers: [joker('raised_fist')], held: [] }).total).toBe(14);
  });
});
