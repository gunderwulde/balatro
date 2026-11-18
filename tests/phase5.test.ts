import { describe, expect, it } from 'vitest';
import { BOSS_LIST, pickBoss } from '../src/core/bosses';
import type { Card } from '../src/core/cards';
import { CONSUMABLE_LIST, SPECTRALS, TAROTS } from '../src/core/consumables';
import { Rng } from '../src/core/rng';
import { Run } from '../src/core/run';
import { scoreHand } from '../src/core/scoring';
import { openPackOf, PACK_KINDS, PACK_SHAPE } from '../src/core/shop';
import { TAG_LIST } from '../src/core/tags';
import { availableVouchers, VOUCHERS, VOUCHER_PAIRS } from '../src/core/vouchers';

const c = (id: number, extra: Partial<Card> = {}): Card => ({ id, rank: 2, suit: 'S', ...extra });

/** Run en juego con una mano controlada. */
function playing(seed = 'P5'): Run {
  const r = new Run(seed);
  r.selectBlind();
  return r;
}
function give(r: Run, id: string) {
  const def = CONSUMABLE_LIST.find((d) => d.id === id)!;
  r.addConsumable(def.kind, id);
  return r.consumables[r.consumables.length - 1].uid;
}

describe('enhancements, sellos y ediciones en la puntuación', () => {
  const base = scoreHand([c(1)]).total; // (5+2)×1
  it('base', () => expect(base).toBe(7));
  it('Bonus +30 fichas', () => expect(scoreHand([c(1, { enhancement: 'bonus' })]).total).toBe(37));
  it('Mult +4', () => expect(scoreHand([c(1, { enhancement: 'mult' })]).total).toBe(35));
  it('Glass ×2 y se rompe con 1/4', () => {
    expect(scoreHand([c(1, { enhancement: 'glass' })]).total).toBe(14);
    expect(scoreHand([c(1, { enhancement: 'glass' })], { rng: () => 0 }).destroyed).toEqual([1]);
    expect(scoreHand([c(1, { enhancement: 'glass' })]).destroyed).toEqual([]);
  });
  it('Steel en mano ×1.5', () => {
    expect(scoreHand([c(1)], { held: [c(2, { enhancement: 'steel' })] }).total).toBe(10);
  });
  it('Lucky usa el azar inyectado', () => {
    expect(scoreHand([c(1, { enhancement: 'lucky' })], { rng: () => 0 }).total).toBe(7 * 21);
    expect(scoreHand([c(1, { enhancement: 'lucky' })]).total).toBe(7);
  });
  it('Red Seal repite; Gold Seal da $3', () => {
    expect(scoreHand([c(1, { seal: 'red' })]).total).toBe(9);
    expect(scoreHand([c(1, { seal: 'gold' })]).money).toBe(3);
  });
  it('ediciones de carta: Foil +50, Holo +10 mult, Poly ×1.5', () => {
    expect(scoreHand([c(1, { edition: 'foil' })]).total).toBe(57);
    expect(scoreHand([c(1, { edition: 'holo' })]).total).toBe(77);
    expect(scoreHand([c(1, { edition: 'poly' })]).total).toBe(10);
  });
  it('carta debilitada no puntúa; Flint reduce la base', () => {
    expect(scoreHand([c(1)], { debuff: () => true }).total).toBe(5);
    expect(scoreHand([c(1)], { flint: true }).total).toBe(Math.floor((2 + 2) * 1));
  });
});

