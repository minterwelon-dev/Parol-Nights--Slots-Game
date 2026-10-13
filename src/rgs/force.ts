// DEV ONLY. Imported by the debug panel behind import.meta.env.DEV, so it never reaches prod.
import { MAX_WIN_MULT } from '../math/config';
import { createRng } from '../math/rng';
import { playRound } from '../math/round';
import type { RoundOutcome } from './types';
import type { RoundPicker } from './MockRGS';

export type Force =
  'freeSpins' | 'retrigger' | 'holdAndWin' | 'grand' | 'bigWin' | 'megaWin' | 'cap';

/** Dev cap used by 'cap': natural 5000x never shows up in play, this exercises the same path. */
export const DEV_CAP_MULT = 20;

const MATCH: Record<Force, (o: RoundOutcome, bet: number) => boolean> = {
  freeSpins: (o) => o.feature?.type === 'freeSpins',
  retrigger: (o) => o.feature?.type === 'freeSpins' && o.feature.spins.some((s) => s.retrigger > 0),
  holdAndWin: (o) => o.feature?.type === 'holdAndWin',
  grand: (o) => o.feature?.type === 'holdAndWin' && o.feature.grand > 0,
  // base-game line wins only, so the win presentation alone is exercised
  bigWin: (o, bet) => !o.feature && o.totalWin >= 15 * bet,
  megaWin: (o, bet) => !o.feature && o.totalWin >= 50 * bet,
  cap: (o) => o.capped && !!o.feature,
};

/** Every force option, in display order. */
export const FORCES = Object.keys(MATCH) as Force[];

/**
 * Scan seeds from the natural one until a round matches. The round stays a real,
 * replayable outcome; only the seed choice is forced.
 */
export function forcePicker(force: Force, maxTries = 2_000_000): RoundPicker {
  const capMult = force === 'cap' ? DEV_CAP_MULT : MAX_WIN_MULT;
  return (bet, seed) => {
    for (let k = 0; k < maxTries; k++) {
      const s = (seed + k) >>> 0;
      if (MATCH[force](playRound(bet, createRng(s), capMult), bet)) return { seed: s, capMult };
    }
    console.warn(`force ${force}: no match in ${maxTries} seeds, playing natural round`);
    return { seed };
  };
}
