import { SUITS, cardIsSuit, isStone, rules, type Card } from './cards';

export type HandType =
  | 'high_card' | 'pair' | 'two_pair' | 'three_kind' | 'straight' | 'flush'
  | 'full_house' | 'four_kind' | 'straight_flush' | 'five_kind' | 'flush_house' | 'flush_five';

export interface HandResult {
  hand: HandType;
  /** Cartas que puntúan, en el orden jugado (las demás son kickers; Stone siempre puntúa). */
  scoring: Card[];
}

const minLen = () => (rules.fourFingers ? 4 : 5);

/** Cartas que forman la escalera (null si no hay). Four Fingers: bastan 4; Shortcut: admite huecos de 1. */
function straightCards(cards: Card[]): Card[] | null {
  const byRank = new Map<number, Card>();
  for (const c of cards) if (!byRank.has(c.rank)) byRank.set(c.rank, c);
  const pos: [number, Card][] = [];
  for (const [r, c] of byRank) {
    pos.push([r, c]);
    if (r === 14) pos.push([1, c]); // el As también vale 1
  }
  pos.sort((a, b) => a[0] - b[0]);
  const gap = rules.shortcut ? 2 : 1;
  let best: Card[] = [];
  let run: Card[] = [];
  for (let i = 0; i < pos.length; i++) {
    if (i > 0 && pos[i][0] - pos[i - 1][0] <= gap) run.push(pos[i][1]);
    else run = [pos[i][1]];
    if (run.length > best.length) best = [...run];
  }
  const uniq = [...new Set(best)];
  return uniq.length >= minLen() ? uniq : null;
}

/** Cartas que forman el color (las Wild valen para cualquiera). Four Fingers: bastan 4. */
function flushCards(cards: Card[]): Card[] | null {
  for (const s of SUITS) {
    const m = cards.filter((c) => cardIsSuit(c, s));
    if (m.length >= minLen()) return m;
  }
  return null;
}

function evaluateCore(cards: Card[]): HandResult {
  const groups = new Map<number, Card[]>();
  for (const c of cards) groups.set(c.rank, [...(groups.get(c.rank) ?? []), c]);
  const sizes = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
  const counts = sizes.map((g) => g.length);
  const fl = flushCards(cards);
  const st = straightCards(cards);
  const all = cards.length === 5 && fl?.length === 5;

  if (counts[0] === 5 && all) return { hand: 'flush_five', scoring: cards };
  if (counts[0] === 3 && counts[1] === 2 && all) return { hand: 'flush_house', scoring: cards };
  if (counts[0] === 5) return { hand: 'five_kind', scoring: cards };
  if (st && fl && st.every((c) => fl.includes(c))) return { hand: 'straight_flush', scoring: [...new Set([...st, ...fl])] };
  if (counts[0] === 4) return { hand: 'four_kind', scoring: sizes[0] };
  if (counts[0] === 3 && counts[1] === 2) return { hand: 'full_house', scoring: cards };
  if (fl) return { hand: 'flush', scoring: fl };
  if (st) return { hand: 'straight', scoring: st };
  if (counts[0] === 3) return { hand: 'three_kind', scoring: sizes[0] };
  if (counts[0] === 2 && counts[1] === 2) return { hand: 'two_pair', scoring: [...sizes[0], ...sizes[1]] };
  if (counts[0] === 2) return { hand: 'pair', scoring: sizes[0] };
  const high = cards.reduce((a, b) => (b.rank > a.rank ? b : a));
  return { hand: 'high_card', scoring: [high] };
}

export function evaluateHand(cards: Card[]): HandResult {
  if (cards.length === 0) throw new Error('Mano vacía');
  // Las cartas Stone no tienen rango ni palo: no forman manos, pero siempre puntúan.
  const rest = cards.filter((c) => !isStone(c));
  if (rest.length === 0) return { hand: 'high_card', scoring: cards };
  const core = evaluateCore(rest);
  const set = new Set(core.scoring);
  return { hand: core.hand, scoring: cards.filter((c) => isStone(c) || set.has(c)) };
}

/** ¿La mano jugada *contiene* este tipo de mano? (p. ej. un Full House contiene Pareja). */
export function containsHand(played: Card[], type: HandType): boolean {
  const cards = played.filter((c) => !isStone(c));
  const counts = new Map<number, number>();
  for (const c of cards) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const sizes = [...counts.values()].sort((a, b) => b - a);
  const max = sizes[0] ?? 0;
  switch (type) {
    case 'pair': return max >= 2;
    case 'two_pair': return sizes.filter((s) => s >= 2).length >= 2;
    case 'three_kind': return max >= 3;
    case 'four_kind': return max >= 4;
    case 'full_house': return max >= 3 && sizes[1] >= 2;
    case 'straight': return !!straightCards(cards);
    case 'flush': return !!flushCards(cards);
    default: return cards.length > 0 && evaluateHand(played).hand === type;
  }
}
