/**
 * Phantom.js — CLI demo
 * ============================================================================
 * Run the Hunter/Skeptic loop from the command line (no web UI):
 *
 *   npm run mcp:build        # build the AST server (once)
 *   npm run agent:demo -- ./sample-repo
 *   npm run agent:demo -- https://github.com/owner/repo
 *   npm run agent:demo -- https://github.com/owner/repo/tree/main/utils
 */

import { runHunt } from "./agent-loop";
import type { RepoSpec, Suspect } from "./types";

function isGithub(input: string): boolean {
  return /^https?:\/\//i.test(input) || /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/.test(input);
}

async function main() {
  const input = process.argv[2] ?? "./sample-repo";
  const spec: RepoSpec = /^https?:\/\//i.test(input)
    ? { kind: "github", url: input }
    : { kind: "local", path: input };

  console.log(`\n🎃 Phantom.js — hunting ${input}\n`);
  const result = await runHunt(spec, {
    githubToken: process.env.GITHUB_TOKEN,
    onProgress: (m) => console.log(`[agent] ${m}`),
  });

  console.log("\n=== Phantom.js Hunt Report ===");
  console.log(`Repo: ${result.repo.ref}  (${result.repo.filesScanned} files)`);
  console.log(`💀 Dead: ${result.summary.dead}  🤔 Uncertain: ${result.summary.uncertain}  ✅ Alive: ${result.summary.alive}`);
  console.log(`Graph: ${result.graph.nodes.length} nodes, ${result.graph.edges.length} edges`);
  console.log(
    `Sandbox safe: ${result.summary.sandbox.safe}  |  FinOps: ~$${result.summary.finops.projectedSavingsUsd}/mo ` +
    `(${result.summary.finops.removedBundleKB} KB removed, ${result.summary.finops.coldStartDeltaMs} ms cold-start delta)`,
  );

  const print = (label: string, emoji: string, list: Suspect[]) => {
    if (!list.length) return;
    console.log(`\n${emoji} ${label} (${list.length})`);
    for (const s of list.slice(0, 15)) {
      console.log(`  ${s.file}:${s.startLine}-${s.endLine}  ${s.functionName}  (conf ${Math.round(s.confidence * 100)}%)`);
      for (const line of s.hunterTrace.concat(s.skepticTrace)) console.log(`      ${line}`);
    }
  };
  print("Dead", "💀", result.suspects.filter((s) => s.verdict === "dead"));
  print("Uncertain", "🤔", result.suspects.filter((s) => s.verdict === "uncertain"));
  console.log("\n(read-only — no files modified.)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
