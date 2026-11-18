import { PLANETS } from './planets';

export type ConsumableKind = 'tarot' | 'planet' | 'spectral';

export interface ConsumableDef {
  id: string;
  kind: ConsumableKind;
  cost: number;
  /** Cartas de la mano que hay que seleccionar (0/0 = ninguna). */
  min: number;
  max: number;
  /** Solo se puede usar durante una ronda (necesita la mano). */
  needsHand: boolean;
}

const t = (id: string, min = 0, max = min, needsHand = min > 0): ConsumableDef => ({ id, kind: 'tarot', cost: 3, min, max, needsHand });
const s = (id: string, min = 0, max = min, needsHand = min > 0): ConsumableDef => ({ id, kind: 'spectral', cost: 4, min, max, needsHand });

/** ⚠ verificar efectos (GDD §8). El efecto vive en `effects.ts`. */
export const TAROTS: ConsumableDef[] = [
  t('fool'),
  t('magician', 1, 2),
  t('high_priestess'),
  t('empress', 1, 2),
  t('emperor'),
  t('hierophant', 1, 2),
  t('lovers', 1),
  t('chariot', 1),
  t('justice', 1),
  t('hermit'),
  t('wheel_of_fortune'),
  t('strength', 1, 2),
  t('hanged_man', 1, 2),
  t('death', 2),
  t('temperance'),
  t('devil', 1),
  t('tower', 1),
  t('star', 1, 3),
  t('moon', 1, 3),
  t('sun', 1, 3),
  t('judgement'),
  t('world', 1, 3),
];

export const SPECTRALS: ConsumableDef[] = [
  s('familiar', 0, 0, true),
  s('grim', 0, 0, true),
  s('incantation', 0, 0, true),
  s('talisman', 1),
  s('aura', 1),
  s('wraith'),
  s('sigil', 0, 0, true),
  s('ouija', 0, 0, true),
  s('ectoplasm'),
  s('immolate', 0, 0, true),
  s('ankh'),
  s('deja_vu', 1),
  s('hex'),
  s('trance', 1),
  s('medium', 1),
  s('cryptid', 1),
  s('the_soul'),
  s('black_hole'),
];

const PLANET_DEFS: ConsumableDef[] = PLANETS.map((p) => ({ id: p.id, kind: 'planet', cost: 3, min: 0, max: 0, needsHand: false }));

export const CONSUMABLE_LIST: ConsumableDef[] = [...TAROTS, ...PLANET_DEFS, ...SPECTRALS];
export const CONSUMABLES: Record<string, ConsumableDef> = Object.fromEntries(CONSUMABLE_LIST.map((c) => [c.id, c]));

export interface ConsumableInstance {
  uid: number;
  id: string;
  kind: ConsumableKind;
  edition?: 'negative';
  cost: number;
}

export const BASE_CONSUMABLE_SLOTS = 2;
