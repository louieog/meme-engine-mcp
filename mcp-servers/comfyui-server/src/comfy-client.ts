/**
 * ComfyUI Python Client Wrapper
 * 
 * Wraps the Python comfyui_client.py module via subprocess calls.
 * This allows TypeScript MCP tools to leverage the existing Python implementation.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_MODULE = join(__dirname, "../../../../phase1/comfyui_client.py");

export interface GenerateImageArgs {
  prompt: string;
  aspect_ratio?: string;
  primary_model?: string;
  seed?: number;
  enable_fallbacks?: boolean;
  scene_id?: number;
  resolution?: string;
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
}

export interface LipSyncArgs {
  video_path: string;
  audio_path: string;
  model?: string;
  scene_id?: number;
}

export interface UploadFileArgs {
  file_path: string;
}

export interface DownloadFileArgs {
  filename: string;
  dest_path: string;
  subfolder?: string;
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

export class ComfyClientWrapper {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMFY_CLOUD_API_KEY || "";
  }

  async executeTool(name: string, args: any): Promise<any> {
    // Map tool names to Python function calls
    const toolMap: Record<string, string> = {
      generate_image: "generate_image",
      generate_video: "generate_video",
      text_to_speech: "text_to_speech",
      lip_sync: "lip_sync",
      upload_file: "upload_file",
      download_file: "download_file",
      get_job_status: "get_job_status",
      create_workflow: "create_workflow"
    };
    
    const pythonFunction = toolMap[name];
    if (!pythonFunction) {
      throw new Error(`Unknown tool: ${name}`);
    }
    
    // Add API key to args if not present
    const argsWithApiKey = {
      ...args,
      api_key: args.api_key || this.apiKey
    };
    
    // Call Python module via subprocess
    return this.callPython(pythonFunction, argsWithApiKey);
  }
  
  private callPython(functionName: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonArgs = [
        PYTHON_MODULE,
        "--function", functionName,
        "--args", JSON.stringify(args)
      ];
      
      const childProcess = spawn("python3", pythonArgs, {
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: "1",
          COMFY_CLOUD_API_KEY: this.apiKey
        }
      });
      
      let stdout = "";
      let stderr = "";
      
      childProcess.stdout.on("data", (data) => stdout += data.toString());
      childProcess.stderr.on("data", (data) => stderr += data.toString());
      
      childProcess.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python error (exit ${code}): ${stderr || stdout}`));
        } else {
          try {
            // Try to parse as JSON first
            const result = JSON.parse(stdout);
            resolve(result);
          } catch {
            // Return as plain text if not valid JSON
            resolve({ 
              success: true, 
              output: stdout.trim(),
              function: functionName 
            });
          }
        }
      });

      childProcess.on("error", (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * Test the wrapper without making actual API calls
   */
  async testConnection(): Promise<{ available: boolean; message: string }> {
    try {
      // Check if Python module exists by trying to import it
      const result = await this.callPython("test", {});
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
