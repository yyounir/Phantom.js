## Inspiration
Dead code ("zombie functions") and bloated packages ("vampire dependencies") silently accumulate in almost every production codebase. They slow down CI/CD builds, inflate serverless bundle sizes, increase cold-start latency, and expand the CVE security surface—yet teams rarely clean them up because naive grep-based tools produce too many false positives and deleting live code is catastrophic. For the Kiroween 2026 Hackathon, we wanted to build an enterprise-grade FinOps and codebase-analysis agent that turns dead-code cleanup into a safe, auditable, and quantifiable cloud-cost savings lever.

## What it does
**Phantom.js is a multi-agent AI system built on the Model Context Protocol (MCP) that answers one question: "What code in this repository can be safely deleted, and how much will removing it save in cloud compute costs?"**
- **Summon & Scan**: Accepts any local directory or public GitHub repository URL, streaming and untarring GitHub repos entirely in memory with zero disk writes.
- **AST-Powered Analysis**: Uses the TypeScript compiler API at runtime to extract function declarations, call graphs, and comment-aware references across .ts, .tsx, .js, and .jsx files.
- **Two-Agent Adversarial Trial (Hunter → Skeptic)**: A Hunter agent flags zero-reference zombie candidates, and a Skeptic agent actively tries to disprove every flag using deterministic veto checks (barrel index.* re-exports, dynamic import() / require(), string-literal reflection, and test-only references).
- **Three-Tier Verdicts & Interactive Graph**: Classifies every function as Dead, Uncertain (routed to human review), or Alive, rendered in an interactive React Flow call graph with expandable Chain-of-Thought traces.
- **Sandbox & FinOps Projection**: Runs an in-process transitive reference check before projecting bundle KB removed, cold-start delta (ms), build minutes saved, and monthly cloud savings ($/mo).
- **Grimoire & Continuous Haunting**: Persists past hunts in Supabase (PostgreSQL) (with flat-file JSON and in-memory fallbacks) and includes a read-only GitHub Action (phantom-haunt.yml) that posts automated zombie reports on pull requests.

## How I built it
We built Phantom.js with Next.js 14 (App Router), TypeScript 5.5, Tailwind CSS, React Flow, Supabase, and the Model Context Protocol (@modelcontextprotocol/sdk), deployed on Vercel.

To enforce strict security boundaries, we decoupled agent reasoning from tool execution via MCP. The agent loop never touches the filesystem or shell directly—it can only invoke 8 read-only MCP tools (```list_source_files```, ```run_ast_parser```, ```find_references```, ```list_exports```, ```get_calls```, ```get_imports```, ```run_sandbox_check```, and ```estimate_finops_impact```).

Kiro IDE and Kiro AI (running in Vibe mode with dynamic Auto model selection) were used to design, scaffold, test, and refine the initial full-stack foundation from an empty workspace. Starting from an architectural prompt, Kiro authored ```ARCHITECTURE.md```, built the read-only Node.js MCP AST server and Next.js agent client, created a ```sample-repo/``` fixture with tricky edge cases, ran live end-to-end verification, and configured Tailwind CSS to spin up the initial Halloween-themed dashboard. From there, we expanded the architecture to support serverless in-memory MCP transport, streaming GitHub tarball ingestion, the Hunter → Skeptic trial, React Flow call graphs, and Supabase persistence.

## Challenges I ran into
- **Serverless MCP Transport**: Spawning a local stdio subprocess for an MCP server works locally, but fails on Vercel serverless functions. We solved this by making createPhantomServer() transport-agnostic and using InMemoryTransport.createLinkedPair(), allowing the full MCP client-server handshake to run in-process on Vercel with zero subprocesses.
- **Comment-Matching Noise**: During early end-to-end testing on sample-repo/, our reference scanner matched symbol names inside code comments, inflating reference counts and polluting reasoning traces. We refactored find_references to use the TypeScript compiler's trivia API (forEachLeadingCommentRange / forEachTrailingCommentRange) to strip comment ranges accurately.
- **MCP SDK Type Overloads**: Strict TypeScript compilation (tsc --noEmit) surfaced type errors where the MCP SDK's generic callTool return type collapsed to {}. We resolved this with a clean structural type guard so the client remains resilient across SDK versions.
- **Preventing False Positives**: Distinguishing truly dead code from dynamically imported functions, barrel re-exports, or computed property keys (#private, [Symbol.x]) required building a hard policy layer in the Skeptic agent that the LLM cannot override.

## Accomplishments that I'm proud of
- **Read-Only Security by Construction**: Even if a scanned repository contains a prompt injection, the agent's blast radius is strictly bounded to read-only AST tools—no write_file, exec, or git tools exist on the MCP server.
- **Real-World Scale**: Benchmarked live on anthropics/anthropic-sdk-typescript/src, scanning 362 files and mapping 1,363 nodes and 5,011 call-graph edges in a single serverless request.
- **Zero-Config Fallbacks**: The agent runs fully deterministically without requiring an ANTHROPIC_API_KEY, and the Grimoire seamlessly swaps between Supabase, local JSON, and in-memory storage via a unified HuntStore interface.

## What I learned
- **MCP is a powerful security seam**: Decoupling judgment (the agent loop) from mechanics (the AST server) makes AI systems auditable, portable, and safe by default.
- **Deterministic guards beat prompt engineering alone**: Pairing Chain-of-Thought reasoning with a code-enforced Skeptic veto layer is the only reliable way to eliminate catastrophic false positives in automated refactoring.
- **AST > Regex**: Leveraging the TypeScript compiler API at runtime—especially its trivia API for comments—eliminates entire classes of noisy edge cases that break naive text scanners.

## What's next for Phantom.js
- **Sandboxed Compilation & Tests:** Upgrading the in-process transitive check to a full Docker/E2B sandbox that runs tsc and the repository's test suite before opening a PR.
- **Semantic Type-Level Graph:** Integrating ts.LanguageService for full semantic reference resolution across parent-directory barrel re-exports and class hierarchies.
- **Redis AST Caching:** Caching parsed ASTs by file content hash across runs and serverless instances for near-instant repeat scans.
- **FOCUS Billing Reconciliation:** Connecting a FOCUS FinOps MCP server to reconcile projected dead-code savings against real cloud billing data.