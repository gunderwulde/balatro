import { describe, expect, it } from 'vitest';
import { DECK_IDS } from '../src/core/decks';
import { emptyProfile, mergeProgress, recordEnd, unlockedStake } from '../src/core/profile';
import { blindTarget, Run } from '../src/core/run';
import { scoreHand } from '../src/core/scoring';
import { anteBase, stakeRules } from '../src/core/stakes';

const play = (r: Run) => {
  r.selectBlind();
  r.score = 1e12;
  r.play([r.hand[0].id]);
};
const toShop = (r: Run) => {
  play(r);
  r.collectCashout();
};

describe('mazos', () => {
  it('hay 15 mazos y todos arrancan una ronda', () => {
    expect(DECK_IDS).toHaveLength(15);
    for (const id of DECK_IDS) {
      const r = new Run('D', { deck: id });
      r.selectBlind();
      expect(r.hand.length).toBeGreaterThan(0);
    }
  });
  it('Red/Blue/Yellow/Black', () => {
    expect(new Run('D', { deck: 'red' }).maxDiscards).toBe(5);
    expect(new Run('D', { deck: 'blue' }).maxHands).toBe(5);
    expect(new Run('D', { deck: 'yellow' }).money).toBe(14);
    const b = new Run('D', { deck: 'black' });
    expect([b.maxHands, b.jokerSlots]).toEqual([3, 6]);
  });
  it('Magic: Crystal Ball y 2 Fool; Nebula: Telescope y -1 slot; Zodiac: 3 vouchers; Ghost: Hex', () => {
    const m = new Run('D', { deck: 'magic' });
    expect(m.consumables.map((c) => c.id)).toEqual(['fool', 'fool']);
    expect(m.consumableSlots).toBe(3);
    const n = new Run('D', { deck: 'nebula' });
    expect([n.vouchers.has('telescope'), n.consumableSlots]).toEqual([true, 1]);
    expect(new Run('D', { deck: 'zodiac' }).vouchers.size).toBe(3);
    expect(new Run('D', { deck: 'ghost' }).consumables[0].id).toBe('hex');
  });
  it('Abandoned sin figuras; Checkered solo picas y corazones; Painted +2 mano, -1 joker', () => {
    expect(new Run('D', { deck: 'abandoned' }).fullDeck).toHaveLength(40);
    const c = new Run('D', { deck: 'checkered' });
    expect(c.fullDeck.every((x) => x.suit === 'S' || x.suit === 'H')).toBe(true);
    expect(c.fullDeck.filter((x) => x.suit === 'S')).toHaveLength(26);
    const p = new Run('D', { deck: 'painted' });
    p.selectBlind();
    expect([p.hand.length, p.jokerSlots]).toEqual([10, 4]);
  });
  it('Erratic es determinista pero distinto al mazo normal', () => {
    const a = new Run('E', { deck: 'erratic' }).fullDeck.map((c) => `${c.rank}${c.suit}`);
    expect(new Run('E', { deck: 'erratic' }).fullDeck.map((c) => `${c.rank}${c.suit}`)).toEqual(a);
    expect(new Set(a).size).toBeLessThan(52);
  });
  it('Plasma: objetivo ×2 y equilibra fichas y mult', () => {
    const r = new Run('D', { deck: 'plasma' });
    expect(r.target).toBe(600);
    const res = scoreHand([{ id: 1, rank: 2, suit: 'S' }], { balance: true });
    expect(res.chips).toBe(res.mult);
    expect(res.total).toBe(16);
  });
  it('Green: $2 por mano y $1 por descarte, sin interés; Anaglyph da Double tras el Boss', () => {
    const g = new Run('G', { deck: 'green' });
    g.money = 50;
    g.selectBlind();
    g.score = 1e9;
    g.play([g.hand[0].id]);
    expect(g.cashout).toMatchObject({ interest: 0, handsBonus: 2 * 3 + 4 });
    const a = new Run('A', { deck: 'anaglyph' });
    a.blindIndex = 2;
    play(a);
    expect(a.tags).toContain('double');
  });
});

