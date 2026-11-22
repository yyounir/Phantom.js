/**
 * /api/hunts — Grimoire CRUD (list + create).
 *   GET  -> { ok, mode, hunts: SavedHuntSummary[] }
 *   POST { result, notes?, status? } -> { ok, mode, hunt: SavedHuntSummary }  (201)
 *
 * Backed by Supabase when configured, else an in-memory store (demo mode).
 * The store is server-only (imports supabase-js); the route is the only caller.
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/hunts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = getStore();
    const hunts = await store.list();
    return NextResponse.json({ ok: true, mode: store.mode, hunts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.result) {
      return NextResponse.json({ ok: false, error: "result is required" }, { status: 400 });
    }
    const store = getStore();
    const hunt = await store.create({
      result: body.result,
      notes: body.notes ?? null,
      status: body.status,
    });
    return NextResponse.json({ ok: true, mode: store.mode, hunt }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
