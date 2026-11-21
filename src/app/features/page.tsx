import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Phantom.js — Features",
  description:
    "Every capability of the Phantom.js Ghost Hunter: AST zombie detection, FinOps projection, multi-agent Skeptic verification, sandboxed builds, continuous GitHub haunting, and AI cost observability.",
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CATEGORIES: Array<{
  title: string;
  accent: string;
  items: Array<{ icon: string; title: string; blurb: string; detail: string }>;
}> = [
  {
    title: "Detection & Analysis",
    accent: "#c084fc",
    items: [
      {
        icon: "🧟",
        title: "AST Zombie Detection",
        blurb: "Whole-repo, comment-aware AST reachability — not grep.",
        detail:
          "The Hunter Agent parses every file with the TypeScript compiler API and flags functions with zero static references. Matches inside comments are ignored, so a symbol mentioned only in a comment never becomes a false positive. A per-file parse cache turns the scan O(files), not O(functions × files).",
      },
      {
        icon: "🧛",
        title: "Vampire Dependency FinOps",
        blurb: "Dead code and bloated deps → bundle KB → cold-start Δ → $/mo.",
        detail:
          "estimate_finops_impact converts removed lines into a bundle-size delta, a cold-start delta (~50 KB ≈ 1 ms), compute-seconds saved per month, and projected $/mo at a tunable price-per-GB-second. Production reconciles these against FOCUS billing exports instead of estimates.",
      },
      {
        icon: "🕸️",
        title: "The Haunted Call Graph",
        blurb: "An interactive React Flow graph of your codebase.",
        detail:
          "Nodes are functions, colored by verdict (terminal green = alive, neon purple = zombie, amber = uncertain), grouped into columns so dead code visually clusters. Edges are caller→callee. Click any node to inspect the Hunter and Skeptic Chain-of-Thought before approving a removal.",
      },
      {
        icon: "📦",
        title: "Public + Local Scanning",
        blurb: "Paste a GitHub URL or a local path — same engine.",
        detail:
          "A RepoSource abstraction backs both: LocalDiskRepo reads the filesystem; InMemoryRepo holds a fetched GitHub tarball (gunzipped + untarred in memory — no git clone, no disk writes). Supports owner/repo, /tree/ref, and /tree/ref/subpath URLs. Tarball capped at 50 MB / 2500 files to protect the function.",
      },
    ],
  },
  {
    title: "Verification & Safety",
    accent: "#00fa00",
    items: [
      {
        icon: "🕵️",
        title: "Multi-Agent Skeptic Verification",
        blurb: "A second agent tries to disprove every flag.",
        detail:
          "The Skeptic runs a veto checklist — dynamic imports, barrel re-exports, string-literal reflection, test-only usage, and computed/private-key names. Any hit forces ALIVE. Computed/private members ([Symbol.x], #x) can't be referenced by plain name, so they route to UNCERTAIN (human review) instead of being false-flagged dead. The model cannot override these checks.",
      },
      {
        icon: "🧪",
        title: "Sandboxed Build Testing",
        blurb: "No PR unless the build still compiles.",
        detail:
          "run_sandbox_check verifies that removing a set of functions leaves no reference from surviving code (a transitive safety net). Production applies the edits in an isolated sandbox (Docker/E2B) and runs tsc --noEmit + the test suite; on any compiler error the agent self-corrects and drops the offending removal from the batch.",
      },
      {
        icon: "⚖️",
        title: "Three-Tier Verdicts + Confidence",
        blurb: "dead / uncertain / alive, never auto-delete the unsure.",
        detail:
          "Each suspect gets a confidence score. ≥0.7 and the Skeptic found nothing → dead. Otherwise → uncertain, which is routed to human review and never deleted automatically. Exported-but-unreferenced functions land in uncertain (they could be intended public API).",
      },
      {
        icon: "🔒",
        title: "Read-Only by Construction",
        blurb: "There is no write/exec tool. Mutation only via an approved PR.",
        detail:
          "The MCP server exposes 8 read-only tools and nothing that mutates. A prompt-injection hidden in scanned source can, at worst, produce a read-only tool call. The only write path is branch + PR, gated behind a human approval, and fully reversible (close the PR, delete the branch).",
      },
    ],
  },
  {
    title: "Platform & Operations",
    accent: "#f59e0b",
    items: [
      {
        icon: "🔌",
        title: "MCP Decoupling",
        blurb: "Transport-agnostic: stdio locally, in-memory on serverless.",
        detail:
          "Reasoning lives in the agent; tool execution lives in the sandboxed server. The same createPhantomServer factory runs over stdio when launched standalone, or linked in-process via InMemoryTransport on Vercel — no subprocess on the function. Swap to Streamable HTTP for a fully network-decoupled deploy; the tool surface and agent loop are unchanged.",
      },
      {
        icon: "🔄",
        title: "Continuous GitHub Haunting",
        blurb: "A GitHub Action comments on every PR before merge.",
        detail:
          ".github/workflows/phantom-haunt.yml triggers on pull requests touching source, runs the agent against the checked-out repo, and posts a Markdown report (zombie candidates + FinOps delta) as a PR comment and the job summary. Read-only — it never pushes. Add an approval label to promote a report into an actual exorcism PR.",
      },
      {
        icon: "📊",
        title: "AI Cost Observability",
        blurb: "Track token spend vs. cloud savings — ROI per scan.",
        detail:
          "Every scan reports the projected savings against the agent's own LLM token cost, so FinOps can see whether the agent paid for itself. Production feeds real cloud spend via a FOCUS (FinOps Open Cost & Usage Specification) MCP server and persists the trend to Supabase.",
      },
      {
        icon: "⚡",
        title: "Redis AST Caching",
        blurb: "Unchanged files skip re-parse across runs and hosts.",
        detail:
          "The in-process parse cache makes a single scan O(files). The stretch Redis layer keys parsed ASTs by file-content hash so repeated scans of a repo (or the same file across PRs) skip parsing entirely — critical for the GitHub Action, which re-scans on every PR.",
      },
    ],
  },
];

