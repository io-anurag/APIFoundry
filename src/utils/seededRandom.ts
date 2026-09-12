const DEFAULT_SEED = 0x20260912;

/**
 * A small, dependency-free 32-bit PRNG (public-domain `mulberry32` algorithm). Deterministic:
 * the same seed always produces the same sequence of draws.
 *
 * @param seed - The 32-bit integer seed to initialize the generator with.
 * @returns A function that returns the next pseudo-random number in `[0, 1)` on each call.
 */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let next = mulberry32(DEFAULT_SEED);

/**
 * Draws the next value from the shared seeded PRNG.
 * @returns The next pseudo-random number in `[0, 1)`.
 */
export function nextRandom(): number {
  return next();
}

/**
 * Reinitializes the shared seeded PRNG to its fixed default seed, so a fresh sequence of draws
 * reproduces the exact same outcomes as any prior sequence starting from the same reset point
 * (constitution Principle II; research.md Decision 5). Called by `tests/helpers/resetStores.ts`.
 */
export function resetSeededRandom(): void {
  next = mulberry32(DEFAULT_SEED);
}
