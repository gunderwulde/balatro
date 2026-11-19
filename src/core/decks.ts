/** Mazos iniciales. Los modificadores los aplica `Run` (ver `applyDeck`). ⚠ verificar (GDD §10). */
export const DECK_IDS = [
  'red', 'blue', 'yellow', 'green', 'black', 'magic', 'nebula', 'ghost',
  'abandoned', 'checkered', 'zodiac', 'painted', 'anaglyph', 'plasma', 'erratic',
] as const;
export type DeckId = (typeof DECK_IDS)[number];
export const DEFAULT_DECK: DeckId = 'red';
