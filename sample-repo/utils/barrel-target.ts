// Re-exported through utils/index.ts (barrel) — expected verdict: ALIVE.
export function aliveViaBarrel(x: number): number {
  return x - 1;
}
