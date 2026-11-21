/**
 * Phantom.js — Agent Loop (Hunter / Skeptic)
 * ============================================================================
 *   SUMMON : build a RepoSource (local disk OR GitHub tarball) and connect an
 *            in-memory MCP client+server pair over it.
 *   HUNT   : run_ast_parser over every file -> FunctionInfo[].
 *   TRIAL  : two-agent pass per suspect function:
 *              Hunter  flags zero-reference candidates as zombies.
 *              Skeptic tries to DISPROVE each flag (dynamic imports, barrel
 *                re-exports, string reflection, test usage).
 *            Combined verdict + confidence. Edges built from call sites ->
 *            the Haunted Call Graph.
 *   EXORCISE: run_sandbox_check (no dangling refs) + estimate_finops_impact.
 *
 * The agent only ever calls the read-only MCP tools; it never touches the repo
 * directly. Both Hunter and Skeptic are deterministic here so the loop runs with
 * no LLM key — the traces show exactly what each "agent" reasoned. In
 * production an LLM drives each pass; the Skeptic's hard checks remain as a
 * policy layer that can VETO the Hunter.
 */

import { connectPhantomServer } from "./mcp-client";
import { LocalDiskRepo, type RepoSource } from "../mcp/mcp-server";
import { fetchGitHubRepo } from "../github";
import type {
  FinopsResult,
  FunctionInfo,
  GraphEdge,
  GraphNode,
  HuntResult,
  ReferenceKind,
  ReferenceMatch,
  RepoSpec,
  SandboxResult,
  Suspect,
  Verdict,
} from "./types";

const DEAD_THRESHOLD = 0.7;
const UNCERTAIN_THRESHOLD = 0.3;
const BARREL_NAMES = new Set(["index.ts", "index.tsx", "index.js", "index.jsx"]);
const MAX_EDGES = 5000;

// Tool-result shapes (mirror the MCP server JSON contracts).
interface ListFilesResult {
  root: string;
  count: number;
  files: string[];
}
interface AstResult {
  file: string;
  functionCount: number;
  functions: FunctionInfo[];
}
interface RefResult {
  symbol: string;
  referenceCount: number;
  references: ReferenceMatch[];
}
interface ExportResult {
  file: string;
  exports: Array<{ name: string; kind: string; localName: string | null }>;
}

export interface HuntOptions {
  onProgress?: (msg: string) => void;
  githubToken?: string;
}

// ---------------------------------------------------------------------------
// The two agents
// ---------------------------------------------------------------------------

function hunterPass(fn: FunctionInfo, refs: RefResult): string[] {
  const t: string[] = [];
  if (fn.isDefaultExport) {
    t.push("Hunter: default export — public API surface, not flagged.");
    return t;
  }
  if (!/^[A-Za-z_$][\w$]*$/.test(fn.name)) {
    t.push("Hunter: name is a computed/private key — references unresolvable by name; not flagging.");
    return t;
  }
  if (refs.referenceCount > 0) {
    t.push(`Hunter: ${refs.referenceCount} reference(s) found — live, not flagged.`);
    return t;
  }
  t.push("Hunter: zero static references — flagging as zombie candidate.");
  return t;
}

function skepticPass(
  fn: FunctionInfo,
  refs: RefResult,
  reexportedBy: string[],
): { trace: string[]; disproof: boolean } {
  const t: string[] = [];
  let disproof = false;
  const hasDynamic = refs.references.some((r) => r.kind === "dynamic-import");
  const hasString = refs.references.some((r) => r.kind === "string-literal");
  const inTests = refs.references.some((r) => /\.(test|spec)\.[tj]sx?$/.test(r.file));

  if (reexportedBy.length) {
    t.push(`Skeptic: re-exported by barrel ${reexportedBy.join(", ")} → ALIVE (public API).`);
    disproof = true;
  } else {
    t.push("Skeptic: no barrel re-export.");
  }
  if (hasDynamic) {
    t.push("Skeptic: dynamic import()/require() usage → ALIVE (runtime-loaded).");
    disproof = true;
  } else {
    t.push("Skeptic: no dynamic import()/require() usage.");
  }
  if (hasString) {
    t.push("Skeptic: string-literal usage → ALIVE (possible reflection/lookup map).");
    disproof = true;
  } else {
    t.push("Skeptic: no string-literal (reflection) usage.");
  }
  if (inTests) t.push("Skeptic: referenced in test files → ALIVE (test utility).");
  if (refs.referenceCount > 0 && !disproof) {
    t.push("Skeptic: references exist that the Hunter already counted → ALIVE.");
    disproof = true;
  }
  if (!disproof) t.push("Skeptic: could not disprove the Hunter — verdict stands.");
  return { trace: t, disproof };
}

