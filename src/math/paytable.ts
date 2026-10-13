export type PaySymbol = 'L1' | 'L2' | 'L3' | 'L4' | 'H1' | 'H2' | 'H3';
export type SymbolId = PaySymbol | 'WILD' | 'SCATTER' | 'COIN';

/** Pays for 3 / 4 / 5 of a kind, in multiples of line bet. Starting values, tuned in simulation. */
export const PAYTABLE: Record<PaySymbol, readonly [number, number, number]> = {
  L1: [10, 30, 80],
  L2: [10, 30, 80],
  L3: [20, 50, 120],
  L4: [20, 50, 120],
  H1: [30, 80, 250],
  H2: [40, 120, 300],
  H3: [60, 200, 800],
};
