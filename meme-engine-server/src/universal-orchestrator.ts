// meme-engine-server/src/universal-orchestrator.ts
// Model-agnostic orchestrator using LLM adapters

import fs from "fs/promises";
import path from "path";
import { MCPClientWrapper } from "./mcp-client-wrapper.js";
import {
  LLMProvider,
  ToolDefinition,
  ToolCall,
  ToolResult,
  LLMMessage,
  LLMConfig,
  getLLMProviderFromEnv,
  createLLMProvider,
} from "../../src/llm-adapters.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "../../src/orchestrator-prompt.js";

export class UniversalOrchestrator {
  private llm: LLMProvider;
  private mcp: MCPClientWrapper;
  private pipelineId: string;
  private providerName: string;

  constructor(pipelineId: string, provider?: string, apiKey?: string) {
    this.pipelineId = pipelineId;
    this.providerName = provider || process.env.LLM_PROVIDER || "claude";
    
    // Initialize LLM provider
    if (provider && apiKey) {
      this.llm = createLLMProvider(provider, apiKey);
    } else {
      this.llm = getLLMProviderFromEnv();
    }
    
    this.mcp = new MCPClientWrapper();
  }

  async run(requestData: any): Promise<void> {
    try {
      console.log(`[Pipeline ${this.pipelineId}] Starting with ${this.providerName}...`);
      
      // Connect to MCP servers
      await this.mcp.connectAll();

      // Build tools from MCP servers
      const tools = await this.buildToolsList();

      // Initial conversation
      const messages: LLMMessage[] = [
        {
          role: "user",
          content: this.buildInitialPrompt(requestData),
        },
      ];

      // LLM configuration
      const config: LLMConfig = {
        model: this.getModelName(),
        max_tokens: 4096,
        temperature: 0.7,
        system: ORCHESTRATOR_SYSTEM_PROMPT,
      };

      // Start conversation
      let response = await this.llm.generate(messages, tools, config);

      // Tool calling loop
      let iteration = 0;
      const maxIterations = 50; // Safety limit

      while (response.stop_reason === "tool_calls" && iteration < maxIterations) {
        iteration++;
        console.log(`[Pipeline ${this.pipelineId}] Tool iteration ${iteration}`);

        // Log assistant response
        await this.logMessage("assistant", response.content);

        // Execute tool calls
        const toolCalls = response.tool_calls || [];
        const toolResults = await this.executeToolCalls(toolCalls);

        // Add to conversation
        messages.push({
          role: "assistant",
          content: response.content,
        });

        // Continue with tool results
        response = await this.llm.generateWithTools(
          messages,
          tools,
          toolResults,
          config
        );

        // Log tool results summary
        await this.logMessage("user", toolResults.map(tr => ({
          tool_call_id: tr.tool_call_id,
          status: tr.error ? "error" : "success",
          summary: tr.error ? tr.error.slice(0, 100) : "Completed",
        })));

        // Update status
        await this.updateStatusFromResponse(response, iteration);
      }

      // Log final response
      await this.logMessage("assistant", response.content);

      // Mark complete
      await this.updateStatus(
        "completed",
        100,
        "Video generation complete!",
        { outputs: await this.getOutputFiles() }
      );

      console.log(`[Pipeline ${this.pipelineId}] Complete!`);

    } catch (error) {
      console.error(`[Pipeline ${this.pipelineId}] Failed:`, error);
      await this.updateStatus(
        "failed",
        0,
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        { error: error instanceof Error ? error.message : "Unknown" }
      );
      throw error;
    } finally {
      await this.mcp.disconnect();
    }
  }

