/**
 * Phantom.js — MCP AST Server
 * ============================================================================
 * A local, capability-scoped Model Context Protocol (MCP) server that exposes
 * READ-ONLY Abstract Syntax Tree (AST) tools to the Phantom.js agent.
 *
 * Design principle: the LLM agent NEVER touches the filesystem directly.
 * It can only invoke the vetted tools listed below. There is no delete_file,
 * no write_file, no shell exec — by construction, the agent cannot mutate the
 * repo it is analyzing. The only write path (PR generation) lives in the
 * Next.js layer and is gated behind human approval.
 *
 * Tools exposed (all READ-ONLY):
 *   - list_source_files : enumerate the .ts/.tsx/.js/.jsx scan set
 *   - run_ast_parser   : parse a file -> list of function declarations
 *   - find_references  : whole-codebase textual reference scan for a symbol
 *   - list_exports     : exported symbols + re-exports (barrel detection)
 *
 * Transport: stdio (local dev / hackathon demo).
 *   For Vercel/serverless production, swap StdioServerTransport for the
 *   Streamable HTTP transport (see ARCHITECTURE.md §4d). The tool surface
 *   and the agent loop are unchanged — only the wire changes.
 *
 * Parsing: the TypeScript compiler API parses .ts/.tsx/.js/.jsx in one pass.
 * find_references is a bounded *textual* scan for the foundational version;
 * a production build swaps it for semantic references via ts.LanguageService
 * or ts-morph (drop-in — same JSON contract).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

// ---------------------------------------------------------------------------
// Shared response helper
// ---------------------------------------------------------------------------

/** Wrap any JSON-serializable value as an MCP text content block. */
function text(obj: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Types returned by the tools
// ---------------------------------------------------------------------------

interface FunctionInfo {
  name: string;
  kind: "function" | "arrow" | "function-expr" | "method";
  startLine: number;
  endLine: number;
  isExported: boolean;
  isAsync: boolean;
  isDefaultExport: boolean;
  paramCount: number;
}

interface ExportInfo {
  name: string;
  kind: "value" | "type" | "re-export";
  localName: string | null;
}

type ReferenceKind = "import" | "call" | "dynamic-import" | "string-literal" | "other";

interface ReferenceMatch {
  file: string;
  line: number;
  column: number;
  context: string;
  kind: ReferenceKind;
}

// ---------------------------------------------------------------------------
// AST parsing helpers (TypeScript compiler API)
// ---------------------------------------------------------------------------

const TS_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/** Pick the ScriptKind so the TS parser applies the right JSX/JS rules. */
function scriptKind(filePath: string): ts.ScriptKind {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs") || filePath.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** Read + parse a file into a SourceFile (with parent links for getText). */
function parseSource(filePath: string): ts.SourceFile {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  const code = fs.readFileSync(filePath, "utf-8");
  return ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind(filePath),
  );
}

/** True if the node carries an `export` modifier. */
function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isAsyncFn(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
}

function hasDefaultModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return (modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

function lineOf(source: ts.SourceFile, pos: number): number {
  return ts.getLineAndCharacterOfPosition(source, pos).line + 1; // 1-indexed
}

/**
 * Walk a source file and collect every function-like declaration:
 * function declarations, arrow functions, function expressions, methods.
 * Returns the compact facts the agent reasons over (no source bodies).
 */
function extractFunctions(source: ts.SourceFile): FunctionInfo[] {
  const out: FunctionInfo[] = [];

  const push = (
    node: ts.Node,
    name: string,
    kind: FunctionInfo["kind"],
    isExportedFlag: boolean,
    isAsyncFlag: boolean,
    isDefault: boolean,
    paramCount: number,
  ) => {
    out.push({
      name,
      kind,
      startLine: lineOf(source, node.getStart(source)),
      endLine: lineOf(source, node.getEnd()),
      isExported: isExportedFlag,
      isAsync: isAsyncFlag,
      isDefaultExport: isDefault,
      paramCount,
    });
  };

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) {
      push(
        node,
        node.name?.text ?? "(anonymous)",
        "function",
        isExported(node),
        isAsyncFn(node),
        hasDefaultModifier(node),
        node.parameters.length,
      );
    } else if (ts.isMethodDeclaration(node)) {
      // Methods live inside classes; they are "alive" only if the class is.
      push(node, node.name.getText(source), "method", false, isAsyncFn(node), false, node.parameters.length);
    } else if (ts.isVariableStatement(node)) {
      // const name = () => {}   /   const name = function () {}
      for (const decl of node.declarationList.declarations) {
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          push(
            init,
            decl.name.getText(source),
            ts.isArrowFunction(init) ? "arrow" : "function-expr",
            isExported(node),
            isAsyncFn(init),
            false,
            init.parameters.length,
          );
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return out;
}

/**
 * Collect exported symbols (values, types, re-exports, barrel `export *`).
 * This is what detects barrel files that keep a "seemingly dead" function alive.
 */
function extractExports(source: ts.SourceFile): ExportInfo[] {
  const out: ExportInfo[] = [];
  for (const stmt of source.statements) {
    if (ts.isVariableStatement(stmt) && isExported(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        out.push({ name: d.name.getText(source), kind: "value", localName: d.name.getText(source) });
      }
    } else if ((ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt)) && isExported(stmt)) {
      const name = stmt.name?.text ?? "(default)";
      out.push({ name, kind: "value", localName: name });
    } else if (ts.isInterfaceDeclaration(stmt) && isExported(stmt)) {
      out.push({ name: stmt.name.text, kind: "type", localName: stmt.name.text });
    } else if (ts.isTypeAliasDeclaration(stmt) && isExported(stmt)) {
      out.push({ name: stmt.name.text, kind: "type", localName: stmt.name.text });
    } else if (ts.isExportDeclaration(stmt)) {
      // export { a, b as c } [from './x']
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          out.push({
            name: el.name.text,
            kind: "re-export",
            localName: el.propertyName ? el.propertyName.text : el.name.text,
          });
        }
      } else {
        // export * from './x'  -> mark the file as a wildcard barrel
        out.push({ name: "*", kind: "re-export", localName: null });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Reference scanner (textual, bounded). Production: swap for semantic refs.
// ---------------------------------------------------------------------------

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".turbo",
]);

/** Recursively list source files, skipping build/dependency directories. */
function listSourceFilesOnDisk(root: string): string[] {
  const results: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable dir: skip silently
    }
    for (const e of entries) {
      if (IGNORED_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (TS_EXT.some((ext) => e.name.endsWith(ext))) results.push(full);
    }
  };
  walk(root);
  return results;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Best-effort classification of a reference by the surrounding characters.
 * This powers the false-positive guards (dynamic-import / string-literal).
 * It is intentionally simple; semantic classification comes with ts-morph later.
 */
function classifyContext(line: string, col: number, symbol: string): ReferenceKind {
  const before = line.slice(0, col);
  const after = line.slice(col + symbol.length);
  // dynamic import: import('./x') or require('x') anywhere on the line
  if (/import\s*\(/.test(line) || /require\s*\(/.test(line)) return "dynamic-import";
  // static import statement
  if (/^\s*import\b/.test(line) || /\bfrom\s+["'`]/.test(line)) return "import";
  // call site: symbol immediately followed by (
  if (after.startsWith("(")) return "call";
  // inside a string literal (potential reflection / lookup map)
  if (/["'`][^"'`]*$/.test(before) && /^[^"'`]*["'`]/.test(after)) return "string-literal";
  return "other";
}

/**
 * Collect all comment ranges (line + block) in a source file using the TS
 * compiler's trivia API. Used to ignore symbol matches that only appear in
 * comments, so reference counts stay accurate (a symbol mentioned only in a
 * comment is NOT a real reference).
 */
function getCommentRanges(source: ts.SourceFile): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  const visit = (node: ts.Node) => {
    ts.forEachLeadingCommentRange(source.text, node.getFullStart(), (s, e) =>
      ranges.push({ start: s, end: e }),
    );
    ts.forEachTrailingCommentRange(source.text, node.getEnd(), (s, e) =>
      ranges.push({ start: s, end: e }),
    );
    ts.forEachChild(node, visit);
  };
  visit(source);
  return ranges;
}

/** True if an absolute offset falls inside any comment range. Linear scan is
 *  fine for the foundational version; a binary search over sorted ranges is a
 *  TODO for very large repos. */
function positionInComment(pos: number, ranges: Array<{ start: number; end: number }>): boolean {
  for (const r of ranges) {
    if (pos >= r.start && pos < r.end) return true;
  }
  return false;
}

/**
 * Scan the codebase for whole-word matches of `symbol` in real code (not
 * comments), classify each, and skip self-declarations in `sourceFile` so a
 * function isn't "referenced" by its own declaration line.
 */
function findReferencesOnDisk(symbol: string, searchRoot: string, sourceFile: string): ReferenceMatch[] {
  const matches: ReferenceMatch[] = [];
  if (!symbol || !/^\w[\w$]*$/.test(symbol)) return matches; // only plain identifiers
  const pattern = new RegExp(`\\b${escapeRegex(symbol)}\\b`, "g");
  const absSource = sourceFile ? path.resolve(sourceFile) : "";

  for (const file of listSourceFilesOnDisk(searchRoot)) {
    let code: string;
    try {
      code = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    // Parse once to (a) get comment ranges and (b) map offsets to line/column.
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false, scriptKind(file));
    const commentRanges = getCommentRanges(source);
    const lines = code.split(/\r?\n/);

    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(code)) !== null) {
      const pos = m.index;
      if (positionInComment(pos, commentRanges)) continue; // ignore comment noise

      const { line, character } = ts.getLineAndCharacterOfPosition(source, pos);
      const lineText = lines[line];

      // Skip the declaration site itself in the source file.
      if (file === absSource) {
        const prefix = lineText.slice(0, character);
        if (/\b(function|const|let|var|class)\b\s*$/.test(prefix)) continue;
      }
      matches.push({
        file: path.relative(searchRoot, file).replace(/\\/g, "/"),
        line: line + 1,
        column: character + 1,
        context: lineText.trim().slice(0, 160),
        kind: classifyContext(lineText, character, symbol),
      });
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// MCP server + tool registration
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "phantom-ast-server",
  version: "0.1.0",
});

server.tool(
  "list_source_files",
  "List all .ts/.tsx/.js/.jsx/.mjs/.cjs source files under a directory, excluding node_modules/dist/build/.next/coverage. READ-ONLY: lets the agent enumerate the scan set without touching the filesystem itself.",
  { searchRoot: z.string().describe("Absolute path to the repository root to scan.") },
  async ({ searchRoot }) => {
    try {
      const root = path.resolve(searchRoot);
      const files = listSourceFilesOnDisk(root).map((f) => path.relative(root, f).replace(/\\/g, "/"));
      return text({ root, count: files.length, files });
    } catch (err) {
      return text({ error: String(err) });
    }
  },
);

server.tool(
  "run_ast_parser",
  "Parse a .ts/.tsx/.js/.jsx source file and return every function-like declaration (functions, arrow functions, function expressions, methods) with line ranges, export/async/default flags, and parameter counts. READ-ONLY: never modifies the file.",
  { filePath: z.string().describe("Absolute or relative path to the source file to parse.") },
  async ({ filePath }) => {
    try {
      const resolved = path.resolve(filePath);
      const source = parseSource(resolved);
      const functions = extractFunctions(source);
      return text({
        file: path.resolve(resolved),
        functionCount: functions.length,
        functions,
      });
    } catch (err) {
      return text({ error: String(err) });
    }
  },
);

server.tool(
  "find_references",
  "Scan the whole codebase (excluding node_modules/dist/.next) for whole-word references to a symbol and classify each match as import / call / dynamic-import / string-literal / other. Used by the agent to decide whether a function is actually dead. READ-ONLY.",
  {
    symbol: z.string().describe("The identifier to search for (whole-word match)."),
    searchRoot: z.string().describe("Absolute path to the repository root to scan."),
    sourceFile: z.string().optional().describe("Path of the file where the symbol is declared; self-declaration lines are skipped."),
  },
  async ({ symbol, searchRoot, sourceFile }) => {
    try {
      const root = path.resolve(searchRoot);
      const references = findReferencesOnDisk(symbol, root, sourceFile ?? "");
      return text({ symbol, referenceCount: references.length, references });
    } catch (err) {
      return text({ error: String(err) });
    }
  },
);

server.tool(
  "list_exports",
  "List all exported symbols (values, types, re-exports, and barrel `export *`) in a file. Used to detect barrel-file re-exports that keep a 'seemingly dead' function alive. READ-ONLY.",
  { filePath: z.string().describe("Absolute or relative path to the source file to inspect.") },
  async ({ filePath }) => {
    try {
      const resolved = path.resolve(filePath);
      const source = parseSource(resolved);
      return text({ file: resolved, exports: extractExports(source) });
    } catch (err) {
      return text({ error: String(err) });
    }
  },
);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The transport keeps the process alive while stdio is open.
}

main().catch((err) => {
  console.error("[phantom-ast-server] fatal:", err);
  process.exit(1);
});
