import type { Card } from '../../src/core/cards';
import { CONSUMABLES } from '../../src/core/consumables';
import { Run, type RunOptions } from '../../src/core/run';

/** Todas las combinaciones de 1..5 cartas de la mano. */
function subsets(hand: Card[]): Card[][] {
  const out: Card[][] = [];
  const n = hand.length;
  const rec = (start: number, cur: Card[]) => {
    if (cur.length) out.push([...cur]);
    if (cur.length === 5) return;
    for (let i = start; i < n; i++) {
      cur.push(hand[i]);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

/** Mejor jugada legal por puntuación esperada (sin azar). */
function bestPlay(r: Run): { cards: Card[]; total: number } | null {
  let best: { cards: Card[]; total: number } | null = null;
  for (const s of subsets(r.hand)) {
    if (r.playError(s)) continue;
    const total = r.preview(s).total;
    if (!best || total > best.total) best = { cards: s, total };
  }
  return best;
}

export interface BotResult {
  run: Run;
  steps: number;
}

/**
 * Bot de simulación: juega la mejor mano, descarta lo que no puntúa cuando la mano no basta,
 * compra jokers y usa Planetas. Sirve para fuzzing y para estimar el balance.
 */
export function playBot(seed: string, opts: RunOptions = {}, maxAnte = 8): BotResult {
  const r = new Run(seed, opts);
  let steps = 0;
  while (steps++ < 8000 && r.phase !== 'won' && r.phase !== 'lost') {
    if (r.phase === 'cashout') {
      r.collectCashout();
    } else if (r.phase === 'blind_select') {
      if (r.ante > maxAnte) break;
      r.selectBlind();
    } else if (r.phase === 'playing') {
      for (const c of [...r.consumables]) {
        if (c.kind === 'planet') {
          try { r.useConsumable(c.uid); } catch { /* sin efecto */ }
        } else if (CONSUMABLES[c.id].min === 0 && !CONSUMABLES[c.id].needsHand && c.kind === 'tarot') {
          try { r.useConsumable(c.uid); } catch { /* sin efecto */ }
        }
      }
      const best = bestPlay(r);
      if (!best) {
        if (r.discardsLeft <= 0) break;
        r.discard(r.hand.slice(0, Math.min(5, r.hand.length)).map((c) => c.id));
        continue;
      }
      const need = (r.target - r.score) / Math.max(1, r.handsLeft);
      if (r.discardsLeft > 0 && best.total < need && r.handsLeft > 0) {
        const keep = new Set(best.cards.map((c) => c.id));
        const junk = r.hand.filter((c) => !keep.has(c.id)).slice(0, 5);
        if (junk.length) {
          try {
            r.discard(junk.map((c) => c.id));
            continue;
          } catch { /* forzada (Campana): se juega */ }
        }
      }
      r.play(best.cards.map((c) => c.id));
    } else if (r.phase === 'shop') {
      if (r.openPack) {
        try { r.pickFromPack(0); } catch { r.skipPack(); }
        continue;
      }
      const buyAll = () => {
        r.shop!.items.forEach((it, i) => {
          if (it && (it.kind === 'joker' || it.kind === 'planet')) {
            try { r.buy(i); } catch { /* sin dinero/hueco */ }
          }
        });
      };
      buyAll();
      for (let k = 0; k < 4 && r.money >= 14; k++) {
        r.reroll();
        buyAll();
      }
      for (const c of [...r.consumables]) {
        if (c.kind === 'planet') {
          try { r.useConsumable(c.uid); } catch { /* solo en ronda */ }
        }
      }
      r.leaveShop();
    }
  }
  return { run: r, steps };
}
