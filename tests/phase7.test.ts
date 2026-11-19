import { describe, expect, it } from 'vitest';
import { BOSS_LIST } from '../src/core/bosses';
import { Run } from '../src/core/run';
import { TAG_LIST } from '../src/core/tags';

function bossRun(id: string, seed = 'P7'): Run {
  const r = new Run(seed);
  r.blindIndex = 2;
  r.ante = 8;
  (r as unknown as { bossByAnte: Map<number, unknown> }).bossByAnte.set(8, BOSS_LIST.find((b) => b.id === id));
  r.selectBlind();
  return r;
}

describe('Fase 7: bosses con cartas boca abajo', () => {
  it('The House: la primera mano viene boca abajo; tras jugar, las nuevas no', () => {
    const r = bossRun('the_house');
    expect(r.hand.every((c) => r.faceDown.has(c.id))).toBe(true);
    r.play(r.hand.slice(0, 1).map((c) => c.id));
    const fresh = r.hand.filter((c) => !r.faceDown.has(c.id));
    expect(fresh.length).toBeGreaterThan(0);
  });

  it('The Fish: las cartas robadas tras jugar vienen boca abajo, la mano inicial no', () => {
    const r = bossRun('the_fish');
    expect(r.faceDown.size).toBe(0);
    r.play(r.hand.slice(0, 2).map((c) => c.id));
    expect(r.faceDown.size).toBe(2);
  });

  it('The Mark: solo las figuras vienen boca abajo', () => {
    const r = bossRun('the_mark', 'MARK');
    for (const c of r.hand) expect(r.faceDown.has(c.id)).toBe(c.rank >= 11 && c.rank <= 13);
  });

  it('The Wheel: algunas cartas boca abajo (≈1/7)', () => {
    let down = 0;
    let total = 0;
    for (let i = 0; i < 40; i++) {
      const r = bossRun('the_wheel', 'W' + i);
      down += r.faceDown.size;
      total += r.hand.length;
    }
    expect(down / total).toBeGreaterThan(0.05);
    expect(down / total).toBeLessThan(0.25);
  });

  it('Cerulean Bell: hay una carta forzada y hay que incluirla', () => {
    const r = bossRun('cerulean_bell');
    expect(r.forcedCard).not.toBeNull();
    const other = r.hand.find((c) => c.id !== r.forcedCard)!;
    expect(r.playError([other])).toBe('boss_forced');
    expect(r.playError([other, r.hand.find((c) => c.id === r.forcedCard)!])).toBeNull();
    expect(() => r.discard([other.id])).toThrow('boss_forced');
  });
});

describe('Fase 7: tags nuevos', () => {
  it('hay 24 tags', () => expect(TAG_LIST).toHaveLength(24));

  it('Top-up crea 2 jokers comunes', () => {
    const r = new Run('TOP');
    r.gainTag('top_up');
    expect(r.jokers).toHaveLength(2);
  });

  it('Orbital sube 3 niveles una mano', () => {
    const r = new Run('ORB');
    r.gainTag('orbital');
    const lv = Object.values(r.levels);
    expect(lv).toHaveLength(1);
    expect(lv[0]).toBe(4);
  });
});

import { CHALLENGE_LIST } from '../src/core/challenges';
import { JOKERS } from '../src/core/jokers';
import { CONSUMABLES } from '../src/core/consumables';
import { recordEnd, emptyProfile } from '../src/core/profile';

describe('Fase 7: desafíos', () => {
  it('todos los desafíos usan ids válidos y arrancan', () => {
    for (const ch of CHALLENGE_LIST) {
      for (const j of ch.jokers ?? []) expect(JOKERS[j.id], ch.id + ':' + j.id).toBeDefined();
      for (const c of ch.consumables ?? []) expect(CONSUMABLES[c.id], ch.id + ':' + c.id).toBeDefined();
      const r = new Run('CH', { deck: 'plain', challenge: ch.id });
      expect(r.challenge).toBe(ch.id);
      r.selectBlind();
      expect(r.hand.length).toBeGreaterThan(0);
    }
  });

  it('Sin Figuras quita 12 cartas; Cañón de Cristal pone Cristal; Monocromo todo Picas', () => {
    expect(new Run('A', { challenge: 'no_faces' }).fullDeck).toHaveLength(40);
    expect(new Run('A', { challenge: 'glass_cannon' }).fullDeck.every((c) => c.enhancement === 'glass')).toBe(true);
    expect(new Run('A', { challenge: 'monochrome' }).fullDeck.every((c) => c.suit === 'S')).toBe(true);
  });

  it('los jokers iniciales son Eternos y sin interés en Ricos y Famosos', () => {
    const r = new Run('A', { challenge: 'omelette' });
    expect(r.jokers.every((j) => j.id !== 'egg' || j.sticker === 'eternal')).toBe(true);
    expect(r.money).toBe(0);
    const rich = new Run('A', { challenge: 'rich_get_richer' });
    expect(rich.money).toBe(100);
    expect(rich.interestCap).toBe(0);
  });

  it('el desafío se guarda y se restaura; ganar no cuenta como Stake', () => {
    const r = new Run('SAVE', { deck: 'plain', challenge: 'no_faces' });
    const back = Run.restore(r.serialize());
    expect(back.challenge).toBe('no_faces');
    const p = recordEnd(emptyProfile(), { deckId: 'plain', stake: 1, ante: 8, bestHand: 1, discovered: new Set(), challenge: 'no_faces' }, true);
    expect(p.challengeWins).toEqual(['no_faces']);
    expect(p.stakeWins).toEqual({});
  });
});
