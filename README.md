<div align="center">

# 👻 Phantom.js — The Ghost Hunter

**An enterprise-grade FinOps & dead-code analysis agent built on the Model Context Protocol.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-7c3aed)](https://modelcontextprotocol.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Phantom.js hunts zero-reference dead code and bloated packages draining bundle size, runs a two-agent Hunter → Skeptic verification trial, sandboxes the proposed removals, and produces a human-approved PR — the **exorcism** — with a projected cloud-cost savings line item.

<!-- [**Live Demo**](#quick-start) · [Architecture Deep-Dive](#architecture) · [API Reference](#api-reference) · [Deploy](#deployment) -->

</div>

---

## Table of Contents

1. [What It Does](#what-it-does)
2. [Architecture](#architecture)
   - [System Overview](#system-overview)
   - [The Four Stages](#the-four-stages)
   - [MCP Tool Surface](#mcp-tool-surface)
   - [Data Flow](#data-flow)
   - [Agent Decision Logic](#agent-decision-logic)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Quick Start](#quick-start)
6. [API Reference](#api-reference)
7. [Configuration](#configuration)
8. [Safety Properties](#safety-properties)
9. [Performance](#performance)
10. [Deployment](#deployment)
11. [Roadmap](#roadmap)
12. [Honest Limitations](#honest-limitations)

---

## Tech Stack

### Languages

| Language | Version | Role |
|---|---|---|
| **TypeScript** | 5.5 | 100% of the codebase — agent loop, MCP server, API routes, React components, and all shared types |
| **TSX / JSX** | — | React component templates (`.tsx` for typed components, `.jsx`-compatible) |
| **CSS** | — | `globals.css` — Tailwind directives + hand-authored keyframe animations for ambient effects |
| **YAML** | — | `.github/workflows/phantom-haunt.yml` — the Continuous Haunting GitHub Action |
| **JSON** | — | `vercel.json` (deploy config), `hunts.json` (dev-mode Grimoire flat-file store) |

---

### Frameworks & Runtime

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 14.2 (App Router) | Full-stack framework — file-based routing, React Server Components, Edge-compatible API routes |
| **React** | 18.3 | UI rendering; client components for the hunt form, call graph, CoT panel, and Grimoire |
| **Node.js** | 20 (LTS) | Server runtime for API routes and the CLI agent demo (`npm run agent:demo`) |
| **Model Context Protocol (MCP)** | SDK 1.6 | Agent ↔ tool protocol; `InMemoryTransport` makes it serverless-safe (no stdio subprocess on Vercel) |

---

### Libraries & Key Dependencies

| Library | Version | Purpose |
|---|---|---|
| `@modelcontextprotocol/sdk` | 1.6.1 | MCP client + server primitives; `InMemoryTransport`, `McpServer`, `Client` |
| `reactflow` | 11.11 | Interactive call-graph visualization — custom nodes colored by verdict, animated edges |
| `@supabase/supabase-js` | 2.45 | Supabase client for persistent Grimoire storage (server-only; never imported in client components) |
| `zod` | 3.23 | Runtime schema validation for MCP tool input/output shapes |
| `tar-stream` | 3.1 | In-memory tar extraction — parses GitHub tarballs without writing to disk |
| `typescript` | 5.5 | Compiler API used **at runtime** to parse ASTs (not just a dev tool); bundled into the Vercel function |
| `tsx` | 4.16 | TypeScript execution for the CLI demo (`npm run agent:demo`) without a separate compile step |

---

### Databases & Persistence

| Store | Type | When Used | What's Stored |
|---|---|---|---|
| **Supabase** (PostgreSQL) | Managed cloud DB | Production (when `SUPABASE_URL` + key are set) | Full `HuntResult` as `jsonb` + summary columns (`dead_count`, `sandbox_safe`, `projected_savings_usd`, etc.) in a `hunts` table |
| **In-Memory Map** | `Map<string, SavedHunt>` in Node process | Serverless fallback (no Supabase config) | Same `SavedHunt` shape; lost on function cold-start restart |
| **Flat-file JSON** | `src/data/hunts.json` | Local dev mode via `GET/POST /api/hunts` | Array of saved hunts serialized to disk between dev-server restarts |
| **Redis** *(stretch)* | Key-value cache | Planned | AST parse results keyed by file content hash — skips re-parse across runs and Vercel instances |

> The `HuntStore` interface abstracts all three persistence modes. Swapping between them requires only changing environment variables.

---

### Styling & UI

| Technology | Version | Role |
|---|---|---|
| **Tailwind CSS** | 3.4 | Utility-first CSS — no runtime stylesheet; only used classes ship in the bundle |
| **PostCSS** | 8.4 | Tailwind processing pipeline |
| **Autoprefixer** | 10.4 | Vendor-prefix injection for cross-browser CSS compatibility |
| **Custom CSS animations** | — | `globals.css` keyframes: fog drift, bat flight, candle flicker, spider web sway, skull rise, blood drip |
| **Inline SVG** | — | Corner spider webs and the static call-graph preview — no image files, no external assets |

---

### Infrastructure & DevOps

| Tool / Service | Role |
|---|---|
| **Vercel** | Serverless hosting; `vercel.json` sets `maxDuration: 60` for `/api/hunt` to allow large repo scans |
| **GitHub Actions** | Continuous Haunting — posts a zombie-report PR comment on every source-touching pull request |
| **npm** | Package manager (workspaces not required; MCP server builds against the root's hoisted `typescript`) |
| **TypeScript compiler (`tsc`)** | `npm run mcp:build` compiles `mcp-server/src/index.ts` → `mcp-server/dist/` before every `next build` |

---

### Architecture Patterns

| Pattern | Where Applied |
|---|---|
| **Multi-agent adversarial trial** | Hunter flags → Skeptic tries to disprove → combined verdict + confidence score |
| **Model Context Protocol (MCP)** | Decouples agent reasoning from tool execution; agent never touches the filesystem |
| **Transport-agnostic design** | Same `createPhantomServer()` runs over `InMemoryTransport` (serverless) or `stdio` (standalone CLI) |
| **Repository abstraction (`RepoSource`)** | `LocalDiskRepo` and `InMemoryRepo` share one interface; agent loop is identical for both |
| **In-memory tarball streaming** | No `git clone`, no disk writes — GitHub repos fetched as a streaming tarball, gunzipped + untarred into a `Map<path, content>` |
| **Policy-layer veto** | Skeptic's hard checks (dynamic import, barrel re-export, string reflection, test usage) are code — the LLM cannot override them |
| **Human-in-the-loop gate** | `POST /api/hunt` is read-only by design; PR generation is a separate approval step |

---

## What It Does

Phantom.js is a **multi-agent AI system** that answers one question: *"What code in this repository can be safely deleted, and how much will removing it save in cloud compute costs?"*

It does this without false positives — through a two-agent adversarial trial, a sandboxed build check, and a human approval gate. Nothing is ever removed automatically.

| Problem | Phantom.js Solution |
|---|---|
| Dead functions accumulate silently | AST-based zero-reference detection (not grep) across the full repo |
| AI tools produce false positives | A second **Skeptic** agent tries to *disprove* every flag before it's trusted |
| "Safe to delete" is hard to prove | In-process transitive sandbox check; no removal ships if anything still references it |
| Dead code has no business case | FinOps projection: removed lines → bundle KB → cold-start Δ ms → compute seconds → $/mo |
| Changes are risky | Every exorcism is a branch + PR — reviewable and fully reversible |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Phantom.js System                               │
│                                                                         │
│  ┌──────────┐    POST /api/hunt    ┌────────────────────────────────┐   │
│  │  Next.js │ ──────────────────▶  │          Agent Loop            │   │
│  │  Web UI  │ ◀──────────────────  │   (Hunter ↔ Skeptic ↔ MCP)    │   │
│  └──────────┘    HuntResult JSON   └───────────┬────────────────────┘   │
│                                                │                        │
│               ┌────────────────────────────────▼──────────────────┐    │
│               │          In-Memory MCP Transport                   │    │
│               │   (InMemoryTransport.createLinkedPair)             │    │
│               │   No subprocess · serverless-safe · same SDK       │    │
│               └───────────────────────┬───────────────────────────┘    │
│                                       │                                 │
│               ┌───────────────────────▼───────────────────────────┐    │
│               │        Phantom AST MCP Server  (read-only)         │    │
│               │  8 tools · TypeScript compiler API · cached parse  │    │
│               └───────────────────────┬───────────────────────────┘    │
│                                       │                                 │
│               ┌───────────────────────▼───────────────────────────┐    │
│               │                  RepoSource                        │    │
│               │  LocalDiskRepo (fs)   │   InMemoryRepo (tarball)   │    │
│               └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Four Stages

```
Stage 1 — SUMMON            Stage 2 — HUNT             Stage 3 — TRIAL           Stage 4 — EXORCISE
─────────────────────       ──────────────────         ───────────────────────   ──────────────────────
                            ┌─────────────────┐        ┌────────────────────┐
GitHub URL or local path    │ list_source_files│        │  For each function │    run_sandbox_check
        │                   │  → file set      │        │                    │      (transitive refs)
        ▼                   └────────┬────────┘        │  Hunter Pass       │             │
 ┌─────────────┐                     │                 │  · zero refs?      │             ▼
 │ LocalDiskRepo│            ┌────────▼────────┐       │  · default export? │    estimate_finops_impact
 │     OR       │            │ run_ast_parser   │       │  · plain name?     │      · bundle KB
 │ InMemoryRepo │            │  → FunctionInfo[]│       │                    │      · cold-start Δms
 │ (tar+gunzip) │            │  (cached parse)  │       │  Skeptic Pass      │      · $/mo savings
 └─────────────┘            └────────┬────────┘       │  · barrel re-export│             │
        │                            │                 │  · dynamic import  │             ▼
        ▼                   ┌────────▼────────┐       │  · string reflect. │    Human approval gate
InMemoryTransport           │ find_references  │       │  · test-only ref   │    Branch + PR (exorcism)
  createLinkedPair()        │  (whole-repo,    │       │                    │    logged to Supabase
MCP handshake complete      │   comment-aware) │       │  Verdict + CoT     │
                            └─────────────────┘       └────────────────────┘
```

### MCP Tool Surface

The agent only ever calls these 8 tools — it **never** touches the filesystem or shell directly:

| Tool | Category | What it does |
|---|---|---|
| `list_source_files` | Discovery | Enumerate the scannable `.ts/.tsx/.js/.jsx` file set |
| `run_ast_parser` | Analysis | Parse a file → `FunctionInfo[]` with line ranges (cached by content hash) |
| `find_references` | Analysis | Whole-repo, comment-aware reference scan for a symbol |
| `list_exports` | Analysis | Exported symbols + barrel (`index.*`) re-exports for a file |
| `get_calls` | Graph | Call-site locations per file (call-graph edges) |
| `get_imports` | Graph | Import declarations across files (cross-file edges) |
| `run_sandbox_check` | Safety | Transitive reference check: safe only if no surviving function references the removal |
| `estimate_finops_impact` | FinOps | Bundle KB → cold-start Δ → compute-seconds → $/mo projection |

> **What's missing is the security boundary:** there is no `write_file`, `exec`, `git`, or shell tool. A prompt injection hiding in scanned source can, at worst, produce a read-only tool call.

### Data Flow

```
POST /api/hunt  { repo: "https://github.com/owner/repo" }
       │
       ▼
  fetchGitHubRepo()
  ├─ Parse URL → owner, repo, ref, subpath
  ├─ GET github.com/default branch (API)
  ├─ GET codeload.github.com tarball (streaming)
  ├─ gunzip + untar in-memory
  └─ InMemoryRepo (Map<relPath, content>)
       │
       ▼
  connectPhantomServer(repo)
  ├─ InMemoryTransport.createLinkedPair() → [clientTransport, serverTransport]
  ├─ createPhantomServer(repo).connect(serverTransport)
  ├─ new Client().connect(clientTransport)
  └─ { listTools, callTool, close }
       │
       ▼
  runHunt()  — the agent loop
  ├─ list_source_files                     → string[]          O(1)
  ├─ run_ast_parser (per file, cached)     → FunctionInfo[]    O(files)
  ├─ For each function:
  │   ├─ find_references                   → ReferenceMatch[]  O(files)
  │   ├─ list_exports (barrel files only)  → ExportResult      O(barrels)
  │   ├─ hunterPass()                      → hunterTrace[]
  │   ├─ skepticPass()                     → skepticTrace[], disproof
  │   └─ combine()                         → Verdict, confidence
  ├─ run_sandbox_check (dead batch)        → SandboxResult
  ├─ estimate_finops_impact (dead lines)   → FinopsResult
  └─ return HuntResult { repo, graph, suspects, summary }
       │
       ▼
  NextResponse.json({ ok: true, result })
```

### Agent Decision Logic

```
                    ┌─────────────────────────┐
                    │      Function fn         │
                    └─────────┬───────────────┘
                              │
                    ┌─────────▼───────────────┐
                    │  Is default export?      │──YES──▶  ALIVE (public API)
                    └─────────┬───────────────┘
                              │NO
                    ┌─────────▼───────────────┐
                    │  Is computed/private?    │──YES──▶  UNCERTAIN (human review)
                    │  ([Symbol.x], #name)     │          can't resolve by name
                    └─────────┬───────────────┘
                              │NO
                    ┌─────────▼───────────────┐
                    │  referenceCount > 0?     │──YES──▶  Hunter: live, not flagged
                    └─────────┬───────────────┘
                              │NO (Hunter flags as zombie candidate)
                              │
              ┌───────────────▼────────────────────────────────────┐
              │                  Skeptic veto checks                │
              │                                                     │
              │  ① Re-exported by barrel index.*?  ──YES──▶ ALIVE  │
              │  ② dynamic import() / require()?   ──YES──▶ ALIVE  │
              │  ③ Used in string literal?          ──YES──▶ ALIVE  │
              │  ④ Referenced in *.test.*?          ──YES──▶ ALIVE  │
              │                                                     │
              └───────────────┬─────────────────────────────────────┘
                              │ None of the above (Skeptic could not disprove)
                              │
                    ┌─────────▼───────────────┐
                    │  Confidence scoring      │
                    │  base = isExported?      │
                    │    0.5 (might be API)    │
                    │    0.8 (not exported)    │
                    │  penalty if >60 lines    │
                    └─────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
         conf ≥ 0.7                      conf < 0.7
              │                               │
              ▼                               ▼
            DEAD                          UNCERTAIN
       (zombie 💀)                   (human review 🤔)
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | File-based routing, server components, API routes — one deploy, zero config |
| **Language** | TypeScript 5.5 | End-to-end types from MCP tool schemas to React UI; `tsc` runs at deploy time |
| **Agent Protocol** | MCP (`@modelcontextprotocol/sdk` 1.6) | Decouples reasoning from tool execution; transport-agnostic (in-memory or stdio) |
| **AST Engine** | TypeScript compiler API (bundled) | First-class TS/TSX parsing — exact line ranges, type-aware, no external deps |
| **UI Graph** | React Flow 11 | Interactive call-graph visualization; custom nodes colored by verdict |
| **Styling** | Tailwind CSS 3.4 | Utility-first; zero runtime CSS — ships only what's used |
| **Persistence** | Supabase (PostgreSQL + jsonb) | Saves full HuntResult + summary columns for the Grimoire; swaps for in-memory in dev |
| **Cache** | Redis (stretch) | AST cache keyed by file content hash — skips re-parse across runs and hosts |
| **Hosting** | Vercel (serverless) | No subprocess requirement — MCP runs in-process via `InMemoryTransport` |

---

## Project Structure

```
PhantomJS/
│
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing page + Hunt UI + React Flow graph
│   │   ├── grimoire/page.tsx         # Saved hunts browser (the Grimoire)
│   │   ├── features/page.tsx         # Full capability reference
│   │   ├── layout.tsx                # Root layout + Halloween decorations
│   │   ├── globals.css               # Tailwind base + spooky ambient effects
│   │   └── api/
│   │       ├── hunt/route.ts         # POST /api/hunt → runs the agent loop
│   │       ├── hunts/route.ts        # GET/POST /api/hunts → list / save to Grimoire
│   │       └── hunts/[id]/route.ts   # GET /api/hunts/:id → fetch single saved hunt
│   │
│   ├── components/
│   │   ├── hunt-graph.tsx            # React Flow wrapper (nodes + edges + custom node)
│   │   ├── cot-panel.tsx             # Chain-of-Thought panel (Hunter + Skeptic traces)
│   │   └── halloween-decor.tsx       # Fixed-position ambient Halloween props
│   │
│   ├── lib/
│   │   ├── agent/
│   │   │   ├── agent-loop.ts         # runHunt(): the Hunter/Skeptic/Sandbox pipeline
│   │   │   ├── mcp-client.ts         # connectPhantomServer() via InMemoryTransport
│   │   │   ├── types.ts              # HuntResult, Suspect, GraphNode/Edge, etc.
│   │   │   └── demo.ts               # CLI entry: npm run agent:demo -- <path|url>
│   │   ├── hunts/
│   │   │   ├── store.ts              # HuntStore interface (Supabase or InMemory)
│   │   │   └── types.ts              # SavedHunt, SavedHuntSummary (client-safe)
│   │   ├── mcp/
│   │   │   └── mcp-server.ts         # Re-exports from mcp-server/dist (single SDK)
│   │   ├── github.ts                 # URL parser + tarball fetch → InMemoryRepo
│   │   └── theme.ts                  # Shared verdict color constants
│   │
│   └── data/
│       └── hunts.json                # Dev-mode flat file store for the Grimoire
│
├── mcp-server/                       # Transport-agnostic MCP AST server
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts                  # RepoSource, 8 read-only tools, createPhantomServer()
│
├── sample-repo/                      # Test fixture (dead/alive/barrel/dynamic-import cases)
├── .github/workflows/
│   └── phantom-haunt.yml             # Continuous Haunting: PR comment with zombie report
├── ARCHITECTURE.md                   # Deep-dive design doc
└── vercel.json                       # buildCommand + maxDuration for /api/hunt
```

---

## Quick Start

**Prerequisites:** Node.js 20+, npm 10+

```bash
# 1. Clone and install
git clone https://github.com/your-username/phantom-js.git
cd phantom-js
npm install

# 2. Build the MCP AST server (TypeScript → dist/)
npm run mcp:build

# 3a. Run the CLI agent on a local sample repo
npm run agent:demo -- ./sample-repo

# 3b. Run the CLI agent on a public GitHub repo (no token needed)
npm run agent:demo -- https://github.com/anthropics/anthropic-sdk-typescript/tree/main/src

# 4. Start the web app
npm run dev
# → http://localhost:3000
```

**Optional environment variables** (copy `.env.example` → `.env`):

```bash
GITHUB_TOKEN=ghp_...           # Increases rate limits; required for private repos
ANTHROPIC_API_KEY=sk-ant-...   # Enables real LLM-driven Hunter/Skeptic (deterministic otherwise)
SUPABASE_URL=https://...       # Persistent Grimoire; falls back to flat-file JSON in dev
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## API Reference

### `POST /api/hunt`

Runs the full Hunter → Skeptic → Sandbox pipeline against a repository.

**Request**
```jsonc
{
  "repo": "https://github.com/owner/repo/tree/main/src"
  // OR: "./local/path/to/repo"
}
```

**Response** `200 OK`
```jsonc
{
  "ok": true,
  "result": {
    "repo": {
      "kind": "github",          // "github" | "local"
      "ref": "/tmp/...",         // internal path / branch
      "url": "https://...",
      "filesScanned": 362
    },
    "graph": {
      "nodes": [
        {
          "id": "src/utils.ts:legacyHelper:14",
          "label": "legacyHelper",
          "file": "src/utils.ts",
          "verdict": "dead",     // "dead" | "uncertain" | "alive"
          "isExported": false,
          "referenceCount": 0
        }
      ],
      "edges": [
        { "id": "caller->callee", "source": "...", "target": "..." }
      ]
    },
    "suspects": [
      {
        "id": "src/utils.ts:legacyHelper:14",
        "file": "src/utils.ts",
        "functionName": "legacyHelper",
        "verdict": "dead",
        "confidence": 0.8,
        "referenceCount": 0,
        "referenceKinds": [],
        "reexportedBy": [],
        "hunterTrace": ["Hunter: zero static references — flagging as zombie candidate."],
        "skepticTrace": ["Skeptic: no barrel re-export.", "Skeptic: could not disprove the Hunter — verdict stands."]
      }
    ],
    "summary": {
      "dead": 12,
      "uncertain": 8,
      "alive": 1343,
      "sandbox": { "safe": true, "issues": [], "note": "..." },
      "finops": {
        "removedBundleKB": 14.2,
        "coldStartDeltaMs": 0.28,
        "projectedSavingsUsd": 3.47,
        "buildMinutesSavedPerMonth": 2
      }
    }
  },
  "logs": ["Summoning https://...", "MCP handshake complete...", "Hunt complete — 12 dead..."]
}
```

**Error** `500`
```jsonc
{ "ok": false, "error": "...", "logs": ["..."] }
```

---

### `POST /api/hunts` — Save to the Grimoire

```jsonc
// Request
{ "result": { /* HuntResult from above */ } }

// Response 201
{ "ok": true, "hunt": { "id": "uuid", "createdAt": "..." }, "mode": "memory" }
```

### `GET /api/hunts` — List the Grimoire

Returns all saved hunts, newest first.

### `GET /api/hunts/:id` — Single saved hunt

Returns `404` if not found.

---

## Configuration

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | No | `undefined` | Boosts API rate limits; required for private repos |
| `ANTHROPIC_API_KEY` | No | `undefined` | Real LLM-driven agents; deterministic fallback if unset |
| `SUPABASE_URL` | No | `undefined` | Supabase project URL for persistent Grimoire |
| `SUPABASE_SERVICE_ROLE_KEY` | No | `undefined` | Server-side Supabase key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No | `undefined` | Anon key fallback |

When Supabase is not configured, the Grimoire falls back to `src/data/hunts.json` (dev) or an in-memory `Map` (serverless). All modes use the same `HuntStore` interface.

---

## Safety Properties

Phantom.js is designed so that **a bug or a prompt injection can never delete live code**:

| Guarantee | Mechanism |
|---|---|
| **Read-only by construction** | No write/exec/git tool exists on the MCP server. The agent loop never mutates anything. |
| **Skeptic veto is a hard policy layer** | The disproof checks (dynamic import, barrel, reflection, test usage, computed keys) are code — the LLM cannot override them. |
| **Three-tier verdicts** | `uncertain` cases always go to human review; they are never auto-deleted. |
| **Sandbox gate** | `run_sandbox_check` verifies no surviving code still references a proposed removal. No PR is generated if it fails. |
| **Human-in-the-loop** | PR generation is a separate, approval-gated step. `POST /api/hunt` never pushes anything. |
| **Reversibility** | Every exorcism is a branch + PR. Closing the PR and deleting the branch fully reverses it. |
| **Resource caps** | Tarball ≤ 50 MB, ≤ 2500 files, parse cache ≤ 4000 entries. |

---

## Performance

| Metric | Value | How |
|---|---|---|
| Parse complexity | O(files) | Per-file cached parse; `find_references` reuses the in-memory AST |
| Real repo benchmark | 362 files → 1363 nodes / 5011 edges | `anthropics/anthropic-sdk-typescript/src` |
| Serverless compatibility | ✅ | In-process MCP via `InMemoryTransport` — no subprocess, no stdio on the function |
| Cold start | Minimal | TypeScript compiler is a production dep, bundled by Vercel; no dynamic `require` |
| Tarball fetch | Streaming | `codeload.github.com` → `gunzip` → `untar` in-memory — no `git clone`, no disk I/O |

---

## Deployment

### Vercel (recommended)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com).
2. `vercel.json` configures everything automatically:
   ```json
   {
     "buildCommand": "npm run build",
     "installCommand": "npm install",
     "functions": { "src/app/api/hunt/route.ts": { "maxDuration": 60 } }
   }
   ```
3. Set `GITHUB_TOKEN` and optionally `ANTHROPIC_API_KEY` in Vercel environment variables.
4. Deploy. `POST /api/hunt` runs the full agent in a single serverless function (no subprocess needed).

### Local / Docker

```bash
npm install
npm run build
npm run start
# → http://localhost:3000
```

### GitHub Action — Continuous Haunting

The included `.github/workflows/phantom-haunt.yml` triggers on every pull request touching source files, runs the agent against the checked-out repo, and **posts a Markdown zombie report as a PR comment**:

```yaml
on:
  pull_request:
    paths: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"]
permissions:
  contents: read
  pull-requests: write
```

It is **read-only** — it never pushes. Add an approval-label step to promote a report into an actual exorcism.

---

## Roadmap

| Feature | Status | Notes |
|---|---|---|
| AST zombie detection + call graph | ✅ Done | Full TypeScript compiler API, O(files) cached |
| Multi-agent Hunter → Skeptic trial | ✅ Done | 4-veto policy layer; deterministic without LLM key |
| FinOps projection | ✅ Done | Bundle KB → cold-start Δ → $/mo formula |
| React Flow interactive call graph | ✅ Done | Custom nodes, verdict colors, CoT side panel |
| Grimoire (save / browse past hunts) | ✅ Done | Supabase or flat-file, same interface |
| Continuous Haunting (GitHub Action) | ✅ Done | PR comment report on every source change |
| Real LLM-driven agents | 🔧 Config | Set `ANTHROPIC_API_KEY`; guards remain as veto layer |
| Docker/E2B sandboxed `tsc` + tests | 🗺️ Planned | Replace in-process transitive check with real compile |
| FOCUS billing reconciliation | 🗺️ Planned | Real cloud spend via FOCUS MCP server |
| Redis AST cache | 🗺️ Planned | Cross-run / cross-host cache keyed by content hash |
| `ts.LanguageService` semantic graph | 🗺️ Planned | True type-level reference resolution |

---

## Honest Limitations

> This section exists because engineering maturity means knowing what a system *can't* do.

- **Reference detection is textual + AST, not semantic.** Methods accessed via `obj[dynamicKey]` or `#private` members cannot be resolved by name — they correctly route to `uncertain` (never false-dead), but they won't surface as `dead` either.
- **The sandbox is an in-process transitive check today.** It correctly catches dangling references but does not run the compiler or the test suite. The Docker/E2B integration is the production upgrade.
- **LLM CoT is deterministic in the starter.** Without `ANTHROPIC_API_KEY`, the Hunter and Skeptic are rule-based but fully functional. The LLM adds nuanced reasoning; the hard guards veto it either way.
- **Barrel detection uses directory matching.** A barrel file in a *parent* directory that re-exports a symbol via `export * from './sub/file'` may not be caught unless the intermediate barrel is in the same directory as the function.

---

<div align="center">

Built for the **Kiroween 2026 Hackathon** 🎃

**[Phantom.js](https://github.com/your-username/phantom-js)** · MIT License

*Ghost hunters never rest — there's always more dead code to exorcise.*

</div>
