import { describe, expect, it } from 'vitest';
import { JOKER_LIST } from '../src/core/jokers';
import { Run } from '../src/core/run';

function shopRun(seed = 'S', money = 100): Run {
  const r = new Run(seed);
  r.selectBlind();
  r.score = 1e6;
  r.play([r.hand[0].id]);
  r.collectCashout();
  r.money = money;
  return r;
}

describe('tienda', () => {
  it('tras cobrar se abre la tienda con 2 casillas, 2 packs y 1 voucher', () => {
    const r = shopRun();
    expect(r.phase).toBe('shop');
    expect(r.shop!.items).toHaveLength(2);
    expect(r.shop!.packs).toHaveLength(2);
    expect(r.shop!.voucher).not.toBeNull();
  });

  it('es determinista por semilla', () => {
    expect(JSON.stringify(shopRun('A').shop)).toBe(JSON.stringify(shopRun('A').shop));
  });

  it('comprar descuenta dinero y añade joker o sube nivel de mano', () => {
    const r = shopRun();
    const it = r.shop!.items[0]!;
    const before = r.money;
    r.buy(0);
    expect(r.money).toBe(before - it.cost);
    expect(r.shop!.items[0]).toBeNull();
    if (it.kind === 'joker') expect(r.jokers).toHaveLength(1);
    else expect(Object.values(r.levels)).toContain(2);
  });

  it('sin dinero no se puede comprar', () => {
    const r = shopRun('S', 0);
    expect(() => r.buy(0)).toThrow('Dinero insuficiente');
  });

  it('reroll cuesta $5 y sube $1 cada vez', () => {
    const r = shopRun();
    r.reroll();
    expect(r.money).toBe(95);
    expect(r.shop!.rerollCost).toBe(6);
    r.reroll();
    expect(r.money).toBe(89);
  });

  it('no hay jokers repetidos entre los poseídos y la tienda', () => {
    const r = shopRun();
    r.jokers.push({ uid: 99, id: JOKER_LIST[0].id, cost: 2, state: {} });
    r.money = 10_000;
    for (let i = 0; i < 20; i++) {
      r.reroll();
      for (const it of r.shop!.items) if (it?.kind === 'joker') expect(it.id).not.toBe(JOKER_LIST[0].id);
    }
  });

  it('límite de slots de joker (negativo suma uno)', () => {
    const r = shopRun();
    for (let i = 0; i < 5; i++) r.jokers.push({ uid: i + 1, id: 'joker', cost: 2, state: {} });
    r.shop!.items[0] = { kind: 'joker', id: 'banner', cost: 5 };
    expect(() => r.buy(0)).toThrow('Sin espacio');
    r.jokers[0].edition = 'negative';
    expect(r.jokerSlots).toBe(6);
    r.buy(0);
    expect(r.jokers).toHaveLength(6);
  });

  it('vender da la mitad del coste (mín. $1)', () => {
    const r = shopRun('S', 0);
    r.jokers.push({ uid: 1, id: 'joker', cost: 5, state: {} });
    r.sellJoker(1);
    expect(r.money).toBe(2);
    expect(r.jokers).toHaveLength(0);
  });

  it('packs: abrir, elegir uno y no dejar la tienda con un pack abierto', () => {
    const r = shopRun();
    r.buyPack(0);
    expect(r.openPack!.choices.length).toBeGreaterThan(0);
    expect(() => r.leaveShop()).toThrow();
    r.pickFromPack(0);
    expect(r.openPack).toBeNull();
    r.leaveShop();
    expect(r.phase).toBe('blind_select');
  });

  it('voucher Grabber da +1 mano', () => {
    const r = shopRun();
    r.shop!.voucher = 'grabber';
    r.buyVoucher();
    expect(r.maxHands).toBe(5);
    expect(r.money).toBe(90);
    r.leaveShop();
    r.selectBlind();
    expect(r.handsLeft).toBe(5);
  });

  it('Golden Joker suma $4 al cashout; Juggler da +1 de tamaño de mano', () => {
    const r = new Run('G');
    r.jokers.push({ uid: 1, id: 'golden_joker', cost: 6, state: {} }, { uid: 2, id: 'juggler', cost: 4, state: {} });
    r.selectBlind();
    expect(r.hand).toHaveLength(9);
    r.score = 1e6;
    r.play([r.hand[0].id]);
    expect(r.cashout!.jokerBonus).toBe(4);
  });
});
