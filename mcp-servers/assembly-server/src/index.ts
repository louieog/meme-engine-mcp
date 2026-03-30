#!/usr/bin/env node
/**
 * Video Assembly MCP Server
 * 
 * A Model Context Protocol server that provides tools for video assembly
 * using ffmpeg. Wraps the Python video_assembly.py module.
 * 
 * Usage:
 *   npm install
 *   npm run build
 *   node dist/index.js
 * 
 * Environment Variables:
 *   ASSEMBLY_OUTPUT_DIR - Default output directory for assembled videos
 *   FFMPEG_PATH - Path to ffmpeg executable (default: "ffmpeg")
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./tools.js";
import { AssemblyClientWrapper } from "./assembly-client.js";

// Initialize client with output directory from environment
const outputDir = process.env.ASSEMBLY_OUTPUT_DIR || "/tmp/mcp-assembly";
const client = new AssemblyClientWrapper(outputDir);

// Create MCP server
const server = new Server(
  { name: "video-assembly", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[Assembly Server] Executing tool: ${name}`);
  console.error(`[Assembly Server] Args: ${JSON.stringify(args)}`);

  try {
    const result = await client.executeTool(name, args);

    console.error(`[Assembly Server] Tool ${name} completed successfully`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Assembly Server] Tool ${name} failed: ${errorMessage}`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: errorMessage,
          tool: name,
          timestamp: new Date().toISOString()
        }, null, 2)
      }],
      isError: true
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();

  console.error("=" .repeat(60));
  console.error("Video Assembly MCP Server v1.0.0");
  console.error("=" .repeat(60));
  console.error(`Output Directory: ${outputDir}`);
  console.error(`FFmpeg: ${process.env.FFMPEG_PATH || "ffmpeg (default)"}`);
  console.error("Available tools:");
  for (const tool of TOOLS) {
    console.error(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
  }
  console.error("=" .repeat(60));
  console.error("Server ready. Waiting for requests...");

  await server.connect(transport);
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Assembly Server] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Assembly Server] Unhandled rejection:", reason);
});

main().catch((error) => {
  console.error("[Assembly Server] Failed to start:", error);
  process.exit(1);
});
