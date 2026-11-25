# `.kiro` Directory — Phantom.js

This directory contains project history, specifications, and steering context for the **Kiro AI Development Environment** and collaborative AI agents.

## Directory Contents

| Path | Purpose |
|---|---|
| [`CHANGELOG.md`](./CHANGELOG.md) | Exhaustive chronological log of all chat turns, prompt requests, decisions, and Git commits. |
| [`changes.md`](./changes.md) | Quick summary of all code changes and features added throughout the project. |
| [`steering/project-history.md`](./steering/project-history.md) | Permanent steering document and architecture guidelines loaded into Kiro AI agent context. |
| [`specs/project-evolution.md`](./specs/project-evolution.md) | Spec-driven development document mapping out requirements, design, and verification phases. |

## Context for Kiro Agents

When working on Phantom.js in Kiro:
1. Always preserve the **read-only MCP boundary** for the AST parser.
2. In serverless routes (Next.js App Router on Vercel), always use `InMemoryTransport` via `src/lib/mcp/mcp-server.ts`. Never spawn background child processes.
3. Keep the **resilient offline storage guarantee** in `src/lib/hunts/store.ts` so the application runs seamlessly with or without Supabase credentials.
