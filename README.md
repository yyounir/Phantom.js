# Phantom.js — The Ghost Hunter 🎃👻

An enterprise-grade **FinOps & codebase-analysis agent** that scans GitHub repositories to hunt **zombie code** (dead, unreferenced functions) and **vampire dependencies** (bloated packages draining bundle size and cloud compute), runs a Hunter → Skeptic → Sandbox trial, and opens verified PRs ("exorcisms") with projected cost savings.

Built on the **Model Context Protocol (MCP)**: reasoning lives in the agent, tool execution lives in a sandboxed, read-only AST server. The model never touches the filesystem.

**Full design doc:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS · React Flow (call graph) · Supabase (audit log) · Redis (AST cache) · Vercel · MCP over a transport-agnostic Node.js AST server (TypeScript compiler API).

## Quick start

```powershell
npm install
npm run mcp:build        # build the AST MCP server (once; also runs via npm run dev/build)
```

Scan a **local** repo:
```powershell
npm run agent:demo -- ./sample-repo
```

Scan a **public GitHub** repo (tarball fetched in memory — no git clone):
```powershell
npm run agent:demo -- https://github.com/anthropics/anthropic-sdk-typescript/tree/main/src
npm run agent:demo -- https://github.com/owner/repo           # whole repo
npm run agent:demo -- https://github.com/owner/repo/tree/main/utils   # subpath
```

Run the web app (paste a repo URL in the dashboard):
```powershell
npm run dev   # http://localhost:3000
```

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import it in Vercel. `vercel.json` sets the build/install commands:
   - `installCommand: npm install`
   - `buildCommand: npm run build` (= `mcp:build` then `next build`)
3. (Optional) set `GITHUB_TOKEN` for larger/private repos and higher API limits. Public repos work without it.
4. Deploy. `/api/hunt` runs the agent fully in-process (in-memory MCP, no subprocess) — serverless-safe.

The MCP server runs **in-process** on the function via `InMemoryTransport`; the same `createPhantomServer(repoSource)` also boots over stdio when run standalone. One tool surface, transport-agnostic.

## How it works
1. **Summon** — paste a repo URL or path; Phantom builds a `RepoSource` (local disk or a fetched in-memory tarball).
2. **Hunt** — an in-memory MCP server exposes 8 read-only AST tools; the agent extracts declarations + references (cached parse = O(files)).
3. **Trial** — the **Hunter** flags zero-reference candidates; the **Skeptic** tries to disprove each (dynamic imports, barrels, reflection, tests, computed/private keys). A sandbox confirms the build still compiles.
4. **Exorcise** — dead candidates + a FinOps projection go to a human-in-the-loop approval gate → branch + PR with the full Chain-of-Thought, logged to Supabase.

## Safety properties
- **Read-only by construction** — no write/exec tool exists; mutation only via a human-approved PR.
- **Skeptic veto layer** — dynamic-import / barrel / reflection / test checks force ALIVE; the model cannot override.
- **Three-tier verdicts** — uncertain cases route to humans, never auto-deleted.
- **Sandbox gate** — no PR unless the build still compiles.
- **Reversible** — PRs are branches, never a push to main.
- **Caps** — tarball ≤50 MB, ≤2500 files, parse cache ≤4000 entries.

## Stretch features (designed; see ARCHITECTURE.md §3)
Continuous GitHub Haunting · Skeptic critic agent · Docker/E2B sandboxed `tsc` + tests · FOCUS billing + LLM-cost ROI · Redis AST cache.

## Verified
- `npm run build` + `npm run mcp:build` pass (type-checked).
- Local scan: dead/uncertain/alive correct incl. dynamic-import + barrel edge cases.
- Public scan: `anthropics/anthropic-sdk-typescript/src` → 362 files → 1363-node / 5011-edge call graph, sandbox safe.
- HTTP: `GET /` → 200 (landing + graph preview); `POST /api/hunt` → `{ok, result:{graph, suspects, summary}}`.

## Honest limitations
Reference detection is textual+AST (not a full semantic graph); `#private`/`[Symbol]` members and methods route to **uncertain** (conservative — never false-dead). Sandbox is the in-process transitive check today (Docker/E2B is the stretch integration). LLM CoT is deterministic in the starter; set `ANTHROPIC_API_KEY` to let a real model drive the Hunter/Skeptic with the guards as the veto layer.
