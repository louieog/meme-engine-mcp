/**
 * Video Assembly Python Client Wrapper
 * 
 * Wraps the Python video_assembly.py module via subprocess calls.
 * Provides video editing capabilities using ffmpeg.
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PYTHON_MODULE = join(__dirname, "../../../src/python/video_assembly.py");

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

/**
 * Helper interface for clip preparation
 */
interface ClipInfo {
  index: number;
  video_path: string;
  duration: number;
  has_audio: boolean;
}

/**
 * Helper interface for text overlays
 */
interface TextOverlay {
  text: string;
  position?: { x: number | string; y: number | string };
  font_size?: number;
  font_color?: string;
  start_time?: number;
  duration?: number;
}

/**
 * Helper interface for scene definition in assemble_full_video
 */
interface SceneInfo {
  video_path: string;
  duration: number;
  has_audio?: boolean;
  text_overlay?: string;
  text_position?: { x: number | string; y: number | string };
  text_start?: number;
  text_duration?: number;
  audio_path?: string;
}

export class AssemblyClientWrapper {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || process.env.ASSEMBLY_OUTPUT_DIR || "/tmp/mcp-assembly";
  }

  async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case "concatenate_scenes":
        return this.concatenateScenes(args);
      
      case "add_text_overlay":
        return this.addTextOverlay(args);
      
      case "add_multiple_text_overlays":
        return this.addMultipleTextOverlays(args);
      
      case "mix_audio":
        return this.mixAudio(args);
      
      case "replace_audio":
        return this.replaceAudio(args);
      
      case "export_format":
        return this.exportFormat(args);
      
      case "create_still_clip":
        return this.createStillClip(args);
      
      case "generate_thumbnail":
        return this.generateThumbnail(args);
      
      case "freeze_frame":
        return this.freezeFrame(args);
      
      case "get_video_info":
        return this.getVideoInfo(args);
      
      case "assemble_full_video":
        return this.assembleFullVideo(args);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Tool Implementations
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * 1. concatenate_scenes - Concatenate multiple video scenes
   */
  private async concatenateScenes(args: ConcatenateScenesArgs): Promise<any> {
    // Convert scene_paths to Path objects for Python
    const result = await this.callPython("concatenate_scenes", {
      scene_paths: args.scene_paths,
      output_path: args.output_path,
      transition: args.transition || "none",
      reencode: args.reencode !== false
    });
    
    return { 
      file_path: result.output_path || args.output_path,
      scenes_count: args.scene_paths.length 
    };
  }

  /**
   * 2. add_text_overlay - Add single text overlay to video
   */
  private async addTextOverlay(args: AddTextOverlayArgs): Promise<any> {
    const result = await this.callPython("add_text_overlay", {
      video_path: args.video_path,
      text: args.text,
      position: args.position || { x: "center", y: "bottom-100" },
      font_size: args.font_size || 72,
      font_color: args.font_color || "white",
      border_width: args.border_width ?? 3,
      border_color: args.border_color || "black",
      output_path: args.output_path,
      enable_expr: args.enable_expr,
      box: args.box || false,
      box_color: args.box_color || "black@0.5"
    });
    
    return { file_path: result.output_path || args.output_path };
  }

  /**
   * 3. add_multiple_text_overlays - Add multiple text overlays in one pass
   */
  private async addMultipleTextOverlays(args: AddMultipleTextOverlaysArgs): Promise<any> {
    const result = await this.callPython("add_multiple_text_overlays", {
      video_path: args.video_path,
      overlays: args.overlays.map(o => ({
        text: o.text,
        position: o.position || { x: "center", y: "center" },
        font_size: o.font_size || 48,
        font_color: o.font_color || "white"
      })),
      output_path: args.output_path
    });
    
    return { 
      file_path: result.output_path || args.output_path,
      overlays_applied: args.overlays.length
    };
  }

  /**
   * 4. mix_audio - Mix external audio with video's existing audio
   */
  private async mixAudio(args: MixAudioArgs): Promise<any> {
    const result = await this.callPython("mix_audio", {
      video_path: args.video_path,
      audio_path: args.audio_path,
      audio_volume: args.audio_volume ?? 1.0,
      video_volume: args.video_volume ?? 1.0,
      output_path: args.output_path,
      duration: args.duration || "first"
    });
    
    return { file_path: result.output_path || args.output_path };
  }

  /**
   * 5. replace_audio - Replace video's audio with external audio
   */
  private async replaceAudio(args: ReplaceAudioArgs): Promise<any> {
    const result = await this.callPython("replace_audio", {
      video_path: args.video_path,
      audio_path: args.audio_path,
      output_path: args.output_path,
      loop_audio: args.loop_audio || false
    });
    
    return { file_path: result.output_path || args.output_path };
  }

  /**
   * 6. export_format - Export video in specific aspect ratio
   */
  private async exportFormat(args: ExportFormatArgs): Promise<any> {
    const result = await this.callPython("export_format", {
      video_path: args.video_path,
      aspect_ratio: args.aspect_ratio,
      output_path: args.output_path,
      resolution: args.resolution || "1080p",
      quality: args.quality ?? 23,
      pad_mode: args.pad_mode || "black",
      pad_color: args.pad_color || "black"
    });
    
    return { 
      file_path: result.output_path || args.output_path,
      aspect_ratio: args.aspect_ratio
    };
  }

  /**
   * 7. create_still_clip - Create video clip from still image
   */
  private async createStillClip(args: CreateStillClipArgs): Promise<any> {
    const result = await this.callPython("create_still_clip", {
      image_path: args.image_path,
      duration: args.duration,
      output_path: args.output_path,
      resolution: args.resolution || "1080p"
    });
    
    return { file_path: result.output_path || args.output_path };
  }

  /**
   * 8. generate_thumbnail - Extract frame at timestamp as thumbnail
   */
  private async generateThumbnail(args: GenerateThumbnailArgs): Promise<any> {
    const result = await this.callPython("generate_thumbnail", {
      video_path: args.video_path,
      timestamp: args.timestamp,
      output_path: args.output_path,
      width: args.width,
      height: args.height,
      quality: args.quality ?? 2
    });
    
    return { file_path: result.output_path || args.output_path };
  }

  /**
   * 9. freeze_frame - Freeze frame at specific timestamp
   */
  private async freezeFrame(args: FreezeFrameArgs): Promise<any> {
    const result = await this.callPython("freeze_frame", {
      video_path: args.video_path,
      freeze_at: args.freeze_at,
      freeze_duration: args.freeze_duration,
      output_path: args.output_path,
      fade_duration: args.fade_duration || 0
    });
    
    return { file_path: result.output_path || args.output_path };
  }

  /**
   * 10. get_video_info - Get comprehensive video metadata
   */
  private async getVideoInfo(args: GetVideoInfoArgs): Promise<any> {
    const result = await this.callPython("get_video_info", {
      video_path: args.video_path
    });
    
    return result;
  }

  /**
   * 11. assemble_full_video - Full pipeline with scenes
   * 
   * This implements the complex multi-step pipeline:
   * 1. Prepare all clips
   * 2. Add text overlays if specified
   * 3. Concatenate all scenes
   * 4. Mix audio if needed
   */
  private async assembleFullVideo(args: AssembleFullVideoArgs): Promise<any> {
    // For the full pipeline, we use the Python AssemblyPipeline class
    // which handles all steps internally via run_full_assembly
    const result = await this.callPython("run_full_assembly", {
      brief_path: args.brief_path,
      scene_assets: args.scene_assets,
      output_dir: args.output_dir,
      generate_thumbs: args.generate_thumbs !== false
    });
    
    return {
      file_path: result["9x16"],
      file_path_16x9: result["16x9"],
      thumbnail: result.thumbnail,
      thumbnail_16x9: result.thumbnail_16x9,
      metadata: result.metadata
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Python Call Helper
  // ─────────────────────────────────────────────────────────────────────────────

  private callPython(functionName: string, args: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonArgs = [
        PYTHON_MODULE,
        "--function", functionName,
        "--args", JSON.stringify(args),
        "--output-dir", this.outputDir
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
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (!result.success) {
            reject(new Error(result.error || "Unknown Python error"));
          } else {
            resolve(result.data);
          }
        } catch (e) {
          // If not valid JSON, return as text
          resolve({
            success: true,
            output: stdout.trim(),
            function: functionName
          });
        }
      });

      childProcess.on("error", (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Test the wrapper without making actual API calls
   */
  async testConnection(): Promise<{ available: boolean; message: string }> {
    try {
      // Check if Python module exists by trying to call get_video_info with invalid path
      // which should still load the module and fail gracefully
      const result = await this.callPython("get_video_info", { video_path: "/dev/null" });
      return {
        available: true,
        message: "Python module accessible"
      };
    } catch (error: any) {
      // If error is about the video not existing, the module is working
      if (error.message?.includes("does not exist") || error.message?.includes("No such file")) {
        return {
          available: true,
          message: "Python module accessible"
        };
      }
      return {
        available: false,
        message: `Python module not accessible: ${error}`
      };
    }
  }
}
