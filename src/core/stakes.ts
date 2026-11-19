/** 8 Stakes acumulativos (cada uno incluye los anteriores). ⚠ verificar (GDD §11). */
export const STAKE_IDS = ['white', 'red', 'green', 'black', 'blue', 'purple', 'orange', 'gold'] as const;
export const MAX_STAKE = STAKE_IDS.length;

export interface StakeRules {
  /** false: la ciega Small no da recompensa (Red). */
  smallReward: boolean;
  /** Tabla de objetivos: 1 normal, 2 (Green), 3 (Purple). */
  scaling: 1 | 2 | 3;
  eternal: boolean;
  perishable: boolean;
  rental: boolean;
  /** Descartes menos (Blue). */
  discardsMinus: number;
}

export function stakeRules(stake: number): StakeRules {
  return {
    smallReward: stake < 2,
    scaling: stake >= 6 ? 3 : stake >= 3 ? 2 : 1,
    eternal: stake >= 4,
    perishable: stake >= 7,
    rental: stake >= 8,
    discardsMinus: stake >= 5 ? 1 : 0,
  };
}

/** Objetivo base por Ante (Ante 1-8) según la tabla de escalado. */
export const ANTE_TABLES: Record<1 | 2 | 3, number[]> = {
  1: [300, 800, 2000, 5000, 11000, 20000, 35000, 50000],
  2: [300, 900, 2600, 8000, 20000, 36000, 60000, 100000],
  3: [300, 1000, 3200, 9000, 25000, 60000, 110000, 200000],
};

/** Base de objetivo; pasado el Ante 8 (Endless) crece de forma casi exponencial. ⚠ aproximación. */
export function anteBase(ante: number, scaling: 1 | 2 | 3 = 1): number {
  const table = ANTE_TABLES[scaling];
  if (ante <= 8) return table[Math.max(1, ante) - 1];
  return Math.round(table[7] * Math.pow(2.2, Math.pow(ante - 8, 1.6)));
}
