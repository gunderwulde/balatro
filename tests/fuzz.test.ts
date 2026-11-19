import { describe, expect, it } from 'vitest';
import { CHALLENGE_LIST } from '../src/core/challenges';
import { DECK_IDS } from '../src/core/decks';
import { playBot } from './helpers/bot';

const finite = (n: number) => Number.isFinite(n);

describe('fuzz: el bot recorre cada mazo, stake y desafío sin romper la run', () => {
  it('todos los mazos × stakes 1/8', { timeout: 120000 }, () => {
    for (const deck of DECK_IDS) {
      for (const stake of [1, 8]) {
        const { run } = playBot(`F-${deck}-${stake}`, { deck, stake });
        expect(['won', 'lost'], `${deck}/${stake}`).toContain(run.phase);
        expect(finite(run.money) && finite(run.score)).toBe(true);
        expect(run.jokers.length).toBeLessThanOrEqual(run.jokerSlots + 1);
      }
    }
  });

  it('todos los desafíos', { timeout: 120000 }, () => {
    for (const ch of CHALLENGE_LIST) {
      for (let i = 0; i < 1; i++) {
        const { run } = playBot(`C-${ch.id}-${i}`, { deck: 'plain', challenge: ch.id });
        expect(['won', 'lost'], ch.id).toContain(run.phase);
      }
    }
  });
});

/** Informe de balance: `BALANCE=1 npx vitest run tests/fuzz.test.ts`. */
describe.runIf(process.env.BALANCE)('balance', () => {
  it('tasa de victoria y Ante medio por stake', { timeout: 900000 }, () => {
    const rows: string[] = [];
    for (const stake of [1, 2, 4, 6, 8]) {
      let wins = 0;
      let anteSum = 0;
      const N = 20;
      for (let i = 0; i < N; i++) {
        const { run } = playBot(`B${stake}-${i}`, { deck: 'red', stake });
        if (run.phase === 'won') wins++;
        anteSum += run.ante;
      }
      rows.push(`stake ${stake}: victorias ${((wins / N) * 100).toFixed(0)}% · ante medio ${(anteSum / N).toFixed(1)}`);
    }
    console.log('\n' + rows.join('\n'));
  });
});
