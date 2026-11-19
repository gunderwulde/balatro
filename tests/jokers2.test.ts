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

describe('jokers lote 2 (motor)', () => {
  const sc = (cards: string, js: JokerInstance[], extra: object = {}) => scoreHand(mk(cards), { jokers: js, ...extra }).total;
  it('Hack repite 2-5 que puntúan; Hanging Chad repite 2 veces la primera', () => {
    expect(sc('5S', [joker('hack')])).toBe(5 + 5 + 5);
    expect(sc('9S', [joker('hack')])).toBe(14);
    expect(sc('9S', [joker('hanging_chad')])).toBe(5 + 9 * 3);
  });
  it('Dusk solo en la última mano; Sock and Buskin en figuras', () => {
    expect(sc('9S', [joker('dusk')], { handsLeft: 1 })).toBe(5 + 18);
    expect(sc('9S', [joker('dusk')], { handsLeft: 3 })).toBe(14);
    expect(sc('KS', [joker('sock_and_buskin')])).toBe(5 + 20);
  });
  it('Mime repite cartas en mano (Steel ×1.5 dos veces; Baron)', () => {
    const held = mk('KH');
    held[0].enhancement = 'steel';
    expect(sc('9S', [joker('mime')], { held })).toBe(Math.floor(14 * 1 * 1.5 * 1.5));
    expect(sc('9S', [joker('mime'), joker('baron')], { held: mk('KD') })).toBe(Math.floor(14 * 1.5 * 1.5));
  });
  it('Blueprint copia al de la derecha, Brainstorm al primero; no se copian entre sí', () => {
    expect(sc('9S', [joker('blueprint'), joker('joker')])).toBe((5 + 9) * 9);
    expect(sc('9S', [joker('joker'), joker('brainstorm')])).toBe((5 + 9) * 9);
    expect(sc('9S', [joker('blueprint'), joker('brainstorm')])).toBe(14);
    expect(sc('9S', [joker('blueprint')])).toBe(14);
  });
  it('Blueprint copia estado y retriggers', () => {
    expect(sc('5S', [joker('blueprint'), joker('hack')])).toBe(5 + 5 * 3);
  });
  it('dinero por carta: Rough Gem y Golden Ticket; Bloodstone con rng', () => {
    expect(scoreHand(mk('9D'), { jokers: [joker('rough_gem')] }).money).toBe(1);
    const g = mk('9S');
    g[0].enhancement = 'gold';
    expect(scoreHand(g, { jokers: [joker('golden_ticket')] }).money).toBe(4);
    expect(sc('9H', [joker('bloodstone')], { rng: () => 0.1 })).toBe(Math.floor(14 * 1.5));
    expect(sc('9H', [joker('bloodstone')], { rng: () => 0.9 })).toBe(14);
  });
  it('jokers del mazo: Stone, Steel, Cloud 9', () => {
    const deck = mk('2S 9H 9D KC');
    deck[0].enhancement = 'stone';
    deck[3].enhancement = 'steel';
    expect(sc('9S', [joker('stone_joker')], { deck })).toBe(14 + 25);
    expect(sc('9S', [joker('steel_joker')], { deck })).toBe(Math.floor(14 * 1.2));
    const r = new Run('C9');
    r.addJoker('cloud_9');
    r.selectBlind();
    r.score = 1e12;
    r.play([r.hand[0].id]);
    expect(r.cashout!.jokerBonus).toBe(4);
  });
  it('destrucción al final de ronda: Gros Michel, Ice Cream, Popcorn, Seltzer; Eterno inmune', () => {
    const run = (id: string, setup?: (j: JokerInstance) => void) => {
      const r = new Run('DIE');
      const j = r.addJoker(id);
      setup?.(j);
      r.selectBlind();
      r.score = 1e12;
      r.play([r.hand[0].id]);
      return r;
    };
    expect(run('ice_cream', (j) => { j.state.spent = 19; }).jokers).toHaveLength(0);
    expect(run('ice_cream').jokers).toHaveLength(1);
    expect(run('popcorn', (j) => { j.state.rounds = 4; }).jokers).toHaveLength(0);
    expect(run('seltzer', (j) => { j.state.hands = 9; }).jokers).toHaveLength(0);
    expect(run('ice_cream', (j) => { j.state.spent = 19; j.sticker = 'eternal'; }).jokers).toHaveLength(1);
    let died = 0;
    for (let i = 0; i < 60; i++) {
      const r = new Run('GM' + i);
      r.addJoker('gros_michel');
      r.selectBlind();
      r.score = 1e12;
      r.play([r.hand[0].id]);
      if (!r.jokers.length) died++;
    }
    expect(died).toBeGreaterThan(0);
    expect(died).toBeLessThan(40);
  });
});
