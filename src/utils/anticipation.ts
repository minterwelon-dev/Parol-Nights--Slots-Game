import { gameConfig } from '../gameConfig';
import { REELS, ROWS } from '../math/config';
import type { SymbolId } from '../rgs/types';

/**
 * Which reels tease before landing. Presentation only: counts symbols already in the response
 * grid, never decides a trigger. Reel r teases when the reels before it show enough SCATTER
 * (or COIN, when coins can trigger, i.e. base game) to make the next one exciting.
 */
export function anticipation(grid: readonly SymbolId[][], coins: boolean): boolean[] {
  const { scatter: scatterTease, coin: coinTease } = gameConfig.anticipation;
  const out: boolean[] = new Array(REELS).fill(false);
  let scatters = 0;
  let coinCount = 0;
  for (let r = 0; r < REELS; r++) {
    out[r] = scatters >= scatterTease || (coins && coinCount >= coinTease);
    for (let row = 0; row < ROWS; row++) {
      if (grid[r][row] === 'SCATTER') scatters++;
      else if (grid[r][row] === 'COIN') coinCount++;
    }
  }
  return out;
}
