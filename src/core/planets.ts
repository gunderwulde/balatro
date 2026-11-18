import type { HandType } from './hands';

export interface PlanetDef {
  id: string;
  hand: HandType;
  /** Planetas secretos: solo aparecen tras jugar esa mano al menos una vez. */
  secret?: boolean;
}

export const PLANETS: PlanetDef[] = [
  { id: 'pluto', hand: 'high_card' },
  { id: 'mercury', hand: 'pair' },
  { id: 'uranus', hand: 'two_pair' },
  { id: 'venus', hand: 'three_kind' },
  { id: 'saturn', hand: 'straight' },
  { id: 'jupiter', hand: 'flush' },
  { id: 'earth', hand: 'full_house' },
  { id: 'mars', hand: 'four_kind' },
  { id: 'neptune', hand: 'straight_flush' },
  { id: 'planet_x', hand: 'five_kind', secret: true },
  { id: 'ceres', hand: 'flush_house', secret: true },
  { id: 'eris', hand: 'flush_five', secret: true },
];

export const PLANET_BY_ID: Record<string, PlanetDef> = Object.fromEntries(PLANETS.map((p) => [p.id, p]));
export const PLANET_COST = 3;
