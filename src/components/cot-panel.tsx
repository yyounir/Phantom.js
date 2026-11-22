import type { Suspect } from "@/lib/agent/types";
import { COLORS, VERDICT_META } from "@/lib/theme";

/** The Hunter + Skeptic Chain-of-Thought for one suspect. Shared by the
 *  dashboard and the Grimoire detail view. */
export function CoTPanel({ s }: { s: Suspect }) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-zinc-100">{s.functionName}</span>
        <span className="text-xs text-zinc-500">
          {s.file}:{s.startLine}-{s.endLine}
        </span>
        <span className="ml-auto text-xs" style={{ color: COLORS[s.verdict] }}>
          {VERDICT_META[s.verdict].emoji} {VERDICT_META[s.verdict].label} · {Math.round(s.confidence * 100)}%
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-fuchsia-400">Hunter Agent</div>
          <div className="mt-1 space-y-1 text-xs text-zinc-400">
            {s.hunterTrace.map((t, i) => (
              <div key={i}>{t}</div>
            ))}
          </div>
        </div>
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">Skeptic Agent</div>
          <div className="mt-1 space-y-1 text-xs text-zinc-400">
            {s.skepticTrace.map((t, i) => (
              <div key={i}>{t}</div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-zinc-600">
        refs: {s.referenceCount} · kinds: {s.referenceKinds.join(", ") || "none"}
        {s.reexportedBy.length ? ` · re-exported by: ${s.reexportedBy.join(", ")}` : ""}
      </div>
    </div>
  );
}
