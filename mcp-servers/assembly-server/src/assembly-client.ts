/**
 * Video Assembly Python Client Wrapper
 * 
 * Wraps the Python video_assembly.py module via subprocess calls.
 * Provides video editing capabilities using ffmpeg.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_MODULE = join(__dirname, "../../../../phase1/video_assembly.py");

export interface ConcatenateScenesArgs {
  scene_paths: string[];
  output_path: string;
  transition?: string;
  reencode?: boolean;
}

export interface AddTextOverlayArgs {
  video_path: string;
  text: string;
  position?: { x: number | string; y: number | string };
  font_size?: number;
  font_color?: string;
  border_width?: number;
  border_color?: string;
  output_path?: string;
  enable_expr?: string;
  box?: boolean;
  box_color?: string;
}

export interface AddMultipleTextOverlaysArgs {
  video_path: string;
  overlays: Array<{
    text: string;
    position?: { x: number | string; y: number | string };
    font_size?: number;
    font_color?: string;
    enable_expr?: string;
  }>;
  output_path?: string;
}

export interface MixAudioArgs {
  video_path: string;
  audio_path: string;
  audio_volume?: number;
  video_volume?: number;
  output_path?: string;
  duration?: string;
}

export interface ReplaceAudioArgs {
  video_path: string;
  audio_path: string;
  output_path?: string;
  loop_audio?: boolean;
}

export interface ExportFormatArgs {
  video_path: string;
  aspect_ratio: string;
  output_path: string;
  resolution?: string;
  quality?: number;
  pad_mode?: string;
  pad_color?: string;
}

export interface CreateStillClipArgs {
  image_path: string;
  duration: number;
  output_path?: string;
  resolution?: string;
}

export interface GenerateThumbnailArgs {
  video_path: string;
  timestamp: number;
  output_path: string;
  width?: number;
  height?: number;
  quality?: number;
}

export interface FreezeFrameArgs {
  video_path: string;
  freeze_at: number;
  freeze_duration: number;
  output_path: string;
  fade_duration?: number;
}

export interface GetVideoInfoArgs {
  video_path: string;
}

export interface AssembleFullVideoArgs {
  brief_path: string;
  scene_assets: Record<number, { video?: string; image?: string; audio?: string }>;
  output_dir: string;
  generate_thumbs?: boolean;
}

export type ToolArgs =
  | ConcatenateScenesArgs
  | AddTextOverlayArgs
  | AddMultipleTextOverlaysArgs
  | MixAudioArgs
  | ReplaceAudioArgs
  | ExportFormatArgs
  | CreateStillClipArgs
  | GenerateThumbnailArgs
  | FreezeFrameArgs
  | GetVideoInfoArgs
  | AssembleFullVideoArgs;

export class AssemblyClientWrapper {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || process.env.ASSEMBLY_OUTPUT_DIR || "/tmp/mcp-assembly";
  }

  async executeTool(name: string, args: any): Promise<any> {
    // Map tool names to Python function calls
    const toolMap: Record<string, string> = {
      concatenate_scenes: "concatenate_scenes",
      add_text_overlay: "add_text_overlay",
      add_multiple_text_overlays: "add_multiple_text_overlays",
      mix_audio: "mix_audio",
      replace_audio: "replace_audio",
      export_format: "export_format",
      create_still_clip: "create_still_clip",
      generate_thumbnail: "generate_thumbnail",
      freeze_frame: "freeze_frame",
      get_video_info: "get_video_info",
      assemble_full_video: "run_full_assembly"
    };

    const pythonFunction = toolMap[name];
    if (!pythonFunction) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Add output directory to args if not present
    const argsWithDefaults = {
      output_dir: this.outputDir,
      ...args
    };

    // Call Python module via subprocess
    return this.callPython(pythonFunction, argsWithDefaults);
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
          PYTHONUNBUFFERED: "1"
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
