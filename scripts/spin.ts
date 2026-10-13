// Inspect one seeded round: npx tsx scripts/spin.ts [seed] [bet]
import { createRng } from '../src/math/rng';
import { playRound } from '../src/math/round';
import type { SymbolId } from '../src/math/paytable';

const seed = Number(process.argv[2] ?? 42);
const bet = Number(process.argv[3] ?? 400);
const o = playRound(bet, createRng(seed));

const printGrid = (grid: SymbolId[][]) => {
  for (let row = 0; row < 3; row++) console.log('  ' + grid.map((c) => c[row].padEnd(8)).join(''));
};

console.log(`seed ${seed}  bet ${bet}  stops ${o.stops.join(',')}`);
printGrid(o.grid);
for (const w of o.lineWins) console.log(`  line ${w.line} ${w.symbol} x${w.count} = ${w.win}`);
console.log(`base win ${o.baseWin}`);

const f = o.feature;
if (f?.type === 'freeSpins') {
  console.log(`FREE SPINS: ${f.awarded} awarded`);
  f.spins.forEach((s, i) =>
    console.log(
      `  #${i + 1} x${s.multiplier} win ${s.win}${s.retrigger ? ` +${s.retrigger} spins` : ''} (left ${s.spinsLeft})`,
    ),
  );
  console.log(`  FS total ${f.totalWin}`);
} else if (f?.type === 'holdAndWin') {
  const fmt = (c: { pos: number; value: number; jackpot?: string }) =>
    `${c.pos}:${c.jackpot ?? c.value / bet + 'x'}`;
  console.log(`HOLD & WIN: initial ${f.initial.map(fmt).join(' ')}`);
  f.respins.forEach((r, i) =>
    console.log(`  respin ${i + 1}: ${r.coins.map(fmt).join(' ') || '-'} (left ${r.respinsLeft})`),
  );
  console.log(`  grand ${f.grand}  H&W total ${f.totalWin}`);
}
console.log(`TOTAL ${o.totalWin} (${o.totalWin / bet}x)${o.capped ? '  CAPPED' : ''}`);
