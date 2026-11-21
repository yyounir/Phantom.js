/**
 * Phantom.js — Next.js API route: trigger an exorcism.
 * ============================================================================
 * POST /api/exorcise
 *   body: { repoPath: string, dryRun?: boolean }
 *   200: { ok: true, report: ExorcismReport, logs: string[] }
 *   400/500: { ok: false, error: string, logs: string[] }
 *
 * The route connects to the local MCP AST server (over stdio), runs the agent
 * loop, and returns the verdict report + the live reasoning log.
 *
 * dryRun defaults to TRUE — the route never mutates the repo by accident.
 * PR generation (dryRun=false + approval) is the next step and must go through
 * a separate approval endpoint; it is intentionally NOT implemented inline so
 * that no code path can mutate without an explicit human gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { runExorcism } from "@/lib/agent/agent-loop";

// stdio subprocess requires the Node runtime (not Edge).
export const runtime = "nodejs";
// scanning a large repo can take a while; give it headroom in dev.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { repoPath?: string; dryRun?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { repoPath, dryRun = true } = body;
  if (!repoPath || typeof repoPath !== "string") {
    return NextResponse.json(
      { ok: false, error: "repoPath is required (string)" },
      { status: 400 },
    );
  }

  const logs: string[] = [];
  try {
    const report = await runExorcism(repoPath, {
      dryRun,
      onProgress: (m) => logs.push(m),
    });
    return NextResponse.json({ ok: true, report, logs });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err), logs },
      { status: 500 },
    );
  }
}
