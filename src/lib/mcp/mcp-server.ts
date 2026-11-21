/**
 * App -> mcp-server bridge.
 *
 * The mcp-server package is the single source of truth for the AST/FinOps/sandbox
 * tools. We import its BUILT output (dist) rather than spawning a subprocess, so
 * the same tools run in-process on Vercel via InMemoryTransport (no stdio, no
 * long-lived subprocess — both impossible on serverless).
 *
 * `export *` re-exports every value + type the app needs:
 *   createPhantomServer, RepoSource, LocalDiskRepo, InMemoryRepo, and the
 *   tool-result interfaces (FunctionInfo, ReferenceMatch, FinopsResult, ...).
 *
 * Build order: `npm run mcp:build` must run before `next dev`/`next build`/the
 * demo. The root `dev`/`build`/`mcp:build` scripts enforce this.
 */
export * from "../../../mcp-server/dist/index.js";
