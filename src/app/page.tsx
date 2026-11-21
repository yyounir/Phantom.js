"use client";

import { useMemo, useState, type FormEvent } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { HuntResult, Suspect, Verdict } from "@/lib/agent/types";

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const COLORS: Record<Verdict, string> = {
  alive: "#00fa00", // terminal green
  dead: "#c084fc", // neon purple (zombie)
  uncertain: "#f59e0b", // amber
};
const VERDICT_META: Record<Verdict, { emoji: string; label: string }> = {
  dead: { emoji: "💀", label: "Zombie" },
  uncertain: { emoji: "🤔", label: "Uncertain" },
  alive: { emoji: "✅", label: "Alive" },
};

// ---------------------------------------------------------------------------
// React Flow custom node
// ---------------------------------------------------------------------------

interface NodeData {
  label: string;
  verdict: Verdict;
  file: string;
  referenceCount: number;
  isExported: boolean;
  selected?: boolean;
}

function PhantomNode({ data }: NodeProps) {
  const d = data as NodeData;
  const color = COLORS[d.verdict];
  return (
    <div
      className="rounded-lg border px-2 py-1 text-[11px] font-mono"
      style={{
        borderColor: color,
        background: `${color}14`,
        boxShadow: d.selected ? `0 0 0 2px ${color}` : `0 0 12px ${color}33`,
        color,
      }}
      title={`${d.file} · refs=${d.referenceCount}${d.isExported ? " · exported" : ""}`}
    >
      <Handle type="target" position={Position.Left} style={{ background: color, width: 6, height: 6 }} />
      {d.label}
      <Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6 }} />
    </div>
  );
}
const nodeTypes = { phantom: PhantomNode };

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur transition hover:border-fuchsia-400/30 hover:bg-white/10">
      <div className="mb-2 text-xl">{icon}</div>
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function Stage({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
      <div className="font-mono text-xs text-fuchsia-400">STAGE {n}</div>
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

  async function hunt(e: FormEvent) {
    e.preventDefault();
    if (!repoInput.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedId(null);
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

  const selected = useMemo(
    () => result?.suspects.find((s) => s.id === selectedId) ?? null,
    [result, selectedId],
  );

  // Map the agent's graph -> React Flow nodes with a verdict-grouped layout.
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!result) return { rfNodes: [] as Node[], rfEdges: [] as Edge[] };
    const verdictOrder: Verdict[] = ["alive", "uncertain", "dead"];
    const col = (v: Verdict) => verdictOrder.indexOf(v);
    const counters = [0, 0, 0];
    const verdictById = new Map(result.graph.nodes.map((n) => [n.id, n.verdict]));

    const rfNodes: Node[] = result.graph.nodes.map((n) => {
      const c = col(n.verdict);
      const y = counters[c]++ * 70;
      return {
        id: n.id,
        type: "phantom",
        position: { x: c * 280, y },
        data: {
          label: n.label,
          verdict: n.verdict,
          file: n.file,
          referenceCount: n.referenceCount,
          isExported: n.isExported,
          selected: n.id === selectedId,
        } as NodeData,
      };
    });

    const rfEdges: Edge[] = result.graph.edges.map((e) => {
      const targetVerdict = verdictById.get(e.target);
      const zombie = targetVerdict === "dead";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        animated: zombie,
        style: { stroke: zombie ? COLORS.dead : "#3f3f46", strokeOpacity: zombie ? 0.7 : 0.35, strokeWidth: 1.5 },
      };
    });
    return { rfNodes, rfEdges };
  }, [result, selectedId]);

  return (
    <main className="min-h-screen text-zinc-100">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-fuchsia-400">FinOps · Dead-Code Exorcist</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Phantom.js <span className="text-zinc-500">— The Ghost Hunter</span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-300">
          Paste a GitHub repo. The Hunter flags <span className="text-fuchsia-300">zombie code</span> and{" "}
          <span className="text-fuchsia-300">vampire dependencies</span>, the Skeptic tries to disprove every flag, a sandbox
          verifies the build still compiles, and Phantom opens a PR with projected cloud savings.
        </p>

        <form onSubmit={hunt} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="https://github.com/owner/repo  or  ./local/path"
            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-sm outline-none backdrop-blur focus:border-fuchsia-400/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-fuchsia-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50"
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
            <div className="h-[460px]">
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                onNodeClick={(_e, n) => setSelectedId(n.id)}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#2a1f3d" gap={20} />
                <Controls showInteractive={false} />
                <MiniMap
                  nodeColor={(n) => COLORS[(n.data as NodeData).verdict]}
                  maskColor="rgba(0,0,0,0.7)"
                />
              </ReactFlow>
            </div>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="mx-auto max-w-5xl px-4 pb-6">
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</div>
        </section>
      )}

      {/* Results: summary + CoT panel */}
      {result && (
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Files scanned" value={String(result.repo.filesScanned)} />
            <Stat label="💀 Zombies" value={String(result.summary.dead)} accent={COLORS.dead} />
            <Stat label="🤔 Uncertain" value={String(result.summary.uncertain)} accent={COLORS.uncertain} />
            <Stat label="✅ Alive" value={String(result.summary.alive)} accent={COLORS.alive} />
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
          <p className="mt-6 text-center text-xs text-zinc-600">
            Phantom.js — built for the Halloween AI hackathon.
          </p>
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

function CoTPanel({ s }: { s: Suspect }) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-zinc-100">{s.functionName}</span>
        <span className="text-xs text-zinc-500">{s.file}:{s.startLine}-{s.endLine}</span>
        <span className="ml-auto text-xs" style={{ color: COLORS[s.verdict] }}>
          {VERDICT_META[s.verdict].emoji} {VERDICT_META[s.verdict].label} · {Math.round(s.confidence * 100)}%
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-400">Hunter Agent</div>
          <div className="mt-1 space-y-1 text-xs text-zinc-400">
            {s.hunterTrace.map((t, i) => <div key={i}>{t}</div>)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">Skeptic Agent</div>
          <div className="mt-1 space-y-1 text-xs text-zinc-400">
            {s.skepticTrace.map((t, i) => <div key={i}>{t}</div>)}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-zinc-600">
        refs: {s.referenceCount} · kinds: {s.referenceKinds.join(", ") || "none"}
        {s.reexportedBy.length ? ` · re-exported by: ${s.reexportedBy.join(", ")}` : ""}
      </div>
    </div>
  );
}
