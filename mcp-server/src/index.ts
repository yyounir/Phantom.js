/**
 * Phantom.js — MCP AST Server (transport-agnostic)
 * ============================================================================
 * A Model Context Protocol server exposing READ-ONLY codebase-analysis tools
 * to the Phantom.js agent. Reasoning lives in the agent; tool execution lives
 * here, behind a finite, vetted capability surface. There is no write/exec
 * tool — by construction the agent cannot mutate the repo it inspects.
 *
 * Transport-agnostic by design (core MCP talking point):
 *   - Standalone : `node dist/index.js ./path/to/repo` -> stdio over a
 *                  LocalDiskRepo (the "decoupled local MCP server" demo).
 *   - Serverless : the app imports createPhantomServer(repoSource) and links an
 *                  in-memory client+server pair via InMemoryTransport — no
 *                  subprocess, so it runs on Vercel. Same tools, same contract.
 *
 * Performance: a per-file parse cache (parseCached) means each file is parsed
 * once per hunt, so find_references is O(files) not O(functions × files). The
 * §3 Redis cache extends this across runs/hosts for unchanged files.
 *
 * Exports: createPhantomServer(repoSource) -> McpServer; RepoSource,
 *          LocalDiskRepo, InMemoryRepo.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// ---------------------------------------------------------------------------
// RepoSource — the only way the tools touch files.
// ---------------------------------------------------------------------------

export interface RepoSource {
  readonly root: string;
  listFiles(): string[];
  readFile(rel: string): string;
}

const TS_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const IGNORED_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage", ".turbo", "out", ".vercel",
]);

function isSourceFile(rel: string): boolean {
  if (rel.endsWith(".d.ts")) return false;
  if (rel.split("/").some((seg) => IGNORED_DIRS.has(seg))) return false;
  return TS_EXT.some((ext) => rel.endsWith(ext));
}

export class LocalDiskRepo implements RepoSource {
  readonly root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }
  listFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (IGNORED_DIRS.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (isSourceFile(path.relative(this.root, full).replace(/\\/g, "/"))) out.push(full);
      }
    };
    walk(this.root);
    return out.map((f) => path.relative(this.root, f).replace(/\\/g, "/")).sort();
  }
  readFile(rel: string): string {
    return fs.readFileSync(path.join(this.root, rel), "utf-8");
  }
}

export class InMemoryRepo implements RepoSource {
  readonly root: string;
  private readonly files: Map<string, string>;
  constructor(root: string, files: Map<string, string>) {
    this.root = root;
    this.files = files;
  }
  listFiles(): string[] {
    return [...this.files.keys()].filter(isSourceFile).sort();
  }
  readFile(rel: string): string {
    const c = this.files.get(rel);
    if (c === undefined) throw new Error(`file not in repo: ${rel}`);
    return c;
  }
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

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
export interface ExportInfo {
  name: string;
  kind: "value" | "type" | "re-export";
  localName: string | null;
}
export type ReferenceKind = "import" | "call" | "dynamic-import" | "string-literal" | "other";
export interface ReferenceMatch {
  file: string;
  line: number;
  column: number;
  context: string;
  kind: ReferenceKind;
}
export interface CallSite {
  caller: string;
  callee: string;
  line: number;
}
export interface ImportInfo {
  source: string;
  default: string | null;
  namespace: string | null;
  named: Array<{ imported: string; local: string }>;
}

// ---------------------------------------------------------------------------
// Pure AST helpers (operate on a SourceFile)
// ---------------------------------------------------------------------------

function scriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}
function parseCode(filePath: string, code: string): ts.SourceFile {
  return ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, scriptKind(filePath));
}
function isExported(node: ts.Node): boolean {
  const m = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (m ?? []).some((x) => x.kind === ts.SyntaxKind.ExportKeyword);
}
function hasDefaultModifier(node: ts.Node): boolean {
  const m = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (m ?? []).some((x) => x.kind === ts.SyntaxKind.DefaultKeyword);
}
function isAsyncFn(node: ts.Node): boolean {
  const m = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (m ?? []).some((x) => x.kind === ts.SyntaxKind.AsyncKeyword);
}
function lineOf(source: ts.SourceFile, pos: number): number {
  return ts.getLineAndCharacterOfPosition(source, pos).line + 1;
}

function extractFunctions(source: ts.SourceFile): FunctionInfo[] {
  const out: FunctionInfo[] = [];
  const push = (
    node: ts.Node, name: string, kind: FunctionInfo["kind"],
    exported: boolean, async: boolean, def: boolean, params: number,
  ) => out.push({
    name, kind,
    startLine: lineOf(source, node.getStart(source)),
    endLine: lineOf(source, node.getEnd()),
    isExported: exported, isAsync: async, isDefaultExport: def, paramCount: params,
  });
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) {
      push(node, node.name?.text ?? "(anonymous)", "function",
        isExported(node), isAsyncFn(node), hasDefaultModifier(node), node.parameters.length);
    } else if (ts.isMethodDeclaration(node)) {
      push(node, node.name.getText(source), "method", false, isAsyncFn(node), false, node.parameters.length);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          push(decl.initializer, decl.name.getText(source),
            ts.isArrowFunction(init) ? "arrow" : "function-expr",
            isExported(node), isAsyncFn(init), false, init.parameters.length);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function extractExports(source: ts.SourceFile): ExportInfo[] {
  const out: ExportInfo[] = [];
  for (const stmt of source.statements) {
    if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const d of stmt.declarationList.declarations)
        out.push({ name: d.name.getText(source), kind: "value", localName: d.name.getText(source) });
    } else if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && isExported(stmt)) {
      const name = stmt.name?.text ?? "(default)";
      out.push({ name, kind: "value", localName: name });
    } else if (ts.isInterfaceDeclaration(stmt) && isExported(stmt)) {
      out.push({ name: stmt.name.text, kind: "type", localName: stmt.name.text });
    } else if (ts.isTypeAliasDeclaration(stmt) && isExported(stmt)) {
      out.push({ name: stmt.name.text, kind: "type", localName: stmt.name.text });
    } else if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements)
          out.push({ name: el.name.text, kind: "re-export", localName: el.propertyName ? el.propertyName.text : el.name.text });
      } else {
        out.push({ name: "*", kind: "re-export", localName: null });
      }
    }
  }
  return out;
}

function getCommentRanges(source: ts.SourceFile): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const visit = (node: ts.Node) => {
    ts.forEachLeadingCommentRange(source.text, node.getFullStart(), (s, e) => ranges.push({ start: s, end: e }));
    ts.forEachTrailingCommentRange(source.text, node.getEnd(), (s, e) => ranges.push({ start: s, end: e }));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return ranges;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classifyContext(line: string, col: number, symbol: string): ReferenceKind {
  const after = line.slice(col + symbol.length);
  if (/import\s*\(/.test(line) || /require\s*\(/.test(line)) return "dynamic-import";
  if (/^\s*import\b/.test(line) || /\bfrom\s+["'`]/.test(line)) return "import";
  if (after.startsWith("(")) return "call";
  if (/["'`][^"'`]*$/.test(line.slice(0, col)) && /^[^"'`]*["'`]/.test(after)) return "string-literal";
  return "other";
}

function calleeName(expr: ts.Expression): string | null {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isElementAccessExpression(expr)) return expr.argumentExpression.getText();
  return null;
}

function extractCallSites(source: ts.SourceFile): CallSite[] {
  const out: CallSite[] = [];
  const record = (caller: string, node: ts.Node) => {
    const visit = (n: ts.Node) => {
      if (n !== node && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n))) return;
      if (ts.isCallExpression(n)) {
        const callee = calleeName(n.expression);
        if (callee) out.push({ caller, callee, line: lineOf(source, n.getStart(source)) });
      }
      ts.forEachChild(n, visit);
    };
    visit(node);
  };
  const visitTop = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) record(node.name?.text ?? "(anonymous)", node);
    else if (ts.isMethodDeclaration(node)) record(node.name.getText(source), node);
    else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) record(decl.name.getText(source), init);
      }
    }
    ts.forEachChild(node, visitTop);
  };
  visitTop(source);
  return out;
}

function extractImports(source: ts.SourceFile): ImportInfo[] {
  const out: ImportInfo[] = [];
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    const sourceModule = (stmt.moduleSpecifier as ts.StringLiteral).text;
    const clause = stmt.importClause;
    if (!clause) continue;
    const named: Array<{ imported: string; local: string }> = [];
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        named.push({ imported: el.propertyName ? el.propertyName.text : el.name.text, local: el.name.text });
      }
    }
    out.push({
      source: sourceModule,
      default: clause.name?.text ?? null,
      namespace: clause.namedBindings && ts.isNamespaceImport(clause.namedBindings) ? clause.namedBindings.name.text : null,
      named,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-file parse cache (the key performance lever)
// ---------------------------------------------------------------------------

interface ParsedFile {
  code: string;
  source: ts.SourceFile;
  lines: string[];
  commentRanges: Array<{ start: number; end: number }>;
  functions: FunctionInfo[];
}
const _parseCache = new Map<string, ParsedFile>();
const PARSE_CACHE_CAP = 4000;

/** Parse `file` once per repo and cache derivatives. Turns find_references
 *  from O(functions × files) parses into O(files) parses. */
