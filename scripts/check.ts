// Math + mock RGS self-checks: npm run check
import assert from 'node:assert/strict';
import { MockRGS, replay } from '../src/rgs/MockRGS';
import { RGSError } from '../src/rgs/RGS';
import { forcePicker, DEV_CAP_MULT } from '../src/rgs/force';
import { SlotStateMachine } from '../src/state/SlotStateMachine';
import { anticipation } from '../src/utils/anticipation';
import { createRng } from '../src/math/rng';
import { PAYLINES } from '../src/math/paylines';
import { PAYTABLE, type SymbolId } from '../src/math/paytable';
import { BET_LEVELS, MAX_WIN_MULT, NUM_LINES, REELS, ROWS } from '../src/math/config';
import { BASE_STRIPS, FREE_STRIPS, gridFromStops, spinReels } from '../src/math/reelStrips';
import { evaluateLines, countSymbol } from '../src/math/evaluate';
import { FS_MAX_MULT, playFreeSpins, playHoldAndWin } from '../src/math/features';
import { playRound } from '../src/math/round';
import type { FreeSpin } from '../src/rgs/types';
import { AnimationHandle } from '../src/game/animation/AnimationHandle';
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, migrateStorage } from '../src/utils/storage';

// ---- step 1: rng, paylines, paytable ----
// rng: same seed -> same sequence, different seed -> different
const seq = (s: number) => {
  const r = createRng(s);
  return Array.from({ length: 8 }, () => r.next());
};
assert.deepEqual(seq(42), seq(42));
assert.notDeepEqual(seq(42), seq(43));
assert.ok(seq(1).every((v) => v >= 0 && v < 1));

// paylines: 40, distinct, in range
assert.equal(PAYLINES.length, NUM_LINES);
assert.equal(new Set(PAYLINES.map((l) => l.join())).size, NUM_LINES, 'duplicate payline');
for (const l of PAYLINES) {
  assert.equal(l.length, REELS);
  assert.ok(l.every((r) => Number.isInteger(r) && r >= 0 && r < ROWS));
}

// paytable: pays rise with count
for (const p of Object.values(PAYTABLE)) assert.ok(p[0] <= p[1] && p[1] <= p[2]);

// bets: integer line bet
assert.ok(BET_LEVELS.every((b) => b % NUM_LINES === 0));

console.log('check step 1: ok');

// ---- step 2: strips + evaluation ----
for (const r of [0, 4]) {
  assert.ok(
    !BASE_STRIPS[r].includes('WILD') && !FREE_STRIPS[r].includes('WILD'),
    'WILD on reel ' + r,
  );
}
assert.ok(
  FREE_STRIPS.every((s) => !s.includes('COIN')),
  'COIN in FS strips',
);
assert.deepEqual(gridFromStops(BASE_STRIPS, [0, 0, 0, 0, 0])[0], BASE_STRIPS[0].slice(0, 3));
const last = BASE_STRIPS[0].length - 1;
assert.deepEqual(
  gridFromStops(BASE_STRIPS, [last, 0, 0, 0, 0])[0],
  [BASE_STRIPS[0][last], BASE_STRIPS[0][0], BASE_STRIPS[0][1]],
  'wrap-around',
);
assert.deepEqual(spinReels(createRng(7), BASE_STRIPS), spinReels(createRng(7), BASE_STRIPS));

const col = (s: SymbolId): SymbolId[] => [s, s, s];
const total = (g: SymbolId[][]) => evaluateLines(g, 1).reduce((a, w) => a + w.win, 0);
const P = PAYTABLE;
// every line 5x L1
assert.equal(total([col('L1'), col('L1'), col('L1'), col('L1'), col('L1')]), 40 * P.L1[2]);
// wild on reel 2 extends H3 to 3 per line
assert.equal(total([col('H3'), col('WILD'), col('H3'), col('L1'), col('L1')]), 40 * P.H3[0]);
// scatter breaks the line
assert.equal(total([col('H1'), col('H1'), col('SCATTER'), col('H1'), col('H1')]), 0);
// no 3-match
assert.equal(total([col('L1'), col('L2'), col('L1'), col('L2'), col('L1')]), 0);
// mid-row H2: line 0 x5 + lines 27, 28 x3
const g: SymbolId[][] = [
  ['L1', 'H2', 'L2'],
  ['L2', 'H2', 'L3'],
  ['L3', 'H2', 'L4'],
  ['L4', 'H2', 'L1'],
  ['L1', 'H2', 'L2'],
];
assert.deepEqual(
  evaluateLines(g, 10).map((w) => [w.line, w.count, w.win]),
  [
    [0, 5, P.H2[2] * 10],
    [27, 3, P.H2[0] * 10],
    [28, 3, P.H2[0] * 10],
  ],
);
assert.equal(
  countSymbol([col('COIN'), col('L1'), ['COIN', 'L1', 'L1'], col('L1'), col('L1')], 'COIN'),
  4,
);

