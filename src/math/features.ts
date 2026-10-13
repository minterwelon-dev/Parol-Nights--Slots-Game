import { REELS, ROWS } from './config';
import { countSymbol, evaluateLines } from './evaluate';
import type { SymbolId } from './paytable';
import { FREE_STRIPS, spinReels } from './reelStrips';
import type { Rng } from './rng';
import type {
  Coin,
  FreeSpin,
  FreeSpinsRound,
  HoldAndWinRound,
  Jackpot,
  Respin,
} from '../rgs/types';

/** Running total that never passes capLeft; the step that reaches it is clamped and sets capped. */
function capper(capLeft: number) {
  const c = {
    total: 0,
    capped: false,
    add(v: number) {
      if (c.total + v >= capLeft) {
        v = capLeft - c.total;
        c.capped = true;
      }
      c.total += v;
      return v;
    },
  };
  return c;
}

// ---- Free Spins ----
export const FS_AWARD: Record<number, number> = { 3: 10, 4: 12, 5: 15 };
export const FS_RETRIGGER = 5;
export const FS_MAX_MULT = 15;

export const fsAward = (scatters: number) => FS_AWARD[Math.min(scatters, 5)] ?? 0;

export function playFreeSpins(
  rng: Rng,
  lineBet: number,
  awarded: number,
  capLeft: number,
): FreeSpinsRound {
  const spins: FreeSpin[] = [];
  const cap = capper(capLeft);
  let left = awarded;
  let mult = 1;
  while (left > 0 && !cap.capped) {
    left--;
    const { stops, grid } = spinReels(rng, FREE_STRIPS);
    const lineWins = evaluateLines(grid, lineBet);
    let raw = 0;
    for (let i = 0; i < lineWins.length; i++) raw += lineWins[i].win;
    const win = cap.add(raw * mult);
    const retrigger = countSymbol(grid, 'SCATTER') >= 3 ? FS_RETRIGGER : 0;
    left += retrigger;
    spins.push({
      stops,
      grid,
      lineWins,
      multiplier: mult,
      win,
      retrigger,
      spinsLeft: cap.capped ? 0 : left,
    });
    if (raw > 0) mult = Math.min(mult + 1, FS_MAX_MULT);
  }
  return { type: 'freeSpins', awarded, spins, totalWin: cap.total, capped: cap.capped };
}

// ---- Hold & Win ----
export const HW_TRIGGER = 6;
export const HW_RESPINS = 3;
export const HW_GRAND_MULT = 1000;
/** Chance an empty cell lands a coin on each respin. */
export const HW_LAND_CHANCE = 0.055;

/** Coin values as multiples of total bet. */
export const COIN_TABLE: readonly { mult: number; weight: number; jackpot?: Jackpot }[] = [
  { mult: 1, weight: 300 },
  { mult: 2, weight: 250 },
  { mult: 3, weight: 180 },
  { mult: 5, weight: 130 },
  { mult: 10, weight: 80 },
  { mult: 15, weight: 35 },
  { mult: 20, weight: 8, jackpot: 'mini' },
  { mult: 50, weight: 3, jackpot: 'minor' },
  { mult: 200, weight: 1, jackpot: 'major' },
];
const COIN_WEIGHT = COIN_TABLE.reduce((a, c) => a + c.weight, 0);

function drawCoin(rng: Rng, bet: number, pos: number): Coin {
  let r = rng.int(COIN_WEIGHT);
  let i = 0;
  while (r >= COIN_TABLE[i].weight) r -= COIN_TABLE[i++].weight;
  const e = COIN_TABLE[i];
  return e.jackpot
    ? { pos, value: e.mult * bet, jackpot: e.jackpot }
    : { pos, value: e.mult * bet };
}

export function playHoldAndWin(
  rng: Rng,
  bet: number,
  grid: readonly SymbolId[][],
  capLeft: number,
): HoldAndWinRound {
  const cells = REELS * ROWS;
  const filled: boolean[] = new Array(cells).fill(false);
  const cap = capper(capLeft);

  const initial: Coin[] = [];
  for (let r = 0; r < REELS; r++) {
    for (let row = 0; row < ROWS; row++) {
      if (grid[r][row] !== 'COIN') continue;
      const coin = drawCoin(rng, bet, r * ROWS + row);
      filled[coin.pos] = true;
      initial.push(coin);
      cap.add(coin.value);
    }
  }

  const respins: Respin[] = [];
  let count = initial.length;
  let left = HW_RESPINS;
  while (left > 0 && count < cells && !cap.capped) {
    left--;
    const coins: Coin[] = [];
    for (let pos = 0; pos < cells; pos++) {
      if (filled[pos] || rng.next() >= HW_LAND_CHANCE) continue;
      const coin = drawCoin(rng, bet, pos);
      filled[pos] = true;
      coins.push(coin);
      cap.add(coin.value);
    }
    count += coins.length;
    if (coins.length > 0) left = HW_RESPINS;
    respins.push({ coins, respinsLeft: cap.capped || count === cells ? 0 : left });
  }

  const grand = count === cells && !cap.capped ? cap.add(HW_GRAND_MULT * bet) : 0;
  return {
    type: 'holdAndWin',
    awarded: HW_RESPINS,
    initial,
    respins,
    grand,
    totalWin: cap.total,
    capped: cap.capped,
  };
}
