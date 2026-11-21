// NOT exported and never referenced anywhere — expected verdict: DEAD.
function deadPrivateHelper(x: number): number {
  return x * 2;
}

// Exported but never referenced anywhere — expected verdict: UNCERTAIN
// (could be intended public API, so it routes to human review).
export function exportedUnreferenced(a: string, b: string): string {
  return a + b;
}
