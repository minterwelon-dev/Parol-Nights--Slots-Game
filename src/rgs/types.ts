import type { SymbolId } from '../math/paytable';
import type { LineWin } from '../math/evaluate';

export type { SymbolId, LineWin };

export interface SpinRequest {
  sessionId: string;
  /** total bet, minor units */
  bet: number;
}

export interface FreeSpin {
  stops: number[];
  grid: SymbolId[][];
  /** raw line wins, before multiplier */
  lineWins: LineWin[];
  /** multiplier applied to this spin */
  multiplier: number;
  /** this spin's payout after multiplier (and cap clamp) */
  win: number;
  /** spins added by a retrigger on this spin */
  retrigger: number;
  /** spins remaining after this one */
  spinsLeft: number;
}

export interface FreeSpinsRound {
  type: 'freeSpins';
  awarded: number;
  spins: FreeSpin[];
  totalWin: number;
  capped: boolean;
}

export type Jackpot = 'mini' | 'minor' | 'major';

export interface Coin {
  /** reel * ROWS + row */
  pos: number;
  /** minor units */
  value: number;
  jackpot?: Jackpot;
}

export interface Respin {
  /** coins that landed this respin */
  coins: Coin[];
  /** respins remaining after this one (reset to 3 when coins land) */
  respinsLeft: number;
}

export interface HoldAndWinRound {
  type: 'holdAndWin';
  /** respins at the start (and after every coin landing) */
  awarded: number;
  /** coins from the triggering base spin */
  initial: Coin[];
  respins: Respin[];
  /** Grand award when all 15 positions fill, else 0 */
  grand: number;
  totalWin: number;
  capped: boolean;
}

export interface SpinResponse {
  roundId: string;
  /** total bet of this round, minor units (a resumed round may differ from the current bet) */
  bet: number;
  /** balance after the round */
  balance: number;
  stops: number[];
  /** [reel][row] */
  grid: SymbolId[][];
  lineWins: LineWin[];
  baseWin: number;
  feature?: FreeSpinsRound | HoldAndWinRound;
  /** includes feature, capped at MAX_WIN_MULT x bet */
  totalWin: number;
  capped: boolean;
}

/** What the math produces; the RGS adds roundId and balance. */
export type RoundOutcome = Omit<SpinResponse, 'roundId' | 'bet' | 'balance'>;
