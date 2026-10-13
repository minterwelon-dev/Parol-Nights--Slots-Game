/** Seedable RNG (mulberry32). The only source of randomness in the project. */
export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** int in [0, n) */
  int(n: number): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n) => Math.floor(next() * n) };
}

/** Fresh session seed. The only Math.random() call in the project. */
export const randomSeed = () => (Math.random() * 4294967296) >>> 0;

/** Independent per-round seed from a session seed and a round counter. */
export const deriveSeed = (seed: number, nonce: number) =>
  (createRng((seed ^ Math.imul(nonce, 0x9e3779b1)) >>> 0).next() * 4294967296) >>> 0;