describe('Boss Blinds', () => {
  it('hay al menos 8 y el Ante 8 usa finalistas', () => {
    expect(BOSS_LIST.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < 20; i++) expect(pickBoss(new Rng('b' + i), 8, new Set()).finisher).toBe(true);
    for (let i = 0; i < 20; i++) expect(pickBoss(new Rng('b' + i), 1, new Set()).finisher).toBeFalsy();
  });
  it('el Boss de cada Ante es determinista y se puede relanzar', () => {
    expect(new Run('X').boss.id).toBe(new Run('X').boss.id);
    const r = new Run('X');
    r.blindIndex = 2;
    r.vouchers.add('directors_cut');
    r.money = 20;
    const before = r.boss.id;
    r.rerollBoss();
    expect(r.boss.id).not.toBe(before);
    expect(r.money).toBe(10);
    expect(() => r.rerollBoss()).toThrow('Ya relanzaste');
  });
  function bossRun(id: string): Run {
    const r = new Run('BOSS');
    r.blindIndex = 2;
    r.ante = 8;
    (r as unknown as { bossByAnte: Map<number, unknown> }).bossByAnte.set(8, BOSS_LIST.find((b) => b.id === id));
    r.selectBlind();
    return r;
  }
  it('The Needle: una mano y objetivo ×1; The Water: sin descartes; The Wall ×4', () => {
    const n = bossRun('the_needle');
    expect(n.handsLeft).toBe(1);
    expect(n.target).toBe(50000);
    expect(bossRun('the_water').discardsLeft).toBe(0);
    expect(bossRun('the_wall').target).toBe(200000);
  });
  it('The Club debilita tréboles', () => {
    const r = bossRun('the_club');
    expect(r.isDebuffed(c(1, { suit: 'C' }))).toBe(true);
    expect(r.isDebuffed(c(1, { suit: 'H' }))).toBe(false);
  });
  it('The Manacle reduce la mano; The Psychic exige 5 cartas', () => {
    expect(bossRun('the_manacle').hand).toHaveLength(7);
    const r = bossRun('the_psychic');
    expect(() => r.play([r.hand[0].id])).toThrow('boss_five');
  });
  it('The Eye no deja repetir tipo de mano; Chicot anula el Boss', () => {
    const r = bossRun('the_eye');
    r.play([r.hand[0].id]);
    expect(r.playError([r.hand[0]])).toBe('boss_repeat');
    r.addJoker('chicot');
    expect(r.activeBoss).toBeNull();
    expect(r.playError([r.hand[0]])).toBeNull();
  });
  it('Verdant Leaf se levanta al vender un joker', () => {
    const r = new Run('V');
    r.blindIndex = 2;
    r.ante = 8;
    (r as unknown as { bossByAnte: Map<number, unknown> }).bossByAnte.set(8, BOSS_LIST.find((b) => b.id === 'verdant_leaf'));
    const j = r.addJoker('joker');
    r.selectBlind();
    expect(r.isDebuffed(r.hand[0])).toBe(true);
    r.sellJoker(j.uid);
    expect(r.isDebuffed(r.hand[0])).toBe(false);
  });
});