console.log('check step 2: ok');

// ---- step 3: features + round ----
const BET = 400;
assert.deepEqual(
  playRound(BET, createRng(99)),
  playRound(BET, createRng(99)),
  'round not deterministic',
);

/** Round invariants over n seeds at a given cap. Returns feature / capped counts. */
function checkRounds(n: number, capMult: number) {
  const cap = capMult * BET;
  let fs = 0;
  let hw = 0;
  let capped = 0;
  for (let seed = 0; seed < n; seed++) {
    const o = playRound(BET, createRng(seed), capMult);
    const f = o.feature;
    assert.ok(o.totalWin <= cap);
    if (o.capped) {
      capped++;
      assert.equal(o.totalWin, cap, 'capped round must pay exactly the cap');
    }
    if (o.capped && !f) {
      assert.equal(o.baseWin, cap);
      continue;
    } // base alone hit a dev cap
    assert.equal(
      o.baseWin,
      o.lineWins.reduce((a, w) => a + w.win, 0),
    );
    assert.equal(o.totalWin, o.baseWin + (f?.totalWin ?? 0));
    const sc = countSymbol(o.grid, 'SCATTER');
    const co = countSymbol(o.grid, 'COIN');
    assert.equal(f?.type === 'freeSpins', sc >= 3, 'FS trigger mismatch seed ' + seed);
    assert.equal(f?.type === 'holdAndWin', sc < 3 && co >= 6, 'HW trigger mismatch seed ' + seed);
    if (f?.type === 'freeSpins') {
      fs++;
      assert.equal(
        f.spins.reduce((a, s) => a + s.win, 0),
        f.totalWin,
      );
      for (let i = 0; i < f.spins.length; i++) {
        const s: FreeSpin = f.spins[i];
        assert.ok(s.multiplier >= 1 && s.multiplier <= FS_MAX_MULT);
        if (i > 0) assert.ok(s.multiplier >= f.spins[i - 1].multiplier);
        assert.ok(!s.grid.flat().includes('COIN'));
      }
      assert.equal(f.spins.at(-1)!.spinsLeft, 0);
    }
    if (f?.type === 'holdAndWin') {
      hw++;
      const all = [...f.initial, ...f.respins.flatMap((r) => r.coins)];
      assert.equal(new Set(all.map((c) => c.pos)).size, all.length, 'duplicate coin pos');
      assert.equal(f.initial.length, co);
      if (!f.capped) assert.equal(f.totalWin, all.reduce((a, c) => a + c.value, 0) + f.grand);
      assert.equal(f.grand > 0, all.length === 15 && !f.capped);
      assert.equal(f.respins.at(-1)?.respinsLeft ?? 0, 0);
    }
  }
  return { fs, hw, capped };
}

const real = checkRounds(20000, MAX_WIN_MULT);
assert.ok(real.fs > 0 && real.hw > 0, `features never triggered (fs ${real.fs}, hw ${real.hw})`);
// dev cap: capped rounds must happen and satisfy every invariant above
const dev = checkRounds(20000, 20);
assert.ok(dev.capped > 0, 'dev cap never reached');

// FS strips carry more WILD per cell than base on reels 2-4
const wildDensity = (s: SymbolId[]) => s.filter((x) => x === 'WILD').length / s.length;
for (let r = 1; r <= 3; r++)
  assert.ok(wildDensity(FREE_STRIPS[r]) > wildDensity(BASE_STRIPS[r]), 'FS wild density reel ' + r);

// cap clamps exactly
const allCoins: SymbolId[][] = [col('COIN'), col('COIN'), col('COIN'), col('COIN'), col('COIN')];
const hwCap = playHoldAndWin(createRng(1), BET, allCoins, 1000);
assert.ok(hwCap.capped && hwCap.totalWin === 1000 && hwCap.grand === 0);
const hwFull = playHoldAndWin(createRng(1), BET, allCoins, 1e12);
assert.ok(hwFull.grand === 1000 * BET && hwFull.respins.length === 0);
const fsCap = playFreeSpins(createRng(5), 10, 50, 1);
assert.ok(fsCap.capped && fsCap.totalWin === 1 && fsCap.spins.at(-1)!.spinsLeft === 0);

console.log(
  `check step 3: ok (20000 rounds: fs ${real.fs}, hw ${real.hw}; dev 20x cap: ${dev.capped} capped)`,
);

// ---- step 5: mock RGS ----
const memory = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};
const rejects = async (p: Promise<unknown>, code: string) => {
  await assert.rejects(p, (e) => e instanceof RGSError && e.code === code);
};

