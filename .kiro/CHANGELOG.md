# Phantom.js — Project Changelog & Chat History

This document records the complete, chronological evolution of **Phantom.js: The Ghost Hunter** based on the Kiro AI chat session logs (`sess_3361f341-8ad2-4f41-859b-bd6d06b46154`) and repository commits from the **Kiroween 2026 AI Hackathon**.

---

## 🎃 Project Overview

- **Project Name:** Phantom.js: The Ghost Hunter
- **Core Concept:** Enterprise-grade FinOps & codebase-analysis autonomous agent that hunts **zombie code** (unreferenced/dead functions) and **vampire dependencies** (bloated packages draining cloud compute), running a multi-agent Hunter → Skeptic verification trial before opening verified PRs ("exorcisms").
- **Key Architecture Innovation:** Decoupling reasoning from execution via the **Model Context Protocol (MCP)**. The LLM has zero direct filesystem write permissions; all AST analysis runs through read-only tools.
- **Tech Stack:** Next.js 14 (App Router), TypeScript 5.5, Tailwind CSS 3.4, Model Context Protocol (`@modelcontextprotocol/sdk`), Node.js TypeScript Compiler AST API, Supabase (with automatic offline fallback), Vercel Serverless.

---

## 📜 Complete Chat Session Timeline

### 📍 Turn 1 — Core Architecture, MCP AST Server & Initial Scaffolding
- **Timestamp:** `2026-11-21T19:23:07.718Z`
- **User Prompt:**
  > *"Act as an expert Senior AI Full-Stack Engineer. I am participating in a Halloween-themed AI hackathon and I am building 'Phantom.js: The Ghost Hunter'—an enterprise-grade FinOps and codebase analysis agent. The app autonomously hunts down 'zombie code' (dead/unreferenced functions) and 'vampire dependencies' (packages draining cloud compute) in GitHub repositories.*
  > *My tech stack is: Next.js (App Router), TypeScript, Tailwind CSS, Supabase (for logging historical 'exorcisms'/PRs), and Vercel for deployment. The core AI architecture will utilize the Model Context Protocol (MCP), using a Node.js MCP server to securely expose AST parsing tools to the LLM agent.*
  > *I need a complete, portfolio-ready project design and implementation guide: 1. System Architecture (Mermaid Diagram), 2. Agentic Workflow & Advanced AI Features, 3. Reliability Mechanisms & Evaluation Harness, 4. Initial Code Implementation, 5. Hackathon Pitch & Documentation."*

- **Key Engineering Decisions:**
  1. **Strict MCP Decoupling:** The LLM agent runs inside Next.js / CLI and never directly touches files. A dedicated Node.js MCP server exposes 4 pure read-only AST tools over stdio transport.
  2. **Multi-Stage Verification State Machine:** Instead of trusting LLM guesses, the agent executes:
     - AST function declaration extraction
     - Exact symbol reference finding across all files
     - Barrel file (`index.ts`) export tracing
     - Deterministic guard rails: vetoes dead classification if dynamic imports (`import()`) or string-reflection calls exist
     - Three-tier verdicts: `dead`, `uncertain`, `alive`
  3. **Human-in-the-Loop & Safe Exorcisms:** Dry-run by default; PR generation only occurs on a dedicated branch upon human review.