function combine(
  fn: FunctionInfo,
  refCount: number,
  reexportedBy: string[],
  kinds: ReferenceKind[],
  skepticDisproof: boolean,
): { verdict: Verdict; confidence: number } {
  // Skeptic (or any reference) forces ALIVE — the safety net the LLM can't override.
  if (skepticDisproof) return { verdict: "alive", confidence: refCount > 0 ? 0.85 : 0.9 };
  if (refCount > 0) return { verdict: "alive", confidence: 0.8 };

  // Computed/private/special-named members (e.g. [Symbol.asyncIterator], #run)
  // can't be referenced by plain name, so "zero references" is unreliable —
  // route to human review instead of marking dead (kills a class of FPs).
  if (!/^[A-Za-z_$][\w$]*$/.test(fn.name)) {
    return { verdict: "uncertain", confidence: 0.4 };
  }

  // No references and the Skeptic found nothing — confidence in "dead".
  let confidence = fn.isExported ? 0.5 : 0.8; // exported & unused might be intended API
  if (fn.endLine - fn.startLine > 60) confidence -= 0.1;
  if (confidence >= DEAD_THRESHOLD) return { verdict: "dead", confidence };
  return { verdict: "uncertain", confidence };
}

// ---------------------------------------------------------------------------
// Call-graph helpers (resolve ref -> enclosing caller using stored AST ranges)
// ---------------------------------------------------------------------------

function enclosingName(
  file: string,
  line: number,
  functionsByFile: Map<string, FunctionInfo[]>,
): string | null {
  const fns = functionsByFile.get(file) ?? [];
  let best: { name: string; size: number } | null = null;
  for (const f of fns) {
    if (line >= f.startLine && line <= f.endLine) {
      const size = f.endLine - f.startLine;
      if (!best || size < best.size) best = { name: f.name, size };
    }
  }
  return best?.name ?? null;
}

function nodeIdFor(
  file: string,
  name: string,
  functionsByFile: Map<string, FunctionInfo[]>,
): string | null {
  const fns = functionsByFile.get(file) ?? [];
  const f = fns.find((x) => x.name === name);
  return f ? `${file}:${name}:${f.startLine}` : null;
}

// ---------------------------------------------------------------------------
// The hunt
// ---------------------------------------------------------------------------