// Rename migration preserves raw saved data and never overwrites an existing destination.
{
  const storage = memory();
  const original = new MockRGS({ storage, latency: [0, 0], seed: 42, startBalance: 10000 });
  const session = await original.init();
  const unfinished = await original.spin({ sessionId: session.sessionId, bet: BET });
  const saved = storage.getItem(STORAGE_KEYS.rgs)!;
  storage.removeItem(STORAGE_KEYS.rgs);
  const values = {
    rgs: saved,
    progress: JSON.stringify({ roundId: unfinished.roundId, step: 2 }),
    muted: '1',
  };
  for (const name of ['rgs', 'progress', 'muted'] as const) {
    storage.setItem(LEGACY_STORAGE_KEYS[name], values[name]);
  }
  migrateStorage(() => storage);
  migrateStorage(() => storage);
  for (const name of ['rgs', 'progress', 'muted'] as const) {
    assert.equal(storage.getItem(STORAGE_KEYS[name]), values[name]);
    assert.equal(storage.getItem(LEGACY_STORAGE_KEYS[name]), null);
    storage.setItem(LEGACY_STORAGE_KEYS[name], 'older data');
  }
  migrateStorage(() => storage);
  for (const name of ['rgs', 'progress', 'muted'] as const) {
    assert.equal(storage.getItem(STORAGE_KEYS[name]), values[name]);
    assert.equal(storage.getItem(LEGACY_STORAGE_KEYS[name]), 'older data');
  }
  const resumed = new MockRGS({ storage, latency: [0, 0] });
  assert.equal(resumed.seed, original.seed);
  assert.equal(resumed.nonce, original.nonce);
  assert.deepEqual(await resumed.init(), await original.init());
  assert.doesNotThrow(() =>
    migrateStorage(() => {
      throw new Error('blocked storage');
    }),
  );
  for (const operation of ['getItem', 'setItem', 'removeItem'] as const) {
    const failing = memory();
    failing.setItem(LEGACY_STORAGE_KEYS.muted, '1');
    assert.doesNotThrow(() =>
      migrateStorage(() => ({
        ...failing,
        [operation]: () => {
          throw new Error('storage failure');
        },
      })),
    );
    assert.equal(failing.getItem(LEGACY_STORAGE_KEYS.muted), '1');
  }
  const empty = memory();
  migrateStorage(() => empty);
  assert.equal(empty.getItem(STORAGE_KEYS.rgs), null);
}
console.log('check storage migration: ok');

{
  const storage = memory();
  const rgs = new MockRGS({ storage, latency: [0, 0], seed: 42, startBalance: 10000 });
  const { sessionId, balance } = await rgs.init();
  assert.equal(balance, 10000);

  const r1 = await rgs.spin({ sessionId, bet: BET });
  assert.equal(r1.balance, 10000 - BET + r1.totalWin);
  // replay from roundId is bit-identical
  assert.deepEqual(replay(r1.roundId, BET, 10000), r1);
  // retry before complete returns the same round, no second debit
  assert.deepEqual(await rgs.spin({ sessionId, bet: BET }), r1);
  // refresh: new instance on same storage resumes the unfinished round
  const resumed = await new MockRGS({ storage, latency: [0, 0] }).init();
  assert.deepEqual(resumed.unfinished, r1);
  await rgs.complete(r1.roundId);
  assert.equal((await rgs.init()).unfinished, undefined);

  // trust boundary
  await rejects(rgs.spin({ sessionId, bet: 123 }), 'invalidBet');
  await rejects(rgs.spin({ sessionId: 'nope', bet: BET }), 'session');
  const poor = new MockRGS({ storage: memory(), latency: [0, 0], startBalance: 10 });
  await rejects(
    poor.spin({ sessionId: (await poor.init()).sessionId, bet: BET }),
    'insufficientFunds',
  );

  // failures: dropped requests change nothing, lost responses are recovered by retry
  const flaky = new MockRGS({
    storage: memory(),
    latency: [0, 0],
    failureRate: 1,
    startBalance: 100000,
  });
  const fid = (await flaky.init()).sessionId;
  let lost = false;
  for (let i = 0; i < 20 && !lost; i++) {
    const before = (await flaky.init()).balance;
    try {
      await flaky.spin({ sessionId: fid, bet: BET });
    } catch (e) {
      assert.ok(e instanceof RGSError && e.code === 'network');
      const after = await flaky.init();
      if (after.unfinished)
        lost = true; // committed, response lost
      else assert.equal(after.balance, before, 'dropped request must not debit');
    }
  }
  assert.ok(lost, 'never saw a lost-response failure');
  flaky.failureRate = 0;
  const recovered = await flaky.spin({ sessionId: fid, bet: BET });
  assert.deepEqual(recovered, (await flaky.init()).unfinished);

  // forced outcomes are real rounds and replay identically
  for (const force of ['freeSpins', 'holdAndWin', 'cap'] as const) {
    const f = new MockRGS({ storage: memory(), latency: [0, 0], seed: 7 });
    const id = (await f.init()).sessionId;
    f.pick = forcePicker(force);
    const r = await f.spin({ sessionId: id, bet: BET });
    if (force === 'cap') assert.ok(r.capped && r.totalWin === DEV_CAP_MULT * BET);
    else assert.equal(r.feature?.type, force);
    assert.deepEqual(replay(r.roundId, BET, 100000), r);
    await f.complete(r.roundId);
    const next = await f.spin({ sessionId: id, bet: BET });
    assert.ok(next.roundId !== r.roundId, 'force must be one-shot');
  }

  // same session seed -> same round sequence
  const seqOf = async () => {
    const m = new MockRGS({ storage: memory(), latency: [0, 0], seed: 99 });
    const id = (await m.init()).sessionId;
    const out: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await m.spin({ sessionId: id, bet: BET });
      out.push(r.roundId + ':' + r.totalWin);
      await m.complete(r.roundId);
    }
    return out;
  };
  assert.deepEqual(await seqOf(), await seqOf());
}

