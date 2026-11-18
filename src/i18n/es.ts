import type { HandType } from '../core/hands';

export const BLIND_NAME = {
  small: 'Ciega pequeña',
  big: 'Ciega grande',
  boss: 'Jefe',
} as const;

export const HAND_NAME: Record<HandType, string> = {
  high_card: 'Carta alta',
  pair: 'Pareja',
  two_pair: 'Doble pareja',
  three_kind: 'Trío',
  straight: 'Escalera',
  flush: 'Color',
  full_house: 'Full',
  four_kind: 'Póker',
  straight_flush: 'Escalera de color',
  five_kind: 'Quintilla',
  flush_house: 'Full de color',
  flush_five: 'Quintilla de color',
};
