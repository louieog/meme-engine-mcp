/**
 * Meme Engine Orchestrator
 * 
 * High-level orchestration logic for coordinating between:
 * - ComfyUI Server (image/video/audio generation)
 * - Assembly Server (video editing and export)
 * - External services (trend research, etc.)
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { promises as fs } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Available models configuration
const AVAILABLE_MODELS = {
  image: [
    { id: "gemini-3-pro", name: "Gemini 2 Image", provider: "Google", quality: "high", speed: "medium" },
    { id: "flux-kontext", name: "Flux Kontext Pro", provider: "Black Forest Labs", quality: "high", speed: "slow" },
    { id: "nano-banana-2", name: "Gemini Nano", provider: "Google", quality: "medium", speed: "fast" }
  ],
  video: [
    { id: "kling-v3-omni", name: "Kling Omni Pro v3", provider: "Kling", quality: "high", speed: "medium", audio: true },
    { id: "kling-v2-master", name: "Kling v2 Master", provider: "Kling", quality: "high", speed: "medium", audio: false }
  ],
  audio: [
    { id: "elevenlabs", name: "ElevenLabs TTS", provider: "ElevenLabs", quality: "high", voices: ["George", "Rachel", "Adam", "Antoni"] }
  ],
  lipsync: [
    { id: "sync-1.6.0", name: "Lip Sync", provider: "Sync", quality: "high" }
  ]
};

// Pipeline tracking
interface PipelineState {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  currentStep: string;
  outputs: Record<string, any>;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

const activePipelines = new Map<string, PipelineState>();

export interface ResearchTrendsArgs {
  topic: string;
  platform?: string;
  days_back?: number;
}

export interface CreateProductionBriefArgs {
  concept: string;
  target_duration?: number;
  style?: string;
  characters?: string[];
  output_path?: string;
}

export interface GenerateMemeVideoArgs {
  brief_path?: string;
  concept?: string;
  output_dir: string;
  scenes?: any[];
  characters?: Record<string, any>;
  skip_image_gen?: boolean;
  skip_video_gen?: boolean;
  skip_audio_gen?: boolean;
  export_formats?: string[];
}

export interface GenerateSceneAssetsArgs {
  scene_id: number;
  image_prompt?: string;
  video_prompt?: string;
  audio_script?: string;
  duration?: number;
  aspect_ratio?: string;
  output_dir: string;
  skip_existing?: boolean;
}

export interface AddTextHooksArgs {
  video_path: string;
  hooks: Array<{
    text: string;
    start_time?: number;
    end_time?: number;
    position?: { x: number | string; y: number | string };
    style?: string;
  }>;
  output_path?: string;
}

export interface GetPipelineStatusArgs {
  pipeline_id: string;
}

export interface ListAvailableModelsArgs {
  type?: string;
}

export interface ValidateBriefArgs {
  brief_path?: string;
  brief_json?: any;
}

export interface EstimateCostArgs {
  brief_path?: string;
  scene_count?: number;
  include_audio?: boolean;
  include_lipsync?: boolean;
}

export class MemeEngineOrchestrator {
  private outputDir: string;
  private comfyServerPath: string;
  private assemblyServerPath: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || process.env.MEME_ENGINE_OUTPUT_DIR || "/tmp/meme-engine";
    this.comfyServerPath = process.env.COMFY_SERVER_PATH || "comfyui-server";
    this.assemblyServerPath = process.env.ASSEMBLY_SERVER_PATH || "assembly-server";
  }

  /**
   * Research current meme trends for a topic
   */
  async researchTrends(args: ResearchTrendsArgs): Promise<any> {
    // This would integrate with external trend APIs
    // For now, return mock data structure
    return {
      topic: args.topic,
      platform: args.platform || "all",
      trends: [
        { format: "News Anchor", engagement: "high", examples: 5 },
        { format: "POV Reaction", engagement: "very high", examples: 8 },
        { format: "Tutorial", engagement: "medium", examples: 3 }
      ],
      hashtags: [`#${args.topic}`, "#viral", "#meme"],
      optimal_duration: 15,
      best_posting_times: ["9am", "12pm", "6pm"],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a production brief from concept
   */
  async createProductionBrief(args: CreateProductionBriefArgs): Promise<any> {
    const brief = {
      version: "1.0",
      created_at: new Date().toISOString(),
      concept: args.concept,
      slug: this.slugify(args.concept.slice(0, 50)),
      target_duration: args.target_duration || 15,
      style: args.style || "news",
      characters: args.characters || ["Main Character"],
      scenes: this.generateScenesFromConcept(args),
      output_specs: {
        formats: ["9:16", "16:9"],
        resolution: "1080p",
        fps: 30
      }
    };

    // Save to file if path provided
    if (args.output_path) {
      await fs.mkdir(dirname(args.output_path), { recursive: true });
      await fs.writeFile(args.output_path, JSON.stringify(brief, null, 2));
    }

    return {
      success: true,
      brief,
      saved_to: args.output_path || null
    };
  }

  /**
   * Generate full meme video from brief
   */
  async generateMemeVideo(args: GenerateMemeVideoArgs): Promise<any> {
    const pipelineId = `pipeline-${Date.now()}`;
    
    // Initialize pipeline state
    const state: PipelineState = {
      id: pipelineId,
      status: "running",
      progress: 0,
      currentStep: "initialization",
      outputs: {},
      errors: [],
      startedAt: new Date()
    };
    activePipelines.set(pipelineId, state);

    // Start async generation
    this.runGenerationPipeline(pipelineId, args).catch(error => {
      state.status = "failed";
      state.errors.push(error.message);
      state.completedAt = new Date();
    });

    return {
      pipeline_id: pipelineId,
      status: "started",
      output_dir: args.output_dir,
      message: "Pipeline started. Use get_pipeline_status to track progress."
    };
  }

  /**
   * Generate assets for a single scene
   */
  async generateSceneAssets(args: GenerateSceneAssetsArgs): Promise<any> {
    const results: any = {
      scene_id: args.scene_id,
      outputs: {}
    };

    // Generate image if prompt provided
    if (args.image_prompt) {
      results.outputs.image = {
        status: "would_generate",
        prompt: args.image_prompt,
        path: `${args.output_dir}/scene${args.scene_id}-char.png`
      };
    }

    // Generate video if prompt provided
    if (args.video_prompt) {
      results.outputs.video = {
        status: "would_generate",
        prompt: args.video_prompt,
        path: `${args.output_dir}/scene${args.scene_id}-video.mp4`
      };
    }

    // Generate audio if script provided
    if (args.audio_script) {
      results.outputs.audio = {
        status: "would_generate",
        script: args.audio_script,
        path: `${args.output_dir}/scene${args.scene_id}-audio.wav`
      };
    }

    return results;
  }

  /**
   * Add text hooks to video
   */
  async addTextHooks(args: AddTextHooksArgs): Promise<any> {
    // This would call the assembly server
    return {
      success: true,
      input_video: args.video_path,
      hooks_added: args.hooks.length,
      output_path: args.output_path || args.video_path.replace(".mp4", "-hooks.mp4")
    };
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(args: GetPipelineStatusArgs): Promise<any> {
    const state = activePipelines.get(args.pipeline_id);
    
    if (!state) {
      return {
        error: "Pipeline not found",
        pipeline_id: args.pipeline_id
      };
    }

    return {
      pipeline_id: state.id,
      status: state.status,
      progress: state.progress,
      current_step: state.currentStep,
      outputs: state.outputs,
      errors: state.errors,
      started_at: state.startedAt,
      completed_at: state.completedAt,
      runtime_seconds: state.completedAt 
        ? (state.completedAt.getTime() - state.startedAt.getTime()) / 1000
        : (Date.now() - state.startedAt.getTime()) / 1000
    };
  }

  /**
   * List available models
   */
  async listAvailableModels(args: ListAvailableModelsArgs): Promise<any> {
    if (args.type && args.type !== "all") {
      return {
        type: args.type,
        models: AVAILABLE_MODELS[args.type as keyof typeof AVAILABLE_MODELS] || []
      };
    }

    return AVAILABLE_MODELS;
  }

  /**
   * Validate production brief
   */
  async validateBrief(args: ValidateBriefArgs): Promise<any> {
    let brief: any;

    try {
      if (args.brief_json) {
        brief = args.brief_json;
      } else if (args.brief_path) {
        const content = await fs.readFile(args.brief_path, "utf-8");
        brief = JSON.parse(content);
      } else {
        return { valid: false, errors: ["No brief provided"] };
      }
    } catch (error) {
      return { 
        valid: false, 
        errors: [`Failed to load brief: ${error}`] 
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!brief.concept) errors.push("Missing 'concept' field");
    if (!brief.scenes || brief.scenes.length === 0) errors.push("No scenes defined");
    
    // Validate scenes
    if (brief.scenes) {
      for (let i = 0; i < brief.scenes.length; i++) {
        const scene = brief.scenes[i];
        if (!scene.image_prompt && !scene.video_prompt) {
          warnings.push(`Scene ${i + 1} has no generation prompts`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      brief_summary: {
        concept: brief.concept?.slice(0, 50),
        scene_count: brief.scenes?.length,
        target_duration: brief.target_duration
      }
    };
  }

  /**
   * Estimate generation cost
   */
  async estimateCost(args: EstimateCostArgs): Promise<any> {
    let sceneCount = args.scene_count || 3;

    // Load brief if provided
    if (args.brief_path) {
      try {
        const content = await fs.readFile(args.brief_path, "utf-8");
        const brief = JSON.parse(content);
        sceneCount = brief.scenes?.length || sceneCount;
      } catch {
        // Use default scene count
      }
    }

    // Estimate credits (rough estimates)
    const imageCost = sceneCount * 4; // ~4 credits per image
    const videoCost = sceneCount * 25; // ~25 credits per video
    const audioCost = args.include_audio ? sceneCount * 1 : 0; // ~1 credit per TTS
    const lipsyncCost = args.include_lipsync ? sceneCount * 5 : 0; // ~5 credits per lip-sync

    const totalCredits = imageCost + videoCost + audioCost + lipsyncCost;
    const estimatedTime = sceneCount * 3; // ~3 minutes per scene

    return {
      scene_count: sceneCount,
      estimated_credits: totalCredits,
      breakdown: {
        images: imageCost,
        videos: videoCost,
        audio: audioCost,
        lipsync: lipsyncCost
      },
      estimated_time_minutes: estimatedTime,
      estimated_cost_usd: (totalCredits / 100).toFixed(2) // Rough estimate: 100 credits = $1
    };
  }

  // Private helper methods

  private async runGenerationPipeline(pipelineId: string, args: GenerateMemeVideoArgs): Promise<void> {
    const state = activePipelines.get(pipelineId)!;
    const steps = ["setup", "images", "videos", "audio", "assembly", "export"];
    
    for (let i = 0; i < steps.length; i++) {
      state.currentStep = steps[i];
      state.progress = (i / steps.length) * 100;
      
      // Simulate work (replace with actual implementation)
      await this.delay(1000);
      
      state.outputs[steps[i]] = { status: "completed", timestamp: new Date().toISOString() };
    }

    state.status = "completed";
    state.progress = 100;
    state.currentStep = "done";
    state.completedAt = new Date();
  }

  private generateScenesFromConcept(args: CreateProductionBriefArgs): any[] {
    // Simple scene generation based on concept
    const sceneCount = Math.ceil((args.target_duration || 15) / 5);
    const scenes = [];

    for (let i = 1; i <= sceneCount; i++) {
      scenes.push({
        scene_id: i,
        duration: 5,
        image_prompt: `Scene ${i} of: ${args.concept}`,
        video_prompt: "Subtle movement, gentle motion",
        audio_script: i === 1 ? args.concept.slice(0, 100) : "",
        text_overlay: ""
      });
    }

    return scenes;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