console.log('check step 5: ok');

// ---- phase 2: state machine ----
{
  const fsm = new SlotStateMachine();
  const log: string[] = [];
  fsm.on((a, b) => log.push(`${a}>${b}`));
  for (const s of [
    'Idle',
    'Spinning',
    'Stopping',
    'Evaluating',
    'FreeSpins',
    'WinPresentation',
    'Idle',
  ] as const)
    fsm.to(s);
  assert.equal(log.length, 7);
  assert.throws(() => fsm.to('Stopping'), /illegal/); // no spin outside Idle
  assert.equal(fsm.state, 'Idle');
  fsm.to('Spinning');
  fsm.to('Error');
  fsm.to('Spinning'); // retry
}
console.log('check phase 2 fsm: ok');

// ---- phase 2: anticipation (presentation rule) ----
{
  const c = (s: SymbolId): SymbolId[] => [s, 'L1', 'L2'];
  const tease = (g: SymbolId[][], coins = true) => anticipation(g, coins).map(Number).join('');
  // 2 scatters on reels 1-2: reels 3-5 tease
  assert.equal(tease([c('SCATTER'), c('SCATTER'), c('L3'), c('L4'), c('H1')]), '00111');
  // second scatter on reel 4: only reel 5
  assert.equal(tease([c('SCATTER'), c('L3'), c('L4'), c('SCATTER'), c('H1')]), '00001');
  // one scatter: nothing
  assert.equal(tease([c('SCATTER'), c('L3'), c('L4'), c('L1'), c('H1')]), '00000');
  // 4 coins by reel 2 tease in base, not when coins can't trigger
  const coins: SymbolId[][] = [
    ['COIN', 'COIN', 'L1'],
    ['COIN', 'COIN', 'L1'],
    c('L3'),
    c('L4'),
    c('H1'),
  ];
  assert.equal(tease(coins), '00111');
  assert.equal(tease(coins, false), '00000');
}
console.log('check anticipation: ok');

// ---- animation handle: finish applies end state, cancel resets, both stop parts and resolve ----
{
  let stops = 0;
  const part = { stop: () => stops++ };
  const log: string[] = [];
  const a = new AnimationHandle().add(
    part,
    () => log.push('final'),
    () => log.push('neutral'),
  );
  a.finish();
  a.finish(); // settled: no second end state
  await a.done;
  assert.deepEqual(log, ['final']);
  assert.equal(stops, 1);
  assert.equal(a.active, false);

  const b = new AnimationHandle().add(
    part,
    () => log.push('final'),
    () => log.push('neutral'),
  );
  b.cancel();
  await b.done;
  assert.deepEqual(log, ['final', 'neutral']);
  b.add(part); // late part on a settled handle stops at once
  assert.equal(stops, 3);

  const c1 = new AnimationHandle().add(null, () => log.push('c1'));
  const c2 = new AnimationHandle().add(null, () => log.push('c2'));
  const all = AnimationHandle.all([c1, c2]);
  all.finish();
  await all.done;
  assert.deepEqual(log.slice(2), ['c1', 'c2']);
  const n1 = new AnimationHandle();
  const group = AnimationHandle.all([n1]);
  n1.complete(); // natural end of every child settles the group
  await group.done;
  assert.equal(group.active, false);
}
console.log('check animation handle: ok');
