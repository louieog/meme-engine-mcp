// meme-engine-server/src/claude-orchestrator.ts
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { MCPClientWrapper } from "./mcp-client-wrapper.js";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export class ClaudeOrchestrator {
  private anthropic: Anthropic;
  private mcp: MCPClientWrapper;
  private pipelineId: string;

  constructor(pipelineId: string) {
    this.pipelineId = pipelineId;
    this.anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    this.mcp = new MCPClientWrapper();
  }

  async run(requestData: any): Promise<void> {
    try {
      // Connect to MCP servers
      await this.mcp.connectAll();

      // Build tools list from MCP servers
      const tools = await this.buildToolsList();

      // Initial message with request
      const messages: Anthropic.MessageParam[] = [
        {
          role: "user",
          content: this.buildInitialPrompt(requestData),
        },
      ];

      // Main conversation loop
      let response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: this.getSystemPrompt(),
        tools,
        messages,
      });

      // Handle tool calls until completion
      while (response.stop_reason === "tool_use") {
        // Log assistant response
        await this.logMessage("assistant", response.content);

        // Execute tool calls
        const toolResults = await this.executeToolCalls(response.content);

        // Add tool results to messages
        messages.push({
          role: "assistant",
          content: response.content,
        });

        for (const result of toolResults) {
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: result.toolUseId,
                content: JSON.stringify(result.result),
              },
            ],
          });
        }

        // Log tool results
        await this.logMessage("user", toolResults.map(r => ({
          type: "tool_result",
          tool_use_id: r.toolUseId,
          content: `Result: ${JSON.stringify(r.result).slice(0, 200)}...`,
        })));

        // Update status
        await this.updateStatus("generating", 50, "Executing tool calls...");

        // Continue conversation
        response = await this.anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: this.getSystemPrompt(),
          tools,
          messages,
        });
      }

      // Log final response
      await this.logMessage("assistant", response.content);

      // Mark complete
      await this.updateStatus("completed", 100, "Video generation complete!");

    } catch (error) {
      console.error(`Pipeline ${this.pipelineId} failed:`, error);
      await this.updateStatus("failed", 0, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
      throw error;
    } finally {
      await this.mcp.disconnect();
    }
  }

  private async buildToolsList(): Promise<Anthropic.Tool[]> {
    const tools: Anthropic.Tool[] = [];

    // Get tools from MCP servers
    const comfyClient = this.mcp.getClient("comfyui");
    const assemblyClient = this.mcp.getClient("assembly");

    if (comfyClient) {
      // These are the tools Claude can call
      tools.push(
        {
          name: "generate_image",
          description: "Generate an image using ComfyUI Cloud",
          input_schema: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Visual description" },
              model: { type: "string", description: "Model key from registry" },
              aspect_ratio: { type: "string", enum: ["9:16", "16:9", "1:1", "4:5"] },
              output_prefix: { type: "string" },
            },
            required: ["prompt", "model"],
          },
        },
        {
          name: "generate_video",
          description: "Generate video from image using ComfyUI Cloud",
          input_schema: {
            type: "object",
            properties: {
              image_path: { type: "string" },
              prompt: { type: "string", description: "Motion description" },
              model: { type: "string" },
              duration: { type: "number" },
              aspect_ratio: { type: "string" },
              include_audio: { type: "boolean" },
            },
            required: ["image_path", "prompt", "model"],
          },
        },
        {
          name: "text_to_speech",
          description: "Generate TTS audio using ElevenLabs",
          input_schema: {
            type: "object",
            properties: {
              text: { type: "string" },
              voice: { type: "string" },
              scene_id: { type: "number" },
            },
            required: ["text"],
          },
        },
        {
          name: "upload_file",
          description: "Upload a file to ComfyUI Cloud",
          input_schema: {
            type: "object",
            properties: {
              file_path: { type: "string" },
            },
            required: ["file_path"],
          },
        },
        {
          name: "get_job_status",
          description: "Check status of a ComfyUI job",
          input_schema: {
            type: "object",
            properties: {
              prompt_id: { type: "string" },
            },
            required: ["prompt_id"],
          },
        }
      );
    }

    if (assemblyClient) {
      tools.push(
        {
          name: "assemble_full_video",
          description: "Assemble final video from scenes using ffmpeg",
          input_schema: {
            type: "object",
            properties: {
              scenes: { type: "array" },
              pipeline_id: { type: "string" },
            },
            required: ["scenes", "pipeline_id"],
          },
        },
        {
          name: "export_format",
          description: "Export video in specific aspect ratio",
          input_schema: {
            type: "object",
            properties: {
              video_path: { type: "string" },
              aspect_ratio: { type: "string" },
              output_path: { type: "string" },
            },
            required: ["video_path", "aspect_ratio", "output_path"],
          },
        },
        {
          name: "generate_thumbnail",
          description: "Generate thumbnail from video",
          input_schema: {
            type: "object",
            properties: {
              video_path: { type: "string" },
              output_path: { type: "string" },
            },
            required: ["video_path"],
          },
        }
      );
    }

    return tools;
  }

  private async executeToolCalls(content: any[]): Promise<{ toolUseId: string; result: any }[]> {
    const results = [];

    for (const block of content) {
      if (block.type === "tool_use") {
        const { id, name, input } = block;
        console.log(`[Tool] Executing: ${name}`);

        let result;
        try {
          // Route to appropriate MCP server
          if (["generate_image", "generate_video", "text_to_speech", "upload_file", "get_job_status"].includes(name)) {
            result = await this.mcp.callTool("comfyui", name, input);
          } else if (["assemble_full_video", "export_format", "generate_thumbnail"].includes(name)) {
            result = await this.mcp.callTool("assembly", name, input);
          } else {
            throw new Error(`Unknown tool: ${name}`);
          }
        } catch (error) {
          result = { error: error instanceof Error ? error.message : "Tool execution failed" };
        }

        results.push({ toolUseId: id, result });
      }
    }

    return results;
  }

  private async updateStatus(status: string, progress: number, currentStage: string): Promise<void> {
    const statusPath = path.resolve(process.cwd(), "..", "requests", `${this.pipelineId}.status.json`);
    
    const statusData = {
      id: this.pipelineId,
      status,
      progress,
      currentStage,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(statusPath, JSON.stringify(statusData, null, 2));
  }

  private async logMessage(role: string, content: any): Promise<void> {
    const logPath = path.resolve(process.cwd(), "..", "requests", `${this.pipelineId}.log.json`);
    
    let logs: any = { messages: [] };
    try {
      const existing = await fs.readFile(logPath, 'utf-8');
      logs = JSON.parse(existing);
    } catch {
      // File doesn't exist yet
    }

    logs.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    await fs.writeFile(logPath, JSON.stringify(logs, null, 2));
  }

  private buildInitialPrompt(requestData: any): string {
    return `
You are orchestrating a meme video generation pipeline.

USER REQUEST:
Concept: ${requestData.request.concept}
Format: ${requestData.request.format}
Style: ${requestData.request.style}
Duration: ${requestData.request.duration_target}s
Aspect Ratios: ${requestData.request.aspect_ratios.join(", ")}

Your task is to:
1. First, generate a production brief with 2-5 scenes
2. Then generate all assets (images, videos, audio if needed)
3. Assemble the final video

Use the available tools to execute each step. Generate the brief first, then proceed to asset generation.
`;
  }

  private getSystemPrompt(): string {
    return `
You are the orchestrator for a viral meme video engine.

Available tools:
- generate_image: Create images for scenes
- generate_video: Create videos from images
- text_to_speech: Generate voice audio
- upload_file: Upload files to ComfyUI
- assemble_full_video: Combine all scenes
- export_format: Create different aspect ratios
- generate_thumbnail: Create poster image

Workflow:
1. Create a brief with scenes (HOOK, SETUP, ESCALATION, PUNCHLINE)
2. Generate images for each scene
3. Generate videos from images
4. Generate audio if needed
5. Assemble final video
6. Export in requested formats

Rules:
- Each scene should be 3-15 seconds
- Use hard cuts between scenes
- Keep dialogue under 8 words per line
- Make the punchline screenshot-worthy
`;
  }
}
