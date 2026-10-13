import { BET_LEVELS, MAX_WIN_MULT } from '../math/config';
import { createRng, deriveSeed, randomSeed, type Rng } from '../math/rng';
import { playRound } from '../math/round';
import { BASE_STRIPS, FREE_STRIPS } from '../math/reelStrips';
import { RGSError, type InitResponse, type RGS } from './RGS';
import type { SpinRequest, SpinResponse } from './types';
import { STORAGE_KEYS } from '../utils/storage';

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Dev hook: picks the seed (and cap) for the next round. Set by the debug panel only. */
export type RoundPicker = (bet: number, seed: number) => { seed: number; capMult?: number };

export interface MockOptions {
  /** defaults to localStorage */
  storage?: KV;
  /** [min, max] ms per call */
  latency?: [number, number];
  /** 0..1 chance a spin fails; half before commit, half after (response lost) */
  failureRate?: number;
  startBalance?: number;
  /** session seed; random if omitted */
  seed?: number;
}

interface Saved {
  sessionId: string;
  seed: number;
  nonce: number;
  balance: number;
  unfinished?: SpinResponse;
}

const KEY = STORAGE_KEYS.rgs;
const STRIPS = { base: BASE_STRIPS, free: FREE_STRIPS };

// roundId = "<nonce>-<seed hex>[-c<capMult>]", enough to replay the round
const makeRoundId = (nonce: number, seed: number, capMult: number) =>
  `${nonce}-${seed.toString(16)}${capMult === MAX_WIN_MULT ? '' : `-c${capMult}`}`;

/** Rebuild a round from its id. Bit-identical to what spin() returned for the same balance. */
export function replay(roundId: string, bet: number, balanceBefore: number): SpinResponse {
  const [, seedHex, cap] = roundId.split('-');
  const capMult = cap ? Number(cap.slice(1)) : MAX_WIN_MULT;
  const outcome = playRound(bet, createRng(parseInt(seedHex, 16)), capMult);
  return { roundId, bet, balance: balanceBefore - bet + outcome.totalWin, ...outcome };
}

export class MockRGS implements RGS {
  latency: [number, number];
  failureRate: number;
  pick?: RoundPicker;

  private storage: KV;
  private s: Saved;
  private net: Rng;

  constructor(o: MockOptions = {}) {
    this.storage = o.storage ?? localStorage;
    this.latency = o.latency ?? [150, 450];
    this.failureRate = o.failureRate ?? 0;
    this.s = this.load() ?? {
      sessionId: 's-' + randomSeed().toString(16),
      seed: o.seed ?? randomSeed(),
      nonce: 0,
      balance: o.startBalance ?? 100000,
    };
    if (o.seed !== undefined && o.seed !== this.s.seed) this.setSeed(o.seed);
    this.net = createRng(this.s.seed ^ 0x5eed);
    this.save();
  }

  /** Dev: restart the round sequence from a new session seed. */
  /** Dev: current session seed and rounds played (round n uses deriveSeed(seed, n)). */
  get seed() {
    return this.s.seed;
  }

  get nonce() {
    return this.s.nonce;
  }

  setSeed(seed: number) {
    this.s.seed = seed >>> 0;
    this.s.nonce = 0;
    this.net = createRng(this.s.seed ^ 0x5eed);
    this.save();
  }

  async init(): Promise<InitResponse> {
    await this.delay();
    const { sessionId, balance, unfinished } = this.s;
    const res: InitResponse = { sessionId, balance, betLevels: BET_LEVELS, reelStrips: STRIPS };
    if (unfinished) res.unfinished = unfinished;
    return res;
  }

  async spin(req: SpinRequest): Promise<SpinResponse> {
    await this.delay();
    const fail = this.net.next() < this.failureRate;
    const lostAfterCommit = fail && this.net.next() < 0.5;
    if (fail && !lostAfterCommit) throw new RGSError('network', 'request dropped');

    if (req.sessionId !== this.s.sessionId) throw new RGSError('session');
    if (this.s.unfinished) return this.s.unfinished;
    if (!(BET_LEVELS as readonly number[]).includes(req.bet)) throw new RGSError('invalidBet');
    if (req.bet > this.s.balance) throw new RGSError('insufficientFunds');

    const nonce = this.s.nonce + 1;
    const pick = this.pick;
    this.pick = undefined; // forcing is one-shot
    const base = deriveSeed(this.s.seed, nonce);
    const { seed, capMult = MAX_WIN_MULT } = pick ? pick(req.bet, base) : { seed: base };
    const res = replay(makeRoundId(nonce, seed, capMult), req.bet, this.s.balance);

    this.s.nonce = nonce;
    this.s.balance = res.balance;
    this.s.unfinished = res;
    this.save();
    if (lostAfterCommit) throw new RGSError('network', 'response lost');
    return res;
  }

  async complete(roundId: string): Promise<void> {
    await this.delay();
    if (this.s.unfinished?.roundId === roundId) {
      delete this.s.unfinished;
      this.save();
    }
  }

  private delay() {
    const [min, max] = this.latency;
    const ms = min + this.net.next() * (max - min);
    return ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve();
  }

  private load(): Saved | undefined {
    try {
      const raw = this.storage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Saved) : undefined;
    } catch {
      return undefined; // corrupt or blocked storage: fresh session
    }
  }

  private save() {
    try {
      this.storage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      // storage blocked (private mode): play on without resume
    }
  }
}
