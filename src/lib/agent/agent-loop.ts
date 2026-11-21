/**
 * Phantom.js — Agent Loop
 * ============================================================================
 * The think → act → observe → validate loop.
 *
 *   PLAN    : enumerate every function declaration across the target files.
 *   ACT     : run_ast_parser(file)            -> FunctionInfo[]
 *   OBSERVE : each function has {name, isExported, kind, lines}.
 *   ACT     : find_references(name, repoRoot) -> ReferenceMatch[]
 *             list_exports(barrel index files) -> reexportedBy[]
 *   THINK   : Chain-of-Thought over the false-positive vectors.
 *   VALID   : deterministic policy guards -> verdict + confidence.
 *   LOOP    : next suspect.
 *   BATCH   : group into {dead, uncertain, alive}. dryRun by default.
 *
 * IMPORTANT — who does the reasoning?
 *   The foundational version runs the policy guards directly, so the agent is
 *   fully functional WITHOUT an LLM API key. The reasoningTrace is emitted as a
 *   CoT log so you can see exactly what the agent "thought".
 *
 *   In production the LLM drives the CoT and proposes a verdict; these same
 *   guards act as a policy layer that can VETO the model (e.g. a dynamic-import
 *   match forces ALIVE regardless of what the model says). The model cannot
 *   self-authorize a deletion — only the guards + a human can.
 */

import { connectPhantomServer, type PhantomMcpClient } from "./mcp-client";
import type {
  ExorcismReport,
  FunctionInfo,
  ReferenceKind,
  ReferenceMatch,
  Suspect,
  Verdict,
} from "./types";
import * as path from "node:path";

// --- Confidence thresholds (tune these via the evaluation harness, §3) ---
const DEAD_THRESHOLD = 0.7; // >= this and "no refs, not exported" => DEAD
const UNCERTAIN_THRESHOLD = 0.3; // below DEAD_THRESHOLD and >= this => UNCERTAIN

/** Shapes returned by the MCP server tools (mirror the server's JSON). */
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

/** `index.*` file basenames that act as barrel re-exporters. */
const BARREL_NAMES = new Set(["index.ts", "index.tsx", "index.js", "index.jsx"]);

export interface ExorcismOptions {
  /** If true (default), produce a report only — never mutate. */
  dryRun?: boolean;
  /** Progress callback (also used to stream logs to the API caller). */
  onProgress?: (msg: string) => void;
}

/**
 * Run a full exorcism over a repository.
 * Returns the report. Performs NO mutation unless dryRun=false AND an approval
 * is provided (PR generation is a separate, gated step — see route note).
 */
export async function runExorcism(
  repoPath: string,
  options: ExorcismOptions = {},
): Promise<ExorcismReport> {
  const root = path.resolve(repoPath);
  const dryRun = options.dryRun ?? true;
  const log = options.onProgress ?? (() => {});

  // 1. Connect to the MCP AST server — the agent's ONLY interface to the repo.
  log("Connecting to Phantom AST MCP server…");
  const mcp = await connectPhantomServer();
  const tools = await mcp.listTools();
  log(`Handshake complete. Tools: ${tools.join(", ")}`);

  try {
    // 2. Enumerate the scan set through MCP (no direct FS access in the agent).
    const fileList = await mcp.callTool<ListFilesResult>("list_source_files", { searchRoot: root });
    log(`Scanning ${fileList.count} source files under ${root}`);

    // Collect barrel index files once (string filtering — no disk access).
    const indexFiles = fileList.files.filter((f) => BARREL_NAMES.has(path.basename(f)));

    const suspects: Suspect[] = [];

    // 3. For each file -> parse -> for each function -> verify -> classify.
    for (const relFile of fileList.files) {
      const absFile = path.join(root, relFile);
      let ast: AstResult;
      try {
        ast = await mcp.callTool<AstResult>("run_ast_parser", { filePath: absFile });
      } catch (e) {
        log(`  skip ${relFile}: ${String(e)}`);
        continue;
      }

      // Cache barrel exports per directory to avoid repeated MCP calls.
      const barrelExports = new Map<string, ExportResult | null>();

      for (const fn of ast.functions) {
        if (fn.isDefaultExport) {
          // Default exports are public-API surface — never auto-flag.
          continue;
        }

        // ACT: find references across the whole codebase.
        const refs = await mcp.callTool<RefResult>("find_references", {
          symbol: fn.name,
          searchRoot: root,
          sourceFile: absFile,
        });

        // ACT: check barrel re-exports in the function's directory.
        const dir = path.dirname(relFile);
        const reexportedBy: string[] = [];
        const barrelCandidates = indexFiles.filter((f) => path.dirname(f) === dir);
        for (const barrel of barrelCandidates) {
          let ex = barrelExports.get(barrel);
          if (ex === undefined) {
            try {
              ex = await mcp.callTool<ExportResult>("list_exports", {
                filePath: path.join(root, barrel),
              });
            } catch {
              ex = null;
            }
            barrelExports.set(barrel, ex);
          }
          if (ex?.exports.some((e) => e.localName === fn.name || e.name === fn.name || e.name === "*")) {
            reexportedBy.push(barrel);
          }
        }

        // THINK + VALIDATE: CoT + policy guards.
        const kinds = refs.references.map((r) => r.kind);
        const reasoningTrace = buildChainOfThought(fn, refs, reexportedBy, relFile);
        const { verdict, confidence } = classify(fn, refs.referenceCount, reexportedBy, kinds);

        suspects.push({
          file: relFile,
          functionName: fn.name,
          kind: fn.kind,
          startLine: fn.startLine,
          endLine: fn.endLine,
          isExported: fn.isExported,
          referenceCount: refs.referenceCount,
          referenceKinds: Array.from(new Set(kinds)),
          reexportedBy,
          verdict,
          confidence,
          reasoningTrace,
        });
      }
    }

    // 4. Aggregate.
    const dead = suspects.filter((s) => s.verdict === "dead");
    const uncertain = suspects.filter((s) => s.verdict === "uncertain");
    const alive = suspects.filter((s) => s.verdict === "alive");

    const report: ExorcismReport = {
      repoPath: root,
      scannedFiles: fileList.count,
      suspects,
      dead,
      uncertain,
      alive,
    };

    // 5. dryRun (default) ONLY reports. PR generation is gated separately.
    if (dryRun) {
      log(`Dry run complete — ${dead.length} dead, ${uncertain.length} uncertain, ${alive.length} alive. (no mutation)`);
    } else {
      log(`Verdicts ready — ${dead.length} dead, ${uncertain.length} uncertain, ${alive.length} alive. Awaiting approval before PR.`);
    }

    return report;
  } finally {
    await mcp.close();
  }
}

