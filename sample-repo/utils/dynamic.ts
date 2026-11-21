// Loaded at runtime via dynamic import() in app.ts — expected verdict: ALIVE.
export function lazyLoaded(x: number): number {
  return x * 3;
}
