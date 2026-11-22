/**
 * Phantom.js — /grimoire
 * ============================================================================
 * Lists all saved hunts from the persistent store (file-backed in dev, Supabase
 * in production). Clicking a row expands the full summary stats. The URL hash
 * (#<id>) scrolls to and highlights a just-saved hunt — the page.tsx "View in
 * Grimoire →" link uses this.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types (mirrors the shape written by /api/hunts POST)
// ---------------------------------------------------------------------------

interface SavedHunt {
  id: string;
  createdAt: string;
  result: {
    repo: { kind: string; ref: string; url?: string; filesScanned: number };
    summary: {
      dead: number;
      uncertain: number;
      alive: number;
      sandbox: { safe: boolean; note: string };
      finops: {
        removedBundleKB: number;
        coldStartDeltaMs: number;
        buildMinutesSavedPerMonth: number;
        projectedSavingsUsd: number;
      };
    };
    suspects: Array<{ id: string; name: string; verdict: string; confidence: number }>;
  };
  mode?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEAD_COLOR = "#c084fc";
const ALIVE_COLOR = "#00fa00";
const UNCERTAIN_COLOR = "#f59e0b";

function verdictColor(v: string) {
  if (v === "dead") return DEAD_COLOR;
  if (v === "alive") return ALIVE_COLOR;
  return UNCERTAIN_COLOR;
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function HuntRow({ hunt, highlighted }: { hunt: SavedHunt; highlighted: boolean }) {
  const [open, setOpen] = useState(highlighted);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);

  const { result } = hunt;
  const repoLabel = result?.repo?.url ?? result?.repo?.ref ?? "unknown";

  return (
    <div
      ref={ref}
      id={hunt.id}
      className={`rounded-xl border backdrop-blur transition ${
        highlighted
          ? "border-orange-400/60 bg-orange-900/10"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
      }`}
    >
      {/* header row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 text-left"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-zinc-400">{fmt(hunt.createdAt)}</span>
          <span className="max-w-xs truncate font-mono text-xs text-zinc-200">{repoLabel}</span>
          <span className="ml-auto flex gap-3 font-mono text-xs">
            <span style={{ color: DEAD_COLOR }}>💀 {result?.summary?.dead ?? 0}</span>
            <span style={{ color: UNCERTAIN_COLOR }}>🤔 {result?.summary?.uncertain ?? 0}</span>
            <span style={{ color: ALIVE_COLOR }}>✅ {result?.summary?.alive ?? 0}</span>
          </span>
          <span className="text-xs text-zinc-500">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {/* expanded detail */}
      {open && result && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Files scanned" value={String(result.repo?.filesScanned ?? "—")} />
            <Stat label="💀 Zombies" value={String(result.summary?.dead ?? 0)} accent={DEAD_COLOR} />
            <Stat label="🤔 Uncertain" value={String(result.summary?.uncertain ?? 0)} accent={UNCERTAIN_COLOR} />
            <Stat label="✅ Alive" value={String(result.summary?.alive ?? 0)} accent={ALIVE_COLOR} />
          </div>

          {result.summary?.finops && (
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <MiniStat label="Bundle removed" value={`${result.summary.finops.removedBundleKB} KB`} />
              <MiniStat label="Cold-start Δ" value={`${result.summary.finops.coldStartDeltaMs} ms`} />
              <MiniStat label="Build min/mo" value={`-${result.summary.finops.buildMinutesSavedPerMonth}`} />
              <MiniStat
                label="Est. savings"
                value={`$${result.summary.finops.projectedSavingsUsd}/mo`}
                accent={ALIVE_COLOR}
              />
            </div>
          )}

          {result.summary?.sandbox && (
            <p className="mt-3 text-xs text-zinc-400">
              <span
                className="font-semibold"
                style={{ color: result.summary.sandbox.safe ? ALIVE_COLOR : UNCERTAIN_COLOR }}
              >
                {result.summary.sandbox.safe ? "✅ Sandbox safe" : "⚠ Sandbox blocked"}
              </span>{" "}
              — {result.summary.sandbox.note}
            </p>
          )}

          {result.suspects && result.suspects.length > 0 && (
            <details className="mt-3 group">
              <summary className="cursor-pointer font-mono text-[11px] text-orange-400 hover:text-orange-300">
                suspects ({result.suspects.length})
              </summary>
              <ul className="mt-2 max-h-48 overflow-y-auto space-y-1">
                {result.suspects.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: verdictColor(s.verdict) }}
                    />
                    <code className="text-zinc-200">{s.name}</code>
                    <span className="ml-auto text-zinc-500">
                      {s.verdict} · {Math.round(s.confidence * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-3 font-mono text-[10px] text-zinc-600">
            id: {hunt.id} {hunt.mode ? `· store: ${hunt.mode}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GrimoirePage() {
  const [hunts, setHunts] = useState<SavedHunt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Read hash on mount so the "View in Grimoire →" link highlights the right row.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.slice(1);
      if (hash) setHighlightId(hash);
    }
  }, []);

  useEffect(() => {
    fetch("/api/hunts")
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((data: SavedHunt[]) => {
        // Newest first
        const sorted = [...data].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setHunts(sorted);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen text-zinc-100">
      {/* nav */}
      <header className="blood-drip-bar mx-auto flex max-w-5xl items-center justify-between px-4 pt-6 pb-2 mb-4">
        <Link href="/" className="font-mono text-sm text-zinc-400 hover:text-zinc-100">
          ← back to the Hunter
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-orange-400">grimoire</span>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          The Grimoire{" "}
          <span className="text-zinc-500">— saved exorcisms</span>
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Every hunt you&apos;ve saved is recorded here. Click a row to expand stats,
          inspect zombie candidates, and review FinOps projections.
        </p>
      </section>

      {/* body */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        {loading && (
          <p className="font-mono text-sm text-zinc-500 animate-pulse">Loading the Grimoire…</p>
        )}

        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && hunts.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
            <p className="text-zinc-400">No hunts saved yet.</p>
            <p className="mt-2 text-xs text-zinc-600">
              Run a hunt on the{" "}
              <Link href="/" className="text-orange-400 hover:text-orange-300">
                Hunter page
              </Link>{" "}
              and click <strong>🔖 Save to Grimoire</strong>.
            </p>
          </div>
        )}

        {hunts.length > 0 && (
          <div className="space-y-3">
            <p className="mb-4 font-mono text-xs text-zinc-500">
              {hunts.length} hunt{hunts.length !== 1 ? "s" : ""} recorded
            </p>
            {hunts.map((h) => (
              <HuntRow key={h.id} hunt={h} highlighted={h.id === highlightId} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
      <div className="font-mono text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="text-sm font-semibold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
