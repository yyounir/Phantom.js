/**
 * Phantom.js — CLI demo
 * ============================================================================
 * Run the agent end-to-end from the command line, no web UI needed:
 *
 *   npm run mcp:build     # build the read-only AST server (once)
 *   npm install
 *   npm run agent:demo -- ./path/to/some/repo
 *
 * Great for the hackathon demo AND for the evaluation harness: pipe a repo path
 * in, read the report out.
 */

import { runExorcism } from "./agent-loop";
import type { Suspect } from "./types";

async function main() {
  const repoPath = process.argv[2] ?? process.env.PHANTOM_REPO_PATH ?? ".";
  console.log(`\n🎃 Phantom.js — exorcising ${repoPath}\n`);

  const report = await runExorcism(repoPath, {
    dryRun: true,
    onProgress: (m) => console.log(`[agent] ${m}`),
  });

  console.log("\n=== Phantom.js Exorcism Report ===");
  console.log(`Scanned ${report.scannedFiles} files in ${report.repoPath}`);
  console.log(`Verdicts — DEAD: ${report.dead.length} | UNCERTAIN: ${report.uncertain.length} | ALIVE: ${report.alive.length}`);

  const print = (label: string, emoji: string, list: Suspect[]) => {
    if (!list.length) return;
    console.log(`\n${emoji} ${label} (${list.length})`);
    for (const s of list.slice(0, 25)) {
      console.log(
        `  ${s.file}:${s.startLine}-${s.endLine}  ${s.functionName}  (conf ${Math.round(s.confidence * 100)}%)`,
      );
      console.log(s.reasoningTrace.map((t) => `      ${t}`).join("\n"));
    }
    if (list.length > 25) console.log(`  …and ${list.length - 25} more.`);
  };

  print("DEAD (candidates for removal)", "💀", report.dead);
  print("UNCERTAIN (human review)", "🤔", report.uncertain);
  print("ALIVE (kept)", "✅", report.alive.slice(0, 10));

  console.log("\n(dry-run: no files were modified.)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
