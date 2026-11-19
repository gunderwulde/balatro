import { describe, expect, it } from 'vitest';
import { evaluateHand } from '../src/core/hands';
import { JOKER_LIST, JOKERS, sellValue, type JokerEvent, type JokerHost, type JokerInstance } from '../src/core/jokers';
import type { Card, Rank, Suit } from '../src/core/cards';
import { Run } from '../src/core/run';
import { makeCtx, scoreHand } from '../src/core/scoring';

let n = 900;
const mk = (s: string): Card[] =>
  s.split(' ').map((t) => {
    const r = t.slice(0, -1);
    const rank = ({ J: 11, Q: 12, K: 13, A: 14 } as Record<string, number>)[r] ?? Number(r);
    return { id: n++, rank: rank as Rank, suit: t.slice(-1) as Suit };
  });
let uid = 1;
const joker = (id: string, state: Record<string, number> = {}, cost = 4): JokerInstance => ({ uid: uid++, id, cost, state });
const total = (cards: string, js: JokerInstance[], extra: object = {}) => scoreHand(mk(cards), { jokers: js, ...extra }).total;

/** Anfitrión de pruebas: registra las llamadas. */
function mockHost(over: Partial<JokerHost> = {}) {
  const calls: string[] = [];
  const host = {
    money: 0, jokers: [] as JokerInstance[], consumables: [], hand: [], fullDeck: [], odds: 1,
    rngFor: () => ({ next: () => 0, int: () => 0 }),
    levelUp: (h: string) => calls.push('level:' + h),
    addConsumable: (k: string, id: string, e?: string) => calls.push(`cons:${k}:${id}:${e}`),
    createConsumable: (k: string) => calls.push('create:' + k),
    consumableSpace: () => 1,
    jokerSpace: () => 2,
    addJoker: (id: string) => { calls.push('joker:' + id); return joker(id); },
    addRandomCommonJoker: () => calls.push('common'),
    removeJokers: (u: number[]) => calls.push('rm:' + u.join()),
    destroyCards: (ids: number[]) => calls.push('destroy:' + ids.join()),
    addCard: (t: Omit<Card, 'id'>, toHand: boolean) => { calls.push(`card:${t.rank}${t.suit}${t.enhancement ?? ''}${t.seal ?? ''}:${toHand}`); return { id: 1, ...t }; },
    gainTag: (t: string) => calls.push('tag:' + t),
    disableBoss: () => calls.push('boss'),
    ...over,
  } as unknown as JokerHost;
  return { host, calls };
}
const fire = (j: JokerInstance, ev: JokerEvent, host: JokerHost) => JOKERS[j.id].onEvent?.(j, ev, host);
const handEv = (cards: string, first = true, bossTriggered = false, rng = () => 0): JokerEvent => {
  const played = mk(cards);
  return { type: 'hand_played', ctx: makeCtx(played, { rng }), first, bossTriggered };
};
const discardEv = (cards: string, first = true): JokerEvent => ({ type: 'discard', cards: mk(cards), first });
const playing = (jokers: string[], seed = 'J3') => {
  const r = new Run(seed);
  for (const id of jokers) r.addJoker(id);
  r.selectBlind();
  return r;
};

