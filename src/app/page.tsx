"use client";

import { useState, type FormEvent } from "react";

type Verdict = "dead" | "uncertain" | "alive";

interface Suspect {
  file: string;
  functionName: string;
  kind: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  referenceCount: number;
  referenceKinds: string[];
  reexportedBy: string[];
  verdict: Verdict;
  confidence: number;
  reasoningTrace: string[];
}

interface Report {
  repoPath: string;
  scannedFiles: number;
  suspects: Suspect[];
  dead: Suspect[];
  uncertain: Suspect[];
  alive: Suspect[];
}

interface ApiResponse {
  ok: boolean;
  report?: Report;
  logs?: string[];
  error?: string;
}

const VERDICT_META: Record<
  Verdict,
  { label: string; emoji: string; ring: string; text: string; dot: string }
> = {
  dead: { label: "Dead", emoji: "💀", ring: "ring-rose-500/40", text: "text-rose-300", dot: "bg-rose-500" },
  uncertain: { label: "Uncertain", emoji: "🤔", ring: "ring-amber-500/40", text: "text-amber-300", dot: "bg-amber-500" },
  alive: { label: "Alive", emoji: "✅", ring: "ring-emerald-500/40", text: "text-emerald-300", dot: "bg-emerald-500" },
};

const pct = (n: number) => `${Math.round(n * 100)}%`;

function SuspectCard({ s }: { s: Suspect }) {
  const meta = VERDICT_META[s.verdict];
  return (
    <details className={`group mb-2 rounded-lg bg-[#15101f] ring-1 ${meta.ring} p-3`}>
      <summary className="flex cursor-pointer list-none items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className="font-mono text-sm text-zinc-100">{s.functionName}</span>
        <span className="text-xs text-zinc-500">· {s.kind}</span>
        <span className="ml-auto font-mono text-xs text-zinc-400">
          {s.file}:{s.startLine}-{s.endLine}
        </span>
        <span className={`ml-2 text-xs ${meta.text}`}>
          {meta.emoji} {meta.label} · {pct(s.confidence)}
        </span>
      </summary>
      <div className="mt-3 ml-4 space-y-1 text-xs text-zinc-400">
        <div>
          references: <span className="text-zinc-200">{s.referenceCount}</span> · kinds:{" "}
          <span className="text-zinc-200">{s.referenceKinds.join(", ") || "none"}</span>
        </div>
        {s.reexportedBy.length > 0 && (
          <div>
            re-exported by: <span className="text-zinc-200">{s.reexportedBy.join(", ")}</span>
          </div>
        )}
        <div className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-500">
          {s.reasoningTrace.map((t, i) => (
            <div key={i}>{t}</div>
          ))}
        </div>
      </div>
    </details>
  );
}

function Section({
  title,
  emoji,
  list,
  accent,
}: {
  title: string;
  emoji: string;
  list: Suspect[];
  accent: string;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span>{emoji}</span>
        <span>{title}</span>
        <span className={`text-xs ${accent}`}>({list.length})</span>
      </h2>
      {list.length === 0 ? (
        <p className="text-xs text-zinc-600">none</p>
      ) : (
        list.map((s, i) => <SuspectCard key={i} s={s} />)
      )}
    </section>
  );
}

export default function Home() {
  const [repoPath, setRepoPath] = useState("./sample-repo");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function runExorcism(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);
    setLogs([]);
    try {
      const res = await fetch("/api/exorcise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath, dryRun: true }),
      });
      const data: ApiResponse = await res.json();
      if (data.ok && data.report) {
        setReport(data.report);
        setLogs(data.logs ?? []);
      } else {
        setError(data.error ?? "Unknown error");
        setLogs(data.logs ?? []);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">
          🎃 Phantom.js <span className="font-normal text-zinc-500">— The Ghost Hunter</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Hunts <span className="text-rose-300">zombie code</span> &amp;{" "}
          <span className="text-violet-300">vampire dependencies</span>. Dry-run by default — no files are modified.
        </p>
      </header>

      <form onSubmit={runExorcism} className="mb-6 flex gap-2">
        <input
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          placeholder="./path/to/repo"
          className="flex-1 rounded-lg bg-[#15101f] px-3 py-2 font-mono text-sm outline-none ring-1 ring-[#2a1f3d] focus:ring-violet-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "Hunting…" : "Exorcise 🔍"}
        </button>
      </form>

      {loading && (
        <div className="mb-4 animate-pulse text-sm text-zinc-400">
          Connecting to the MCP AST server and scanning the repo…
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-rose-950/40 p-3 text-sm text-rose-200 ring-1 ring-rose-500/40">
          {error}
        </div>
      )}

      {logs.length > 0 && (
        <details className="mb-6 rounded-lg bg-[#15101f] p-3 ring-1 ring-[#2a1f3d]">
          <summary className="cursor-pointer text-xs text-zinc-400">agent log ({logs.length})</summary>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] text-zinc-500">{logs.join("\n")}</pre>
        </details>
      )}

      {report && (
        <div className="grid gap-6">
          <div className="text-sm text-zinc-400">
            Scanned <span className="text-zinc-200">{report.scannedFiles}</span> files in{" "}
            <span className="font-mono text-zinc-200">{report.repoPath}</span>
          </div>
          <Section title="Dead — candidates for removal" emoji="💀" list={report.dead} accent="text-rose-300" />
          <Section title="Uncertain — human review" emoji="🤔" list={report.uncertain} accent="text-amber-300" />
          <Section title="Alive — kept" emoji="✅" list={report.alive} accent="text-emerald-300" />
        </div>
      )}

      {!report && !loading && !error && (
        <p className="text-sm text-zinc-500">
          Enter a repo path (try <span className="font-mono">./sample-repo</span>) and click Exorcise.
        </p>
      )}
    </main>
  );
}
