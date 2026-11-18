import { describe, expect, it } from 'vitest';
import { blindTarget, computeCashout, Run } from '../src/core/run';

const ids = (r: Run, n: number) => r.hand.slice(0, n).map((c) => c.id);

describe('objetivos y cashout', () => {
  it('objetivos del Ante 1 y 8', () => {
    expect(blindTarget(1, 'small')).toBe(300);
    expect(blindTarget(1, 'big')).toBe(450);
    expect(blindTarget(1, 'boss')).toBe(600);
    expect(blindTarget(8, 'boss')).toBe(100000);
  });
  it('interés: $1 por cada $5, máx. $5', () => {
    expect(computeCashout('small', 2, 4)).toMatchObject({ blindReward: 3, handsBonus: 2, interest: 0, total: 5 });
    expect(computeCashout('big', 0, 12).interest).toBe(2);
    expect(computeCashout('boss', 0, 100).interest).toBe(5);
  });
});

describe('Run', () => {
  it('es determinista por semilla', () => {
    const a = new Run('SEED');
    const b = new Run('SEED');
    a.selectBlind();
    b.selectBlind();
    expect(a.hand.map((c) => c.id)).toEqual(b.hand.map((c) => c.id));
    const c = new Run('OTRA');
    c.selectBlind();
    expect(c.hand.map((x) => x.id)).not.toEqual(a.hand.map((x) => x.id));
  });

  it('estado inicial correcto', () => {
    const r = new Run('X');
    expect(r).toMatchObject({ phase: 'blind_select', ante: 1, money: 4, maxHands: 4, maxDiscards: 4 });
    r.selectBlind();
    expect(r.phase).toBe('playing');
    expect(r.hand).toHaveLength(8);
    expect(r.drawPile).toHaveLength(44);
  });

  it('jugar gasta mano, repone cartas y suma puntos', () => {
    const r = new Run('X');
    r.selectBlind();
    const res = r.play(ids(r, 1));
    expect(res.score.total).toBeGreaterThan(0);
    expect(r.handsLeft).toBe(3);
    expect(r.hand).toHaveLength(8);
    expect(r.score).toBe(res.score.total);
    expect(r.discardPile).toHaveLength(1);
  });

  it('descartar gasta descarte y repone; se agotan', () => {
    const r = new Run('X');
    r.selectBlind();
    for (let i = 0; i < 4; i++) r.discard(ids(r, 2));
    expect(r.discardsLeft).toBe(0);
    expect(r.hand).toHaveLength(8);
    expect(() => r.discard(ids(r, 1))).toThrow('Sin descartes');
  });

  it('valida selecciones inválidas', () => {
    const r = new Run('X');
    r.selectBlind();
    expect(() => r.play([])).toThrow();
    expect(() => r.play(ids(r, 6))).toThrow();
    expect(() => r.play([999])).toThrow('no está en la mano');
    const id = r.hand[0].id;
    expect(() => r.play([id, id])).toThrow('repetidas');
  });

  it('acciones fuera de fase lanzan error', () => {
    const r = new Run('X');
    expect(() => r.play([1])).toThrow('Acción inválida');
    expect(() => r.collectCashout()).toThrow();
  });

  it('perder: sin manos y sin llegar al objetivo', () => {
    const r = new Run('X');
    r.selectBlind();
    let last;
    for (let i = 0; i < 4; i++) last = r.play(ids(r, 1)); // 1 carta suelta nunca llega a 300
    expect(last!.lost).toBe(true);
    expect(r.phase).toBe('lost');
  });

  it('ganar una ciega → cashout → siguiente ciega', () => {
    const r = new Run('X');
    r.selectBlind();
    r.score = 299; // casi en el objetivo (acceso directo para test)
    const res = r.play(ids(r, 5));
    expect(res.cleared).toBe(true);
    expect(r.phase).toBe('cashout');
    // 3 (small) + 3 manos sobrantes + 0 interés ($4)
    expect(r.cashout).toMatchObject({ blindReward: 3, handsBonus: 3, interest: 0, total: 6 });
    r.collectCashout();
    expect(r.phase).toBe("shop");
    r.leaveShop();
    expect(r.money).toBe(10);
    expect(r.phase).toBe('blind_select');
    expect(r.blind).toBe('big');
    expect(r.ante).toBe(1);
  });

  it('skip: Small/Big sí, Boss no; tras Boss sube el Ante', () => {
    const r = new Run('X');
    r.skipBlind();
    r.skipBlind();
    expect(r.blind).toBe('boss');
    expect(() => r.skipBlind()).toThrow('Boss');
    expect(r.skipped).toBe(2);
    r.selectBlind();
    r.score = 10_000;
    r.play(ids(r, 1));
    r.collectCashout();
    r.leaveShop();
    expect(r).toMatchObject({ ante: 2, blindIndex: 0, phase: 'blind_select' });
  });

  it('victoria al superar el Boss del Ante 8', () => {
    const r = new Run('X');
    r.ante = 8;
    r.blindIndex = 2;
    r.selectBlind();
    r.score = 1e9;
    r.play(ids(r, 1));
    r.collectCashout();
    expect(r.phase).toBe('won');
  });
});