describe('reglas de mano: Four Fingers, Shortcut, Smeared, Pareidolia, Splash', () => {
  it('Four Fingers: Color y Escalera con 4 cartas', () => {
    expect(evaluateHand(mk('2S 5S 9S KS 3H')).hand).toBe('high_card');
    const r = scoreHand(mk('2S 5S 9S KS 3H'), { jokers: [joker('four_fingers')] });
    expect(r.hand).toBe('flush');
    expect(r.scoring).toHaveLength(4);
    expect(scoreHand(mk('4S 5H 6D 7C KS'), { jokers: [joker('four_fingers')] }).hand).toBe('straight');
  });
  it('Shortcut: Escalera con huecos de 1', () => {
    expect(evaluateHand(mk('2S 4H 6D 8C 10S')).hand).toBe('high_card');
    expect(scoreHand(mk('2S 4H 6D 8C 10S'), { jokers: [joker('shortcut')] }).hand).toBe('straight');
    expect(scoreHand(mk('2S 5H 6D 8C 10S'), { jokers: [joker('shortcut')] }).hand).toBe('high_card');
  });
  it('Smeared: ♥≡♦ y ♠≡♣', () => {
    expect(evaluateHand(mk('2H 5D 9H KD 3H')).hand).toBe('high_card');
    expect(scoreHand(mk('2H 5D 9H KD 3H'), { jokers: [joker('smeared_joker')] }).hand).toBe('flush');
    expect(scoreHand(mk('2H 5S 9H KD 3H'), { jokers: [joker('smeared_joker')] }).hand).toBe('high_card');
  });
  it('Pareidolia: todas son figuras', () => {
    expect(total('9S', [joker('scary_face')])).toBe(14);
    expect(total('9S', [joker('pareidolia'), joker('scary_face')])).toBe(14 + 30);
  });
  it('Splash: todas las cartas puntúan', () => {
    expect(total('9S 3H', [])).toBe(14);
    expect(total('9S 3H', [joker('splash')])).toBe(5 + 9 + 3);
  });
});

describe('jokers de puntuación (lote 4)', () => {
  it('Misprint: azar en juego, nada en la vista previa', () => {
    expect(total('9S', [joker('misprint')], { rng: () => 0.5 })).toBe(14 * 13);
    expect(total('9S', [joker('misprint')])).toBe(14);
  });
  it('Swashbuckler suma el valor de venta de los demás', () => {
    expect(total('9S', [joker('swashbuckler'), joker('joker')])).toBe(14 * (1 + 2 + 4));
  });
  it('Joker Stencil: ×1 por hueco vacío', () => {
    expect(total('9S', [joker('joker_stencil')])).toBe(14 * 5);
  });
  it('Constellation, Hologram, Lucky Cat, Glass, Throwback, Hit the Road, Canio, Campfire escalan', () => {
    expect(total('9S', [joker('constellation', { n: 5 })])).toBe(Math.floor(14 * 1.5));
    expect(total('9S', [joker('hologram', { n: 4 })])).toBe(14 * 2);
    expect(total('9S', [joker('lucky_cat', { n: 4 })])).toBe(14 * 2);
    expect(total('9S', [joker('glass_joker', { n: 2 })])).toBe(Math.floor(14 * 2.5));
    expect(total('9S', [joker('throwback', { n: 4 })])).toBe(14 * 2);
    expect(total('9S', [joker('hit_the_road', { n: 2 })])).toBe(14 * 2);
    expect(total('9S', [joker('canio', { n: 1 })])).toBe(14 * 2);
    expect(total('9S', [joker('campfire', { n: 4 })])).toBe(14 * 2);
  });
  it('Mult acumulado: Fortune Teller, Red Card, Flash Card, Ceremonial Dagger; Castle da fichas', () => {
    expect(total('9S', [joker('fortune_teller', { n: 3 })])).toBe(14 * 4);
    expect(total('9S', [joker('red_card', { n: 2 })])).toBe(14 * 7);
    expect(total('9S', [joker('flash_card', { n: 2 })])).toBe(14 * 5);
    expect(total('9S', [joker('ceremonial_dagger', { mult: 8 })])).toBe(14 * 9);
    expect(total('9S', [joker('castle', { chips: 6 })])).toBe(20);
  });
  it('Vampire, Idol, Ancient, Baseball Card', () => {
    expect(total('9S', [joker('vampire', { n: 10 })])).toBe(14 * 2);
    expect(total('9S', [joker('the_idol', { rank: 9, suit: 0 })])).toBe(14 * 2);
    expect(total('9H', [joker('the_idol', { rank: 9, suit: 0 })])).toBe(14);
    expect(total('9S', [joker('ancient_joker', { suit: 0 })])).toBe(Math.floor(14 * 1.5));
    expect(total('9S', [joker('baseball_card'), joker('fibonacci')])).toBe(Math.floor(14 * 1.5));
  });
  it('Oops! All 6s duplica las probabilidades', () => {
    const lucky = mk('9S');
    lucky[0].enhancement = 'lucky';
    // 0.3 < 0.2*2 pero no < 0.2
    const base = scoreHand(lucky, { rng: () => 0.3 }).total;
    const oops = scoreHand(lucky, { rng: () => 0.3, jokers: [joker('oops_all_6s')] }).total;
    expect(oops).toBeGreaterThan(base);
    expect(scoreHand(lucky, { rng: () => 0.3, jokers: [joker('oops_all_6s')] }).lucky).toBeGreaterThan(0);
  });
});

