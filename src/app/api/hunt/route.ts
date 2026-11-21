/**
 * Phantom.js — /api/hunt
 * ============================================================================
 * POST { repo: string }  -> { ok, result: HuntResult, logs: string[] }
 *
 * `repo` is either a GitHub URL (public repo) or a local path. The route runs
 * the Hunter/Skeptic loop fully in-process: it builds a RepoSource (disk or a
 * fetched tarball), links an in-memory MCP client+server, and returns the call
 * graph + Chain-of-Thought. No subprocess — so it runs on Vercel serverless.
 *
 * This route NEVER mutates a repo. PR generation is a separate, approval-gated
 * step (not implemented inline) so no code path can write without a human gate.
 */

import { NextRequest, NextResponse } from "next/server";
import { runHunt } from "@/lib/agent/agent-loop";
import type { RepoSpec } from "@/lib/agent/types";

export const runtime = "nodejs"; // in-process MCP + tarball fetch need Node, not Edge
export const maxDuration = 60; // scanning larger repos can take a while in dev
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { repo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body.repo?.trim();
  if (!input) {
    return NextResponse.json({ ok: false, error: "repo is required" }, { status: 400 });
  }

  const spec: RepoSpec = /^https?:\/\//i.test(input)
    ? { kind: "github", url: input }
    : { kind: "local", path: input };

  const logs: string[] = [];
  try {
    const result = await runHunt(spec, {
      githubToken: process.env.GITHUB_TOKEN,
      onProgress: (m) => logs.push(m),
    });
    return NextResponse.json({ ok: true, result, logs });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err), logs },
      { status: 500 },
    );
  }
}
