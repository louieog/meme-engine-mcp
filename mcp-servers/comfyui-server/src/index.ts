#!/usr/bin/env node
/**
 * ComfyUI Cloud MCP Server
 * 
 * A Model Context Protocol server that provides tools for interacting
 * with ComfyUI Cloud API. Wraps the Python comfyui_client.py module.
 * 
 * Usage:
 *   npm install
 *   npm run build
 *   node dist/index.js
 * 
 * Environment Variables:
 *   COMFY_CLOUD_API_KEY - Your ComfyUI Cloud API key (required)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./tools.js";
import { ComfyClientWrapper } from "./comfy-client.js";

// Initialize client with API key from environment
const apiKey = process.env.COMFY_CLOUD_API_KEY || "";
if (!apiKey) {
  console.error("WARNING: COMFY_CLOUD_API_KEY not set. Some tools may fail.");
}

const client = new ComfyClientWrapper(apiKey);

// Create MCP server
const server = new Server(
  { name: "comfyui-cloud", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[ComfyUI Server] Executing tool: ${name}`);
  console.error(`[ComfyUI Server] Args: ${JSON.stringify(args)}`);
  
  try {
    const result = await client.executeTool(name, args);
    
    console.error(`[ComfyUI Server] Tool ${name} completed successfully`);
    
    return {
      content: [{ 
        type: "text", 
        text: JSON.stringify(result, null, 2) 
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ComfyUI Server] Tool ${name} failed: ${errorMessage}`);
    
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
  
  console.error("=".repeat(60));
  console.error("ComfyUI Cloud MCP Server v1.0.0");
  console.error("=".repeat(60));
  console.error(`API Key: ${apiKey ? "***" + apiKey.slice(-4) : "NOT SET"}`);
  console.error("Available tools:");
  for (const tool of TOOLS) {
    console.error(`  - ${tool.name}: ${tool.description.slice(0, 60)}...`);
  }
  console.error("=".repeat(60));
  console.error("Server ready. Waiting for requests...");
  
  await server.connect(transport);
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[ComfyUI Server] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[ComfyUI Server] Unhandled rejection:", reason);
});

main().catch((error) => {
  console.error("[ComfyUI Server] Failed to start:", error);
  process.exit(1);
});
