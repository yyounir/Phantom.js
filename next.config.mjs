/** @type {import('next').NextConfig} */
const nextConfig = {
  // The exorcise route spawns a stdio subprocess to the MCP server, so it must
  // run on the Node.js runtime (not the Edge runtime) during local dev.
  // In production, swap stdio for Streamable HTTP transport (see ARCHITECTURE.md §5).
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
