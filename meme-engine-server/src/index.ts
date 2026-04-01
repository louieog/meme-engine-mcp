#!/usr/bin/env node
/**
 * Meme Engine Server with Claude Orchestration
 * 
 * High-level orchestration server using Claude with MCP tool integration.
 * Coordinates between ComfyUI and Assembly MCP servers.
 * 
 * Usage:
 *   npm install
 *   npm run build
 *   node dist/index.js
 * 
 * Environment Variables:
 *   ANTHROPIC_API_KEY - Required for Claude API
 *   MEME_ENGINE_OUTPUT_DIR - Default output directory
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ClaudeOrchestrator } from "./claude-orchestrator.js";

// Create MCP server
const server = new Server(
  { name: "meme-engine-claude", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Available tools for direct MCP usage
const TOOLS = [
  {
    name: "generate_meme_video",
    description: "Generate a viral meme video using Claude orchestration",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "object",
          properties: {
            concept: { type: "string", description: "The meme concept or idea" },
            format: { type: "string", enum: ["meme", "story", "tutorial", "ad"] },
            style: { type: "string", description: "Visual style (e.g., 'anime', 'realistic', 'cartoon')" },
            duration_target: { type: "number", description: "Target duration in seconds" },
            aspect_ratios: { type: "array", items: { type: "string" } },
          },
          required: ["concept", "format"],
        },
      },
      required: ["request"],
    },
  },
  {
    name: "get_pipeline_status",
    description: "Get the status of a pipeline by ID",
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { type: "string" },
      },
      required: ["pipeline_id"],
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[Meme Engine] Executing tool: ${name}`);

  try {
    let result: any;
    
    switch (name) {
      case "generate_meme_video": {
        const pipelineId = `pipeline-${Date.now()}`;
        const orchestrator = new ClaudeOrchestrator(pipelineId);
        
        // Run orchestration asynchronously
        orchestrator.run(args).catch(console.error);
        
        result = {
          pipeline_id: pipelineId,
          status: "started",
          message: "Video generation pipeline started with Claude orchestration",
        };
        break;
      }
      
      case "get_pipeline_status": {
        // Status is managed by the orchestrator via status files
        result = {
          pipeline_id: args?.pipeline_id,
          status: "unknown",
          message: "Use status file to track pipeline progress",
        };
        break;
      }
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Meme Engine] Tool ${name} failed:`, errorMessage);

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
  console.error("Meme Engine Server with Claude Orchestration v1.0.0");
  console.error("=".repeat(60));
  console.error(`Output Directory: ${process.env.MEME_ENGINE_OUTPUT_DIR || "./output"}`);
  console.error(`API Key: ${process.env.ANTHROPIC_API_KEY ? "configured" : "NOT SET"}`);
  console.error("=".repeat(60));
  console.error("Server ready. Waiting for requests...");

  await server.connect(transport);
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Meme Engine] Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Meme Engine] Unhandled rejection:", reason);
});

main().catch((error) => {
  console.error("[Meme Engine] Failed to start:", error);
  process.exit(1);
});