function parseCached(repo: RepoSource, file: string): ParsedFile | null {
  const key = repo.root + "::" + file;
  const cached = _parseCache.get(key);
  if (cached) return cached;
  let code: string;
  try {
    code = repo.readFile(file);
  } catch {
    return null;
  }
  const source = parseCode(file, code);
  const p: ParsedFile = {
    code, source,
    lines: code.split(/\r?\n/),
    commentRanges: getCommentRanges(source),
    functions: extractFunctions(source),
  };
  _parseCache.set(key, p);
  if (_parseCache.size > PARSE_CACHE_CAP) {
    const first = _parseCache.keys().next().value;
    if (first) _parseCache.delete(first);
  }
  return p;
}

/** Whole-repo textual reference scan (comment-aware), skipping self-declarations. */
function findReferencesInSource(symbol: string, repo: RepoSource, sourceFile: string): ReferenceMatch[] {
  const matches: ReferenceMatch[] = [];
  if (!symbol || !/^\w[\w$]*$/.test(symbol)) return matches;
  const pattern = new RegExp(`\\b${escapeRegex(symbol)}\\b`, "g");
  for (const file of repo.listFiles()) {
    const p = parseCached(repo, file);
    if (!p) continue;
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(p.code)) !== null) {
      const pos = m.index;
      if (p.commentRanges.some((r) => pos >= r.start && pos < r.end)) continue;
      const { line, character } = ts.getLineAndCharacterOfPosition(p.source, pos);
      const lineText = p.lines[line];
      if (file === sourceFile) {
        const prefix = lineText.slice(0, character);
        if (/\b(function|const|let|var|class)\b\s*$/.test(prefix)) continue;
      }
      matches.push({
        file, line: line + 1, column: character + 1,
        context: lineText.trim().slice(0, 160),
        kind: classifyContext(lineText, character, symbol),
      });
    }
  }
  return matches;
}

