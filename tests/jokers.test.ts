import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/core/cards';
import { containsHand } from '../src/core/hands';
import type { Edition, JokerInstance } from '../src/core/jokers';
import { Run } from '../src/core/run';
import { scoreHand } from '../src/core/scoring';

let n = 100;
const mk = (s: string): Card[] =>
  s.split(' ').map((t) => {
    const r = t.slice(0, -1);
    const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
    return { id: n++, rank: rank as Rank, suit: t.slice(-1) as Suit };
  });
let uid = 1;
const joker = (id: string, edition?: Edition, state: Record<string, number> = {}): JokerInstance => ({
  uid: uid++, id, edition, cost: 4, state,
});

describe('containsHand', () => {
  it('full house contiene pareja, trío y doble pareja', () => {
    const h = mk('2S 2H 2D 9C 9S');
    expect(containsHand(h, 'pair')).toBe(true);
    expect(containsHand(h, 'three_kind')).toBe(true);
    expect(containsHand(h, 'two_pair')).toBe(true);
    expect(containsHand(h, 'four_kind')).toBe(false);
  });
});

describe('puntuación con jokers', () => {
  const pairAces = () => mk('AS AH'); // base 10 + 22 = 32 chips, mult 2

  it('Joker: +4 mult → 32 × 6', () => {
    expect(scoreHand(pairAces(), { jokers: [joker('joker')] }).total).toBe(32 * 6);
  });
  it('Greedy Joker solo puntúa diamantes', () => {
    expect(scoreHand(mk('AD AH'), { jokers: [joker('greedy_joker')] }).total).toBe(32 * 5);
  });
  it('Jolly Joker: +8 mult si contiene pareja', () => {
    expect(scoreHand(pairAces(), { jokers: [joker('jolly_joker')] }).total).toBe(32 * 10);
    expect(scoreHand(mk('2S 5H'), { jokers: [joker('jolly_joker')] }).total).toBe((5 + 5) * 1);
  });
  it('el ORDEN importa: +mult antes de xmult', () => {
    const a = scoreHand(pairAces(), { jokers: [joker('joker'), joker('the_duo')] }).total; // (2+4)*2
    const b = scoreHand(pairAces(), { jokers: [joker('the_duo'), joker('joker')] }).total; // 2*2+4
    expect(a).toBe(32 * 12);
    expect(b).toBe(32 * 8);
  });
  it('ediciones: foil +50 chips, holo +10 mult, poly x1.5', () => {
    expect(scoreHand(pairAces(), { jokers: [joker('golden_joker', 'foil')] }).total).toBe(82 * 2);
    expect(scoreHand(pairAces(), { jokers: [joker('golden_joker', 'holo')] }).total).toBe(32 * 12);
    expect(scoreHand(pairAces(), { jokers: [joker('golden_joker', 'poly')] }).total).toBe(32 * 3);
  });
  it('poly se aplica DESPUÉS del efecto del propio joker', () => {
    expect(scoreHand(pairAces(), { jokers: [joker('joker', 'poly')] }).total).toBe(32 * 9); // (2+4)*1.5
  });
  it('Photograph: x2 solo en la primera figura', () => {
    expect(scoreHand(mk('KS KH'), { jokers: [joker('photograph')] }).total).toBe(30 * 4);
  });
  it('Baron: cada rey en mano x1.5', () => {
    const r = scoreHand(pairAces(), { jokers: [joker('baron')], held: mk('KS KD') });
    expect(r.total).toBe(Math.floor(32 * 2 * 1.5 * 1.5));
  });
  it('Banner: +30 chips por descarte restante', () => {
    expect(scoreHand(pairAces(), { jokers: [joker('banner')], discardsLeft: 3 }).total).toBe((32 + 90) * 2);
  });
  it('Acrobat: x3 solo en la última mano', () => {
    expect(scoreHand(pairAces(), { jokers: [joker('acrobat')], handsLeft: 1 }).total).toBe(32 * 6);
    expect(scoreHand(pairAces(), { jokers: [joker('acrobat')], handsLeft: 2 }).total).toBe(32 * 2);
  });
  it('Green Joker escala con manos y baja con descartes', () => {
    const r = new Run('G');
    r.jokers.push(joker('green_joker'));
    r.selectBlind();
    r.play([r.hand[0].id]);
    expect(r.jokers[0].state.mult).toBe(1);
    r.discard([r.hand[0].id]);
    expect(r.jokers[0].state.mult).toBe(0);
    r.discard([r.hand[0].id]);
    expect(r.jokers[0].state.mult).toBe(0);
  });
});
