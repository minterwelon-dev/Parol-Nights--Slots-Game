export const REELS = 5;
export const ROWS = 3;
export const NUM_LINES = 40;

/** Total bet levels in minor units. All divisible by NUM_LINES so line bet is an integer. */
export const BET_LEVELS = [40, 80, 200, 400, 1000, 2000] as const;

/** Max win as a multiple of total bet. */
export const MAX_WIN_MULT = 5000;
