#!/usr/bin/env node
/**
 * Meme Engine MCP Server
 * 
 * High-level orchestration server for end-to-end meme video generation.
 * Coordinates between ComfyUI and Assembly MCP servers.
 * 
 * Usage:
 *   npm install
 *   npm run build
 *   node dist/index.js
 * 
 * Environment Variables:
 *   MEME_ENGINE_OUTPUT_DIR - Default output directory
 *   COMFY_SERVER_PATH - Path to comfyui-server binary
 *   ASSEMBLY_SERVER_PATH - Path to assembly-server binary
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./tools.js";
import { MemeEngineOrchestrator } from "./orchestrator.js";

// Initialize orchestrator
const outputDir = process.env.MEME_ENGINE_OUTPUT_DIR || "/tmp/meme-engine";
const orchestrator = new MemeEngineOrchestrator(outputDir);

// Create MCP server
const server = new Server(
  { name: "meme-engine", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[Meme Engine] Executing tool: ${name}`);
  console.error(`[Meme Engine] Args: ${JSON.stringify(args)}`);

  try {
    let result: any;

    // Route to appropriate orchestrator method
    switch (name) {
      case "research_trends":
        result = await orchestrator.researchTrends(args);
        break;
      case "create_production_brief":
        result = await orchestrator.createProductionBrief(args);
        break;
      case "generate_meme_video":
        result = await orchestrator.generateMemeVideo(args);
        break;
      case "generate_scene_assets":
        result = await orchestrator.generateSceneAssets(args);
        break;
      case "add_text_hooks":
        result = await orchestrator.addTextHooks(args);
        break;
      case "get_pipeline_status":
        result = await orchestrator.getPipelineStatus(args);
        break;
      case "list_available_models":
        result = await orchestrator.listAvailableModels(args);
        break;
      case "validate_brief":
        result = await orchestrator.validateBrief(args);
        break;
      case "estimate_cost":
        result = await orchestrator.estimateCost(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    console.error(`[Meme Engine] Tool ${name} completed successfully`);

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Meme Engine] Tool ${name} failed: ${errorMessage}`);

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
  console.error("Meme Engine MCP Server v1.0.0");
  console.error("=".repeat(60));
  console.error(`Output Directory: ${outputDir}`);
  console.error(`Comfy Server: ${process.env.COMFY_SERVER_PATH || "comfyui-server"}`);
  console.error(`Assembly Server: ${process.env.ASSEMBLY_SERVER_PATH || "assembly-server"}`);
  console.error("Available tools:");
  for (const tool of TOOLS) {
    console.error(`  - ${tool.name}: ${tool.description.slice(0, 55)}...`);
  }
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
