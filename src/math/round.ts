import { MAX_WIN_MULT, NUM_LINES } from './config';
import { countSymbol, evaluateLines } from './evaluate';
import { fsAward, HW_TRIGGER, playFreeSpins, playHoldAndWin } from './features';
import { BASE_STRIPS, spinReels } from './reelStrips';
import type { Rng } from './rng';
import type { RoundOutcome } from '../rgs/types';

/**
 * Full round for a total bet: base spin plus any feature. SCATTER trigger wins over COIN.
 * capMult overrides the 5000x cap (dev forcing only) so capped presentation can be exercised;
 * natural max is ~1200x in 5M spins. H&W tops out at 4000x, so only Free Spins can reach 5000x.
 */
export function playRound(bet: number, rng: Rng, capMult: number = MAX_WIN_MULT): RoundOutcome {
  const lineBet = bet / NUM_LINES;
  const cap = capMult * bet;
  const { stops, grid } = spinReels(rng, BASE_STRIPS);
  const lineWins = evaluateLines(grid, lineBet);
  let baseWin = 0;
  for (let i = 0; i < lineWins.length; i++) baseWin += lineWins[i].win;
  // base peaks at 800x (5x H3 on all 40 lines), so this only fires with a dev capMult
  if (baseWin >= cap) return { stops, grid, lineWins, baseWin: cap, totalWin: cap, capped: true };

  const awarded = fsAward(countSymbol(grid, 'SCATTER'));
  const feature =
    awarded > 0
      ? playFreeSpins(rng, lineBet, awarded, cap - baseWin)
      : countSymbol(grid, 'COIN') >= HW_TRIGGER
        ? playHoldAndWin(rng, bet, grid, cap - baseWin)
        : undefined;

  const out: RoundOutcome = {
    stops,
    grid,
    lineWins,
    baseWin,
    totalWin: baseWin + (feature?.totalWin ?? 0),
    capped: feature?.capped ?? false,
  };
  if (feature) out.feature = feature;
  return out;
}
