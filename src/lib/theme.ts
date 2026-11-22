import type { Verdict } from "@/lib/agent/types";

/** Verdict colors — terminal green for alive, neon purple for zombies, amber for uncertain. */
export const COLORS: Record<Verdict, string> = {
  alive: "#00fa00",
  dead: "#c084fc",
  uncertain: "#f59e0b",
};

export const VERDICT_META: Record<Verdict, { emoji: string; label: string }> = {
  dead: { emoji: "💀", label: "Zombie" },
  uncertain: { emoji: "🤔", label: "Uncertain" },
  alive: { emoji: "✅", label: "Alive" },
};
