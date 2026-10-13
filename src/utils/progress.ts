import { STORAGE_KEYS } from './storage';

/**
 * Client-side presentation progress of the unfinished round, so a refresh resumes mid-feature
 * instead of replaying it. Outcome state lives in the RGS; this only says how far playback got.
 */
const KEY = STORAGE_KEYS.progress;

export interface Progress {
  roundId: string;
  /** feature steps already presented: free spins played, or H&W respins revealed */
  step: number;
}

export function loadProgress(roundId: string): number | undefined {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Progress | null;
    return p && p.roundId === roundId && Number.isInteger(p.step) && p.step >= 0
      ? p.step
      : undefined;
  } catch {
    return undefined; // corrupt or blocked storage: replay the whole round
  }
}

export function saveProgress(roundId: string, step: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ roundId, step } satisfies Progress));
  } catch {
    // storage blocked: resume falls back to a full replay
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
