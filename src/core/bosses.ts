import type { Suit } from './cards';
import type { Rng } from './rng';

/** Modificadores declarativos de un Boss Blind; los aplica `Run`. ⚠ verificar valores contra la fuente oficial. */
export interface BossDef {
  id: string;
  minAnte: number;
  finisher?: boolean;
  /** Multiplicador del objetivo respecto a la ciega base (Boss normal = 2). */
  mult: number;
  /** Cartas de este palo quedan debilitadas. */
  debuffSuit?: Suit;
  debuffFace?: boolean;
  /** Todas las cartas debilitadas hasta vender un joker (Verdant Leaf). */
  debuffAll?: boolean;
  /** Cartas jugadas antes en este Ante quedan debilitadas (Pillar). */
  debuffPlayed?: boolean;
  /** Solo una mano (Needle). */
  singleHand?: boolean;
  noDiscards?: boolean;
  /** No repetir tipo de mano en la ronda (Eye). */
  noRepeatHand?: boolean;
  /** Solo un tipo de mano (Mouth). */
  singleHandType?: boolean;
  /** Hay que jugar 5 cartas (Psychic). */
  mustPlayFive?: boolean;
  /** Fichas y mult base a la mitad (Flint). */
  flint?: boolean;
  /** -$1 por carta jugada (Tooth). */
  toothMoney?: boolean;
  handSizeMinus?: number;
  /** Jugar la mano más jugada deja el dinero a $0 (Ox). */
  ox?: boolean;
  /** Jugar una mano baja su nivel en 1 (Arm). */
  arm?: boolean;
  /** Tras jugar o descartar siempre robas 3 (Serpent). */
  serpent?: boolean;
  /** Tras jugar se descartan 2 cartas al azar de la mano (Hook). */
  hook?: boolean;
  /** Baraja los jokers al empezar (Amber Acorn). */
  shuffleJokers?: boolean;
  /** Un joker aleatorio queda anulado cada mano (Crimson Heart). */
  disableJoker?: boolean;
}

export const BOSS_LIST: BossDef[] = [
  { id: 'the_hook', minAnte: 1, mult: 2, hook: true },
  { id: 'the_club', minAnte: 1, mult: 2, debuffSuit: 'C' },
  { id: 'the_goad', minAnte: 1, mult: 2, debuffSuit: 'S' },
  { id: 'the_window', minAnte: 1, mult: 2, debuffSuit: 'D' },
  { id: 'the_head', minAnte: 1, mult: 2, debuffSuit: 'H' },
  { id: 'the_psychic', minAnte: 1, mult: 2, mustPlayFive: true },
  { id: 'the_manacle', minAnte: 1, mult: 2, handSizeMinus: 1 },
  { id: 'the_wall', minAnte: 2, mult: 4 },
  { id: 'the_arm', minAnte: 2, mult: 2, arm: true },
  { id: 'the_water', minAnte: 2, mult: 2, noDiscards: true },
  { id: 'the_mouth', minAnte: 2, mult: 2, singleHandType: true },
  { id: 'the_needle', minAnte: 2, mult: 1, singleHand: true },
  { id: 'the_flint', minAnte: 2, mult: 2, flint: true },
  { id: 'the_eye', minAnte: 3, mult: 2, noRepeatHand: true },
  { id: 'the_tooth', minAnte: 3, mult: 2, toothMoney: true },
  { id: 'the_plant', minAnte: 4, mult: 2, debuffFace: true },
  { id: 'the_serpent', minAnte: 5, mult: 2, serpent: true },
  { id: 'the_pillar', minAnte: 6, mult: 2, debuffPlayed: true },
  { id: 'the_ox', minAnte: 6, mult: 2, ox: true },
  { id: 'amber_acorn', minAnte: 8, mult: 2, finisher: true, shuffleJokers: true },
  { id: 'verdant_leaf', minAnte: 8, mult: 2, finisher: true, debuffAll: true },
  { id: 'violet_vessel', minAnte: 8, mult: 6, finisher: true },
  { id: 'crimson_heart', minAnte: 8, mult: 2, finisher: true, disableJoker: true },
];

export const BOSSES: Record<string, BossDef> = Object.fromEntries(BOSS_LIST.map((b) => [b.id, b]));

/** Elige el Boss de un Ante: finalistas en el Ante 8, normales antes; evita repetir los ya vistos si puede. */
export function pickBoss(rng: Rng, ante: number, seen: Set<string>, exclude?: string): BossDef {
  const finisher = ante % 8 === 0;
  let pool = BOSS_LIST.filter((b) => !!b.finisher === finisher && b.minAnte <= Math.min(ante, 8) && b.id !== exclude);
  const fresh = pool.filter((b) => !seen.has(b.id));
  if (fresh.length) pool = fresh;
  return pool[rng.int(pool.length)];
}
