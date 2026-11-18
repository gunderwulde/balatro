import { ENHANCEMENTS, RANKS, SUITS, type Card, type Enhancement, type Rank, type Seal, type Suit } from './cards';
import { CONSUMABLES, TAROTS, type ConsumableKind } from './consumables';
import type { HandType } from './hands';
import { sellValue, type Edition, type JokerInstance } from './jokers';
import { PLANETS, PLANET_BY_ID } from './planets';
import type { Rng } from './rng';
import { legendaryJokerId, rollJoker, type CardTemplate } from './shop';

/** Lo que los efectos de Tarot/Spectral necesitan de la run (la clase `Run` lo implementa). */
export interface EffectHost {
  hand: Card[];
  money: number;
  jokers: JokerInstance[];
  levels: Partial<Record<HandType, number>>;
  vouchers: Set<string>;
  handSizePenalty: number;
  lastConsumed: { kind: ConsumableKind; id: string } | null;
  message: string | null;
  rngFor(tag: string): Rng;
  consumableSpace(): number;
  jokerSpace(): number;
  addConsumable(kind: ConsumableKind, id: string, edition?: 'negative'): void;
  addJoker(id: string, edition?: Edition): JokerInstance;
  removeJokers(uids: number[]): void;
  destroyCards(ids: number[]): void;
  addCard(t: CardTemplate, toHand: boolean): Card;
  levelUp(hand: HandType): void;
}

const need = (ok: boolean, msg: string) => {
  if (!ok) throw new Error(msg);
};
const pick = <T>(rng: Rng, xs: T[]): T => xs[rng.int(xs.length)];
const randomEnhancement = (rng: Rng): Enhancement => pick(rng, ENHANCEMENTS.filter((e) => e !== 'stone'));
const randomEdition = (rng: Rng) => pick(rng, ['foil', 'holo', 'poly'] as const);

function enhance(cards: Card[], e: Enhancement) {
  for (const c of cards) c.enhancement = e;
}
function setSuit(cards: Card[], s: Suit) {
  for (const c of cards) c.suit = s;
}
function setSeal(cards: Card[], s: Seal) {
  for (const c of cards) c.seal = s;
}

function createConsumables(h: EffectHost, rng: Rng, kind: 'tarot' | 'planet', n: number) {
  const count = Math.min(n, h.consumableSpace());
  need(count > 0, 'Sin espacio para consumibles');
  for (let i = 0; i < count; i++) {
    const ids = kind === 'tarot' ? TAROTS.map((c) => c.id) : PLANETS.filter((p) => !p.secret).map((p) => p.id);
    h.addConsumable(kind, pick(rng, ids));
  }
}

function destroyRandomInHand(h: EffectHost, rng: Rng, n: number) {
  const ids: number[] = [];
  const pool = [...h.hand];
  for (let i = 0; i < n && pool.length; i++) ids.push(pool.splice(rng.int(pool.length), 1)[0].id);
  h.destroyCards(ids);
}

function addEnhanced(h: EffectHost, rng: Rng, ranks: Rank[], n: number) {
  for (let i = 0; i < n; i++) {
    h.addCard({ rank: pick(rng, ranks), suit: pick(rng, SUITS), enhancement: randomEnhancement(rng) }, true);
  }
}

function onlyJokersToKeep(h: EffectHost, keep: JokerInstance) {
  h.removeJokers(h.jokers.filter((j) => j.uid !== keep.uid).map((j) => j.uid));
}