describe('jokers con eventos (lote 4)', () => {
  it('Eight Ball, Superposition, Seance, Vagabond, Cartomancer crean consumibles', () => {
    let { host, calls } = mockHost();
    fire(joker('eight_ball'), handEv('8S'), host);
    expect(calls).toEqual(['create:tarot']);
    ({ host, calls } = mockHost());
    fire(joker('eight_ball'), handEv('8S', true, false, () => 0.9), host);
    expect(calls).toEqual([]);
    ({ host, calls } = mockHost());
    fire(joker('superposition'), handEv('AS 2H 3D 4C 5S'), host);
    expect(calls).toEqual(['create:tarot']);
    ({ host, calls } = mockHost());
    fire(joker('seance'), handEv('2S 3S 4S 5S 6S'), host);
    expect(calls).toEqual(['create:spectral']);
    ({ host, calls } = mockHost({ money: 4 }));
    fire(joker('vagabond'), handEv('9S'), host);
    expect(calls).toEqual(['create:tarot']);
    ({ host, calls } = mockHost({ money: 5 }));
    fire(joker('vagabond'), handEv('9S'), host);
    expect(calls).toEqual([]);
    ({ host, calls } = mockHost());
    fire(joker('cartomancer'), { type: 'blind_selected', blind: 'small' }, host);
    expect(calls).toEqual(['create:tarot']);
  });
  it('Sixth Sense, DNA y Space Joker', () => {
    let { host, calls } = mockHost();
    const six = mk('6S');
    fire(joker('sixth_sense'), { type: 'hand_played', ctx: makeCtx(six, {}), first: true, bossTriggered: false }, host);
    expect(calls).toEqual([`destroy:${six[0].id}`, 'create:spectral']);
    ({ host, calls } = mockHost());
    fire(joker('sixth_sense'), handEv('7S'), host);
    expect(calls).toEqual([]);
    ({ host, calls } = mockHost());
    fire(joker('dna'), handEv('KH'), host);
    expect(calls).toEqual(['card:13H:true']);
    ({ host, calls } = mockHost());
    fire(joker('dna'), handEv('KH', false), host);
    expect(calls).toEqual([]);
    ({ host, calls } = mockHost());
    fire(joker('space_joker'), handEv('9S 9H'), host);
    expect(calls).toEqual(['level:pair']);
  });
  it('dinero: Faceless, Mail-In, Trading Card, To Do List, Matador, Mail-In', () => {
    let { host } = mockHost();
    fire(joker('faceless_joker'), discardEv('KS QH JD'), host);
    expect(host.money).toBe(5);
    ({ host } = mockHost());
    fire(joker('faceless_joker'), discardEv('KS QH 2D'), host);
    expect(host.money).toBe(0);
    ({ host } = mockHost());
    fire(joker('mail_in_rebate'), discardEv('2S 2H 3D'), host);
    expect(host.money).toBe(10);
    let m = mockHost();
    fire(joker('trading_card'), discardEv('5S'), m.host);
    expect(m.host.money).toBe(3);
    expect(m.calls[0]).toMatch(/^destroy:/);
    m = mockHost();
    fire(joker('trading_card'), discardEv('5S', false), m.host);
    expect(m.calls).toEqual([]);
    m = mockHost();
    const todo = joker('to_do_list', { hand: 1 });
    fire(todo, handEv('9S 9H'), m.host);
    expect(m.host.money).toBe(4);
    fire(todo, { type: 'round_end', blind: 'small' }, m.host);
    expect(todo.state.hand).toBe(0);
    m = mockHost();
    fire(joker('matador'), handEv('9S', true, true), m.host);
    expect(m.host.money).toBe(8);
    m = mockHost();
    fire(joker('matador'), handEv('9S', true, false), m.host);
    expect(m.host.money).toBe(0);
  });
  it('roundEndMoney: Delayed Gratification, To the Moon, Rocket, Satellite', () => {
    const info = { money: 23, discardsUsed: 0, discardsLeft: 3 };
    expect(JOKERS.delayed_gratification.roundEndMoney!(joker('delayed_gratification'), [], info)).toBe(6);
    expect(JOKERS.delayed_gratification.roundEndMoney!(joker('delayed_gratification'), [], { ...info, discardsUsed: 1 })).toBe(0);
    expect(JOKERS.to_the_moon.roundEndMoney!(joker('to_the_moon'), [], info)).toBe(4);
    const rocket = joker('rocket');
    expect(JOKERS.rocket.roundEndMoney!(rocket, [], info)).toBe(1);
    const { host } = mockHost();
    fire(rocket, { type: 'round_end', blind: 'big' }, host);
    expect(rocket.state.m ?? 1).toBe(1);
    fire(rocket, { type: 'round_end', blind: 'boss' }, host);
    expect(JOKERS.rocket.roundEndMoney!(rocket, [], info)).toBe(3);
    const sat = joker('satellite');
    fire(sat, { type: 'consumable_used', kind: 'planet', id: 'mercury' }, host);
    fire(sat, { type: 'consumable_used', kind: 'planet', id: 'mercury' }, host);
    fire(sat, { type: 'consumable_used', kind: 'planet', id: 'venus' }, host);
    fire(sat, { type: 'consumable_used', kind: 'tarot', id: 'fool' }, host);
    expect(JOKERS.satellite.roundEndMoney!(sat, [], info)).toBe(2);
  });
  it('contadores: Fortune Teller, Constellation, Hologram, Throwback, Flash, Red Card, Lucky Cat, Glass, Canio, Yorick, Hit the Road, Campfire', () => {
    const { host } = mockHost();
    const each = (id: string, evs: JokerEvent[], key = 'n') => {
      const j = joker(id);
      for (const e of evs) fire(j, e, host);
      return j.state[key] ?? 0;
    };
    expect(each('fortune_teller', [{ type: 'consumable_used', kind: 'tarot', id: 'fool' }, { type: 'consumable_used', kind: 'planet', id: 'venus' }])).toBe(1);
    expect(each('constellation', [{ type: 'consumable_used', kind: 'planet', id: 'venus' }])).toBe(1);
    expect(each('hologram', [{ type: 'card_added', card: mk('2S')[0] }])).toBe(1);
    expect(each('throwback', [{ type: 'skip_blind' }, { type: 'skip_blind' }])).toBe(2);
    expect(each('flash_card', [{ type: 'reroll' }])).toBe(1);
    expect(each('red_card', [{ type: 'pack_skipped' }])).toBe(1);
    expect(each('lucky_cat', [{ type: 'lucky', count: 3 }])).toBe(3);
    const glass = mk('2S 3S');
    glass[0].enhancement = 'glass';
    expect(each('glass_joker', [{ type: 'cards_destroyed', cards: glass }])).toBe(1);
    expect(each('canio', [{ type: 'cards_destroyed', cards: mk('KS 2S QH') }])).toBe(2);
    expect(each('yorick', [discardEv('2S 3S 4S 5S 6S'), discardEv('2S 3S 4S 5S 6S'), discardEv('2S 3S 4S 5S 6S'), discardEv('2S 3S 4S 5S 6S'), discardEv('2S 3S 4S 5S 6S')])).toBe(1);
    expect(each('hit_the_road', [discardEv('JS JH 2D')])).toBe(2);
    expect(each('hit_the_road', [discardEv('JS JH 2D'), { type: 'round_end', blind: 'small' }])).toBe(0);
    const camp = joker('campfire');
    fire(camp, { type: 'sold', joker: null }, host);
    fire(camp, { type: 'sold', joker: joker('joker') }, host);
    fire(camp, { type: 'sold', joker: camp }, host);
    expect(camp.state.n).toBe(2);
    fire(camp, { type: 'round_end', blind: 'boss' }, host);
    expect(camp.state.n).toBe(0);
  });
  it('Castle, Burnt Joker, Gift Card, Ceremonial Dagger, Madness, Riff-Raff, Marble, Certificate', () => {
    let m = mockHost();
    const castle = joker('castle');
    fire(castle, discardEv('2S 3S 4H'), m.host);
    expect(castle.state.chips).toBe(6);
    m = mockHost();
    fire(joker('burnt_joker'), discardEv('9S 9H'), m.host);
    expect(m.calls).toEqual(['level:pair']);
    m = mockHost();
    fire(joker('burnt_joker'), discardEv('9S 9H', false), m.host);
    expect(m.calls).toEqual([]);

    const a = joker('gift_card');
    const b = joker('joker');
    const cons = [{ uid: 1, id: 'fool', kind: 'tarot', cost: 3 }];
    m = mockHost({ jokers: [a, b], consumables: cons } as Partial<JokerHost>);
    fire(a, { type: 'round_end', blind: 'small' }, m.host);
    expect([sellValue(a), sellValue(b), cons[0].cost]).toEqual([3, 3, 5]);

    const dag = joker('ceremonial_dagger');
    const right = joker('joker', {}, 6);
    m = mockHost({ jokers: [dag, right] } as Partial<JokerHost>);
    fire(dag, { type: 'blind_selected', blind: 'small' }, m.host);
    expect(m.calls).toEqual([`rm:${right.uid}`]);
    expect(dag.state.mult).toBe(6);

    const mad = joker('madness');
    const victim = joker('joker');
    m = mockHost({ jokers: [mad, victim] } as Partial<JokerHost>);
    fire(mad, { type: 'blind_selected', blind: 'boss' }, m.host);
    expect(m.calls).toEqual([]);
    fire(mad, { type: 'blind_selected', blind: 'big' }, m.host);
    expect(m.calls).toEqual([`rm:${victim.uid}`]);
    expect(mad.state.n).toBe(1);

    m = mockHost();
    fire(joker('riff_raff'), { type: 'blind_selected', blind: 'small' }, m.host);
    expect(m.calls).toEqual(['common', 'common']);
    m = mockHost();
    fire(joker('marble_joker'), { type: 'blind_selected', blind: 'small' }, m.host);
    expect(m.calls[0]).toMatch(/stone:false$/);
    m = mockHost();
    fire(joker('certificate'), { type: 'blind_selected', blind: 'small' }, m.host);
    expect(m.calls[0]).toMatch(/gold:true$/);
  });
  it('ventas: Diet Cola, Luchador, Invisible Joker, Perkeo, Hallucination', () => {
    let m = mockHost();
    const cola = joker('diet_cola');
    fire(cola, { type: 'sold', joker: cola }, m.host);
    expect(m.calls).toEqual(['tag:double']);
    m = mockHost();
    const luch = joker('luchador');
    fire(luch, { type: 'sold', joker: luch }, m.host);
    expect(m.calls).toEqual(['boss']);
    const inv = joker('invisible_joker');
    const other = joker('joker');
    m = mockHost({ jokers: [other] } as Partial<JokerHost>);
    fire(inv, { type: 'sold', joker: inv }, m.host);
    expect(m.calls).toEqual([]);
    fire(inv, { type: 'round_end', blind: 'small' }, m.host);
    fire(inv, { type: 'round_end', blind: 'small' }, m.host);
    fire(inv, { type: 'sold', joker: inv }, m.host);
    expect(m.calls).toEqual(['joker:joker']);
    m = mockHost({ consumables: [{ uid: 1, id: 'venus', kind: 'planet', cost: 3 }] } as Partial<JokerHost>);
    fire(joker('perkeo'), { type: 'shop_left' }, m.host);
    expect(m.calls).toEqual(['cons:planet:venus:negative']);
    m = mockHost();
    fire(joker('hallucination'), { type: 'pack_opened' }, m.host);
    expect(m.calls).toEqual(['create:tarot']);
  });
  it('Vampire y Midas Mask modifican las cartas jugadas; Idol/Ancient/Castle rotan', () => {
    const cards = mk('KS 9H');
    cards[0].enhancement = 'bonus';
    const v = joker('vampire');
    JOKERS.vampire.onHandPlayed!(v, makeCtx(cards, {}));
    expect(cards[0].enhancement).toBeUndefined();
    const face = mk('KS');
    JOKERS.midas_mask.onHandPlayed!(joker('midas_mask'), makeCtx(face, {}));
    expect(face[0].enhancement).toBe('gold');
    const { host } = mockHost({ fullDeck: mk('7D') } as Partial<JokerHost>);
    const idol = joker('the_idol');
    fire(idol, { type: 'round_end', blind: 'small' }, host);
    expect([idol.state.rank, idol.state.suit]).toEqual([7, 2]);
    const anc = joker('ancient_joker');
    fire(anc, { type: 'round_end', blind: 'small' }, host);
    expect(anc.state.suit).not.toBe(0);
  });
});