  private async buildToolsList(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = [];

    // ComfyUI tools
    tools.push(
      {
        name: "generate_image",
        description: "Generate an image using ComfyUI Cloud. Returns file path to generated image.",
        input_schema: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Detailed visual description for the image" },
            model: { type: "string", description: "Model key from MODEL_REGISTRY (e.g., 'GeminiImage2Node:gemini-3-pro-image-preview')" },
            aspect_ratio: { type: "string", enum: ["9:16", "16:9", "1:1", "4:5"], default: "9:16" },
            output_prefix: { type: "string", description: "Filename prefix for output" },
            seed: { type: "number", description: "Random seed for reproducibility" },
          },
          required: ["prompt", "model"],
        },
      },
      {
        name: "generate_video",
        description: "Generate video from an image using ComfyUI Cloud. Returns file path to generated video.",
        input_schema: {
          type: "object",
          properties: {
            image_path: { type: "string", description: "Path to input image file" },
            prompt: { type: "string", description: "Motion description - what should happen in the video" },
            model: { type: "string", description: "Model key from MODEL_REGISTRY" },
            duration: { type: "number", description: "Video duration in seconds (3-15)", default: 5 },
            aspect_ratio: { type: "string", enum: ["9:16", "16:9"], default: "9:16" },
            include_audio: { type: "boolean", description: "Whether to include native audio generation", default: false },
            output_prefix: { type: "string" },
          },
          required: ["image_path", "prompt", "model"],
        },
      },
      {
        name: "text_to_speech",
        description: "Generate TTS audio using ElevenLabs. Returns file path to audio file.",
        input_schema: {
          type: "object",
          properties: {
            text: { type: "string", description: "Text to speak" },
            voice: { type: "string", description: "Voice name (e.g., 'George (male, british)')", default: "George (male, british)" },
            scene_id: { type: "number", description: "Scene identifier for organization" },
            line_index: { type: "number", description: "Line index within scene" },
          },
          required: ["text"],
        },
      },
      {
        name: "lip_sync",
        description: "Synchronize audio to video using lip sync model. Returns file path to synchronized video.",
        input_schema: {
          type: "object",
          properties: {
            video_path: { type: "string", description: "Path to video file" },
            audio_path: { type: "string", description: "Path to audio file" },
            model: { type: "string", description: "Lip sync model to use", default: "KlingLipSyncAudioToVideoNode" },
          },
          required: ["video_path", "audio_path"],
        },
      },
      {
        name: "upload_file",
        description: "Upload a file to ComfyUI Cloud storage. Returns cloud filename for use in workflows.",
        input_schema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Local file path to upload" },
          },
          required: ["file_path"],
        },
      },
      {
        name: "get_job_status",
        description: "Check the status of a running ComfyUI job.",
        input_schema: {
          type: "object",
          properties: {
            prompt_id: { type: "string", description: "Job ID from a previous submission" },
          },
          required: ["prompt_id"],
        },
      }
    );

    // Assembly tools
    tools.push(
      {
        name: "assemble_full_video",
        description: "Assemble final video from scenes using ffmpeg. Combines all clips with transitions.",
        input_schema: {
          type: "object",
          properties: {
            scenes: {
              type: "array",
              description: "Array of scene objects with video paths and metadata",
              items: {
                type: "object",
                properties: {
                  video_path: { type: "string" },
                  audio_path: { type: "string" },
                  duration: { type: "number" },
                  text_overlay: { type: "string" },
                },
              },
            },
            pipeline_id: { type: "string" },
            background_audio: { type: "string", description: "Optional background music path" },
          },
          required: ["scenes", "pipeline_id"],
        },
      },
      {
        name: "export_format",
        description: "Export video in specific aspect ratio (e.g., 9:16 for mobile, 16:9 for desktop).",
        input_schema: {
          type: "object",
          properties: {
            video_path: { type: "string", description: "Input video path" },
            aspect_ratio: { type: "string", enum: ["9:16", "16:9", "1:1", "4:5"] },
            output_path: { type: "string", description: "Output file path" },
          },
          required: ["video_path", "aspect_ratio", "output_path"],
        },
      },
      {
        name: "generate_thumbnail",
        description: "Extract a thumbnail frame from a video. Returns file path to thumbnail image.",
        input_schema: {
          type: "object",
          properties: {
            video_path: { type: "string" },
            output_path: { type: "string" },
            time_seconds: { type: "number", description: "Time to extract frame (default: 1s)", default: 1 },
          },
          required: ["video_path"],
        },
      },
      {
        name: "add_text_overlay",
        description: "Burn text onto a video at specified position and time.",
        input_schema: {
          type: "object",
          properties: {
            video_path: { type: "string" },
            output_path: { type: "string" },
            text: { type: "string" },
            position: { type: "string", enum: ["top", "center", "bottom"], default: "center" },
            start_time: { type: "number", default: 0 },
            duration: { type: "number" },
          },
          required: ["video_path", "text"],
        },
      }
    );

    return tools;
  }

  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const call of toolCalls) {
      console.log(`[Pipeline ${this.pipelineId}] Tool: ${call.name}`);
      
      try {
        let result: any;

        // Route to appropriate MCP server
        if (["generate_image", "generate_video", "text_to_speech", "lip_sync", "upload_file", "get_job_status"].includes(call.name)) {
          result = await this.mcp.callTool("comfyui", call.name, call.input);
        } else if (["assemble_full_video", "export_format", "generate_thumbnail", "add_text_overlay"].includes(call.name)) {
          result = await this.mcp.callTool("assembly", call.name, call.input);
        } else {
          throw new Error(`Unknown tool: ${call.name}`);
        }

        results.push({
          tool_call_id: call.id,
          result,
        });

        // Update status based on tool
        await this.updateStatus(
          "generating",
          this.calculateProgress(call.name),
          `Completed: ${call.name}`
        );

      } catch (error) {
        console.error(`[Pipeline ${this.pipelineId}] Tool ${call.name} failed:`, error);
        results.push({
          tool_call_id: call.id,
          result: null,
          error: error instanceof Error ? error.message : "Tool execution failed",
        });
      }
    }

    return results;
  }

  private getModelName(): string {
    // Map provider to default model
    const modelMap: Record<string, string> = {
      claude: "claude-sonnet-4-20250514",
      anthropic: "claude-sonnet-4-20250514",
      openai: "gpt-4-turbo-preview",
      gpt: "gpt-4-turbo-preview",
      gemini: "gemini-pro",
      google: "gemini-pro",
    };

    return modelMap[this.providerName] || process.env.LLM_MODEL || "claude-sonnet-4-20250514";
  }

  private calculateProgress(toolName: string): number {
    // Rough progress estimation
    const progressMap: Record<string, number> = {
      generate_image: 20,
      generate_video: 50,
      text_to_speech: 60,
      lip_sync: 70,
      assemble_full_video: 85,
      export_format: 95,
      generate_thumbnail: 100,
    };
    return progressMap[toolName] || 50;
  }

  private async updateStatusFromResponse(response: any, iteration: number): Promise<void> {
    const stageNames: Record<string, string> = {
      briefing: "Creating production brief...",
      images: "Generating scene images...",
      videos: "Generating videos...",
      audio: "Generating audio...",
      assembly: "Assembling final video...",
      export: "Exporting formats...",
    };

    // Try to infer stage from response content
    const content = JSON.stringify(response.content).toLowerCase();
    let stage = "generating";
    let progress = Math.min(iteration * 5, 95); // Rough estimate

    if (content.includes("image")) {
      stage = "images";
      progress = 25;
    } else if (content.includes("video")) {
      stage = "videos";
      progress = 50;
    } else if (content.includes("audio")) {
      stage = "audio";
      progress = 70;
    } else if (content.includes("assemble")) {
      stage = "assembly";
      progress = 85;
    }

    await this.updateStatus(stage, progress, stageNames[stage] || "Processing...");
  }

  private async updateStatus(
    status: string,
    progress: number,
    currentStage: string,
    extra: any = {}
  ): Promise<void> {
    const statusPath = path.resolve(process.cwd(), "..", "requests", `${this.pipelineId}.status.json`);
    
    const statusData = {
      id: this.pipelineId,
      status,
      progress,
      currentStage,
      provider: this.providerName,
      updatedAt: new Date().toISOString(),
      ...extra,
    };

    await fs.writeFile(statusPath, JSON.stringify(statusData, null, 2));
  }

  private async logMessage(role: string, content: any): Promise<void> {
    const logPath = path.resolve(process.cwd(), "..", "requests", `${this.pipelineId}.log.json`);
    
    let logs: any = { messages: [], provider: this.providerName };
    try {
      const existing = await fs.readFile(logPath, "utf-8");
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

  private async getOutputFiles(): Promise<any> {
    try {
      const outputDir = path.resolve(process.cwd(), "..", "output");
      const date = new Date().toISOString().split("T")[0];
      const dateDir = path.join(outputDir, date);
      
      const files = await fs.readdir(dateDir);
      const videos = files.filter(f => f.endsWith(".mp4"));
      const thumbnails = files.filter(f => f.endsWith("_thumb.jpg"));
      
      return {
        videos: videos.map(v => `/api/outputs/${date}/${v}`),
        thumbnails: thumbnails.map(t => `/api/outputs/${date}/${t}`),
      };
    } catch {
      return { videos: [], thumbnails: [] };
    }
  }

  private buildInitialPrompt(requestData: any): string {
    return `
You are orchestrating a viral meme video generation pipeline.

USER REQUEST:
- Concept: ${requestData.request.concept}
- Format: ${requestData.request.format}
- Style: ${requestData.request.style}
- Target Duration: ${requestData.request.duration_target}s
- Aspect Ratios: ${requestData.request.aspect_ratios.join(", ")}
${requestData.request.model_overrides ? `
- Model Overrides: ${JSON.stringify(requestData.request.model_overrides)}
` : ""}

YOUR TASK:
1. Generate a production brief with 2-5 scenes (HOOK → SETUP → ESCALATION → PUNCHLINE → TAG)
2. For each scene, generate: image → video (→ audio if needed) → lip sync (if needed)
3. Assemble all scenes into final video
4. Export in requested aspect ratios
5. Generate thumbnail

Use the available tools to execute each step. Start by generating the brief, then proceed scene by scene.

Current provider: ${this.providerName}
`;
  }
}

// Backwards compatibility - keep ClaudeOrchestrator as alias
export { UniversalOrchestrator as ClaudeOrchestrator };
