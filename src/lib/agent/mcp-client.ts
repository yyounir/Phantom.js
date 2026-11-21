/**
 * Phantom.js — MCP Client
 * ============================================================================
 * A thin wrapper around the MCP SDK client that spawns the local Phantom AST
 * server over stdio, completes the handshake, and exposes listTools/callTool.
 *
 * The agent talks to the repo it is analyzing ONLY through this client. There
 * is no other path to the filesystem — that is the security boundary.
 *
 * Transport: stdio (local dev / hackathon demo).
 *   On Vercel serverless you cannot spawn a long-lived stdio subprocess. Swap
 *   StdioClientTransport for the Streamable HTTP transport and host the AST
 *   server as a small HTTP service (or run the agent in a queue worker). The
 *   tool surface and agent loop are unchanged.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as path from "node:path";

/** Where the built server lives after `npm run mcp:build`. */
const SERVER_ENTRY = path.join(process.cwd(), "mcp-server", "dist", "index.js");

export interface PhantomMcpClient {
  /** Return the names of the tools the server advertises. */
  listTools(): Promise<string[]>;
  /** Call a tool and parse its text JSON content into the given type. */
  callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T>;
  /** Close the stdio transport (terminates the server subprocess). */
  close(): Promise<void>;
}

/**
 * Spawn the local AST server and complete the MCP handshake.
 * Throws if the server cannot be started or fails to handshake.
 */
export async function connectPhantomServer(): Promise<PhantomMcpClient> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_ENTRY],
  });

  const client = new Client(
    { name: "phantom-agent", version: "0.1.0" },
    { capabilities: {} },
  );

  await client.connect(transport);

  return {
    async listTools() {
      const res = await client.listTools();
      return (res.tools ?? []).map((t) => t.name);
    },

    async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
      // Cast to a structural shape so we don't depend on the SDK's complex
      // generic callTool overloads (whose inferred type varies across versions).
      const res = (await client.callTool({ name, arguments: args })) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const block = res.content?.find((c) => c.type === "text");
      if (!block || typeof block.text !== "string") {
        throw new Error(`Tool "${name}" returned no text content`);
      }
      return JSON.parse(block.text) as T;
    },

    async close() {
      await transport.close();
    },
  };
}
