/**
 * Tool definitions for the Video Assembly MCP Server
 * 
 * These tools wrap the Python video_assembly.py module functionality
 * for concatenating scenes, adding text overlays, mixing audio, and exporting.
 */

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export const TOOLS: Tool[] = [
  {
    name: "concatenate_scenes",
    description: "Concatenate multiple video scenes into a single video file. Supports optional transitions and re-encoding.",
    inputSchema: {
      type: "object",
      properties: {
        scene_paths: { 
          type: "array", 
          items: { type: "string" },
          description: "List of video file paths to concatenate in order"
        },
        output_path: { 
          type: "string",
          description: "Output path for concatenated video"
        },
        transition: { 
          type: "string", 
          enum: ["none", "fade", "crossfade"], 
          default: "none",
          description: "Transition type between scenes (requires reencode=true)"
        },
        reencode: { 
          type: "boolean", 
          default: false,
          description: "Whether to re-encode video (required for transitions or different formats)"
        }
      },
      required: ["scene_paths", "output_path"]
    }
  },
  {
    name: "add_text_overlay",
    description: "Add text overlay to video with customizable position, style, and timing.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to input video file"
        },
        text: { 
          type: "string",
          description: "Text to overlay (use \\n for newlines)"
        },
        position: { 
          type: "object", 
          properties: { 
            x: { 
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["center", "left", "right", "center-100", "center+100", "left+50", "right-50"] }
              ]
            }, 
            y: { 
              oneOf: [
                { type: "number" },
                { type: "string", enum: ["center", "top", "bottom", "center-100", "center+100", "top+50", "bottom-100"] }
              ]
            } 
          },
          default: { x: "center", y: "bottom-100" },
          description: "Text position. Use 'center', 'top', 'bottom', 'left', 'right' or pixel values. Can use offsets like 'bottom-100'"
        },
        font_size: { 
          type: "number", 
          default: 72,
          description: "Font size in pixels"
        },
        font_color: { 
          type: "string", 
          default: "white",
          description: "Font color (name or hex)"
        },
        border_width: { 
          type: "number", 
          default: 3,
          description: "Text border/outline width"
        },
        border_color: { 
          type: "string", 
          default: "black",
          description: "Border color"
        },
        output_path: { 
          type: "string",
          description: "Output path (auto-generated if not provided)"
        },
        enable_expr: { 
          type: "string",
          description: "FFmpeg expression for when to show text (e.g., 'between(t,1,5)' for 1-5 seconds)"
        },
        box: {
          type: "boolean",
          default: false,
          description: "Whether to draw a background box behind text"
        },
        box_color: {
          type: "string",
          default: "black@0.5",
          description: "Box color with alpha (e.g., 'black@0.5' for 50% opacity)"
        }
      },
      required: ["video_path", "text"]
    }
  },
  {
    name: "add_multiple_text_overlays",
    description: "Add multiple text overlays to a video in a single pass for better performance.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to input video file"
        },
        overlays: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              position: { 
                type: "object",
                properties: { x: {}, y: {} }
              },
              font_size: { type: "number" },
              font_color: { type: "string" },
              enable_expr: { type: "string" }
            },
            required: ["text"]
          },
          description: "Array of overlay definitions"
        },
        output_path: { 
          type: "string",
          description: "Output path (auto-generated if not provided)"
        }
      },
      required: ["video_path", "overlays"]
    }
  },
  {
    name: "mix_audio",
    description: "Mix external audio with video's existing audio track.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to input video"
        },
        audio_path: { 
          type: "string",
          description: "Path to external audio file"
        },
        audio_volume: { 
          type: "number", 
          default: 1.0,
          description: "Volume multiplier for external audio (0.0 to 2.0)"
        },
        video_volume: { 
          type: "number", 
          default: 1.0,
          description: "Volume multiplier for video audio (0.0 to 2.0)"
        },
        output_path: { 
          type: "string",
          description: "Output path (auto-generated if not provided)"
        },
        duration: { 
          type: "string", 
          enum: ["first", "longest", "shortest"], 
          default: "first",
          description: "How to handle duration differences"
        }
      },
      required: ["video_path", "audio_path"]
    }
  },
  {
    name: "replace_audio",
    description: "Replace video's audio with external audio file.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to input video"
        },
        audio_path: { 
          type: "string",
          description: "Path to external audio file"
        },
        output_path: { 
          type: "string",
          description: "Output path (auto-generated if not provided)"
        },
        loop_audio: { 
          type: "boolean", 
          default: false,
          description: "Whether to loop audio to match video duration"
        }
      },
      required: ["video_path", "audio_path"]
    }
  },
  {
    name: "export_format",
    description: "Export video in specific aspect ratio with padding options.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to input video"
        },
        aspect_ratio: { 
          type: "string", 
          enum: ["9:16", "16:9", "1:1", "4:5", "2:3"],
          description: "Target aspect ratio"
        },
        output_path: { 
          type: "string",
          description: "Output path for exported video"
        },
        resolution: { 
          type: "string", 
          enum: ["720p", "1080p", "1440p", "4k"], 
          default: "1080p",
          description: "Output resolution"
        },
        quality: { 
          type: "number", 
          minimum: 18, 
          maximum: 28, 
          default: 23,
          description: "CRF quality value (lower = higher quality)"
        },
        pad_mode: { 
          type: "string", 
          enum: ["black", "blur", "color"], 
          default: "black",
          description: "How to handle aspect ratio mismatch"
        },
        pad_color: { 
          type: "string", 
          default: "black",
          description: "Padding color when pad_mode is 'color'"
        }
      },
      required: ["video_path", "aspect_ratio", "output_path"]
    }
  },
  {
    name: "create_still_clip",
    description: "Create video clip from still image with specified duration.",
    inputSchema: {
      type: "object",
      properties: {
        image_path: { 
          type: "string",
          description: "Path to input image"
        },
        duration: { 
          type: "number",
          description: "Video duration in seconds"
        },
        output_path: { 
          type: "string",
          description: "Output path (auto-generated if not provided)"
        },
        resolution: { 
          type: "string", 
          enum: ["720p", "1080p", "1440p", "4k"], 
          default: "1080p",
          description: "Output resolution"
        }
      },
      required: ["image_path", "duration"]
    }
  },
  {
    name: "generate_thumbnail",
    description: "Extract frame at timestamp as thumbnail image.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to source video"
        },
        timestamp: { 
          type: "number",
          description: "Time in seconds to extract frame"
        },
        output_path: { 
          type: "string",
          description: "Output path for thumbnail"
        },
        width: { 
          type: "number",
          description: "Optional output width"
        },
        height: { 
          type: "number",
          description: "Optional output height"
        },
        quality: { 
          type: "number", 
          default: 2,
          description: "JPEG quality (1-31, lower is better)"
        }
      },
      required: ["video_path", "timestamp", "output_path"]
    }
  },
  {
    name: "freeze_frame",
    description: "Freeze frame at specific timestamp for CTA (call-to-action) extension.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to input video"
        },
        freeze_at: { 
          type: "number",
          description: "Timestamp in seconds to freeze"
        },
        freeze_duration: { 
          type: "number",
          description: "Duration of freeze in seconds"
        },
        output_path: { 
          type: "string",
          description: "Output path for result"
        },
        fade_duration: { 
          type: "number", 
          default: 0,
          description: "Optional fade in/out duration for smooth transition"
        }
      },
      required: ["video_path", "freeze_at", "freeze_duration", "output_path"]
    }
  },
  {
    name: "get_video_info",
    description: "Get comprehensive video metadata using ffprobe.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to video file"
        }
      },
      required: ["video_path"]
    }
  },
  {
    name: "assemble_full_video",
    description: "Run full assembly pipeline from scenes using a production brief.",
    inputSchema: {
      type: "object",
      properties: {
        brief_path: { 
          type: "string",
          description: "Path to production brief JSON file"
        },
        scene_assets: { 
          type: "object",
          description: "Dictionary mapping scene_id to asset dict with 'video', 'image', 'audio' keys"
        },
        output_dir: { 
          type: "string",
          description: "Directory for output files"
        },
        generate_thumbs: { 
          type: "boolean", 
          default: true,
          description: "Whether to generate thumbnails"
        }
      },
      required: ["brief_path", "scene_assets", "output_dir"]
    }
  }
];

// Map tool names to Python module functions
export const TOOL_TO_PYTHON_MAP: Record<string, string> = {
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