export async function runHunt(
  repoSpec: RepoSpec,
  options: HuntOptions = {},
): Promise<HuntResult> {
  const log = options.onProgress ?? (() => {});

  // SUMMON: build a RepoSource.
  let repo: RepoSource;
  if (repoSpec.kind === "github") {
    log(`Summoning ${repoSpec.url}…`);
    repo = await fetchGitHubRepo(repoSpec.url, {
      token: options.githubToken,
      onProgress: log,
    });
  } else {
    repo = new LocalDiskRepo(repoSpec.path);
    log(`Summoning local repo ${repo.root}…`);
  }

  // Connect the in-memory MCP client+server over the repo (serverless-safe).
  const mcp = await connectPhantomServer(repo);
  const tools = await mcp.listTools();
  log(`MCP handshake complete. Tools: ${tools.join(", ")}`);

  try {
    // HUNT: enumerate + parse every file once.
    const { files } = await mcp.callTool<ListFilesResult>("list_source_files", {});
    log(`Scanning ${files.length} source files`);

    const functionsByFile = new Map<string, FunctionInfo[]>();
    for (const file of files) {
      try {
        const ast = await mcp.callTool<AstResult>("run_ast_parser", { filePath: file });
        functionsByFile.set(file, ast.functions);
      } catch (e) {
        log(`  skip ${file}: ${String(e)}`);
      }
    }

    const indexFiles = files.filter((f) => BARREL_NAMES.has(f.split("/").pop() ?? ""));
    const barrelCache = new Map<string, ExportResult | null>();

    const suspects: Suspect[] = [];
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>();

    // TRIAL: Hunter + Skeptic per function.
    for (const [file, fns] of functionsByFile) {
      const dir = file.split("/").slice(0, -1).join("/");
      const barrelCandidates = indexFiles.filter((b) => b.split("/").slice(0, -1).join("/") === dir);

      for (const fn of fns) {
        if (fn.isDefaultExport) continue;

        const refs = await mcp.callTool<RefResult>("find_references", {
          symbol: fn.name,
          sourceFile: file,
        });
        const kinds = refs.references.map((r) => r.kind);

        const reexportedBy: string[] = [];
        for (const barrel of barrelCandidates) {
          let ex = barrelCache.get(barrel);
          if (ex === undefined) {
            try {
              ex = await mcp.callTool<ExportResult>("list_exports", { filePath: barrel });
            } catch {
              ex = null;
            }
            barrelCache.set(barrel, ex);
          }
          if (ex?.exports.some((e) => e.localName === fn.name || e.name === fn.name || e.name === "*")) {
            reexportedBy.push(barrel);
          }
        }

        const hunterTrace = hunterPass(fn, refs);
        const skeptic = skepticPass(fn, refs, reexportedBy);
        const { verdict, confidence } = combine(
          fn, refs.referenceCount, reexportedBy, kinds, skeptic.disproof,
        );

        const id = `${file}:${fn.name}:${fn.startLine}`;
        suspects.push({
          id, file, functionName: fn.name, kind: fn.kind,
          startLine: fn.startLine, endLine: fn.endLine, isExported: fn.isExported,
          referenceCount: refs.referenceCount,
          referenceKinds: Array.from(new Set(kinds)),
          reexportedBy, verdict, confidence,
          hunterTrace, skepticTrace: skeptic.trace,
        });
        nodes.push({
          id, label: fn.name, file, verdict,
          isExported: fn.isExported, referenceCount: refs.referenceCount,
        });

        // Build call edges from this function's references (caller -> this fn).
        if (edges.length < MAX_EDGES) {
          for (const r of refs.references) {
            if (r.kind === "import" || r.kind === "string-literal") continue;
            const caller = enclosingName(r.file, r.line, functionsByFile);
            if (!caller) continue;
            const callerId = nodeIdFor(r.file, caller, functionsByFile);
            if (!callerId || callerId === id) continue;
            const eid = `${callerId}->${id}`;
            if (edgeSet.has(eid)) continue;
            edgeSet.add(eid);
            edges.push({ id: eid, source: callerId, target: id });
          }
        }
      }
    }

    const dead = suspects.filter((s) => s.verdict === "dead");
    const uncertain = suspects.filter((s) => s.verdict === "uncertain");
    const alive = suspects.filter((s) => s.verdict === "alive");

    // EXORCISE prep: sandbox + FinOps (read-only; PR generation is a separate gate).
    const sandbox = await mcp.callTool<SandboxResult>("run_sandbox_check", {
      removals: dead.map((s) => ({ file: s.file, name: s.functionName })),
    });
    const removedLines = dead.reduce((n, s) => n + (s.endLine - s.startLine + 1), 0);
    const finops = await mcp.callTool<FinopsResult>("estimate_finops_impact", { removedLines });

    log(
      `Hunt complete — ${dead.length} dead, ${uncertain.length} uncertain, ${alive.length} alive. ` +
      `Sandbox safe=${sandbox.safe}. Savings≈$${finops.projectedSavingsUsd}/mo.`,
    );

    return {
      repo: {
        kind: repoSpec.kind,
        ref: repo.root,
        url: repoSpec.kind === "github" ? repoSpec.url : undefined,
        filesScanned: files.length,
      },
      graph: { nodes, edges },
      suspects,
      summary: {
        dead: dead.length,
        uncertain: uncertain.length,
        alive: alive.length,
        finops,
        sandbox,
      },
    };
  } finally {
    await mcp.close();
  }
}
