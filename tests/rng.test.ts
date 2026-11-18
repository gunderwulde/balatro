import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng', () => {
  it('es determinista por semilla', () => {
    const a = new Rng('ABC');
    const b = new Rng('ABC');
    expect([a.next(), a.next()]).toEqual([b.next(), b.next()]);
  });
  it('semillas distintas dan secuencias distintas', () => {
    expect(new Rng('A').next()).not.toBe(new Rng('B').next());
  });
});
