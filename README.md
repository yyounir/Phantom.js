# Phantom.js — The Ghost Hunter 🎃👻

An enterprise-grade **FinOps & codebase-analysis agent** that hunts **zombie code** (dead, unreferenced functions) and **vampire dependencies** (packages draining cloud compute), then opens automated PRs to exorcise them.

Built on the **Model Context Protocol (MCP)**: reasoning lives in the agent, tool execution lives in a sandboxed, read-only AST server. The model never touches the filesystem.

**Full design doc:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Stack
Next.js (App Router) · TypeScript · Tailwind · Supabase (audit log) · Vercel · MCP over a local Node.js AST server (TypeScript compiler API).

## Quick start

```bash
# 1. Build the read-only MCP AST server (-> mcp-server/dist/index.js)
npm run mcp:build

# 2. Install root dependencies
npm install

# 3. Run the agent against a repo from the CLI (no web UI needed)
npm run agent:demo -- ./path/to/some/repo

# Or start the web app and POST to /api/exorcise
npm run dev
```

```bash
curl -X POST localhost:3000/api/exorcise \
  -H "Content-Type: application/json" \
  -d '{"repoPath":"./path/to/some/repo","dryRun":true}'
```

## What it does

1. **Handshake** with the local AST MCP server; discovers the read-only tool set.
2. **Scan** every `.ts/.tsx/.js/.jsx` file → AST-extract function declarations.
3. **Verify** each function: references? barrel re-exports? dynamic imports? string reflection?
4. **Classify** → `dead` / `uncertain` / `alive` with a confidence score and a Chain-of-Thought trace.
5. **Approve** (human-in-the-loop) → open a branch + PR; **dry-run by default** (zero mutation).
6. **Log** the exorcism + bundle delta + projected FinOps savings to Supabase.

## Safety properties

- **Read-only by construction** — the MCP server exposes no write/exec tools.
- **Deterministic guards veto the LLM** — dynamic-import & reflection matches force ALIVE.
- **Three-tier verdicts** — uncertain cases route to humans, never auto-deleted.
- **Reversible** — PRs are branches, never a push to `main`.
- **Auditable** — every tool call + CoT step persisted to Supabase.

## Layout

```
mcp-server/              # local read-only AST MCP server (separate process)
src/lib/agent/           # MCP client + agent loop + types + CLI demo
src/app/api/exorcise/    # Next.js API route (trigger + connect)
ARCHITECTURE.md          # full 5-section design guide
```

## Production transport note

stdio is for the local demo. On Vercel serverless, swap stdio for the **Streamable HTTP** MCP transport and host the AST server as a small HTTP service (or run the agent in a queue worker). The tool surface and agent loop are unchanged — only the wire changes.