describe('jokers con el motor (lote 4)', () => {
  it('Credit Card: deuda hasta -$20', () => {
    const r = new Run('CC');
    r.addJoker('credit_card');
    r.selectBlind();
    r.score = 1e12;
    r.play([r.hand[0].id]);
    r.collectCashout();
    r.money = 0;
    const item = r.shop!.items.findIndex((i) => i && i.cost <= 20);
    expect(item).toBeGreaterThanOrEqual(0);
    const cost = r.shop!.items[item]!.cost;
    r.buy(item);
    expect(r.money).toBe(-cost);
    r.money = -20;
    expect(() => r.reroll()).toThrow('insuficiente');
  });
  it('Chaos the Clown: un relanzamiento gratis por tienda', () => {
    const r = new Run('CH');
    r.addJoker('chaos_the_clown');
    r.selectBlind();
    r.score = 1e12;
    r.play([r.hand[0].id]);
    r.collectCashout();
    r.money = 0;
    expect(r.shop!.free).toBe(1);
    r.reroll();
    expect(r.shop!.free).toBe(0);
    expect(r.shop!.rerollCost).toBe(5);
    expect(() => r.reroll()).toThrow('insuficiente');
  });
  it('Burglar: +3 manos y sin descartes', () => {
    const r = playing(['burglar']);
    expect(r.handsLeft).toBe(r.maxHands + 3);
    expect(r.discardsLeft).toBe(0);
  });
  it('Turtle Bean: +5 de mano que baja cada ronda y se destruye', () => {
    const r = new Run('TB');
    const base = r.handSize;
    const t = r.addJoker('turtle_bean');
    expect(r.handSize).toBe(base + 5);
    t.state.rounds = 4;
    expect(r.handSize).toBe(base + 1);
    r.selectBlind();
    r.score = 1e12;
    r.play([r.hand[0].id]);
    expect(r.jokers).toHaveLength(0);
  });
  it('Mr. Bones evita perder con el 25 % del objetivo y se destruye', () => {
    const r = playing(['mr_bones']);
    r.handsLeft = 1;
    r.score = Math.floor(r.target * 0.3);
    const res = r.play([r.hand[0].id]);
    expect(res.lost).toBe(false);
    expect(res.cleared).toBe(true);
    expect(r.jokers).toHaveLength(0);
    const r2 = playing([]);
    r2.handsLeft = 1;
    expect(r2.play([r2.hand[0].id]).lost).toBe(true);
  });
  it('Diet Cola al venderlo da un Tag Doble; Campfire cuenta ventas reales', () => {
    const r = new Run('DC');
    const cola = r.addJoker('diet_cola');
    r.addJoker('campfire');
    r.sellJoker(cola.uid);
    expect(r.tags).toContain('double');
    expect(r.jokers[0].state.n).toBe(1);
  });
  it('Showman permite duplicados; Astronomer abarata Planetas y packs Celestiales', () => {
    const owned = (r: Run) => {
      for (const d of JOKER_LIST.filter((x) => (x.rarity === 'common' || x.rarity === 'uncommon') && x.id !== 'showman')) r.addJoker(d.id);
    };
    let dup = 0;
    let dupWithout = 0;
    for (let i = 0; i < 40; i++) {
      for (const withShowman of [true, false]) {
        const r = new Run('SH' + i);
        owned(r);
        if (withShowman) r.addJoker('showman');
        r.selectBlind();
        r.score = 1e12;
        r.play([r.hand[0].id]);
        r.collectCashout();
        const ids = new Set(r.jokers.map((j) => j.id));
        const hits = r.shop!.items.filter((it) => it?.kind === 'joker' && ids.has(it.id)).length;
        if (withShowman) dup += hits;
        else dupWithout += hits;
      }
    }
    expect(dup).toBeGreaterThan(0);
    expect(dupWithout).toBe(0);
    let free = 0;
    for (let i = 0; i < 60; i++) {
      const r = new Run('AS' + i);
      r.addJoker('astronomer');
      r.selectBlind();
      r.score = 1e12;
      r.play([r.hand[0].id]);
      r.collectCashout();
      for (const it of r.shop!.items) if (it?.kind === 'planet') { expect(it.cost).toBe(0); free++; }
      for (const p of r.shop!.packs) if (p?.kind === 'celestial') expect(p.cost).toBe(0);
    }
    expect(free).toBeGreaterThan(0);
  });
  it('eventos reales: Hologram con cartas nuevas, Satellite/Constellation con Planetas, Flash Card con relanzamientos', () => {
    const r = new Run('EV');
    const holo = r.addJoker('hologram');
    r.addCard({ rank: 5, suit: 'S' }, false);
    expect(holo.state.n).toBe(1);
    const con = r.addJoker('constellation');
    r.addConsumable('planet', 'mercury');
    r.useConsumable(r.consumables[0].uid);
    expect(con.state.n).toBe(1);
    const flash = r.addJoker('flash_card');
    r.selectBlind();
    r.score = 1e12;
    r.play([r.hand[0].id]);
    r.collectCashout();
    r.money = 50;
    r.reroll();
    expect(flash.state.n).toBe(1);
  });
  it('Glass Joker y Canio reaccionan a cartas destruidas de verdad', () => {
    const r = new Run('GL');
    const glass = r.addJoker('glass_joker');
    const canio = r.addJoker('canio');
    const g = r.addCard({ rank: 13, suit: 'S', enhancement: 'glass' }, false);
    r.destroyCards([g.id], false);
    expect(glass.state.n).toBe(1);
    expect(canio.state.n).toBe(1);
  });
});