const TOOLS: Array<{ name: string; desc: string }> = [
  { name: "list_source_files", desc: "Enumerate the scannable file set" },
  { name: "run_ast_parser", desc: "Parse a file → function declarations" },
  { name: "find_references", desc: "Whole-repo, comment-aware reference scan" },
  { name: "list_exports", desc: "Exported symbols + barrel re-exports" },
  { name: "get_calls", desc: "Call sites per file (call-graph edges)" },
  { name: "get_imports", desc: "Import declarations (cross-file edges)" },
  { name: "run_sandbox_check", desc: "Transitive reference safety before PR" },
  { name: "estimate_finops_impact", desc: "Bundle / cold-start / $ projection" },
];

const STATS = [
  { value: "8", label: "read-only tools" },
  { value: "0", label: "write / exec tools" },
  { value: "362", label: "files scanned (real repo)" },
  { value: "1363", label: "nodes in call graph" },
  { value: "5011", label: "edges in call graph" },
  { value: "O(files)", label: "parse complexity (cached)" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FeaturesPage() {
  return (
    <main className="min-h-screen text-zinc-100">
      {/* nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-6">
        <Link href="/" className="font-mono text-sm text-zinc-400 hover:text-zinc-100">
          ← back to the Hunter
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-fuchsia-400">features</span>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Every weapon in the Hunter&apos;s arsenal
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Phantom.js is not an LLM that greps your code. It&apos;s a two-agent pipeline with a vetted,
          read-only tool surface, sandboxed verification, and a FinOps line item on every PR. Here&apos;s
          what&apos;s under the hood — and why each piece exists.
        </p>
      </section>

      {/* feature categories */}
      {CATEGORIES.map((cat) => (
        <section key={cat.title} className="mx-auto max-w-5xl px-4 pb-12">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            <span className="h-2 w-2 rounded-full" style={{ background: cat.accent }} />
            {cat.title}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {cat.items.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur transition hover:border-fuchsia-400/30 hover:bg-white/10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{f.icon}</span>
                  <h3 className="text-sm font-semibold text-zinc-100">{f.title}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">{f.blurb}</p>
                <details className="group mt-3">
                  <summary className="cursor-pointer font-mono text-[11px] text-fuchsia-400 hover:text-fuchsia-300">
                    how it works
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-400">{f.detail}</p>
                </details>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* two-agent flow */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">
            The Trial — two agents, one verdict
          </h2>
          <div className="grid items-center gap-3 sm:grid-cols-7">
            <FlowCard tone="#c084fc" title="Hunter" lines={["flags zero-reference", "candidates"]} />
            <Arrow />
            <FlowCard tone="#00fa00" title="Skeptic" lines={["dynamic imports", "barrels, reflection", "tests, computed keys"]} />
            <Arrow />
            <FlowCard tone="#f59e0b" title="Verdict" lines={["dead / uncertain", "alive"]} />
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            The Skeptic can only upgrade a candidate toward ALIVE or uncertain — never toward dead. A human
            approves before anything is removed, and a sandbox confirms the build still compiles.
          </p>
        </div>
      </section>

      {/* MCP tool surface */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-zinc-400">
          The MCP tool surface — finite &amp; read-only
        </h2>
        <p className="mb-4 max-w-2xl text-xs text-zinc-500">
          This is the complete set of operations the agent can perform. Note what&apos;s missing: there is no
          <code className="mx-1 rounded bg-white/5 px-1">write_file</code>,
          <code className="mx-1 rounded bg-white/5 px-1">exec</code>, or
          <code className="mx-1 rounded bg-white/5 px-1">git</code> tool. That&apos;s the security boundary.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <div
              key={t.name}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 backdrop-blur"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="read-only" />
              <code className="font-mono text-xs text-zinc-200">{t.name}</code>
              <span className="ml-auto text-xs text-zinc-500">{t.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* verified stats */}
      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">Verified, not assumed</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur">
              <div className="text-xl font-bold text-zinc-100">{s.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          From a real scan of{" "}
          <code className="rounded bg-white/5 px-1">anthropics/anthropic-sdk-typescript</code> (src). Build and
          type-check pass; the local sample repo resolves the dynamic-import and barrel-re-export edge cases
          correctly.
        </p>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
          <p className="text-sm text-zinc-300">Want to see it hunt?</p>
          <Link
            href="/"
            className="mt-3 inline-block rounded-lg bg-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-fuchsia-500"
          >
            👻 Summon the Hunter
          </Link>
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Arrow() {
  return <div className="hidden text-center font-mono text-zinc-600 sm:block">→</div>;
}

function FlowCard({ tone, title, lines }: { tone: string; title: string; lines: string[] }) {
  return (
    <div
      className="rounded-xl border p-4 backdrop-blur sm:col-span-2"
      style={{ borderColor: `${tone}55`, background: `${tone}10` }}
    >
      <div className="text-sm font-semibold" style={{ color: tone }}>
        {title}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-zinc-400">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}
