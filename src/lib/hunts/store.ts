/**
 * Phantom.js — Hunt store (CRUD).
 * ============================================================================
 * Persists saved hunts ("the Grimoire") so users can revisit past exorcisms.
 *
 * Two interchangeable backends behind one HuntStore interface:
 *   - SupabaseHuntStore : real persistence. Used when SUPABASE_URL + a key are
 *                         set. The full HuntResult (graph + suspects + summary)
 *                         is stored as jsonb; summary columns are projected for
 *                         fast list views.
 *   - InMemoryHuntStore  : session-only fallback (a Map). Used automatically
 *                         when Supabase isn't configured, so the CRUD is fully
 *                         demoable locally without provisioning a database.
 *
 * Server-only: imports @supabase/supabase-js. Never import this module from a
 * client component — use src/lib/hunts/types.ts for shared types instead.
 */

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HuntResult } from "@/lib/agent/types";
import type {
  CreateInput,
  HuntStoreMode,
  SavedHunt,
  SavedHuntSummary,
  UpdateInput,
} from "./types";

export interface HuntStore {
  mode: HuntStoreMode;
  create(input: CreateInput): Promise<SavedHuntSummary>;
  list(): Promise<SavedHuntSummary[]>;
  get(id: string): Promise<SavedHunt | null>;
  update(id: string, patch: UpdateInput): Promise<SavedHuntSummary | null>;
  remove(id: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Row <-> object mapping (DB columns are snake_case; `result` is jsonb)
// ---------------------------------------------------------------------------

type DbRow = Record<string, any>;

const SUMMARY_COLS =
  "id,created_at,repo_kind,repo_ref,repo_url,files_scanned,dead_count,uncertain_count,alive_count,sandbox_safe,projected_savings_usd,removed_bundle_kb,status,notes";

function rowToSummary(r: DbRow): SavedHuntSummary {
  return {
    id: r.id,
    createdAt: r.created_at,
    repoKind: r.repo_kind,
    repoRef: r.repo_ref,
    repoUrl: r.repo_url ?? null,
    filesScanned: r.files_scanned,
    deadCount: r.dead_count,
    uncertainCount: r.uncertain_count,
    aliveCount: r.alive_count,
    sandboxSafe: r.sandbox_safe,
    projectedSavingsUsd: Number(r.projected_savings_usd ?? 0),
    removedBundleKb: Number(r.removed_bundle_kb ?? 0),
    status: r.status,
    notes: r.notes ?? null,
  };
}

function rowToHunt(r: DbRow): SavedHunt {
  return { ...rowToSummary(r), result: r.result as HuntResult };
}

// ---------------------------------------------------------------------------
// Supabase store
// ---------------------------------------------------------------------------

function createSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  // Server client: no session persistence / token refresh.
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

class SupabaseHuntStore implements HuntStore {
  mode: HuntStoreMode = "supabase";
  private sb: SupabaseClient;
  constructor(sb: SupabaseClient) {
    this.sb = sb;
  }

  async create({ result, notes, status }: CreateInput): Promise<SavedHuntSummary> {
    const row = {
      repo_kind: result.repo.kind,
      repo_ref: result.repo.ref,
      repo_url: result.repo.url ?? null,
      files_scanned: result.repo.filesScanned,
      dead_count: result.summary.dead,
      uncertain_count: result.summary.uncertain,
      alive_count: result.summary.alive,
      sandbox_safe: result.summary.sandbox.safe,
      projected_savings_usd: result.summary.finops.projectedSavingsUsd,
      removed_bundle_kb: result.summary.finops.removedBundleKB,
      status: status ?? "saved",
      notes: notes ?? null,
      result,
    };
    const { data, error } = await this.sb.from("hunts").insert(row).select(SUMMARY_COLS).single();
    if (error) throw new Error(`Supabase create failed: ${error.message}`);
    return rowToSummary(data as DbRow);
  }

  async list(): Promise<SavedHuntSummary[]> {
    const { data, error } = await this.sb
      .from("hunts")
      .select(SUMMARY_COLS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase list failed: ${error.message}`);
    return (data as DbRow[] | null ?? []).map(rowToSummary);
  }

  async get(id: string): Promise<SavedHunt | null> {
    const { data, error } = await this.sb.from("hunts").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase get failed: ${error.message}`);
    return data ? rowToHunt(data as DbRow) : null;
  }

  async update(id: string, patch: UpdateInput): Promise<SavedHuntSummary | null> {
    const update: Record<string, unknown> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.notes !== undefined) update.notes = patch.notes;

    let data: DbRow | null = null;
    if (Object.keys(update).length > 0) {
      const res = await this.sb.from("hunts").update(update).eq("id", id).select(SUMMARY_COLS).maybeSingle();
      if (res.error) throw new Error(`Supabase update failed: ${res.error.message}`);
      data = res.data as DbRow | null;
    } else {
      const res = await this.sb.from("hunts").select(SUMMARY_COLS).eq("id", id).maybeSingle();
      if (res.error) throw new Error(`Supabase update failed: ${res.error.message}`);
      data = res.data as DbRow | null;
    }
    return data ? rowToSummary(data) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { error } = await this.sb.from("hunts").delete().eq("id", id);
    if (error) throw new Error(`Supabase delete failed: ${error.message}`);
    return true; // delete is idempotent in Postgres; a missing row isn't an error
  }
}

// ---------------------------------------------------------------------------
// In-memory store (local demo fallback when Supabase is not configured)
// ---------------------------------------------------------------------------

class InMemoryHuntStore implements HuntStore {
  mode: HuntStoreMode = "memory";
  private hunts = new Map<string, SavedHunt>();

  async create({ result, notes, status }: CreateInput): Promise<SavedHuntSummary> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const summary: SavedHuntSummary = {
      id,
      createdAt,
      repoKind: result.repo.kind,
      repoRef: result.repo.ref,
      repoUrl: result.repo.url ?? null,
      filesScanned: result.repo.filesScanned,
      deadCount: result.summary.dead,
      uncertainCount: result.summary.uncertain,
      aliveCount: result.summary.alive,
      sandboxSafe: result.summary.sandbox.safe,
      projectedSavingsUsd: result.summary.finops.projectedSavingsUsd,
      removedBundleKb: result.summary.finops.removedBundleKB,
      status: status ?? "saved",
      notes: notes ?? null,
    };
    this.hunts.set(id, { ...summary, result });
    return summary;
  }

  async list(): Promise<SavedHuntSummary[]> {
    return [...this.hunts.values()]
      .map(({ result: _r, ...s }) => s)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<SavedHunt | null> {
    return this.hunts.get(id) ?? null;
  }

  async update(id: string, patch: UpdateInput): Promise<SavedHuntSummary | null> {
    const h = this.hunts.get(id);
    if (!h) return null;
    if (patch.status !== undefined) h.status = patch.status;
    if (patch.notes !== undefined) h.notes = patch.notes;
    const { result: _r, ...summary } = h;
    return summary;
  }

  async remove(id: string): Promise<boolean> {
    return this.hunts.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Store selection
// ---------------------------------------------------------------------------

let _store: HuntStore | null = null;

/** Supabase if configured, else the in-memory demo store. */
export function getStore(): HuntStore {
  if (_store) return _store;
  const sb = createSupabase();
  _store = sb ? new SupabaseHuntStore(sb) : new InMemoryHuntStore();
  return _store;
}
