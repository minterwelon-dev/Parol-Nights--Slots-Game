// RTP simulation: npm run simulate -- --spins 1000000 --seed 42 [--bet 400] [--out docs/simulation-report.txt]
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/math/rng';
import { playRound } from '../src/math/round';
import { BET_LEVELS, MAX_WIN_MULT } from '../src/math/config';
import { GAME_TITLE, gameConfig } from '../src/gameConfig';

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const spins = Number(arg('spins', '1000000'));
const seed = Number(arg('seed', '42'));
const bet = Number(arg('bet', String(BET_LEVELS[3])));
const out = arg('out', '');

const t0 = Date.now();
const rng = createRng(seed);
let base = 0,
  fsWin = 0,
  hwWin = 0;
let hits = 0,
  fsCount = 0,
  hwCount = 0,
  capped = 0,
  maxWin = 0,
  grands = 0;
let fsSpins = 0,
  retriggers = 0;
let sumSq = 0; // of win/bet, for volatility
const tiers: Record<string, number> = { epic: 0, mega: 0, big: 0 };
const jackpots: Record<string, number> = { mini: 0, minor: 0, major: 0 };

for (let i = 0; i < spins; i++) {
  const o = playRound(bet, rng);
  base += o.baseWin;
  const f = o.feature;
  if (f?.type === 'freeSpins') {
    fsCount++;
    fsWin += f.totalWin;
    fsSpins += f.spins.length;
    for (let s = 0; s < f.spins.length; s++) if (f.spins[s].retrigger) retriggers++;
  } else if (f?.type === 'holdAndWin') {
    hwCount++;
    hwWin += f.totalWin;
    if (f.grand) grands++;
    for (const c of f.initial) if (c.jackpot) jackpots[c.jackpot]++;
    for (const r of f.respins) for (const c of r.coins) if (c.jackpot) jackpots[c.jackpot]++;
  }
  if (o.totalWin > 0) hits++;
  if (o.capped) capped++;
  if (o.totalWin > maxWin) maxWin = o.totalWin;
  const x = o.totalWin / bet;
  sumSq += x * x;
  for (const t of gameConfig.winTiers)
    if (x >= t.min) {
      tiers[t.name]++;
      break;
    }
}

const wagered = spins * bet;
const total = base + fsWin + hwWin;
const pct = (v: number) => ((100 * v) / wagered).toFixed(3).padStart(8) + '%';
const freq = (n: number) => (n ? `1 in ${(spins / n).toFixed(1)}` : 'never');
const mean = total / wagered;
const sd = Math.sqrt(sumSq / spins - mean * mean);
const ci = (1.96 * sd) / Math.sqrt(spins);

const lines = [
  `${GAME_TITLE} - simulation report`,
  `spins ${spins}  seed ${seed}  bet ${bet}  cap ${MAX_WIN_MULT}x`,
  '',
  `RTP              ${pct(total)}   (95% CI +/- ${(ci * 100).toFixed(2)}%)`,
  `  base game      ${pct(base)}`,
  `  free spins     ${pct(fsWin)}`,
  `  hold & win     ${pct(hwWin)}`,
  '',
  `hit frequency    ${((100 * hits) / spins).toFixed(2)}%  (${freq(hits)})`,
  `volatility (SD)  ${sd.toFixed(2)}x bet`,
  `max win          ${(maxWin / bet).toFixed(1)}x  capped ${capped} (${freq(capped)})`,
  '',
  `free spins       ${freq(fsCount)}  avg ${fsCount ? (fsWin / fsCount / bet).toFixed(1) : 0}x  avg spins ${fsCount ? (fsSpins / fsCount).toFixed(1) : 0}  retriggers ${retriggers}`,
  `hold & win       ${freq(hwCount)}  avg ${hwCount ? (hwWin / hwCount / bet).toFixed(1) : 0}x  grand ${grands} (${freq(grands)})`,
  `jackpot coins    mini ${jackpots.mini}  minor ${jackpots.minor}  major ${jackpots.major}`,
  '',
  `big   (>=15x)    ${freq(tiers.big)}`,
  `mega  (>=50x)    ${freq(tiers.mega)}`,
  `epic  (>=100x)   ${freq(tiers.epic)}`,
];
const report = lines.join('\n') + '\n';
process.stdout.write(report);
if (out) writeFileSync(out, report);
// timing goes to stderr so the report stays byte-identical for a given seed
console.error(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`);