/** Name of the function whose body contains `line` in `file` (smallest range). */
function enclosingFunctionName(file: string, line: number, repo: RepoSource): string | null {
  const p = parseCached(repo, file);
  if (!p) return null;
  let best: { name: string; size: number } | null = null;
  for (const f of p.functions) {
    if (line >= f.startLine && line <= f.endLine) {
      const size = f.endLine - f.startLine;
      if (!best || size < best.size) best = { name: f.name, size };
    }
  }
  return best?.name ?? null;
}

// ---------------------------------------------------------------------------
// FinOps estimation (pure calc)
// ---------------------------------------------------------------------------

export interface FinopsInputs {
  removedLines: number;
  avgBytesPerLine?: number;
  monthlyInvocations?: number;
  coldStartFraction?: number;
  memoryGb?: number;
  pricePerGbSecond?: number;
}
export interface FinopsResult {
  removedLines: number;
  removedBundleKB: number;
  coldStartDeltaMs: number;
  extraComputeSecondsPerMonth: number;
  projectedSavingsUsd: number;
  buildMinutesSavedPerMonth: number;
  inputs: Required<FinopsInputs>;
}

function estimateFinops(input: FinopsInputs): FinopsResult {
  const avgBytesPerLine = input.avgBytesPerLine ?? 40;
  const monthlyInvocations = input.monthlyInvocations ?? 1_000_000;
  const coldStartFraction = input.coldStartFraction ?? 0.05;
  const memoryGb = input.memoryGb ?? 1;
  const pricePerGbSecond = input.pricePerGbSecond ?? 0.0000166667;
  const removedBundleKB = (input.removedLines * avgBytesPerLine) / 1024;
  const coldStartDeltaMs = removedBundleKB / 50; // ~50 KB ~ 1 ms cold-start delta
  const extraComputeSecondsPerMonth = (coldStartDeltaMs / 1000) * monthlyInvocations * coldStartFraction;
  const projectedSavingsUsd = extraComputeSecondsPerMonth * memoryGb * pricePerGbSecond;
  const buildMinutesSavedPerMonth = (removedBundleKB / 1024) * 0.02 * 30;
  return {
    removedLines: input.removedLines,
    removedBundleKB: Math.round(removedBundleKB * 10) / 10,
    coldStartDeltaMs: Math.round(coldStartDeltaMs * 100) / 100,
    extraComputeSecondsPerMonth: Math.round(extraComputeSecondsPerMonth * 10) / 10,
    projectedSavingsUsd: Math.round(projectedSavingsUsd * 100) / 100,
    buildMinutesSavedPerMonth: Math.round(buildMinutesSavedPerMonth * 100) / 100,
    inputs: { removedLines: input.removedLines, avgBytesPerLine, monthlyInvocations, coldStartFraction, memoryGb, pricePerGbSecond },
  };
}

