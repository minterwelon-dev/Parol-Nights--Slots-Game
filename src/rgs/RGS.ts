import type { SpinRequest, SpinResponse, SymbolId } from './types';

export interface InitResponse {
  sessionId: string;
  balance: number;
  betLevels: readonly number[];
  /** display strips for the visual spin; final symbols always come from the response grid */
  reelStrips: { base: readonly (readonly SymbolId[])[]; free: readonly (readonly SymbolId[])[] };
  /** round committed but not yet completed by the client: present it, then call complete() */
  unfinished?: SpinResponse;
}

export type RGSErrorCode = 'network' | 'session' | 'invalidBet' | 'insufficientFunds';

export class RGSError extends Error {
  constructor(
    public readonly code: RGSErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

/** The only server surface the client depends on. */
export interface RGS {
  init(): Promise<InitResponse>;
  /** Returns the whole round. If a round is unfinished, returns that round instead (safe retry). */
  spin(req: SpinRequest): Promise<SpinResponse>;
  /** Client finished presenting the round. */
  complete(roundId: string): Promise<void>;
}
