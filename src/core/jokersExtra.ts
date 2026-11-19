import { RANKS, SUITS, cardIsSuit, isFaceCard, isStone, type Card } from './cards';
import { evaluateHand, type HandType } from './hands';
import { JOKERS, type JokerDef, type JokerInstance } from './jokers';

/**
 * Jokers que necesitan eventos de la run (`onEvent`) o reglas especiales.
 * ⚠ verificar valores/costes contra la fuente oficial (GDD §7).
 */
const HANDS: HandType[] = [
  'high_card', 'pair', 'two_pair', 'three_kind', 'straight', 'flush',
  'full_house', 'four_kind', 'straight_flush', 'five_kind', 'flush_house', 'flush_five',
];
const sell = (j: JokerInstance) => Math.max(1, Math.floor(j.cost / 2)) + (j.state.sell ?? 0);
const st = (j: JokerInstance, k: string) => j.state[k] ?? 0;
const bump = (j: JokerInstance, k: string, by = 1) => { j.state[k] = st(j, k) + by; };
const plain = (c: Card) => !isStone(c);

export const EXTRA_JOKERS: JokerDef[] = [
  // ---------------- Comunes ----------------
  { id: 'credit_card', rarity: 'common', cost: 1, passive: { debt: 20 } },
  {
    id: 'eight_ball', rarity: 'common', cost: 5,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'hand_played') return;
      for (const c of ev.ctx.scoring) {
        if (plain(c) && c.rank === 8 && ev.ctx.rng() < 0.25 * ev.ctx.odds && host.consumableSpace() > 0) host.createConsumable('tarot');
      }
    },
  },
  { id: 'misprint', rarity: 'common', cost: 4, onScore: (_j, c) => (c.preview ? undefined : { mult: Math.min(23, Math.floor(c.rng() * 24)) }) },
  { id: 'chaos_the_clown', rarity: 'common', cost: 4 },
  {
    id: 'delayed_gratification', rarity: 'common', cost: 4,
    roundEndMoney: (_j, _d, i) => (i.discardsUsed === 0 ? 2 * i.discardsLeft : 0),
  },
  { id: 'splash', rarity: 'common', cost: 3 },
  {
    id: 'faceless_joker', rarity: 'common', cost: 4,
    onEvent: (_j, ev, host) => {
      if (ev.type === 'discard' && ev.cards.filter(isFaceCard).length >= 3) host.money += 5;
    },
  },
  {
    id: 'superposition', rarity: 'common', cost: 4,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'hand_played') return;
      const straight = ev.ctx.handType === 'straight' || ev.ctx.handType === 'straight_flush';
      if (straight && ev.ctx.scoring.some((c) => plain(c) && c.rank === 14) && host.consumableSpace() > 0) host.createConsumable('tarot');
    },
  },
  {
    id: 'to_do_list', rarity: 'common', cost: 4,
    onEvent: (j, ev, host) => {
      if (ev.type === 'hand_played' && ev.ctx.handType === HANDS[j.state.hand ?? j.uid % HANDS.length]) host.money += 4;
      if (ev.type === 'round_end') j.state.hand = host.rngFor('todo').int(HANDS.length);
    },
  },
  { id: 'red_card', rarity: 'common', cost: 5, onScore: (j) => (st(j, 'n') ? { mult: 3 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'pack_skipped') bump(j, 'n'); } },
  {
    id: 'riff_raff', rarity: 'common', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'blind_selected') return;
      for (let i = 0; i < 2 && host.jokerSpace() > 0; i++) host.addRandomCommonJoker();
    },
  },
  {
    id: 'mail_in_rebate', rarity: 'common', cost: 4,
    onEvent: (j, ev, host) => {
      if (ev.type === 'discard') host.money += 5 * ev.cards.filter((c) => plain(c) && c.rank === (j.state.rank ?? 2)).length;
      if (ev.type === 'round_end') j.state.rank = RANKS[host.rngFor('mail').int(RANKS.length)];
    },
  },
  {
    id: 'hallucination', rarity: 'common', cost: 4,
    onEvent: (_j, ev, host) => {
      if (ev.type === 'pack_opened' && host.rngFor('halluc').next() < 0.5 * host.odds && host.consumableSpace() > 0) host.createConsumable('tarot');
    },
  },
  {
    id: 'fortune_teller', rarity: 'common', cost: 6,
    onScore: (j) => (st(j, 'n') ? { mult: st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'consumable_used' && ev.kind === 'tarot') bump(j, 'n'); },
  },
  {
    id: 'swashbuckler', rarity: 'common', cost: 4,
    onScore: (j, c) => ({ mult: c.jokers.filter((x) => x !== j).reduce((n, x) => n + sell(x), 0) }),
  },

  // ---------------- Poco comunes ----------------
  {
    id: 'joker_stencil', rarity: 'uncommon', cost: 8,
    onScore: (_j, c) => ({ xmult: Math.max(1, c.jokerSlots - c.jokers.length + c.jokers.filter((x) => x.id === 'joker_stencil').length) }),
  },
  { id: 'four_fingers', rarity: 'uncommon', cost: 7 },
  {
    id: 'ceremonial_dagger', rarity: 'uncommon', cost: 6,
    onScore: (j) => (st(j, 'mult') ? { mult: st(j, 'mult') } : undefined),
    onEvent: (j, ev, host) => {
      if (ev.type !== 'blind_selected') return;
      const right = host.jokers[host.jokers.indexOf(j) + 1];
      if (right && right.sticker !== 'eternal') {
        bump(j, 'mult', 2 * sell(right));
        host.removeJokers([right.uid]);
      }
    },
  },
  {
    id: 'marble_joker', rarity: 'uncommon', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'blind_selected') return;
      const r = host.rngFor('marble');
      host.addCard({ rank: RANKS[r.int(RANKS.length)], suit: SUITS[r.int(4)], enhancement: 'stone' }, false);
    },
  },
  { id: 'pareidolia', rarity: 'uncommon', cost: 5 },
  {
    id: 'space_joker', rarity: 'uncommon', cost: 5,
    onEvent: (_j, ev, host) => {
      if (ev.type === 'hand_played' && ev.ctx.rng() < 0.25 * ev.ctx.odds) host.levelUp(ev.ctx.handType);
    },
  },
  { id: 'burglar', rarity: 'uncommon', cost: 6, passive: { hands: 3, discards: -99 } },
  {
    id: 'sixth_sense', rarity: 'uncommon', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'hand_played' || !ev.first || ev.ctx.played.length !== 1) return;
      const c = ev.ctx.played[0];
      if (plain(c) && c.rank === 6 && host.consumableSpace() > 0) {
        host.destroyCards([c.id], false);
        host.createConsumable('spectral');
      }
    },
  },
  {
    id: 'constellation', rarity: 'uncommon', cost: 6,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.1 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'consumable_used' && ev.kind === 'planet') bump(j, 'n'); },
  },
  {
    id: 'madness', rarity: 'uncommon', cost: 7,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.5 * st(j, 'n') } : undefined),
    onEvent: (j, ev, host) => {
      if (ev.type !== 'blind_selected' || ev.blind === 'boss') return;
      bump(j, 'n');
      const pool = host.jokers.filter((x) => x !== j && x.sticker !== 'eternal');
      if (pool.length) host.removeJokers([pool[host.rngFor('madness').int(pool.length)].uid]);
    },
  },
  {
    id: 'seance', rarity: 'uncommon', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type === 'hand_played' && ev.ctx.handType === 'straight_flush' && host.consumableSpace() > 0) host.createConsumable('spectral');
    },
  },
  {
    id: 'vampire', rarity: 'uncommon', cost: 7,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.1 * st(j, 'n') } : undefined),
    onHandPlayed: (j, c) => {
      for (const card of c.scoring) {
        if (card.enhancement) {
          delete card.enhancement;
          bump(j, 'n');
        }
      }
    },
  },
  { id: 'shortcut', rarity: 'uncommon', cost: 7 },
  {
    id: 'hologram', rarity: 'uncommon', cost: 7,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.25 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'card_added') bump(j, 'n'); },
  },
  {
    id: 'rocket', rarity: 'uncommon', cost: 6,
    roundEndMoney: (j) => j.state.m ?? 1,
    onEvent: (j, ev) => { if (ev.type === 'round_end' && ev.blind === 'boss') j.state.m = (j.state.m ?? 1) + 2; },
  },
  {
    id: 'midas_mask', rarity: 'uncommon', cost: 7,
    onHandPlayed: (_j, c) => { for (const card of c.scoring) if (isFaceCard(card)) card.enhancement = 'gold'; },
  },
  {
    id: 'gift_card', rarity: 'uncommon', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'round_end') return;
      for (const x of host.jokers) bump(x, 'sell');
      for (const c of host.consumables) c.cost += 2;
    },
  },
  {
    id: 'turtle_bean', rarity: 'uncommon', cost: 6,
    dynamicPassive: (j) => ({ handSize: 5 - st(j, 'rounds') }),
    onRoundEnd: (j) => { bump(j, 'rounds'); return 5 - st(j, 'rounds') <= 0; },
  },
  { id: 'to_the_moon', rarity: 'uncommon', cost: 5, roundEndMoney: (_j, _d, i) => Math.floor(Math.max(0, i.money) / 5) },
  {
    id: 'lucky_cat', rarity: 'uncommon', cost: 6,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.25 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'lucky') bump(j, 'n', ev.count); },
  },
  {
    id: 'diet_cola', rarity: 'uncommon', cost: 6,
    onEvent: (j, ev, host) => { if (ev.type === 'sold' && ev.joker === j) host.gainTag('double'); },
  },
  {
    id: 'trading_card', rarity: 'uncommon', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type === 'discard' && ev.first && ev.cards.length === 1) {
        host.destroyCards([ev.cards[0].id], false);
        host.money += 3;
      }
    },
  },
  {
    id: 'flash_card', rarity: 'uncommon', cost: 5,
    onScore: (j) => (st(j, 'n') ? { mult: 2 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'reroll') bump(j, 'n'); },
  },
  {
    id: 'castle', rarity: 'uncommon', cost: 6,
    onScore: (j) => (st(j, 'chips') ? { chips: st(j, 'chips') } : undefined),
    onEvent: (j, ev, host) => {
      if (ev.type === 'discard') bump(j, 'chips', 3 * ev.cards.filter((c) => cardIsSuit(c, SUITS[st(j, 'suit')])).length);
      if (ev.type === 'round_end') j.state.suit = host.rngFor('castle').int(4);
    },
  },
  {
    id: 'mr_bones', rarity: 'uncommon', cost: 5, preventsDeath: true,
  },
  {
    id: 'certificate', rarity: 'uncommon', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'blind_selected') return;
      const r = host.rngFor('cert');
      const seals = ['gold', 'red', 'blue', 'purple'] as const;
      host.addCard({ rank: RANKS[r.int(RANKS.length)], suit: SUITS[r.int(4)], seal: seals[r.int(4)] }, true);
    },
  },
  { id: 'smeared_joker', rarity: 'uncommon', cost: 7 },
  {
    id: 'throwback', rarity: 'uncommon', cost: 6,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.25 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'skip_blind') bump(j, 'n'); },
  },
  {
    id: 'glass_joker', rarity: 'uncommon', cost: 6,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.75 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'cards_destroyed') bump(j, 'n', ev.cards.filter((c) => c.enhancement === 'glass').length); },
  },
  { id: 'showman', rarity: 'uncommon', cost: 5 },
  { id: 'oops_all_6s', rarity: 'uncommon', cost: 4 },
  {
    id: 'the_idol', rarity: 'uncommon', cost: 6,
    onCardScored: (j, _c, card) => (plain(card) && card.rank === (j.state.rank ?? 14) && card.suit === SUITS[st(j, 'suit')] ? { xmult: 2 } : undefined),
    onEvent: (j, ev, host) => {
      if (ev.type !== 'round_end' || !host.fullDeck.length) return;
      const c = host.fullDeck[host.rngFor('idol').int(host.fullDeck.length)];
      j.state.rank = c.rank;
      j.state.suit = SUITS.indexOf(c.suit);
    },
  },
  {
    id: 'matador', rarity: 'uncommon', cost: 7,
    onEvent: (_j, ev, host) => { if (ev.type === 'hand_played' && ev.bossTriggered) host.money += 8; },
  },
  {
    id: 'hit_the_road', rarity: 'uncommon', cost: 8,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.5 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => {
      if (ev.type === 'discard') bump(j, 'n', ev.cards.filter((c) => plain(c) && c.rank === 11).length);
      if (ev.type === 'round_end') j.state.n = 0;
    },
  },
  {
    id: 'satellite', rarity: 'uncommon', cost: 6,
    roundEndMoney: (j) => Object.keys(j.state).filter((k) => k.startsWith('p_')).length,
    onEvent: (j, ev) => { if (ev.type === 'consumable_used' && ev.kind === 'planet') j.state[`p_${ev.id}`] = 1; },
  },
  {
    id: 'astronomer', rarity: 'uncommon', cost: 8,
  },
  {
    id: 'burnt_joker', rarity: 'uncommon', cost: 8,
    onEvent: (_j, ev, host) => { if (ev.type === 'discard' && ev.first) host.levelUp(evaluateHand(ev.cards).hand); },
  },
  {
    id: 'cartomancer', rarity: 'uncommon', cost: 6,
    onEvent: (_j, ev, host) => {
      if (ev.type === 'blind_selected' && host.consumableSpace() > 0) host.createConsumable('tarot');
    },
  },
  {
    id: 'luchador', rarity: 'uncommon', cost: 5,
    onEvent: (j, ev, host) => { if (ev.type === 'sold' && ev.joker === j) host.disableBoss(); },
  },

  // ---------------- Raros ----------------
  {
    id: 'dna', rarity: 'rare', cost: 8,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'hand_played' || !ev.first || ev.ctx.played.length !== 1) return;
      const { rank, suit, enhancement, seal, edition } = ev.ctx.played[0];
      host.addCard({ rank, suit, enhancement, seal, edition }, true);
    },
  },
  {
    id: 'baseball_card', rarity: 'rare', cost: 8,
    onScore: (j, c) => {
      const n = c.jokers.filter((x) => x !== j && JOKERS[x.id].rarity === 'uncommon').length;
      return n ? { xmult: 1.5 ** n } : undefined;
    },
  },
  {
    id: 'ancient_joker', rarity: 'rare', cost: 8,
    onCardScored: (j, _c, card) => (cardIsSuit(card, SUITS[st(j, 'suit')]) ? { xmult: 1.5 } : undefined),
    onEvent: (j, ev, host) => {
      if (ev.type === 'round_end') j.state.suit = (st(j, 'suit') + 1 + host.rngFor('ancient').int(3)) % 4;
    },
  },
  {
    id: 'campfire', rarity: 'rare', cost: 9,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + 0.25 * st(j, 'n') } : undefined),
    onEvent: (j, ev) => {
      if (ev.type === 'sold' && ev.joker !== j) bump(j, 'n');
      if (ev.type === 'round_end' && ev.blind === 'boss') j.state.n = 0;
    },
  },
  {
    id: 'invisible_joker', rarity: 'rare', cost: 8,
    onEvent: (j, ev, host) => {
      if (ev.type === 'round_end') bump(j, 'rounds');
      if (ev.type === 'sold' && ev.joker === j && st(j, 'rounds') >= 2 && host.jokers.length) {
        const src = host.jokers[host.rngFor('invisible').int(host.jokers.length)];
        const copy = host.addJoker(src.id, src.edition);
        copy.state = { ...src.state };
      }
    },
  },
  {
    id: 'vagabond', rarity: 'rare', cost: 8,
    onEvent: (_j, ev, host) => {
      if (ev.type === 'hand_played' && host.money <= 4 && host.consumableSpace() > 0) host.createConsumable('tarot');
    },
  },

  // ---------------- Legendarios ----------------
  {
    id: 'canio', rarity: 'legendary', cost: 20,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + st(j, 'n') } : undefined),
    onEvent: (j, ev) => { if (ev.type === 'cards_destroyed') bump(j, 'n', ev.cards.filter(isFaceCard).length); },
  },
  {
    id: 'yorick', rarity: 'legendary', cost: 20,
    onScore: (j) => (st(j, 'n') ? { xmult: 1 + st(j, 'n') } : undefined),
    onEvent: (j, ev) => {
      if (ev.type !== 'discard') return;
      bump(j, 'd', ev.cards.length);
      while (st(j, 'd') >= 23) {
        bump(j, 'd', -23);
        bump(j, 'n');
      }
    },
  },
  {
    id: 'perkeo', rarity: 'legendary', cost: 20,
    onEvent: (_j, ev, host) => {
      if (ev.type !== 'shop_left' || !host.consumables.length) return;
      const src = host.consumables[host.rngFor('perkeo').int(host.consumables.length)];
      host.addConsumable(src.kind, src.id, 'negative');
    },
  },
];