// ---------------------------------------------------------------------------
// Sandbox check (transitive reference safety net)
// ---------------------------------------------------------------------------

export interface SandboxRemoval {
  file: string;
  name: string;
}
export interface SandboxResult {
  safe: boolean;
  issues: Array<{ removal: string; ref: ReferenceMatch }>;
  note: string;
}

function runSandboxCheck(removals: SandboxRemoval[], repo: RepoSource): SandboxResult {
  const removedByFile = new Map<string, Set<string>>();
  for (const r of removals) {
    if (!removedByFile.has(r.file)) removedByFile.set(r.file, new Set());
    removedByFile.get(r.file)!.add(r.name);
  }
  const issues: Array<{ removal: string; ref: ReferenceMatch }> = [];
  for (const r of removals) {
    const refs = findReferencesInSource(r.name, repo, r.file);
    for (const ref of refs) {
      const enclosing = enclosingFunctionName(ref.file, ref.line, repo);
      const removedInRefFile = removedByFile.get(ref.file);
      if (enclosing && removedInRefFile?.has(enclosing)) continue; // caller is also removed
      issues.push({ removal: r.name, ref });
    }
  }
  return {
    safe: issues.length === 0,
    issues,
    note:
      "In-process transitive reference check. Production applies edits in an " +
      "isolated sandbox (Docker/E2B) and runs `tsc --noEmit` + the test suite " +
      "before approving (see ARCHITECTURE.md §3).",
  };
}

// ---------------------------------------------------------------------------
// MCP server factory
// ---------------------------------------------------------------------------

