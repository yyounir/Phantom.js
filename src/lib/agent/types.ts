/**
 * Phantom.js — shared agent + UI types.
 * These mirror the JSON contracts produced by the agent loop (which in turn
 * call the MCP server tools in mcp-server/src/index.ts).
 */

export type Verdict = "dead" | "uncertain" | "alive";

export type ReferenceKind =
  | "import"
  | "call"
  | "dynamic-import"
  | "string-literal"
  | "other";

export interface ReferenceMatch {
  file: string;
  line: number;
  column: number;
  context: string;
  kind: ReferenceKind;
}

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

/** One analyzed function + the Hunter/Skeptic Chain-of-Thought behind its verdict. */
export interface Suspect {
  id: string;
  file: string;
  functionName: string;
  kind: FunctionInfo["kind"];
  startLine: number;
  endLine: number;
  isExported: boolean;
  referenceCount: number;
  referenceKinds: ReferenceKind[];
  reexportedBy: string[];
  verdict: Verdict;
  confidence: number;
  /** Hunter Agent: flags zombie candidates. */
  hunterTrace: string[];
  /** Skeptic Agent: tries to disprove each flag. */
  skepticTrace: string[];
}

/** Call-graph node — a function in the repo, colored by verdict in the UI. */
export interface GraphNode {
  id: string;
  label: string;
  file: string;
  verdict: Verdict;
  isExported: boolean;
  referenceCount: number;
}

/** Call-graph edge — caller -> callee. */
export interface GraphEdge {
  id: string;
  source: string; // caller node id
  target: string; // callee node id
}

export interface FinopsResult {
  removedLines: number;
  removedBundleKB: number;
  coldStartDeltaMs: number;
  extraComputeSecondsPerMonth: number;
  projectedSavingsUsd: number;
  buildMinutesSavedPerMonth: number;
  inputs: {
    removedLines: number;
    avgBytesPerLine: number;
    monthlyInvocations: number;
    coldStartFraction: number;
    memoryGb: number;
    pricePerGbSecond: number;
  };
}

export interface SandboxResult {
  safe: boolean;
  issues: Array<{ removal: string; ref: ReferenceMatch }>;
  note: string;
}

export interface HuntResult {
  repo: {
    kind: "local" | "github";
    ref: string; // display: branch/ref or local path
    url?: string;
    filesScanned: number;
  };
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  suspects: Suspect[];
  summary: {
    dead: number;
    uncertain: number;
    alive: number;
    finops: FinopsResult;
    sandbox: SandboxResult;
  };
}

/** What the agent hunts. */
export type RepoSpec =
  | { kind: "local"; path: string }
  | { kind: "github"; url: string; subpath?: string };
