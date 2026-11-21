/**
 * Phantom.js — CI haunt script (GitHub Action entry point).
 * Runs the Hunter/Skeptic loop against the checked-out repo and writes a
 * Markdown report to stdout (human logs go to stderr). The workflow pipes
 * stdout to haunt-report.md and posts it as a PR comment + job summary.
 *
 *   npx tsx scripts/haunt.ts <path>
 */

import { runHunt } from "../src/lib/agent/agent-loop";

async function main() {
  const path = process.argv[2] ?? ".";
  process.stderr.write(`[phantom] haunting ${path}\n`);

  const r = await runHunt({ kind: "local", path }, {
    onProgress: (m) => process.stderr.write(`[phantom] ${m}\n`),
  });

  const dead = r.suspects.filter((s) => s.verdict === "dead");
  const lines: string[] = [
    "## 🎃 Phantom.js Haunt Report",
    "",
    `Scanned **${r.repo.filesScanned}** files — 💀 ${r.summary.dead} zombies · 🤔 ${r.summary.uncertain} uncertain · ✅ ${r.summary.alive} alive.`,
    "",
    `**Sandbox:** ${r.summary.sandbox.safe ? "✅ safe to remove" : "⚠ blocking references"} · **Projected savings:** $${r.summary.finops.projectedSavingsUsd}/mo (${r.summary.finops.removedBundleKB} KB removed, ${r.summary.finops.coldStartDeltaMs} ms cold-start Δ).`,
    "",
    dead.length ? "### 🧟 Zombie candidates" : "_No zombies found — clean repo._",
    ...dead.slice(0, 25).map(
      (s) => `- \`${s.file}:${s.startLine}\` **${s.functionName}** (conf ${Math.round(s.confidence * 100)}%) — ${s.hunterTrace[0] ?? ""}`,
    ),
    "",
    "Read-only scan — no files modified. Approve candidates via the dashboard to open a verified PR.",
  ];

  process.stdout.write(lines.join("\n") + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
