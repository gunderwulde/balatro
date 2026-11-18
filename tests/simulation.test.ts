import { describe, expect, it } from 'vitest';
import { Run } from '../src/core/run';

/** Bot simple: juega las 5 primeras cartas, compra todo lo que puede y elige siempre la primera opción. */
function simulate(seed: string): Run {
  const r = new Run(seed);
  for (let steps = 0; steps < 5000 && r.phase !== 'won' && r.phase !== 'lost'; steps++) {
    switch (r.phase) {
      case 'blind_select':
        r.selectBlind();
        break;
      case 'playing':
        if (r.discardsLeft > 0 && r.handsLeft > 1) r.discard(r.hand.slice(0, 3).map((c) => c.id));
        else r.play(r.hand.slice(0, 5).map((c) => c.id));
        break;
      case 'cashout':
        r.collectCashout();
        break;
      case 'shop':
        if (r.openPack) {
          try { r.pickFromPack(0); } catch { r.skipPack(); }
        } else {
          for (let i = 0; i < r.shop!.items.length; i++) {
            try { r.buy(i); } catch { /* sin dinero o sin hueco */ }
          }
          try { r.buyPack(0); } catch { /* sin dinero */ }
          if (!r.openPack) r.leaveShop();
        }
        break;
    }
  }
  return r;
}

describe('simulación de runs completas con bot', () => {
  it('termina siempre en won/lost sin lanzar errores (30 semillas)', () => {
    for (let i = 0; i < 30; i++) {
      const r = simulate(`BOT${i}`);
      expect(['won', 'lost']).toContain(r.phase);
      expect(r.jokers.length).toBeLessThanOrEqual(r.jokerSlots);
      expect(r.money).toBeGreaterThanOrEqual(0);
    }
  });

  it('es determinista', () => {
    const a = simulate('X1');
    const b = simulate('X1');
    expect([a.ante, a.blindIndex, a.money, a.phase]).toEqual([b.ante, b.blindIndex, b.money, b.phase]);
  });
});
