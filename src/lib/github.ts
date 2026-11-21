/**
 * Phantom.js — GitHub fetcher
 * ============================================================================
 * Turns a public GitHub repository URL into an InMemoryRepo (a Map of
 * relative path -> file content) by downloading the repo tarball from
 * codeload and decompressing it in memory. No git binary, no disk writes,
 * no clone — so it runs on Vercel serverless.
 *
 * Supported URL shapes:
 *   https://github.com/{owner}/{repo}
 *   https://github.com/{owner}/{repo}/tree/{ref}
 *   https://github.com/{owner}/{repo}/tree/{ref}/{subpath}
 *   {owner}/{repo}               (shorthand)
 *   {owner}/{repo}@{ref}         (shorthand)
 *
 * Limits: a max bundle size + a file cap protect the serverless function from
 * enormous repos. For private/large repos, set GITHUB_TOKEN (raises limits and
 * enables private access). See ARCHITECTURE.md §3 (Redis caching) for how to
 * avoid re-fetching unchanged repos.
 */

import { Readable } from "node:stream";
import { extract } from "tar-stream";
import { gunzipSync } from "node:zlib";
import { InMemoryRepo } from "./mcp/mcp-server";

const MAX_TARBALL_BYTES = 50 * 1024 * 1024; // 50 MB guard for the serverless fn
const MAX_FILES = 2500;

interface ParsedUrl {
  owner: string;
  repo: string;
  ref?: string;
  subpath?: string;
}

export function parseGithubUrl(input: string): ParsedUrl {
  const trimmed = input.trim();

  // Shorthand: owner/repo[@ref]
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith("git@")) {
    const [head, ref] = trimmed.split("@");
    const parts = head.split("/");
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1], ref: ref || undefined };
    }
    throw new Error("Could not parse repo shorthand. Use owner/repo or a GitHub URL.");
  }

  const url = new URL(trimmed);
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") {
    throw new Error("Only github.com URLs are supported.");
  }
  const segs = url.pathname.split("/").filter(Boolean); // [owner, repo, "tree", ref, ...subpath]
  if (segs.length < 2) throw new Error("URL must include owner/repo.");

  const owner = segs[0];
  const repo = segs[1].replace(/\.git$/, "");

  if (segs.length >= 4 && segs[2] === "tree") {
    return { owner, repo, ref: segs[3], subpath: segs.slice(4).join("/") || undefined };
  }
  return { owner, repo };
}

function githubHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "phantom-js-ghost-hunter",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function getDefaultBranch(owner: string, repo: string, token?: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: githubHeaders(token),
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { default_branch?: string };
  if (!data.default_branch) throw new Error("Repository has no default branch (empty?).");
  return data.default_branch;
}

function isSourceRel(rel: string): boolean {
  if (rel.endsWith(".d.ts")) return false;
  const segs = rel.split("/");
  if (segs.some((s) => ["node_modules", ".git", "dist", "build", ".next", "coverage", "out", ".vercel"].includes(s))) return false;
  return [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].some((ext) => rel.endsWith(ext));
}

/** Strip the leading top-level dir codeload adds (e.g. `repo-abc123/...`). */
function stripTopDir(name: string): string {
  const idx = name.indexOf("/");
  return idx === -1 ? name : name.slice(idx + 1);
}

/**
 * Download + extract a GitHub tarball into an InMemoryRepo (path -> content).
 */
export async function fetchGitHubRepo(
  url: string,
  opts: { token?: string; onProgress?: (m: string) => void } = {},
): Promise<InMemoryRepo> {
  const log = opts.onProgress ?? (() => {});
  const { owner, repo, ref, subpath } = parseGithubUrl(url);

  const resolvedRef = ref ?? (await getDefaultBranch(owner, repo, opts.token));
  log(`Resolved ${owner}/${repo} @ ${resolvedRef}${subpath ? ` (subpath: ${subpath})` : ""}`);

  const tarballUrl = `https://codeload.github.com/${owner}/${repo}/tar.gz/${resolvedRef}`;
  const res = await fetch(tarballUrl, {
    headers: opts.token ? { Authorization: `token ${opts.token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not download repo tarball (${res.status}): ${tarballUrl}`);

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_TARBALL_BYTES) {
    throw new Error(
      `Repo tarball is ${(arrayBuf.byteLength / 1048576).toFixed(1)} MB — over the ${MAX_TARBALL_BYTES / 1048576} MB demo cap. Try a subpath (…/tree/${resolvedRef}/dir) or a smaller repo.`,
    );
  }
  log(`Downloaded ${(arrayBuf.byteLength / 1048576).toFixed(1)} MB tarball`);

  const tar = gunzipSync(Buffer.from(arrayBuf));
  const files = new Map<string, string>();

  await new Promise<void>((resolve, reject) => {
    const ex = extract();
    ex.on("entry", (header, entry, next) => {
      if (header.type === "file") {
        const rel = stripTopDir(header.name);
        const inSubpath = !subpath || rel === subpath || rel.startsWith(subpath + "/");
        if (isSourceRel(rel) && inSubpath && files.size < MAX_FILES) {
          const chunks: Buffer[] = [];
          entry.on("data", (c: Buffer) => chunks.push(c));
          entry.on("end", () => {
            files.set(rel, Buffer.concat(chunks).toString("utf-8"));
            next();
          });
          return;
        }
      }
      entry.resume();
      entry.on("end", next);
    });
    ex.on("finish", resolve);
    ex.on("error", reject);
    Readable.from(tar).pipe(ex);
  });

  if (files.size === 0) {
    throw new Error("No source files found (the repo/subpath may be empty or non-JS/TS).");
  }
  log(`Extracted ${files.size} source files`);

  return new InMemoryRepo(`${owner}/${repo}@${resolvedRef}`, files);
}
