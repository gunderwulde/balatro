/** 16 pares Voucher base → mejorado. ⚠ verificar efectos/costes contra la fuente oficial. */
export const VOUCHER_PAIRS: [string, string][] = [
  ['overstock', 'overstock_plus'],
  ['clearance_sale', 'liquidation'],
  ['hone', 'glow_up'],
  ['reroll_surplus', 'reroll_glut'],
  ['crystal_ball', 'omen_globe'],
  ['telescope', 'observatory'],
  ['grabber', 'nacho_tong'],
  ['wasteful', 'recyclomancy'],
  ['tarot_merchant', 'tarot_tycoon'],
  ['planet_merchant', 'planet_tycoon'],
  ['seed_money', 'money_tree'],
  ['blank', 'antimatter'],
  ['magic_trick', 'illusion'],
  ['hieroglyph', 'petroglyph'],
  ['directors_cut', 'retcon'],
  ['paint_brush', 'palette'],
];

export const VOUCHERS: string[] = VOUCHER_PAIRS.flat();
export const VOUCHER_BASE_OF: Record<string, string> = Object.fromEntries(VOUCHER_PAIRS.map(([b, u]) => [u, b]));
export const VOUCHER_COST = 10;

/** Vouchers que se pueden ofrecer: los no comprados cuyo base ya se tiene (o que son base). */
export function availableVouchers(owned: Set<string>): string[] {
  return VOUCHERS.filter((v) => !owned.has(v) && (!VOUCHER_BASE_OF[v] || owned.has(VOUCHER_BASE_OF[v])));
}