/** Aplica el efecto de un Tarot/Spectral. Lanza un Error (sin mutar) si no se puede usar. `cards` en orden de mano. */
export function applyConsumable(h: EffectHost, id: string, cards: Card[]): void {
  const def = CONSUMABLES[id];
  const rng = h.rngFor(`use:${id}`);
  const hasJokers = h.jokers.length > 0;
  const noEdition = h.jokers.filter((j) => !j.edition);

  switch (id) {
    // ---------------- Tarot ----------------
    case 'fool': {
      need(!!h.lastConsumed, 'Aún no has usado ningún Tarot o Planeta');
      need(h.consumableSpace() > 0, 'Sin espacio para consumibles');
      h.addConsumable(h.lastConsumed!.kind, h.lastConsumed!.id);
      return;
    }
    case 'magician': enhance(cards, 'lucky'); return;
    case 'high_priestess': createConsumables(h, rng, 'planet', 2); return;
    case 'empress': enhance(cards, 'mult'); return;
    case 'emperor': createConsumables(h, rng, 'tarot', 2); return;
    case 'hierophant': enhance(cards, 'bonus'); return;
    case 'lovers': enhance(cards, 'wild'); return;
    case 'chariot': enhance(cards, 'steel'); return;
    case 'justice': enhance(cards, 'glass'); return;
    case 'hermit': h.money += Math.min(Math.max(0, h.money), 20); return;
    case 'wheel_of_fortune': {
      need(noEdition.length > 0, 'Ningún joker sin edición');
      if (rng.next() < 0.25) pick(rng, noEdition).edition = rng.next() < 0.5 ? 'foil' : rng.next() < 0.7 ? 'holo' : 'poly';
      else h.message = 'wheel_nope';
      return;
    }
    case 'strength': for (const c of cards) c.rank = (c.rank === 14 ? 2 : c.rank + 1) as Rank; return;
    case 'hanged_man': h.destroyCards(cards.map((c) => c.id)); return;
    case 'death': {
      const [left, right] = cards;
      left.rank = right.rank;
      left.suit = right.suit;
      left.enhancement = right.enhancement;
      left.seal = right.seal;
      left.edition = right.edition;
      return;
    }
    case 'temperance': h.money += Math.min(50, h.jokers.reduce((n, j) => n + sellValue(j), 0)); return;
    case 'devil': enhance(cards, 'gold'); return;
    case 'tower': enhance(cards, 'stone'); return;
    case 'star': setSuit(cards, 'D'); return;
    case 'moon': setSuit(cards, 'C'); return;
    case 'sun': setSuit(cards, 'H'); return;
    case 'world': setSuit(cards, 'S'); return;
    case 'judgement': {
      need(h.jokerSpace() > 0, 'Sin espacio para jokers');
      const j = rollJoker(rng, new Set(h.jokers.map((x) => x.id)), h.vouchers);
      need(!!j, 'No quedan jokers');
      h.addJoker(j!.id, j!.edition);
      return;
    }

    // ---------------- Spectral ----------------
    case 'familiar': need(h.hand.length > 0, 'Sin cartas en la mano'); destroyRandomInHand(h, rng, 1); addEnhanced(h, rng, [11, 12, 13], 3); return;
    case 'grim': need(h.hand.length > 0, 'Sin cartas en la mano'); destroyRandomInHand(h, rng, 1); addEnhanced(h, rng, [14], 2); return;
    case 'incantation': need(h.hand.length > 0, 'Sin cartas en la mano'); destroyRandomInHand(h, rng, 1); addEnhanced(h, rng, [2, 3, 4, 5, 6, 7, 8, 9, 10], 4); return;
    case 'talisman': setSeal(cards, 'gold'); return;
    case 'deja_vu': setSeal(cards, 'red'); return;
    case 'trance': setSeal(cards, 'blue'); return;
    case 'medium': setSeal(cards, 'purple'); return;
    case 'aura': cards[0].edition = randomEdition(rng); return;
    case 'cryptid': {
      const c = cards[0];
      for (let i = 0; i < 2; i++) h.addCard({ rank: c.rank, suit: c.suit, enhancement: c.enhancement, seal: c.seal, edition: c.edition }, true);
      return;
    }
    case 'wraith': {
      need(h.jokerSpace() > 0, 'Sin espacio para jokers');
      const j = rollJoker(rng, new Set(h.jokers.map((x) => x.id)), h.vouchers, { rarity: 'rare', edition: undefined });
      need(!!j, 'No quedan jokers raros');
      h.addJoker(j!.id);
      h.money = 0;
      return;
    }
    case 'the_soul': {
      need(h.jokerSpace() > 0, 'Sin espacio para jokers');
      const lid = legendaryJokerId(rng, new Set(h.jokers.map((x) => x.id)));
      need(!!lid, 'No quedan jokers legendarios');
      h.addJoker(lid!);
      return;
    }
    case 'sigil': {
      need(h.hand.length > 0, 'Sin cartas en la mano');
      setSuit(h.hand, pick(rng, SUITS));
      return;
    }
    case 'ouija': {
      need(h.hand.length > 0, 'Sin cartas en la mano');
      const r = pick(rng, RANKS);
      for (const c of h.hand) c.rank = r;
      h.handSizePenalty++;
      return;
    }
    case 'ectoplasm': {
      need(noEdition.length > 0, 'Ningún joker sin edición');
      pick(rng, noEdition).edition = 'negative';
      h.handSizePenalty++;
      return;
    }
    case 'immolate': {
      need(h.hand.length > 0, 'Sin cartas en la mano');
      destroyRandomInHand(h, rng, 5);
      h.money += 20;
      return;
    }
    case 'ankh': {
      need(hasJokers, 'No tienes jokers');
      const keep = pick(rng, h.jokers);
      onlyJokersToKeep(h, keep);
      const copy = h.addJoker(keep.id, keep.edition);
      copy.state = { ...keep.state };
      return;
    }
    case 'hex': {
      need(hasJokers, 'No tienes jokers');
      const keep = pick(rng, h.jokers);
      keep.edition = 'poly';
      onlyJokersToKeep(h, keep);
      return;
    }
    case 'black_hole': for (const p of PLANETS) h.levelUp(p.hand); return;
    default:
      if (def?.kind === 'planet') {
        h.levelUp(PLANET_BY_ID[id].hand);
        return;
      }
      throw new Error(`Consumible desconocido: ${id}`);
  }
}