function text(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

export function createPhantomServer(repo: RepoSource): McpServer {
  const server = new McpServer({ name: "phantom-ast-server", version: "0.1.0" });

  server.tool("list_source_files",
    "List every scannable source file in the repo (excluding node_modules/dist/.next). READ-ONLY.",
    {}, async () => {
      const files = repo.listFiles();
      return text({ root: repo.root, count: files.length, files });
    });

  server.tool("run_ast_parser",
    "Parse a source file and return every function-like declaration with line ranges, export/async/default flags, and param counts. READ-ONLY.",
    { filePath: z.string() }, async ({ filePath }) => {
      try {
        const p = parseCached(repo, filePath);
        if (!p) return text({ error: `could not read ${filePath}` });
        return text({ file: filePath, functionCount: p.functions.length, functions: p.functions });
      } catch (err) { return text({ error: String(err) }); }
    });

  server.tool("find_references",
    "Scan the whole repo for whole-word references to a symbol (comment-aware) and classify each as import/call/dynamic-import/string-literal/other. READ-ONLY.",
    { symbol: z.string(), sourceFile: z.string().optional() }, async ({ symbol, sourceFile }) => {
      try {
        const references = findReferencesInSource(symbol, repo, sourceFile ?? "");
        return text({ symbol, referenceCount: references.length, references });
      } catch (err) { return text({ error: String(err) }); }
    });

  server.tool("list_exports",
    "List exported values/types/re-exports (incl. barrel `export *`) in a file. READ-ONLY.",
    { filePath: z.string() }, async ({ filePath }) => {
      try {
        const p = parseCached(repo, filePath);
        if (!p) return text({ error: `could not read ${filePath}` });
        return text({ file: filePath, exports: extractExports(p.source) });
      } catch (err) { return text({ error: String(err) }); }
    });

  server.tool("get_calls",
    "Return the call sites in a file: which function calls which identifier, and on what line. Used to build the call graph. READ-ONLY.",
    { filePath: z.string() }, async ({ filePath }) => {
      try {
        const p = parseCached(repo, filePath);
        if (!p) return text({ error: `could not read ${filePath}` });
        return text({ file: filePath, calls: extractCallSites(p.source) });
      } catch (err) { return text({ error: String(err) }); }
    });

  server.tool("get_imports",
    "Return the import declarations in a file (source module + default/namespace/named bindings). READ-ONLY.",
    { filePath: z.string() }, async ({ filePath }) => {
      try {
        const p = parseCached(repo, filePath);
        if (!p) return text({ error: `could not read ${filePath}` });
        return text({ file: filePath, imports: extractImports(p.source) });
      } catch (err) { return text({ error: String(err) }); }
    });

  server.tool("run_sandbox_check",
    "Given proposed removals ({file,name}), verify removing them leaves no reference from surviving code (transitive safety net before PR). READ-ONLY.",
    { removals: z.array(z.object({ file: z.string(), name: z.string() })) },
    async ({ removals }) => {
      try { return text(runSandboxCheck(removals as SandboxRemoval[], repo)); }
      catch (err) { return text({ error: String(err) }); }
    });

  server.tool("estimate_finops_impact",
    "Project bundle reduction, cold-start delta, and cloud-cost savings from removed lines. READ-ONLY (pure calc).",
    {
      removedLines: z.number(),
      avgBytesPerLine: z.number().optional(),
      monthlyInvocations: z.number().optional(),
      coldStartFraction: z.number().optional(),
      memoryGb: z.number().optional(),
      pricePerGbSecond: z.number().optional(),
    },
    async (args) => {
      try { return text(estimateFinops(args as FinopsInputs)); }
      catch (err) { return text({ error: String(err) }); }
    });

  return server;
}

// ---------------------------------------------------------------------------
// Standalone stdio entry — only boots when run directly.
// ---------------------------------------------------------------------------

async function main() {
  const target = process.argv[2] ?? process.env.PHANTOM_REPO_PATH ?? ".";
  const repo: RepoSource = new LocalDiskRepo(target);
  const server = createPhantomServer(repo);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[phantom-ast-server] stdio ready, repo=${repo.root}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error("[phantom-ast-server] fatal:", err);
    process.exit(1);
  });
}
