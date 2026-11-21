/**
 * Phantom.js — shared agent types.
 *
 * These mirror the JSON contracts returned by the MCP AST server tools and the
 * verdicts produced by the agent loop's policy guards.
 */

/** How a textual reference was classified by find_references. */
export type ReferenceKind =
  | "import"
  | "call"
  | "dynamic-import"
  | "string-literal"
  | "other";

/** A single reference match returned by the find_references MCP tool. */
export interface ReferenceMatch {
  file: string;
  line: number;
  column: number;
  context: string;
  kind: ReferenceKind;
}

/** A function declaration returned by the run_ast_parser MCP tool. */
export interface FunctionInfo {
  name: string;
  kind: "function" | "arrow" | "function-expr" | "method";
  startLine: number;
  endLine: number;
  isExported: boolean;
  isAsync: boolean;
  isDefaultExport: boolean;
  paramCount: number;
}

/** Agent verdict for a suspect function. */
export type Verdict = "dead" | "uncertain" | "alive";

/** One analyzed function + the evidence and reasoning behind its verdict. */
export interface Suspect {
  file: string;
  functionName: string;
  kind: FunctionInfo["kind"];
  startLine: number;
  endLine: number;
  isExported: boolean;
  referenceCount: number;
  referenceKinds: ReferenceKind[];
  /** Barrel files that re-export this symbol (empty if none). */
  reexportedBy: string[];
  verdict: Verdict;
  /** 0..1 confidence in the verdict. */
  confidence: number;
  /** Chain-of-Thought steps emitted while reasoning about this function. */
  reasoningTrace: string[];
}

/** The full output of an exorcism run. */
export interface ExorcismReport {
  repoPath: string;
  scannedFiles: number;
  suspects: Suspect[];
  dead: Suspect[];
  uncertain: Suspect[];
  alive: Suspect[];
}