describe('Tarots y Spectrals', () => {
  it('hay 22 Tarots y 18 Spectrals', () => {
    expect(TAROTS).toHaveLength(22);
    expect(SPECTRALS).toHaveLength(18);
  });
  it('Magician/Empress/Hierophant/Lovers/Chariot/Justice/Devil/Tower aplican su enhancement', () => {
    const table: [string, string][] = [
      ['magician', 'lucky'], ['empress', 'mult'], ['hierophant', 'bonus'], ['lovers', 'wild'],
      ['chariot', 'steel'], ['justice', 'glass'], ['devil', 'gold'], ['tower', 'stone'],
    ];
    for (const [tarot, enh] of table) {
      const r = playing();
      const card = r.hand[0];
      r.useConsumable(give(r, tarot), [card.id]);
      expect(card.enhancement).toBe(enh);
    }
  });
  it('Star/Moon/Sun/World cambian el palo', () => {
    for (const [tarot, suit] of [['star', 'D'], ['moon', 'C'], ['sun', 'H'], ['world', 'S']] as const) {
      const r = playing();
      const cards = r.hand.slice(0, 3);
      r.useConsumable(give(r, tarot), cards.map((x) => x.id));
      expect(cards.every((x) => x.suit === suit)).toBe(true);
    }
  });
  it('exige el nº de cartas y no gasta el consumible si falla', () => {
    const r = playing();
    const uid = give(r, 'death');
    expect(() => r.useConsumable(uid, [r.hand[0].id])).toThrow();
    expect(() => r.useConsumable(uid, [])).toThrow();
    expect(r.consumables).toHaveLength(1);
    const [a, b] = r.hand;
    r.useConsumable(uid, [a.id, b.id]);
    expect(a).toMatchObject({ rank: b.rank, suit: b.suit });
    expect(r.consumables).toHaveLength(0);
  });
  it('Strength sube el rango (As→2); Hanged Man destruye cartas del mazo', () => {
    const r = playing();
    const card = r.hand[0];
    const rank = card.rank;
    r.useConsumable(give(r, 'strength'), [card.id]);
    expect(card.rank).toBe(rank === 14 ? 2 : rank + 1);
    const victim = r.hand[1];
    r.useConsumable(give(r, 'hanged_man'), [victim.id]);
    expect(r.hand.find((x) => x.id === victim.id)).toBeUndefined();
    expect(r.fullDeck.find((x) => x.id === victim.id)).toBeUndefined();
  });
  it('Hermit duplica el dinero (máx. +$20); Temperance suma el valor de venta', () => {
    const r = playing();
    r.money = 8;
    r.useConsumable(give(r, 'hermit'));
    expect(r.money).toBe(16);
    r.money = 50;
    r.useConsumable(give(r, 'hermit'));
    expect(r.money).toBe(70);
    r.addJoker('joker');
    r.money = 0;
    r.useConsumable(give(r, 'temperance'));
    expect(r.money).toBe(1);
  });
  it('The Fool copia el último Tarot/Planeta; Emperor y High Priestess crean consumibles', () => {
    const r = playing();
    expect(() => r.useConsumable(give(r, 'fool'))).toThrow();
    r.consumables = [];
    r.useConsumable(give(r, 'hermit'));
    r.useConsumable(give(r, 'fool'));
    expect(r.consumables.map((x) => x.id)).toEqual(['hermit']);
    r.consumables = [];
    r.useConsumable(give(r, 'emperor'));
    expect(r.consumables).toHaveLength(2);
    expect(r.consumables.every((x) => x.kind === 'tarot')).toBe(true);
    r.consumables = [];
    r.useConsumable(give(r, 'high_priestess'));
    expect(r.consumables.every((x) => x.kind === 'planet')).toBe(true);
  });
  it('Judgement crea un joker; sin hueco falla', () => {
    const r = playing();
    r.useConsumable(give(r, 'judgement'));
    expect(r.jokers).toHaveLength(1);
    for (let i = 0; i < 4; i++) r.addJoker('banner');
    expect(() => r.useConsumable(give(r, 'judgement'))).toThrow('Sin espacio');
  });
  it('Wheel of Fortune a veces da edición (determinista por semilla)', () => {
    let hits = 0;
    for (let i = 0; i < 40; i++) {
      const r = playing('W' + i);
      const j = r.addJoker('joker');
      r.useConsumable(give(r, 'wheel_of_fortune'));
      if (j.edition) hits++;
    }
    expect(hits).toBeGreaterThan(3);
    expect(hits).toBeLessThan(25);
  });
  it('los Planetas suben de nivel y Black Hole sube todas las manos', () => {
    const r = playing();
    r.useConsumable(give(r, 'mercury'));
    expect(r.levels.pair).toBe(2);
    r.useConsumable(give(r, 'black_hole'));
    expect(r.levels.pair).toBe(3);
    expect(r.levels.flush).toBe(2);
  });
  it('sellos: Talisman, Deja Vu, Trance, Medium', () => {
    for (const [sp, seal] of [['talisman', 'gold'], ['deja_vu', 'red'], ['trance', 'blue'], ['medium', 'purple']] as const) {
      const r = playing();
      r.useConsumable(give(r, sp), [r.hand[0].id]);
      expect(r.hand[0].seal).toBe(seal);
    }
  });
  it('Aura da edición; Cryptid duplica la carta', () => {
    const r = playing();
    r.useConsumable(give(r, 'aura'), [r.hand[0].id]);
    expect(r.hand[0].edition).toBeDefined();
    const n = r.fullDeck.length;
    r.useConsumable(give(r, 'cryptid'), [r.hand[1].id]);
    expect(r.fullDeck).toHaveLength(n + 2);
  });
  it('Familiar/Grim/Incantation destruyen 1 carta y crean mejoradas', () => {
    for (const [sp, added] of [['familiar', 3], ['grim', 2], ['incantation', 4]] as const) {
      const r = playing();
      const n = r.fullDeck.length;
      r.useConsumable(give(r, sp));
      expect(r.fullDeck).toHaveLength(n - 1 + added);
      expect(r.hand.filter((x) => x.id >= 1000 && x.enhancement)).toHaveLength(added);
    }
  });
  it('Immolate destruye 5 y da $20; Ouija/Ectoplasm reducen la mano', () => {
    const r = playing();
    r.money = 0;
    r.useConsumable(give(r, 'immolate'));
    expect(r.hand).toHaveLength(3);
    expect(r.money).toBe(20);
    const o = playing();
    o.useConsumable(give(o, 'ouija'));
    expect(new Set(o.hand.map((x) => x.rank)).size).toBe(1);
    expect(o.handSizePenalty).toBe(1);
    const e = playing();
    const j = e.addJoker('joker');
    e.useConsumable(give(e, 'ectoplasm'));
    expect(j.edition).toBe('negative');
    expect(e.handSizePenalty).toBe(1);
  });
  it('Ankh copia un joker y destruye el resto; Hex lo hace policromo', () => {
    const r = playing();
    r.addJoker('joker');
    r.addJoker('banner');
    r.addJoker('half_joker');
    r.useConsumable(give(r, 'ankh'));
    expect(r.jokers).toHaveLength(2);
    expect(r.jokers[0].id).toBe(r.jokers[1].id);
    r.useConsumable(give(r, 'hex'));
    expect(r.jokers).toHaveLength(1);
    expect(r.jokers[0].edition).toBe('poly');
  });
  it('Wraith da un joker raro y deja el dinero a 0; The Soul uno legendario', () => {
    const r = playing();
    r.money = 30;
    r.useConsumable(give(r, 'wraith'));
    expect(r.money).toBe(0);
    expect(r.jokers).toHaveLength(1);
    r.useConsumable(give(r, 'the_soul'));
    expect(['triboulet', 'chicot']).toContain(r.jokers[1].id);
  });
  it('slots de consumibles: 2, +1 Crystal Ball, +1 Negative', () => {
    const r = new Run('S');
    expect(r.consumableSlots).toBe(2);
    r.vouchers.add('crystal_ball');
    r.addConsumable('tarot', 'fool', 'negative');
    expect(r.consumableSlots).toBe(4);
  });
  it('vender un consumible da la mitad', () => {
    const r = playing();
    r.money = 0;
    r.sellConsumable(give(r, 'hermit'));
    expect(r.money).toBe(1);
  });
});