- **Files Created:**
  - [`ARCHITECTURE.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/ARCHITECTURE.md): Comprehensive 5-section specification including Mermaid state machine, stage-by-stage transitions, FinOps calculus, and evaluation harness.
  - [`README.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/README.md): Initial project overview and CLI quick-start.
  - [`package.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/package.json): Root configuration with dependencies and scripts (`agent:demo`, `mcp:build`, `build`, `dev`).
  - [`tsconfig.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/tsconfig.json): Strict TypeScript compiler options.
  - [`next.config.mjs`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/next.config.mjs): Next.js configuration.
  - [`.env.example`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.env.example): Environment variable templates.
  - [`.gitignore`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.gitignore): Ignored patterns.
  - [`mcp-server/package.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/mcp-server/package.json), [`mcp-server/tsconfig.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/mcp-server/tsconfig.json), [`mcp-server/src/index.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/mcp-server/src/index.ts): Standalone AST MCP server implementing:
    - `list_source_files`: Discovers code files excluding `node_modules` and hidden dirs.
    - `run_ast_parser`: Parses AST using the TypeScript Compiler API, extracting function names, kinds, line numbers, parameter counts, and export flags.
    - `find_references`: Scans AST for identifier call sites, import declarations, dynamic imports, and string reflections.
    - `list_exports`: Analyzes barrel and re-export statements.
  - [`src/lib/agent/types.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/agent/types.ts): Shared TypeScript interfaces (`Suspect`, `Verdict`, `ReferenceMatch`, `ExorcismReport`).
  - [`src/lib/agent/mcp-client.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/agent/mcp-client.ts): Client spawner over `StdioClientTransport`.
  - [`src/lib/agent/agent-loop.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/agent/agent-loop.ts): Agent orchestration loop implementing the AST scan and Chain-of-Thought policy guards.
  - [`src/lib/agent/demo.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/agent/demo.ts): Standalone CLI trial runner (`npm run agent:demo -- ./sample-repo`).
  - [`src/app/api/exorcise/route.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/api/exorcise/route.ts): Initial Next.js API endpoint.
  - [`sample-repo/`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/sample-repo): Verification fixture repository containing `dead.ts`, `alive.ts`, `barrel-target.ts`, `index.ts`, `dynamic.ts`, `app.ts`.

- **Associated Git Commit:** `0a13ecf` (*0.1 - Initialize repository and added basic features to check repos*).

---

### 📍 Turn 2 — Web UI Dashboard & Chrome Browser Support
- **Timestamp:** `2026-11-21T19:41:32.621Z`
- **User Prompt:**
  > *"how do i load the page or app onto chrome?"*

- **Key Engineering Decisions:**
  1. The project originally had only CLI scripts and an API endpoint. Built a complete Next.js web application frontend so users can trigger scans and inspect evidence directly inside Google Chrome.
  2. Set up Tailwind CSS styling, dark phantom theme, responsive layout, and real-time scan triggers.

- **Files Created/Modified:**
  - [`tailwind.config.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/tailwind.config.ts): Added custom phantom color palette (`phantom-bg`, `phantom-panel`, `phantom-border`, `phantom-accent`, `phantom-blood`, `phantom-amber`, `phantom-alive`).
  - [`postcss.config.mjs`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/postcss.config.mjs): PostCSS pipeline configuration.
  - [`src/app/globals.css`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/globals.css): Dark background styling and custom scrollbars.
  - [`src/app/layout.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/layout.tsx): App root layout with metadata and fonts.
  - [`src/app/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/page.tsx): Interactive web dashboard:
    - Repository input pre-filled with `./sample-repo`
    - "Summon the Hunter" interactive action button
    - Real-time animated scanning spinner
    - Stat breakdown cards (Dead Zombies, Uncertain Spirits, Living Code)
    - Expandable Chain-of-Thought (CoT) drawer showing the agent's step-by-step reasoning per function
    - Safe exorcism dry-run toggle
  - [`package.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/package.json): Added `autoprefixer`, `postcss`, and `tailwindcss`.

- **Associated Git Commit:** `77b6add` (*0.2 - Added dedicated homepage*).

---

### 📍 Turn 3 — Public GitHub Repositories & Vercel Serverless Architecture
- **Timestamp:** `2026-11-21T20:22:47.966Z`
- **User Prompt:**
  > *"Can you make it possible for it to scan public repositories as well? Adjust the project so that I can deploy it to vercel. Act as an expert Senior AI Full-Stack Engineer and UI/UX Architect..."*