describe('stakes', () => {
  it('reglas acumulativas', () => {
    expect(stakeRules(1)).toMatchObject({ smallReward: true, scaling: 1, eternal: false });
    expect(stakeRules(2).smallReward).toBe(false);
    expect(stakeRules(3).scaling).toBe(2);
    expect(stakeRules(4).eternal).toBe(true);
    expect(stakeRules(5).discardsMinus).toBe(1);
    expect(stakeRules(6).scaling).toBe(3);
    expect(stakeRules(7).perishable).toBe(true);
    expect(stakeRules(8)).toMatchObject({ rental: true, perishable: true, eternal: true });
  });
  it('Stake Red: Small sin recompensa; Blue: -1 descarte; Green sube objetivos', () => {
    const r = new Run('S', { stake: 2 });
    play(r);
    expect(r.cashout!.blindReward).toBe(0);
    expect(new Run('S', { stake: 5 }).maxDiscards).toBe(3);
    expect(new Run('S', { stake: 3 }).target).toBe(300);
    expect(blindTarget(2, 'small', 2, 2)).toBe(900);
    expect(blindTarget(2, 'small', 2, 3)).toBe(1000);
  });
  it('pasado el Ante 8 los objetivos siguen creciendo', () => {
    expect(anteBase(9)).toBeGreaterThan(anteBase(8) * 2);
    expect(anteBase(10)).toBeGreaterThan(anteBase(9));
  });
  it('stickers: solo con el Stake adecuado', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = new Run('ST' + i, { stake: 8 });
      toShop(r);
      for (const it of r.shop!.items) if (it?.sticker) seen.add(it.sticker);
    }
    expect([...seen].sort()).toEqual(['eternal', 'perishable', 'rental']);
    for (let i = 0; i < 20; i++) {
      const r = new Run('ST' + i, { stake: 3 });
      toShop(r);
      expect(r.shop!.items.every((it) => !it?.sticker)).toBe(true);
    }
  });
  it('Eternal no se vende; Rental cobra $3; Perishable se agota a las 5 rondas', () => {
    const r = new Run('K', { stake: 8 });
    const e = r.addJoker('joker');
    e.sticker = 'eternal';
    expect(() => r.sellJoker(e.uid)).toThrow('Eterno');
    e.sticker = 'rental';
    const money = r.money;
    play(r);
    expect(r.cashout!.rental).toBe(3);
    expect(r.cashout!.total).toBe(r.cashout!.blindReward + r.cashout!.handsBonus + r.cashout!.interest - 3);
    expect(r.money).toBe(money);
    const p = new Run('P', { stake: 8 });
    const j = p.addJoker('joker');
    j.sticker = 'perishable';
    const card = { id: 1, rank: 2 as const, suit: 'S' as const };
    const before = scoreHand([card], { jokers: [j] }).total;
    j.rounds = 5;
    expect(scoreHand([card], { jokers: [j] }).total).toBeLessThan(before);
  });
});

describe('guardar y continuar', () => {
  it('solo se guarda entre rondas', () => {
    const r = new Run('V', { deck: 'blue', stake: 2 });
    expect(r.canSave).toBe(true);
    r.selectBlind();
    expect(r.canSave).toBe(false);
  });
  it('ida y vuelta idéntica y la run continúa igual (determinismo)', () => {
    const a = new Run('SAVE', { deck: 'ghost', stake: 3 });
    toShop(a);
    a.money = 100;
    a.buy(0);
    a.reroll();
    const json = JSON.stringify(a.serialize());
    const b = Run.restore(JSON.parse(json));
    expect(JSON.stringify(b.serialize())).toBe(json);
    for (const r of [a, b]) {
      r.leaveShop();
      r.selectBlind();
    }
    expect(b.hand.map((c) => c.id)).toEqual(a.hand.map((c) => c.id));
    const ra = a.play([a.hand[0].id]);
    const rb = b.play([b.hand[0].id]);
    expect(rb.score.total).toBe(ra.score.total);
    expect(b.drawPile.map((c) => c.id)).toEqual(a.drawPile.map((c) => c.id));
  });
  it('conserva el Boss del Ante, tags, jokers y consumibles', () => {
    const a = new Run('SV2');
    a.tags.push('coupon');
    a.addJoker('baron', 'foil');
    a.addConsumable('tarot', 'magician');
    const boss = a.boss.id;
    const b = Run.restore(JSON.parse(JSON.stringify(a.serialize())));
    expect(b.boss.id).toBe(boss);
    expect(b.tags).toEqual(['coupon']);
    expect(b.jokers[0]).toMatchObject({ id: 'baron', edition: 'foil' });
    expect(b.consumables[0].id).toBe('magician');
  });
});

describe('Endless', () => {
  it('tras ganar se puede seguir; el Ante 16 vuelve a tener finalista', () => {
    const r = new Run('END');
    r.ante = 8;
    r.blindIndex = 2;
    play(r);
    r.collectCashout();
    expect(r.phase).toBe('won');
    r.continueEndless();
    expect(r.phase).toBe('shop');
    expect(r.endless).toBe(true);
    r.leaveShop();
    expect(r.ante).toBe(9);
    expect(r.boss.finisher).toBeFalsy();
    r.ante = 16;
    expect(r.boss.finisher).toBe(true);
  });
});

describe('perfil', () => {
  const summary = { deckId: 'blue', stake: 1, ante: 5, bestHand: 1234, discovered: new Set(['joker']) };
  it('registra runs, récords y colección', () => {
    let p = recordEnd(emptyProfile(), summary, false);
    expect(p).toMatchObject({ runs: 1, wins: 0, bestAnte: 5, bestHand: 1234, discovered: ['joker'] });
    p = mergeProgress(p, { ...summary, discovered: new Set(['banner']) });
    expect(p.runs).toBe(1);
    expect(p.discovered.sort()).toEqual(['banner', 'joker']);
  });
  it('ganar desbloquea el siguiente Stake solo para ese mazo', () => {
    let p = emptyProfile();
    expect(unlockedStake(p, 'blue')).toBe(1);
    p = recordEnd(p, summary, true);
    expect(unlockedStake(p, 'blue')).toBe(2);
    expect(unlockedStake(p, 'red')).toBe(1);
    p = recordEnd(p, { ...summary, stake: 8 }, true);
    expect(unlockedStake(p, 'blue')).toBe(8);
  });
});