describe('sellos al jugar', () => {
  it('Purple Seal crea un Tarot al descartar', () => {
    const r = playing();
    r.hand[0].seal = 'purple';
    r.discard([r.hand[0].id]);
    expect(r.consumables.filter((x) => x.kind === 'tarot')).toHaveLength(1);
  });
  it('Blue Seal en mano crea el Planeta de la última mano; Gold enhancement en mano da $3', () => {
    const r = playing();
    const [played, ...rest] = r.hand;
    rest[0].seal = 'blue';
    rest[1].enhancement = 'gold';
    r.score = 1e9;
    r.play([played.id]);
    expect(r.consumables.map((x) => x.id)).toEqual(['pluto']);
    expect(r.cashout!.heldBonus).toBe(3);
  });
});

describe('Tags', () => {
  it('saltar da el Tag ofrecido; el Boss no tiene', () => {
    for (let i = 0; i < 25; i++) {
      const r = new Run('T' + i);
      const tag = r.offeredTag!;
      expect(TAG_LIST.map((t) => t.id)).toContain(tag);
      r.skipBlind();
      const instant = ['economy', 'handy', 'garbage', 'speed', 'boss'].includes(tag);
      expect(r.tags.includes(tag)).toBe(!instant);
    }
    const r = new Run('B');
    r.blindIndex = 2;
    expect(r.offeredTag).toBeNull();
  });
  it('Coupon deja gratis la tienda; D6 el reroll; Voucher añade un voucher', () => {
    const r = new Run('C');
    r.tags.push('coupon', 'd6', 'voucher');
    r.selectBlind();
    r.score = 1e9;
    r.play([r.hand[0].id]);
    r.collectCashout();
    expect(r.shop!.items.every((i) => !i || i.cost === 0)).toBe(true);
    expect(r.shop!.packs.every((p) => !p || p.cost === 0)).toBe(true);
    expect(r.shop!.rerollCost).toBe(0);
    expect(r.shop!.vouchers).toHaveLength(2);
    expect(r.tags).toEqual([]);
  });
  it('Tags de pack y de joker dan contenido gratuito; Juggle +3 mano; Investment $25', () => {
    const r = new Run('J');
    r.tags.push('charm', 'rare', 'juggle', 'investment');
    r.selectBlind();
    expect(r.hand).toHaveLength(11);
    r.score = 1e9;
    r.play([r.hand[0].id]);
    r.collectCashout();
    expect(r.shop!.packs.some((p) => p?.kind === 'arcana' && p.size === 'mega' && p.cost === 0)).toBe(true);
    expect(r.shop!.items.some((i) => i?.kind === 'joker' && i.cost === 0)).toBe(true);
    const b = new Run('I');
    b.tags.push('investment');
    b.blindIndex = 2;
    b.selectBlind();
    b.score = 1e9;
    b.play([b.hand[0].id]);
    expect(b.cashout!.tagBonus).toBe(25);
  });
  it('Double copia el siguiente Tag', () => {
    const r = new Run('D');
    r.tags.push('double');
    r.skipBlind();
    const t = new Run('D').offeredTag!;
    if (!['economy', 'handy', 'garbage', 'speed', 'boss'].includes(t)) expect(r.tags.filter((x) => x === t)).toHaveLength(2);
  });
});

