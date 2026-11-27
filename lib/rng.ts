export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function int(rng: () => number, min: number, max: number, step = 1): number {
  const n = Math.floor((max - min) / step) + 1;
  return min + Math.floor(rng() * n) * step;
}

export function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

export function distinct(values: number[], eps = 0.5): boolean {
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++) if (Math.abs(values[i] - values[j]) < eps) return false;
  return true;
}
