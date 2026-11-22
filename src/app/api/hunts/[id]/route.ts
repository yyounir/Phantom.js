/**
 * /api/hunts/[id] — Grimoire CRUD (get + update + delete).
 *   GET    -> { ok, mode, hunt: SavedHunt } | 404
 *   PATCH  { status?, notes? } -> { ok, mode, hunt: SavedHuntSummary } | 404
 *   DELETE -> 204 | 404
 */

import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/hunts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getStore();
    const hunt = await store.get(params.id);
    if (!hunt) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, mode: store.mode, hunt });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const store = getStore();
    const hunt = await store.update(params.id, { status: body.status, notes: body.notes });
    if (!hunt) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, mode: store.mode, hunt });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const store = getStore();
    const ok = await store.remove(params.id);
    if (!ok) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
