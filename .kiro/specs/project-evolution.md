# Kiro Spec: Phantom.js Project Evolution

This specification documents the multi-phase evolution of **Phantom.js: The Ghost Hunter** across all chat turns and repository milestones.

---

## Phase 1: Core Architecture & MCP AST Engine
- **Goal:** Establish a secure, decoupled FinOps agent that identifies dead code without granting the LLM direct write permissions to the codebase.
- **Key Deliverables:**
  - `mcp-server/src/index.ts`: AST analysis engine built on the TypeScript Compiler API.
  - `src/lib/agent/mcp-client.ts`: MCP transport client.
  - `src/lib/agent/agent-loop.ts`: Deterministic classification loop.
  - `sample-repo/`: Realistic benchmark repository verifying zero false positives on dynamic imports and barrel exports.
- **Verification:** `npm run mcp:build && npm run agent:demo -- ./sample-repo` passed with 100% accuracy.

---

## Phase 2: Chrome Web Dashboard
- **Goal:** Enable end-users to interact with Phantom.js through a modern browser interface.
- **Key Deliverables:**
  - `src/app/page.tsx`: Single-page dashboard with real-time hunt trigger, stat cards, and CoT reasoning drawer.
  - `src/app/globals.css`: Dark phantom color tokens and UI styling.
- **Verification:** Verified HTTP 200 response on `http://localhost:3000`.

---

## Phase 3: Public GitHub Repositories & Serverless Deployment
- **Goal:** Allow scanning of any public GitHub repository and ensure full compatibility with Vercel Serverless Functions.
- **Key Deliverables:**
  - Dual-mode MCP transport (`InMemoryTransport` for Vercel, `StdioClientTransport` for CLI).
  - In-memory tarball streaming (`src/lib/github.ts`) using `tar-stream` without disk IO.
  - Unified scan API (`src/app/api/hunt/route.ts`).
  - GitHub Actions continuous haunt workflow (`.github/workflows/phantom-haunt.yml`).
  - Vercel deployment profile (`vercel.json`).
- **Verification:** Tested local and remote repository hunts end-to-end.

---

## Phase 4: Features Showcase
- **Goal:** Provide a comprehensive technical deep-dive into Phantom.js's capabilities.
- **Key Deliverables:**
  - `src/app/features/page.tsx`: Zero-JS React Server Component.
  - 3 pillars: Detection & Analysis, Verification & Safety, Platform & Operations.
  - Interactive "The Trial" state diagram and FinOps ROI comparison table.
- **Verification:** Prerendered to static HTML (175 B JS bundle size).

---

## Phase 5: Supabase Persistence & Full CRUD (The Grimoire)
- **Goal:** Persist past hunt results and allow users to view, search, annotate, and delete historical exorcisms.
- **Key Deliverables:**
  - `supabase/schema.sql`: PostgreSQL schema with JSONB suspects and RLS.
  - `src/lib/hunts/store.ts`: Hybrid dual-storage engine (Supabase with offline JSON fallback).
  - REST endpoints: `GET/POST /api/hunts`, `GET/PATCH/DELETE /api/hunts/[id]`.
  - `src/app/grimoire/page.tsx`: Full audit log management UI.
- **Verification:** Full CRUD verified with and without Supabase credentials.

---

## Phase 6: Halloween Decor & Hackathon Polish
- **Goal:** Elevate presentation aesthetics for the Kiroween 2026 Hackathon.
- **Key Deliverables:**
  - `src/components/halloween-decor.tsx`: Floating ghosts, glowing bats, pumpkin accents.
  - Spooky animations and glowing borders in `globals.css`.
  - Comprehensive portfolio `README.md` with architecture badges and pitch talking points.
  - Typography update to Comic Sans MS for a fun retro aesthetic.