describe('Vouchers', () => {
  it('32 vouchers en 16 pares; los mejorados exigen el base', () => {
    expect(VOUCHER_PAIRS).toHaveLength(16);
    expect(new Set(VOUCHERS).size).toBe(32);
    const first = availableVouchers(new Set());
    expect(first).toHaveLength(16);
    expect(availableVouchers(new Set(['overstock']))).toContain('overstock_plus');
    expect(availableVouchers(new Set(['overstock']))).not.toContain('overstock');
  });
  function shop(): Run {
    const r = new Run('VV');
    r.selectBlind();
    r.score = 1e9;
    r.play([r.hand[0].id]);
    r.collectCashout();
    r.money = 1000;
    return r;
  }
  it('efectos inmediatos', () => {
    const r = shop();
    const buy = (v: string) => {
      r.shop!.vouchers[0] = v;
      r.buyVoucher(0);
    };
    buy('nacho_tong');
    expect(r.maxHands).toBe(5);
    buy('recyclomancy');
    expect(r.maxDiscards).toBe(5);
    buy('palette');
    expect(r.baseHandSize).toBe(9);
    buy('antimatter');
    expect(r.jokerSlots).toBe(6);
    buy('crystal_ball');
    expect(r.consumableSlots).toBe(3);
    buy('money_tree');
    expect(r.interestCap).toBe(20);
    buy('overstock_plus');
    expect(r.shop!.items.length).toBe(3);
    buy('hieroglyph');
    expect(r.maxHands).toBe(4);
  });
  it('Clearance Sale rebaja un 25 %; reroll_surplus -$2', () => {
    const r = shop();
    const before = r.shop!.packs[0]!.cost;
    r.shop!.vouchers[0] = 'clearance_sale';
    r.buyVoucher(0);
    expect(r.shop!.packs[0]!.cost).toBe(Math.max(1, Math.round(before * 0.75)));
    r.shop!.vouchers[0] = 'reroll_surplus';
    r.buyVoucher(0);
    expect(r.shop!.rerollCost).toBe(3);
  });
  it('Observatory: ×1.5 con el Planeta de esa mano en consumibles', () => {
    const r = playing();
    r.vouchers.add('observatory');
    const card = r.hand[0];
    const base = r.preview([card]).total;
    r.addConsumable('planet', 'pluto');
    expect(r.preview([card]).total).toBe(Math.floor(r.preview([card]).chips * (r.preview([card]).mult)));
    expect(r.preview([card]).total).toBeGreaterThan(base);
  });
});

describe('Packs', () => {
  it('forma de cada tipo/tamaño y 2 elecciones en Mega', () => {
    const ctx = { handPlays: {}, vouchers: new Set<string>(), ownedJokers: new Set<string>() };
    for (const kind of PACK_KINDS) {
      for (const size of ['normal', 'jumbo', 'mega'] as const) {
        const p = openPackOf(new Rng(kind + size), { kind, size }, ctx);
        expect(p.choices).toHaveLength(PACK_SHAPE[kind][size][0]);
        expect(p.picksLeft).toBe(PACK_SHAPE[kind][size][1]);
      }
    }
  });
  it('Mega Buffoon: se eligen dos y luego se cierra', () => {
    const r = new Run('MP');
    r.selectBlind();
    r.score = 1e9;
    r.play([r.hand[0].id]);
    r.collectCashout();
    r.shop!.packs[0] = { kind: 'buffoon', size: 'mega', cost: 0 };
    r.buyPack(0);
    r.pickFromPack(0);
    expect(r.openPack).not.toBeNull();
    r.pickFromPack(0);
    expect(r.openPack).toBeNull();
    expect(r.jokers).toHaveLength(2);
  });
  it('Standard pack añade cartas al mazo; Arcana respeta el espacio de consumibles', () => {
    const r = new Run('SP');
    r.selectBlind();
    r.score = 1e9;
    r.play([r.hand[0].id]);
    r.collectCashout();
    r.shop!.packs[0] = { kind: 'standard', size: 'normal', cost: 0 };
    r.buyPack(0);
    r.pickFromPack(0);
    expect(r.fullDeck).toHaveLength(53);
    r.shop!.packs[1] = { kind: 'arcana', size: 'normal', cost: 0 };
    r.buyPack(1);
    r.addConsumable('tarot', 'fool');
    r.addConsumable('tarot', 'fool');
    expect(() => r.pickFromPack(0)).toThrow('Sin espacio');
    r.skipPack();
    expect(r.openPack).toBeNull();
  });
});
