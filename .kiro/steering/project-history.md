# Kiro Steering: Phantom.js Architecture & Project History

This file serves as a **permanent compass and steering layer** for AI agents operating within the Kiro development environment on the Phantom.js codebase.

---

## 1. Core Architectural Invariants

Whenever adding features, modifying code, or fixing bugs in this repository, you must maintain these four architectural invariants:

### A. Read-Only by Construction (MCP Decoupling)
- The agent loop (`src/lib/agent/agent-loop.ts`) does **not** possess filesystem write capabilities.
- Code analysis must always flow through the AST MCP server (`list_source_files`, `run_ast_parser`, `find_references`, `list_exports`).
- Any mutation of code (an "exorcism") is strictly gated behind human approval and must produce a Git branch/PR rather than directly modifying files on `main`.

### B. Dual-Transport MCP Compatibility
- **Serverless (Vercel / Next.js API Routes):** Always use `InMemoryTransport` via `src/lib/mcp/mcp-server.ts`. Never attempt to call `child_process.spawn()` or `StdioClientTransport` inside `/api/` routes because Vercel Serverless Functions do not support persistent background subprocesses.
- **Local CLI (`npm run agent:demo`):** `StdioClientTransport` remains supported for the standalone Node CLI.

### C. In-Memory Remote Repo Analysis
- When scanning public GitHub repositories (`src/lib/github.ts`), always stream tarballs into memory buffers using `tar-stream` and `zlib`. Never invoke shell `git clone` or write temporary files to the disk.

### D. Zero-Config Demoability (Supabase + Offline JSON)
- The persistence engine in `src/lib/hunts/store.ts` must maintain its dual-mode design:
  - If `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided: perform PostgreSQL operations via `@supabase/supabase-js`.
  - If unconfigured: fall back silently to the local mock store (`src/data/hunts.json`).
- Never crash or throw an unhandled exception if Supabase environment variables are missing.

---

## 2. Verdict Logic & Policy Guards

When the agent analyzes a suspect function, verdicts must strictly follow this policy state machine:

1. **ALIVE (Veto Guard):**
   - If reference count > 0 from active call sites.
   - If re-exported by a barrel file (`index.ts`).
   - If dynamically imported (`import(...)`).
   - If referenced via string reflection.
2. **DEAD:**
   - Reference count == 0.
   - Not exported, or exported from a non-barrel file with 0 external references.
   - No dynamic imports or reflection detected.
   - Confidence score >= 0.85.
3. **UNCERTAIN (Human Review Queue):**
   - Exported symbols with 0 local references in library code that may serve as a public SDK entry point.
   - Ambiguous naming collision or unresolved AST binding.
   - Routed to the human review queue; **never automatically removed**.

---

## 3. Project Evolution Summary

- **Turn 1 (Commit 0.1):** MCP AST Server, core agent loop, CLI demo, and `ARCHITECTURE.md`.
- **Turn 2 (Commit 0.2):** Web dashboard in Chrome (`src/app/page.tsx`), Tailwind dark theme, and CoT drawer.
- **Turn 3 (Commits 0.2 - 0.4):** Dual-transport MCP (`InMemoryTransport`), public GitHub scanning via tarball streaming, CI action `phantom-haunt.yml`, and `vercel.json`.
- **Turn 4 (Commit 0.3):** Dedicated `/features` showcase (React Server Component).
- **Turn 5 (Commit 0.4 - 0.5):** Supabase persistence with full CRUD and the Grimoire history viewer (`/grimoire`).
- **Commits 0.6 – 0.10:** Link clarification, interactive Halloween decor (`halloween-decor.tsx`), complete `README.md`, Comic Sans styling, and project notes.
