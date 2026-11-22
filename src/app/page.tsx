"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { HuntGraph } from "@/components/hunt-graph";
import { CoTPanel } from "@/components/cot-panel";
import { COLORS } from "@/lib/theme";
import type { HuntResult, Suspect, Verdict } from "@/lib/agent/types";

// ---------------------------------------------------------------------------
// Small presentational helpers (landing only)
// ---------------------------------------------------------------------------

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur transition hover:border-orange-400/30 hover:bg-white/10">
      <div className="mb-2 text-xl">{icon}</div>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function Stage({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="font-mono text-xs text-orange-400">STAGE {n}</div>
      <h3 className="mt-1 text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

// A static stylized preview of the Haunted Call Graph (shown before a hunt).
function GraphPreview() {
  const nodes: Array<{ x: number; y: number; label: string; color: string }> = [
    { x: 40, y: 30, label: "main()", color: COLORS.alive },
    { x: 200, y: 20, label: "render()", color: COLORS.alive },
    { x: 360, y: 30, label: "legacyUtil()", color: COLORS.dead },
    { x: 200, y: 120, label: "formatCurrency()", color: COLORS.dead },
  ];
  const lines = [[0, 1], [1, 2], [1, 3]];
  return (
    <svg viewBox="0 0 440 160" className="h-40 w-full">
      {lines.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a].x + 70}
          y1={nodes[a].y + 10}
          x2={nodes[b].x}
          y2={nodes[b].y + 10}
          stroke={nodes[b].color}
          strokeOpacity={0.5}
          strokeWidth={1.5}
          strokeDasharray={nodes[b].color === COLORS.dead ? "4 3" : undefined}
        />
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x} y={n.y} width={70} height={20} rx={4} fill={`${n.color}1a`} stroke={n.color} />
          <text x={n.x + 6} y={n.y + 14} fontSize={10} fontFamily="monospace" fill={n.color}>{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [repoInput, setRepoInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HuntResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Save-to-Grimoire state.
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selected = useMemo(
    () => result?.suspects.find((s) => s.id === selectedId) ?? null,
    [result, selectedId],
  );

  async function hunt(e: FormEvent) {
    e.preventDefault();
    if (!repoInput.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedId(null);
    setSavedId(null);
    setSaveMode(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoInput.trim() }),
      });
      const data = await res.json();
      if (data.ok && data.result) setResult(data.result);
      else setError(data.error ?? "Hunt failed");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveHunt() {
    if (!result) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/hunts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      const data = await res.json();
      if (data.ok && data.hunt) {
        setSavedId(data.hunt.id);
        setSaveMode(data.mode);
      } else {
        setSaveError(data.error ?? "save failed");
      }
    } catch (err) {
      setSaveError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen text-zinc-100">
      {/* nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-6">
        <span className="font-mono text-xs uppercase tracking-widest text-orange-400">Phantom.js</span>
        <nav className="flex gap-4">
          <Link href="/features" className="font-mono text-sm text-zinc-400 transition hover:text-zinc-100">
            Features →
          </Link>
          <Link href="/grimoire" className="font-mono text-sm text-zinc-400 transition hover:text-zinc-100">
            Grimoire →
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-orange-400">FinOps · Dead-Code Exorcist</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Phantom.js <span className="text-zinc-500">— The Ghost Hunter</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-300">
          Paste a GitHub repo. The Hunter flags <span className="text-orange-300">zombie code</span> and{" "}
          <span className="text-orange-300">vampire dependencies</span>, the Skeptic tries to disprove every flag, a sandbox
          verifies the build still compiles, and Phantom opens a PR with projected cloud savings.
        </p>

        <form onSubmit={hunt} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="https://github.com/owner/repo  or  ./local/path"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm outline-none backdrop-blur focus:border-orange-400/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50"
          >
            {loading ? "Summoning…" : "👻 Summon the Hunter"}
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          Try <code className="rounded bg-white/5 px-1">./sample-repo</code> (local) or a public repo URL. Read-only by default.
        </p>
      </section>

      {/* Haunted Call Graph */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-xs text-zinc-400">HAUNTED CALL GRAPH {result ? "— live" : "— preview"}</span>
            <span className="flex gap-3 text-[10px] font-mono">
              <span style={{ color: COLORS.alive }}>● alive</span>
              <span style={{ color: COLORS.uncertain }}>● uncertain</span>
              <span style={{ color: COLORS.dead }}>● zombie</span>
            </span>
          </div>
          {!result ? (
            <GraphPreview />
          ) : (
            <HuntGraph
              nodes={result.graph.nodes}
              edges={result.graph.edges}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="mx-auto max-w-5xl px-4 pb-6">
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>
        </section>
      )}

      {/* Results: summary + save + CoT panel */}
      {result && (
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Files scanned" value={String(result.repo.filesScanned)} />
            <Stat label="💀 Zombies" value={String(result.summary.dead)} accent={COLORS.dead} />
            <Stat label="🤔 Uncertain" value={String(result.summary.uncertain)} accent={COLORS.uncertain} />
            <Stat label="✅ Alive" value={String(result.summary.alive)} accent={COLORS.alive} />
          </div>

          {/* Save to Grimoire */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <button
              onClick={saveHunt}
              disabled={saving || !!savedId}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:opacity-50"
            >
              {savedId ? `Saved ✓` : saving ? "Saving…" : "🔖 Save to Grimoire"}
            </button>
            {savedId ? (
              <>
                <span className="text-xs text-zinc-400">
                  saved to the Grimoire
                  {saveMode === "memory" ? " (demo memory — set SUPABASE_* to persist)" : " (Supabase)"}
                </span>
                <Link
                  href={`/grimoire#${savedId}`}
                  className="ml-auto font-mono text-sm text-orange-400 transition hover:text-orange-300"
                >
                  View in Grimoire →
                </Link>
              </>
            ) : (
              <span className="text-xs text-zinc-500">Store the graph + Hunter/Skeptic traces to revisit or annotate later.</span>
            )}
            {saveError && <span className="text-xs text-rose-300">{saveError}</span>}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="font-mono text-xs text-zinc-400">SANDBOX CHECK</div>
              <div
                className="mt-1 text-lg font-semibold"
                style={{ color: result.summary.sandbox.safe ? COLORS.alive : COLORS.uncertain }}
              >
                {result.summary.sandbox.safe ? "✅ Safe to remove" : "⚠ Blocking refs"}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{result.summary.sandbox.note}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:col-span-2">
              <div className="font-mono text-xs text-zinc-400">FINOPS PROJECTION (per removal batch)</div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Bundle removed" value={`${result.summary.finops.removedBundleKB} KB`} />
                <MiniStat label="Cold-start Δ" value={`${result.summary.finops.coldStartDeltaMs} ms`} />
                <MiniStat label="Build min/mo" value={`-${result.summary.finops.buildMinutesSavedPerMonth}`} />
                <MiniStat label="Est. savings" value={`$${result.summary.finops.projectedSavingsUsd}/mo`} accent={COLORS.alive} />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4 backdrop-blur">
            <div className="font-mono text-xs text-zinc-400">CHAIN OF THOUGHT — click a graph node</div>
            {selected ? (
              <CoTPanel s={selected} />
            ) : (
              <p className="mt-2 text-sm text-zinc-500">
                {result.suspects.filter((s) => s.verdict === "dead").length} zombie candidates. Click a neon-purple node
                (or any node) above to inspect the Hunter and Skeptic reasoning.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Feature grid (landing only) */}
      {!result && (
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Capabilities</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard icon="🧟" title="AST Zombie Detection" body="Whole-repo, comment-aware AST reachability. The Hunter flags functions with zero static references — not grep, so comments and substrings don't trigger false positives." />
            <FeatureCard icon="🧛" title="Vampire Dependency FinOps" body="Dead code and bloated deps map to bundle size, cold starts, and build minutes — turned into a projected $/mo cloud-savings line item on every PR." />
            <FeatureCard icon="🕵️" title="Multi-Agent Skeptic Verification" body="A second agent tries to disprove every flag via dynamic imports, barrel re-exports, string reflection, and test usage — eliminating false positives before they ship." />
            <FeatureCard icon="🧪" title="Sandboxed Build Testing" body="Proposed removals are type-checked (tsc --noEmit) and test-run in an isolated sandbox (Docker/E2B) before approval. The agent self-corrects on compiler errors." />
            <FeatureCard icon="🔄" title="Continuous GitHub Haunting" body="A GitHub Action comments on every PR with AST evidence and bundle/compute impact before merge — exorcisms run continuously, not just on demand." />
            <FeatureCard icon="📊" title="AI Cost Observability" body="Track LLM token spend vs. cloud savings against FOCUS billing exports. Every scan shows ROI: did the agent save more than it cost to run?" />
          </div>
          <p className="mt-4 text-center text-xs text-zinc-500">
            <Link href="/features" className="text-orange-400 hover:text-orange-300">See every capability →</Link>
          </p>
        </section>
      )}

      {/* How it works (landing only) */}
      {!result && (
        <section className="mx-auto max-w-5xl px-4 pb-12">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">How It Works</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stage n="1" title="The Summoning" body="Paste a repo URL or path. Phantom fetches the tree (GitHub tarball or local disk) into an in-memory RepoSource." />
            <Stage n="2" title="The Hunt — MCP + AST" body="An in-memory MCP server exposes read-only AST tools. The agent calls them to extract declarations and references — never touching files directly." />
            <Stage n="3" title="The Trial — Skeptic + Sandbox" body="The Skeptic tries to disprove each flag; a sandbox type-checks proposed removals. No PR unless the build still compiles." />
            <Stage n="4" title="The Exorcism — Verified PR" body="Approved removals become a branch + PR with the FinOps delta and the full Chain-of-Thought, logged to Supabase for audit." />
          </div>
        </section>
      )}

      {/* Trust bar (landing only) */}
      {!result && (
        <section className="mx-auto max-w-5xl px-4 pb-20">
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:grid-cols-4">
            <Trust title="MCP decoupling" body="Reasoning and tool execution are separate. The model only sees a finite read-only tool surface." />
            <Trust title="Read-only by default" body="No write/exec tool exists. Mutation only via a human-approved PR — fully reversible." />
            <Trust title="FOCUS billing" body="FinOps projections reconcile against FOCUS cost-and-usage exports, not guesses." />
            <Trust title="0% FP build guarantee" body="Sandbox + Skeptic mean no removal ships unless the build still compiles." />
          </div>
          <p className="mt-6 text-center text-xs text-zinc-600">Phantom.js — built for the Halloween AI hackathon.</p>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="font-mono text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-zinc-500">{label}</div>
      <div className="text-sm font-semibold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Trust({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-zinc-100">{title}</div>
      <p className="mt-1 text-xs text-zinc-400">{body}</p>
    </div>
  );
}