// ---------------------------------------------------------------------------
// Chain-of-Thought: emit the reasoning the agent performs per suspect.
// In production this text is produced by the LLM; here it is deterministic so
// the loop is fully functional without an API key.
// ---------------------------------------------------------------------------

function buildChainOfThought(
  fn: FunctionInfo,
  refs: RefResult,
  reexportedBy: string[],
  relFile: string,
): string[] {
  const trace: string[] = [];
  trace.push(
    `Suspect: ${fn.name} (${fn.kind}) in ${relFile}:${fn.startLine}-${fn.endLine}. Exported=${fn.isExported}, params=${fn.paramCount}.`,
  );
  trace.push(`Step 1 — Static references across codebase: ${refs.referenceCount}.`);
  if (refs.references.length) {
    const sample = refs.references
      .slice(0, 3)
      .map((r) => `    - ${r.file}:${r.line} [${r.kind}] ${r.context}`)
      .join("\n");
    trace.push(`Sample references:\n${sample}`);
  } else {
    trace.push(`No references found outside its own declaration.`);
  }
  if (reexportedBy.length) {
    trace.push(`Step 2 — Re-exported by barrel file(s): ${reexportedBy.join(", ")} → treat as ALIVE (public API).`);
  } else {
    trace.push(`Step 2 — Not re-exported by any barrel index file.`);
  }
  if (refs.references.some((r) => r.kind === "dynamic-import")) {
    trace.push(`Step 3 — Dynamic-import usage detected → ALIVE (runtime-loaded).`);
  } else {
    trace.push(`Step 3 — No dynamic import()/require() usage.`);
  }
  if (refs.references.some((r) => r.kind === "string-literal")) {
    trace.push(`Step 4 — String-literal usage detected → ALIVE (possible reflection/lookup map).`);
  } else {
    trace.push(`Step 4 — No string-literal (reflection) usage.`);
  }
  return trace;
}

// ---------------------------------------------------------------------------
// Policy guards. These can VETO the LLM. Exported for the evaluation harness.
// ---------------------------------------------------------------------------

export function classify(
  fn: FunctionInfo,
  refCount: number,
  reexportedBy: string[],
  kinds: ReferenceKind[],
): { verdict: Verdict; confidence: number } {
  // Hard rules that FORCE ALIVE (false-positive guards).
  // The LLM cannot override these — they are the safety net.
  if (reexportedBy.length > 0) return { verdict: "alive", confidence: 0.9 };
  if (kinds.includes("dynamic-import")) return { verdict: "alive", confidence: 0.85 };
  if (kinds.includes("string-literal")) return { verdict: "alive", confidence: 0.7 };
  if (refCount > 0) return { verdict: "alive", confidence: 0.8 };

  // No references at all. Confidence in "dead" depends on export status:
  // a private, unreferenced function is almost certainly dead; an exported,
  // unreferenced one might be intended public API → uncertain.
  let confidence = fn.isExported ? 0.5 : 0.8;
  const size = fn.endLine - fn.startLine;
  if (size > 60) confidence -= 0.1; // large functions are riskier to delete

  if (confidence >= DEAD_THRESHOLD) return { verdict: "dead", confidence };
  if (confidence >= UNCERTAIN_THRESHOLD) return { verdict: "uncertain", confidence };
  return { verdict: "uncertain", confidence };
}
