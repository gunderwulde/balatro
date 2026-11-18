import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../src/core/cards';
import { evaluateHand } from '../src/core/hands';
import { scoreHand } from '../src/core/scoring';

let n = 0;
const mk = (s: string): Card[] =>
  s.split(' ').map((t) => {
    const r = t.slice(0, -1);
    const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
    return { id: n++, rank: rank as Rank, suit: t.slice(-1) as Suit };
  });

describe('evaluateHand', () => {
  const cases: [string, string][] = [
    ['2S 5H 9D JC KS', 'high_card'],
    ['2S 2H 9D JC KS', 'pair'],
    ['2S 2H 9D 9C KS', 'two_pair'],
    ['2S 2H 2D 9C KS', 'three_kind'],
    ['5S 6H 7D 8C 9S', 'straight'],
    ['AS 2H 3D 4C 5S', 'straight'],
    ['10S JH QD KC AS', 'straight'],
    ['QS KH AD 2C 3S', 'high_card'],
    ['2S 5S 9S JS KS', 'flush'],
    ['2S 2H 2D 9C 9S', 'full_house'],
    ['7S 7H 7D 7C KS', 'four_kind'],
    ['5S 6S 7S 8S 9S', 'straight_flush'],
    ['7S 7H 7D 7C 7S', 'five_kind'],
    ['7S 7S 7S 9S 9S', 'flush_house'],
    ['7S 7S 7S 7S 7S', 'flush_five'],
  ];
  for (const [cards, hand] of cases) it(`${cards} -> ${hand}`, () => expect(evaluateHand(mk(cards)).hand).toBe(hand));

  it('solo puntúan las cartas de la mano (kickers no)', () => {
    expect(evaluateHand(mk('2S 2H 9D JC KS')).scoring).toHaveLength(2);
  });
});

describe('scoreHand', () => {
  it('par de ases: (10+11+11) x 2 = 64', () => {
    expect(scoreHand(mk('AS AH 9D JC KS')).total).toBe(64);
  });
  it('nivel 2 mejora chips y mult', () => {
    expect(scoreHand(mk('AS AH'), { pair: 2 }).total).toBe((25 + 22) * 3);
  });
});
