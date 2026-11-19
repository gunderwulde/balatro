import { MAX_STAKE } from './stakes';

/** Meta-progresión persistente (estadísticas, Stakes desbloqueados, colección). Pura: la E/S vive en `ui/storage.ts`. */
export interface Profile {
  v: 1;
  runs: number;
  wins: number;
  bestAnte: number;
  bestHand: number;
  /** Stake más alto ganado por mazo. */
  stakeWins: Record<string, number>;
  discovered: string[];
}

export function emptyProfile(): Profile {
  return { v: 1, runs: 0, wins: 0, bestAnte: 0, bestHand: 0, stakeWins: {}, discovered: [] };
}

/** Lo mínimo que necesita el perfil de una run (la clase `Run` lo cumple). */
export interface RunSummary {
  deckId: string;
  stake: number;
  ante: number;
  bestHand: number;
  discovered: Set<string>;
}

function merge(p: Profile, r: RunSummary): Profile {
  return {
    ...p,
    bestAnte: Math.max(p.bestAnte, r.ante),
    bestHand: Math.max(p.bestHand, r.bestHand),
    discovered: [...new Set([...p.discovered, ...r.discovered])],
  };
}

/** Actualiza colección y récords sin contar una partida terminada (autoguardado). */
export function mergeProgress(p: Profile, r: RunSummary): Profile {
  return merge(p, r);
}

/** Registra el final de una run. Ganar con un Stake desbloquea el siguiente para ese mazo. */
export function recordEnd(p: Profile, r: RunSummary, won: boolean): Profile {
  const next = merge(p, r);
  next.runs = p.runs + 1;
  if (won) {
    next.wins = p.wins + 1;
    next.stakeWins = { ...p.stakeWins, [r.deckId]: Math.max(p.stakeWins[r.deckId] ?? 0, r.stake) };
  }
  return next;
}

/** Stake más alto que se puede elegir con ese mazo. */
export function unlockedStake(p: Profile, deck: string): number {
  return Math.min(MAX_STAKE, (p.stakeWins[deck] ?? 0) + 1);
}
