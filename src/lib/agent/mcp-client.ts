/**
 * Phantom.js — MCP Client (in-process / serverless)
 * ============================================================================
 * Links an in-memory MCP client+server pair so the agent can call the AST/
 * FinOps/sandbox tools WITHOUT spawning a subprocess. This is what makes the
 * agent runnable on Vercel serverless (stdio + long-lived children are not
 * available there).
 *
 * The decoupling is preserved: the agent only ever sees the finite, read-only
 * tool surface advertised by the server. It cannot touch the filesystem or
 * shell directly — only call vetted tools with bounded inputs.
 *
 * For a fully network-decoupled deploy, swap InMemoryTransport for the
 * Streamable HTTP transport (host the AST server as a small HTTP service).
 * The tool surface and the agent loop are unchanged.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPhantomServer, type RepoSource } from "../mcp/mcp-server";

export interface PhantomMcpClient {
  listTools(): Promise<string[]>;
  callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T>;
  close(): Promise<void>;
}

/**
 * Build an in-memory MCP server over `repo` and link a client to it.
 * Both live in the current process; the protocol contract is unchanged.
 */
export async function connectPhantomServer(repo: RepoSource): Promise<PhantomMcpClient> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = createPhantomServer(repo);
  await server.connect(serverTransport);

  const client = new Client(
    { name: "phantom-agent", version: "0.1.0" },
    { capabilities: {} },
  );
  await client.connect(clientTransport);

  return {
    async listTools() {
      const res = await client.listTools();
      return (res.tools ?? []).map((t) => t.name);
    },

    async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
      // Structural cast — don't depend on the SDK's complex callTool overloads.
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
      try {
        await (client as unknown as { close?: () => Promise<void> }).close?.();
      } catch {
        /* ignore */
      }
      try {
        await (server as unknown as { close?: () => Promise<void> }).close?.();
      } catch {
        /* ignore */
      }
    },
  };
}
