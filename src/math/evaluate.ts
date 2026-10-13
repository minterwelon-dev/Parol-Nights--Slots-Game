import { PAYLINES } from './paylines';
import { PAYTABLE, type PaySymbol, type SymbolId } from './paytable';

export interface LineWin {
  /** index into PAYLINES */
  line: number;
  symbol: SymbolId;
  count: number;
  /** minor units */
  win: number;
}

const isPay = (s: SymbolId): s is PaySymbol => s in PAYTABLE;

/** Left-to-right line wins, WILD substitutes for pay symbols only. grid[reel][row]. */
export function evaluateLines(grid: readonly SymbolId[][], lineBet: number): LineWin[] {
  const wins: LineWin[] = [];
  for (let l = 0; l < PAYLINES.length; l++) {
    const rows = PAYLINES[l];
    // ponytail: target = first non-wild; a leading run of WILDs never pays alone (WILD is not on reel 1)
    let target: SymbolId = 'WILD';
    let count = 0;
    for (let r = 0; r < rows.length; r++) {
      const s = grid[r][rows[r]];
      if (s === 'WILD') {
        count++;
        continue;
      }
      if (target === 'WILD' && isPay(s)) target = s;
      if (s !== target) break;
      count++;
    }
    if (count >= 3 && isPay(target)) {
      wins.push({ line: l, symbol: target, count, win: PAYTABLE[target][count - 3] * lineBet });
    }
  }
  return wins;
}

export function countSymbol(grid: readonly SymbolId[][], id: SymbolId): number {
  let n = 0;
  for (let r = 0; r < grid.length; r++)
    for (let row = 0; row < grid[r].length; row++) if (grid[r][row] === id) n++;
  return n;
}
