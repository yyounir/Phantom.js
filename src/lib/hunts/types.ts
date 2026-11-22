/**
 * Phantom.js — saved-hunt types ("the Grimoire").
 * Pure types (no server-only imports) so they're safe to import in client code.
 * The store implementation lives in store.ts (server-only — imports supabase-js).
 */

import type { HuntResult } from "@/lib/agent/types";

export type HuntStoreMode = "supabase" | "memory";

/** A saved hunt's summary row — what the list view renders. */
export interface SavedHuntSummary {
  id: string;
  createdAt: string;
  repoKind: string;
  repoRef: string;
  repoUrl: string | null;
  filesScanned: number;
  deadCount: number;
  uncertainCount: number;
  aliveCount: number;
  sandboxSafe: boolean;
  projectedSavingsUsd: number;
  removedBundleKb: number;
  status: string; // "saved" | "approved" | "archived"
  notes: string | null;
}

/** A saved hunt with its full result (graph + suspects + summary) — the detail view. */
export interface SavedHunt extends SavedHuntSummary {
  result: HuntResult;
}

export interface CreateInput {
  result: HuntResult;
  notes?: string | null;
  status?: string;
}

export interface UpdateInput {
  status?: string;
  notes?: string | null;
}
