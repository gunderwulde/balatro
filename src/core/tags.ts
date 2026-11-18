import type { Edition, Rarity } from './jokers';
import type { Rng } from './rng';

export type TagTrigger = 'instant' | 'shop' | 'round' | 'boss_clear' | 'next_tag';

export interface TagDef {
  id: string;
  trigger: TagTrigger;
  /** Pack gratuito (Mega) que concede al abrir la tienda. */
  freePack?: { kind: 'arcana' | 'celestial' | 'spectral' | 'standard' | 'buffoon'; size: 'normal' | 'mega' };
  /** Joker gratis de la tienda con esta rareza/edición. */
  freeJoker?: { rarity?: Rarity; edition?: Edition };
}

/** ⚠ verificar (GDD §9). Se obtienen al saltar Small/Big. */
export const TAG_LIST: TagDef[] = [
  { id: 'economy', trigger: 'instant' },
  { id: 'handy', trigger: 'instant' },
  { id: 'garbage', trigger: 'instant' },
  { id: 'speed', trigger: 'instant' },
  { id: 'investment', trigger: 'boss_clear' },
  { id: 'juggle', trigger: 'round' },
  { id: 'coupon', trigger: 'shop' },
  { id: 'd6', trigger: 'shop' },
  { id: 'voucher', trigger: 'shop' },
  { id: 'boss', trigger: 'instant' },
  { id: 'double', trigger: 'next_tag' },
  { id: 'charm', trigger: 'shop', freePack: { kind: 'arcana', size: 'mega' } },
  { id: 'meteor', trigger: 'shop', freePack: { kind: 'celestial', size: 'mega' } },
  { id: 'buffoon', trigger: 'shop', freePack: { kind: 'buffoon', size: 'mega' } },
  { id: 'standard', trigger: 'shop', freePack: { kind: 'standard', size: 'mega' } },
  { id: 'ethereal', trigger: 'shop', freePack: { kind: 'spectral', size: 'normal' } },
  { id: 'uncommon', trigger: 'shop', freeJoker: { rarity: 'uncommon' } },
  { id: 'rare', trigger: 'shop', freeJoker: { rarity: 'rare' } },
  { id: 'foil', trigger: 'shop', freeJoker: { edition: 'foil' } },
  { id: 'holographic', trigger: 'shop', freeJoker: { edition: 'holo' } },
  { id: 'polychrome', trigger: 'shop', freeJoker: { edition: 'poly' } },
  { id: 'negative', trigger: 'shop', freeJoker: { edition: 'negative' } },
];

export const TAGS: Record<string, TagDef> = Object.fromEntries(TAG_LIST.map((t) => [t.id, t]));

export function rollTag(rng: Rng): string {
  return TAG_LIST[rng.int(TAG_LIST.length)].id;
}