- **Key Architectural Challenges & Breakthroughs:**
  1. **The Serverless Incompatibility:** On Vercel Serverless Functions, spawning long-running child processes over `stdio` (`child_process.spawn('node', ['mcp-server/...'])`) is blocked or unreliable due to the ephemeral runtime environment.
     - **Solution: Dual-Transport MCP Architecture.** Refactored MCP server and client to support `InMemoryTransport`. In serverless mode (Vercel), the client and AST server communicate directly in-memory within the same process without spawning subprocesses. For CLI usage, `StdioClientTransport` is preserved!
  2. **Streaming Public Repositories Without Git Clone:** Cloning arbitrary public GitHub repos to disk requires disk space, the Git CLI binary, and elevated permissions.
     - **Solution: In-Memory Tarball Streaming.** Built [`src/lib/github.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/github.ts) using GitHub's Tarball API (`api.github.com/repos/{owner}/{repo}/tarball/{branch}`) combined with `tar-stream` and `zlib`. Repository source files are downloaded and extracted purely into memory buffers.
  3. **Continuous GitHub Haunting (CI/CD):** Created a turnkey GitHub Action and CLI runner to run Phantom.js on PRs automatically.

- **Files Created/Modified:**
  - [`src/lib/mcp/mcp-server.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/mcp/mcp-server.ts): Exportable MCP server factory supporting both in-memory and stdio transports.
  - [`src/lib/agent/mcp-client.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/agent/mcp-client.ts): Dual-transport client connecting via `InMemoryTransport` or `StdioClientTransport`.
  - [`src/lib/github.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/github.ts): High-performance GitHub public repo fetcher with memory tarball streaming.
  - [`src/types/tar-stream.d.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/types/tar-stream.d.ts): TypeScript typings for `tar-stream`.
  - [`src/app/api/hunt/route.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/api/hunt/route.ts): Unified scan API handling both remote GitHub URLs (`https://github.com/owner/repo`) and local file paths.
  - [`scripts/haunt.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/scripts/haunt.ts): Automated haunt script for CI workflows.
  - [`.github/workflows/phantom-haunt.yml`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.github/workflows/phantom-haunt.yml): GitHub Actions workflow for pull-request ghost hunting.
  - [`vercel.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/vercel.json): Vercel configuration tuning serverless function memory (1024MB) and timeout (60s).
  - Updated [`src/app/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/page.tsx): Added GitHub repository URL support, sample quick-pick buttons, and branch inputs.
  - Updated [`ARCHITECTURE.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/ARCHITECTURE.md) and [`README.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/README.md).

- **Associated Git Commits:** `77b6add`, `e63d0c8`, and `4beef18`.

---

### 📍 Turn 4 — Dedicated Features Showcase Page
- **Timestamp:** `2026-11-21T22:11:07.254Z`
- **User Prompt:**
  > *"Can you create another page that is dedicated to highlighting its features?"*

- **Key Engineering Decisions:**
  1. Built a high-performance React Server Component at `/features` that pre-renders to static HTML with negligible client-side JS overhead (175 B).
  2. Implemented native `<details>` accordions for seamless zero-JS interactions.
  3. Structured features across three distinct enterprise pillars: Detection & Analysis, Verification & Safety, and Platform & Operations.
  4. Added "The Trial" state diagram and an enterprise FinOps comparison matrix contrasting Phantom.js against Knip, ts-prune, and ESLint.

- **Files Created/Modified:**
  - [`src/app/features/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/features/page.tsx):
    - Hero: *"Every weapon in the Hunter's arsenal"*
    - **Detection & Analysis Cards:** AST Zombie Detection, Vampire Dependency FinOps, The Haunted Call Graph, Public + Local Scanning
    - **Verification & Safety Cards:** Multi-Agent Skeptic Verification, Sandboxed Build Testing, Three-Tier Verdicts, Read-Only by Construction
    - **Platform & Operations Cards:** MCP Decoupling, Continuous GitHub Haunting, AI Cost Observability, Redis AST Caching
    - **The Trial Visualizer:** Interactive state flow showing Hunter → Skeptic → Verdict → Exorcism PR
    - **Competitive Table:** FinOps ROI and comparative feature matrix
  - [`src/app/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/page.tsx): Added navigation links in header to `/features`.

- **Associated Git Commit:** `e63d0c8` (*0.3 - Added the Features page to highlight the features of the app*).

---

### 📍 Turn 5 — Supabase Persistence, Full CRUD & "The Grimoire"
- **Timestamp:** `2026-11-21T22:58:23.327Z`
- **User Prompt:**
  > *"Can you include the option to save data to the supabase database so that they can reference it back later, include the entire CRUD operation."*

- **Key Architectural Challenges & Breakthroughs:**
  1. **Resilient Dual Storage (Supabase + Local In-Memory Fallback):** Hackathon demos often suffer from unconfigured credentials or network blocks. Implemented [`src/lib/hunts/store.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/hunts/store.ts) with dynamic provider switching:
     - If `SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided: connects to PostgreSQL via `@supabase/supabase-js`.
     - If unconfigured: seamlessly falls back to a file-backed JSON store (`src/data/hunts.json`), allowing full CRUD operations to work locally offline with zero configuration!
  2. **Complete CRUD REST API:**
     - `POST /api/hunts`: Create and record a completed hunt.
     - `GET /api/hunts`: List historical exorcisms with status/search filtering.
     - `GET /api/hunts/[id]`: Retrieve full scan details including all suspects and CoT traces.
     - `PATCH /api/hunts/[id]`: Update audit notes, status tags, or mark exorcisms completed.
     - `DELETE /api/hunts/[id]`: Purge a record from the database.
  3. **Shared Visual Components:**
     - Extracted [`src/components/cot-panel.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/components/cot-panel.tsx) (Chain-of-Thought drawer) and [`src/components/hunt-graph.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/components/hunt-graph.tsx) (interactive call graph).

- **Files Created/Modified:**
  - [`supabase/schema.sql`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/supabase/schema.sql): PostgreSQL table definition (`hunts`) with JSONB suspect arrays, RLS policies, and performance indexes.
  - [`src/lib/hunts/types.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/hunts/types.ts): TypeScript interfaces for `SavedHunt`, `CreateHuntInput`, `UpdateHuntInput`.
  - [`src/lib/hunts/store.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/hunts/store.ts): Hybrid storage engine managing Supabase or JSON persistence.
  - [`src/app/api/hunts/route.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/api/hunts/route.ts): Collection endpoints (`GET`, `POST`).
  - [`src/app/api/hunts/[id]/route.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/api/hunts/[id]/route.ts): Single-resource endpoints (`GET`, `PATCH`, `DELETE`).
  - [`src/components/cot-panel.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/components/cot-panel.tsx): Modular CoT drawer component.
  - [`src/components/hunt-graph.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/components/hunt-graph.tsx): Modular call graph visualizer.
  - [`src/lib/theme.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/lib/theme.ts): Theme color constants.
  - [`package.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/package.json): Added `@supabase/supabase-js`.
  - Updated [`src/app/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/page.tsx): Added "Save to Grimoire" button upon hunt completion and navigation link to `/grimoire`.

