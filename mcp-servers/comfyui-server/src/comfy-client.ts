/**
 * ComfyUI Python Client Wrapper
 * 
 * Wraps the Python comfyui_client.py module via subprocess calls.
 * This allows TypeScript MCP tools to leverage the existing Python implementation.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_MODULE = join(__dirname, "../../../src/python/comfyui_client.py");

export interface GenerateImageArgs {
  prompt: string;
  aspect_ratio?: string;
  primary_model?: string;
  seed?: number;
  enable_fallbacks?: boolean;
  scene_id?: number;
  resolution?: string;
  output_prefix?: string;
  model?: string;
}

export interface GenerateVideoArgs {
  image_path?: string;
  cloud_image?: string;
  prompt: string;
  duration?: number;
  aspect_ratio?: string;
  generate_audio?: boolean;
  model?: string;
  seed?: number;
  scene_id?: number;
  output_prefix?: string;
  include_audio?: boolean;
}

export interface TextToSpeechArgs {
  text: string;
  voice?: string;
  speed?: number;
  stability?: number;
  similarity_boost?: number;
  seed?: number;
  scene_id?: number;
  line_index?: number;
  output_prefix?: string;
}

export interface LipSyncArgs {
  video_path: string;
  audio_path: string;
  model?: string;
  scene_id?: number;
  output_prefix?: string;
}

export interface UploadFileArgs {
  file_path: string;
}

export interface DownloadFileArgs {
  filename: string;
  dest_path: string;
  subfolder?: string;
  file_type?: string;
}

export interface GetJobStatusArgs {
  prompt_id: string;
}

export interface CreateWorkflowArgs {
  workflow_type: string;
  params: Record<string, any>;
}

export type ToolArgs = 
  | GenerateImageArgs 
  | GenerateVideoArgs 
  | TextToSpeechArgs 
  | LipSyncArgs 
  | UploadFileArgs 
  | DownloadFileArgs 
  | GetJobStatusArgs 
  | CreateWorkflowArgs;

// Model registry helpers
interface ModelConfig {
  name: string;
  type: string;
  supportsNativeAudio?: boolean;
}

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  "gemini-3-pro": { name: "Gemini 3 Pro", type: "image" },
  "flux-kontext": { name: "Flux Kontext", type: "image" },
  "nano-banana-2": { name: "Nano Banana 2", type: "image" },
  "kling-v3-omni": { name: "Kling Omni Pro v3", type: "video", supportsNativeAudio: true },
  "kling-v2-master": { name: "Kling v2 Master", type: "video", supportsNativeAudio: false }
};

function getModelConfig(model: string): ModelConfig | undefined {
  return MODEL_REGISTRY[model];
}

function getFallbackChain(primaryModel: string): string[] {
  const chain: string[] = [primaryModel];
  
  // Add fallbacks based on model type
  if (MODEL_REGISTRY[primaryModel]?.type === "image") {
    if (primaryModel !== "flux-kontext") chain.push("flux-kontext");
    if (primaryModel !== "nano-banana-2") chain.push("nano-banana-2");
  }
  
  return [...new Set(chain)]; // Remove duplicates
}

function isNativeAudioModel(model: string): boolean {
  return MODEL_REGISTRY[model]?.supportsNativeAudio === true;
}

// Helper to call Python CLI
async function callPython(functionName: string, args: any, apiKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonArgs = [
      PYTHON_MODULE,
      "--function", functionName,
      "--args", JSON.stringify(args),
      "--api-key", apiKey
    ];
    
    const proc = spawn("python3", pythonArgs, {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        COMFY_CLOUD_API_KEY: apiKey
      }
    });
    
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (data) => stdout += data.toString());
    proc.stderr.on("data", (data) => stderr += data.toString());
    
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited ${code}: ${stderr || stdout}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        if (!result.success) {
          reject(new Error(result.error));
        } else {
          resolve(result.data);
        }
      } catch (e) {
        reject(new Error(`Invalid JSON: ${stdout}`));
      }
    });
    
    proc.on("error", (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
  });
}

export class ComfyClientWrapper {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMFY_CLOUD_API_KEY || "";
  }

  async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case "generate_image":
        return this.generateImage(args);
      case "generate_video":
        return this.generateVideo(args);
      case "text_to_speech":
        return this.textToSpeech(args);
      case "lip_sync":
        return this.lipSync(args);
      case "upload_file":
        return this.uploadFile(args);
      case "download_file":
        return this.downloadFile(args);
      case "get_job_status":
        return this.getJobStatus(args);
      case "create_workflow":
        return this.createWorkflow(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // 1. Generate Image
  private async generateImage(args: GenerateImageArgs): Promise<any> {
    const model = args.model || args.primary_model || "gemini-3-pro";
    const modelConfig = getModelConfig(model);
    if (!modelConfig) throw new Error(`Unknown model: ${model}`);

    // Build workflow via Python
    const workflow = await callPython("build_image_workflow", {
      model: model,
      prompt: args.prompt,
      aspect_ratio: args.aspect_ratio || "9:16",
      seed: args.seed ?? Math.floor(Math.random() * 1000000)
    }, this.apiKey);

    // Submit and wait (10 min timeout for images)
    const result = await callPython("submit_and_wait", {
      workflow,
      timeout_seconds: 600
    }, this.apiKey);

    // Download output
    const files = await callPython("extract_files", { outputs: result.outputs }, this.apiKey);
    if (!files || files.length === 0) throw new Error("No output files");

    const outputDir = resolve(process.cwd(), "output");
    const downloadPath = join(outputDir, args.output_prefix || "image");
    
    await callPython("download_file", {
      filename: files[0].filename,
      subfolder: files[0].subfolder || "",
      file_type: files[0].type || "output",
      dest_path: downloadPath
    }, this.apiKey);

    return { file_path: downloadPath, prompt_id: result.prompt_id };
  }

  // 2. Generate Video
  private async generateVideo(args: GenerateVideoArgs): Promise<any> {
    const model = args.model || "kling-v3-omni";
    
    // Upload image first
    let cloudImage: string;
    if (args.image_path) {
      const uploadResult = await callPython("upload_file", {
        file_path: args.image_path
      }, this.apiKey);
      cloudImage = uploadResult.filename;
    } else if (args.cloud_image) {
      cloudImage = args.cloud_image;
    } else {
      throw new Error("Either image_path or cloud_image is required");
    }

    // Build workflow with native audio if applicable
    const generateAudio = isNativeAudioModel(model) && (args.include_audio || args.generate_audio);

    const workflow = await callPython("build_video_workflow", {
      model: model,
      cloud_image: cloudImage,
      prompt: args.prompt,
      duration: args.duration || 5,
      aspect_ratio: args.aspect_ratio || "9:16",
      generate_audio: generateAudio
    }, this.apiKey);

    // Submit and wait (12 min timeout for video)
    const result = await callPython("submit_and_wait", {
      workflow,
      timeout_seconds: 720
    }, this.apiKey);

    // Download
    const files = await callPython("extract_files", { outputs: result.outputs }, this.apiKey);
    if (!files || files.length === 0) throw new Error("No output files");

    const outputDir = resolve(process.cwd(), "output");
    const downloadPath = join(outputDir, args.output_prefix || "video");
    
    await callPython("download_file", {
      filename: files[0].filename,
      subfolder: files[0].subfolder || "",
      file_type: files[0].type || "output",
      dest_path: downloadPath
    }, this.apiKey);

    return { file_path: downloadPath, prompt_id: result.prompt_id, has_audio: generateAudio };
  }

  // 3. Text to Speech
  private async textToSpeech(args: TextToSpeechArgs): Promise<any> {
    const workflow = await callPython("build_tts_workflow", {
      text: args.text,
      voice: args.voice || "George (male, british)",
      scene_id: args.scene_id || 1,
      line_index: args.line_index || 0
    }, this.apiKey);

    // Submit and wait (2 min timeout for TTS)
    const result = await callPython("submit_and_wait", { 
      workflow, 
      timeout_seconds: 120 
    }, this.apiKey);
    
    const files = await callPython("extract_files", { outputs: result.outputs }, this.apiKey);
    if (!files || files.length === 0) throw new Error("No output files");

    const outputDir = resolve(process.cwd(), "output");
    const downloadPath = join(outputDir, args.output_prefix || "audio");
    
    await callPython("download_file", {
      filename: files[0].filename,
      subfolder: files[0].subfolder || "",
      file_type: files[0].type || "output",
      dest_path: downloadPath
    }, this.apiKey);

    return { file_path: downloadPath };
  }

  // 4. Lip Sync
  private async lipSync(args: LipSyncArgs): Promise<any> {
    // Upload both files
    const videoUpload = await callPython("upload_file", { file_path: args.video_path }, this.apiKey);
    const audioUpload = await callPython("upload_file", { file_path: args.audio_path }, this.apiKey);

    const workflow = await callPython("build_lip_sync_workflow", {
      video_file: videoUpload.filename,
      audio_file: audioUpload.filename,
      model: args.model || "KlingLipSyncAudioToVideoNode"
    }, this.apiKey);

    // Submit and wait (10 min timeout for lip sync)
    const result = await callPython("submit_and_wait", { 
      workflow, 
      timeout_seconds: 600 
    }, this.apiKey);
    
    const files = await callPython("extract_files", { outputs: result.outputs }, this.apiKey);
    if (!files || files.length === 0) throw new Error("No output files");

    const outputDir = resolve(process.cwd(), "output");
    const downloadPath = join(outputDir, args.output_prefix || "lipsync");
    
    await callPython("download_file", {
      filename: files[0].filename,
      subfolder: files[0].subfolder || "",
      file_type: files[0].type || "output",
      dest_path: downloadPath
    }, this.apiKey);

    return { file_path: downloadPath };
  }

  // 5. Upload File
  private async uploadFile(args: UploadFileArgs): Promise<any> {
    const result = await callPython("upload_file", { file_path: args.file_path }, this.apiKey);
    return { filename: result.filename, url: result.url };
  }

  // 6. Download File
  private async downloadFile(args: DownloadFileArgs): Promise<any> {
    const result = await callPython("download_file", {
      filename: args.filename,
      subfolder: args.subfolder || "",
      file_type: args.file_type || "output",
      dest_path: args.dest_path
    }, this.apiKey);
    return { file_path: args.dest_path, success: true };
  }

  // 7. Get Job Status
  private async getJobStatus(args: GetJobStatusArgs): Promise<any> {
    const result = await callPython("get_job_status", { prompt_id: args.prompt_id }, this.apiKey);
    return { status: result.status, outputs: result.outputs, error: result.error };
  }

  // 8. Create Workflow (for inspection)
  private async createWorkflow(args: CreateWorkflowArgs): Promise<any> {
    const builderMap: Record<string, string> = {
      image: "build_image_workflow",
      video: "build_video_workflow",
      tts: "build_tts_workflow",
      lipsync: "build_lip_sync_workflow"
    };

    const builderFunc = builderMap[args.workflow_type];
    if (!builderFunc) {
      throw new Error(`Unknown workflow type: ${args.workflow_type}`);
    }

    const workflow = await callPython(builderFunc, args.params, this.apiKey);
    return { workflow, type: args.workflow_type };
  }

  /**
   * Test the wrapper without making actual API calls
   */
  async testConnection(): Promise<{ available: boolean; message: string }> {
    try {
      // Check if Python module exists by trying to import it
      const result = await callPython("extract_files", { outputs: {} }, this.apiKey);
      return {
        available: true,
        message: "Python module accessible"
      };
    } catch (error) {
      return {
        available: false,
        message: `Python module not accessible: ${error}`
      };
    }
  }
}
