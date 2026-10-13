import { REELS, ROWS } from './config';
import type { SymbolId } from './paytable';
import { createRng, type Rng } from './rng';

type Counts = Partial<Record<SymbolId, number>>;

/** Fixed strips: counts shuffled once with a fixed seed, so strips are constant across runs. */
function buildStrip(counts: Counts, seed: number): SymbolId[] {
  const strip: SymbolId[] = [];
  for (const id in counts)
    for (let i = 0; i < counts[id as SymbolId]!; i++) strip.push(id as SymbolId);
  const rng = createRng(seed);
  for (let i = strip.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  return strip;
}

// Tuned via scripts/simulate.ts. Re-run and commit docs/simulation-report.txt after any change.
const BASE: Counts = {
  L1: 24,
  L2: 24,
  L3: 20,
  L4: 20,
  H1: 14,
  H2: 12,
  H3: 10,
  WILD: 6,
  SCATTER: 3,
  COIN: 17,
};
const FREE: Counts = { L1: 14, L2: 14, L3: 12, L4: 12, H1: 6, H2: 5, H3: 3, WILD: 3, SCATTER: 1 };

/** Reels 1 and 5 (index 0, 4): no WILD, plus per-strip overrides. */
const perReel = (c: Counts, edge: Counts, seedBase: number) =>
  Array.from({ length: REELS }, (_, r) =>
    buildStrip(r === 0 || r === REELS - 1 ? { ...c, ...edge, WILD: 0 } : c, seedBase + r),
  );

export const BASE_STRIPS: readonly SymbolId[][] = perReel(BASE, { SCATTER: 5 }, 1000);
export const FREE_STRIPS: readonly SymbolId[][] = perReel(FREE, { SCATTER: 2 }, 2000);

/** Visible window for given stops. grid[reel][row], row 0 = strip[stop]. */
export function gridFromStops(
  strips: readonly SymbolId[][],
  stops: readonly number[],
): SymbolId[][] {
  const grid: SymbolId[][] = [];
  for (let r = 0; r < REELS; r++) {
    const s = strips[r];
    const col: SymbolId[] = [];
    for (let row = 0; row < ROWS; row++) col.push(s[(stops[r] + row) % s.length]);
    grid.push(col);
  }
  return grid;
}

export function spinReels(rng: Rng, strips: readonly SymbolId[][]) {
  const stops: number[] = [];
  for (let r = 0; r < REELS; r++) stops.push(rng.int(strips[r].length));
  return { stops, grid: gridFromStops(strips, stops) };
}