- **Associated Git Commits:** `4beef18` (*0.4 - Added spooky interface for the project*) and `1c4abcb` (*0.5 - Fixed error where grimoire wasnt displaying data properly*).

---

### 📍 Turn 6 (Current) — Documenting Project Evolution in `.kiro/`
- **Timestamp:** `2026-11-24T01:24:35.924Z` (Original session request) → Completed in Antigravity.
- **User Prompt:**
  > *"Create a /.kiro file directory listing all the changes made thorughout thie project based on the chats"*

- **Implementation:**
  - Analyzed the raw session JSONL log (`messages.jsonl`), reconstructed all prompt turns, extracted every file write, edit, and CLI command.
  - Cross-referenced all 10 Git commits (`0.1` to `0.10`).
  - Created the `.kiro/` directory containing:
    1. [`.kiro/CHANGELOG.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.kiro/CHANGELOG.md) (this document)
    2. [`.kiro/changes.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.kiro/changes.md) (direct quick-reference changelog)
    3. [`.kiro/steering/project-history.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.kiro/steering/project-history.md) (steering context for Kiro AI agents)
    4. [`.kiro/specs/project-evolution.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.kiro/specs/project-evolution.md) (spec-driven development history)
    5. [`.kiro/README.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/.kiro/README.md) (directory index and navigation guide)

---

## 🔬 Post-Chat Refinements & Polish (Git Commits 0.5 – 0.10)

Following the interactive chat sessions, targeted fixes and aesthetic refinements were committed directly to the repository:

| Commit | Title | Key Changes |
|---|---|---|
| **0.5 (`1c4abcb`)** | *Fixed error where grimoire wasnt displaying data properly* | Created [`src/app/grimoire/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/grimoire/page.tsx) with audit history viewer, status filtering, note editing, and delete actions. Added 1,500 lines of rich offline mock data to [`src/data/hunts.json`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/data/hunts.json). Added [`src/app/api/items/route.ts`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/api/items/route.ts). |
| **0.6 (`694010a`)** | *Added some clarification towards pasting links* | Clarified placeholder text and helper labels in [`src/app/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/page.tsx) to guide users when pasting GitHub repository URLs. |
| **0.7 (`83e0b8f`)** | *Added more decorations for halloween decoration* | Created [`src/components/halloween-decor.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/components/halloween-decor.tsx) with floating ghosts, glowing bats, pumpkin accents, and eerie mist. Updated [`src/app/globals.css`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/globals.css) with keyframe animations. |
| **0.8 (`3c982e6`)** | *Added README* | Rewrote [`README.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/README.md) into a comprehensive portfolio presentation with architecture diagrams, API tables, and hackathon judging points. |
| **0.9 (`cff311c`)** | *Changed the font style for app* | Updated body font family to Comic Sans MS in [`src/app/globals.css`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/globals.css) for a campy, retro Halloween feel. Updated footer in [`src/app/page.tsx`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/src/app/page.tsx) to cite Kiroween 2026. |
| **0.10 (`af025db`)** | *Adjusted some code* | Added [`Markdown.md`](file:///c:/Users/yyins/Projects/Hackathons/PhantomJS/Markdown.md) for notes. |

---

## 📊 Summary of Artifacts Created Throughout the Project

```
PhantomJS/
├── .kiro/                               # Kiro agent ecosystem directory
│   ├── CHANGELOG.md                     # Complete chronological changelog
│   ├── changes.md                       # Quick-reference changes file
│   ├── README.md                        # .kiro directory guide
│   ├── specs/
│   │   └── project-evolution.md         # Spec-driven development phases
│   └── steering/
│       └── project-history.md           # Permanent AI agent context & guidelines
├── .github/workflows/
│   └── phantom-haunt.yml                # CI/CD GitHub Action for continuous scans
├── mcp-server/                          # Local AST MCP Server
│   ├── src/index.ts                     # 4 read-only AST tools (TS Compiler API)
│   ├── package.json
│   └── tsconfig.json
├── sample-repo/                         # Fixture repository for verification
│   ├── utils/                           # dead.ts, alive.ts, dynamic.ts, barrel-target.ts
│   └── app.ts
├── scripts/
│   └── haunt.ts                         # Standalone runner for CI/CD
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── hunt/route.ts            # Unified scan API (public + local)
│   │   │   ├── hunts/route.ts           # Grimoire collection CRUD (GET, POST)
│   │   │   └── hunts/[id]/route.ts      # Grimoire resource CRUD (GET, PATCH, DELETE)
│   │   ├── features/page.tsx            # Dedicated Features showcase (Server Component)
│   │   ├── grimoire/page.tsx            # Grimoire audit log UI
│   │   ├── globals.css                  # Halloween themes, animations & styling
│   │   ├── layout.tsx                   # Root layout
│   │   └── page.tsx                     # Main Hunter dashboard
│   ├── components/
│   │   ├── cot-panel.tsx                # Chain-of-Thought reasoning drawer
│   │   ├── halloween-decor.tsx          # Spooky interactive visual decor
│   │   └── hunt-graph.tsx               # Call graph visualization
│   ├── lib/
│   │   ├── agent/                       # Agent loop, MCP client, demo runner, types
│   │   ├── hunts/                       # Supabase / in-memory hybrid store & CRUD
│   │   ├── mcp/                         # Dual-transport MCP server factory
│   │   ├── github.ts                    # Streaming public GitHub tarball fetcher
│   │   └── theme.ts                     # Color tokens & theme constants
│   └── data/
│       └── hunts.json                   # Offline seed data for Grimoire demos
├── supabase/
│   └── schema.sql                       # PostgreSQL database schema & RLS policies
├── ARCHITECTURE.md                      # Full 5-section enterprise architecture
├── README.md                            # Portfolio README with pitch & badges
└── vercel.json                          # Vercel serverless deployment config
```
