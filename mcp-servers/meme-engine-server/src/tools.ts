/**
 * Tool definitions for the Meme Engine MCP Server
 * 
 * High-level orchestration tools for end-to-end meme video generation.
 * Coordinates between ComfyUI server and Assembly server.
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
    name: "research_trends",
    description: "Research current meme trends and viral content for a given topic. Returns trending formats, hashtags, and engagement metrics.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { 
          type: "string",
          description: "Topic or niche to research (e.g., 'cats', 'finance', 'gaming')"
        },
        platform: { 
          type: "string", 
          enum: ["tiktok", "instagram", "youtube", "all"], 
          default: "all",
          description: "Target platform for trend research"
        },
        days_back: { 
          type: "number", 
          default: 7,
          description: "Number of days to look back for trends"
        }
      },
      required: ["topic"]
    }
  },
  {
    name: "create_production_brief",
    description: "Create a production brief from a meme concept. Generates scene-by-scene breakdown with prompts for image/video generation.",
    inputSchema: {
      type: "object",
      properties: {
        concept: { 
          type: "string",
          description: "Meme concept or script idea"
        },
        target_duration: { 
          type: "number", 
          default: 15,
          description: "Target video duration in seconds"
        },
        style: { 
          type: "string", 
          enum: ["news", "sketch", "animation", "reaction", "tutorial"], 
          default: "news",
          description: "Video style/format"
        },
        characters: { 
          type: "array",
          items: { type: "string" },
          description: "List of character descriptions"
        },
        output_path: { 
          type: "string",
          description: "Path to save the brief JSON file"
        }
      },
      required: ["concept"]
    }
  },
  {
    name: "generate_meme_video",
    description: "Run full meme video generation pipeline: generate images, videos, audio, and assemble final output.",
    inputSchema: {
      type: "object",
      properties: {
        brief_path: { 
          type: "string",
          description: "Path to production brief JSON file"
        },
        concept: {
          type: "string",
          description: "Direct concept (alternative to brief_path)"
        },
        output_dir: { 
          type: "string",
          description: "Directory for all output files"
        },
        scenes: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              image_prompt: { type: "string" },
              video_prompt: { type: "string" },
              audio_script: { type: "string" },
              duration: { type: "number" }
            }
          },
          description: "Scene definitions (if not using brief)"
        },
        characters: {
          type: "object",
          description: "Character definitions with descriptions"
        },
        skip_image_gen: { 
          type: "boolean", 
          default: false,
          description: "Skip image generation if images already exist"
        },
        skip_video_gen: { 
          type: "boolean", 
          default: false,
          description: "Skip video generation if videos already exist"
        },
        skip_audio_gen: { 
          type: "boolean", 
          default: false,
          description: "Skip audio/TTS generation if audio already exists"
        },
        export_formats: { 
          type: "array", 
          items: { type: "string", enum: ["9:16", "16:9", "1:1"] },
          default: ["9:16", "16:9"],
          description: "Output aspect ratios to generate"
        }
      },
      required: ["output_dir"]
    }
  },
  {
    name: "generate_scene_assets",
    description: "Generate assets for a single scene (image, video, audio).",
    inputSchema: {
      type: "object",
      properties: {
        scene_id: { 
          type: "number",
          description: "Scene identifier"
        },
        image_prompt: { 
          type: "string",
          description: "Prompt for character/background image generation"
        },
        video_prompt: { 
          type: "string",
          description: "Motion prompt for video generation"
        },
        audio_script: { 
          type: "string",
          description: "Script text for TTS generation"
        },
        duration: { 
          type: "number", 
          default: 5,
          description: "Video duration in seconds"
        },
        aspect_ratio: { 
          type: "string", 
          enum: ["9:16", "16:9", "1:1"], 
          default: "9:16",
          description: "Output aspect ratio"
        },
        output_dir: { 
          type: "string",
          description: "Directory for output files"
        },
        skip_existing: { 
          type: "boolean", 
          default: true,
          description: "Skip generation if files already exist"
        }
      },
      required: ["scene_id", "output_dir"]
    }
  },
  {
    name: "add_text_hooks",
    description: "Add viral text hooks and captions to a video.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Path to input video"
        },
        hooks: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              start_time: { type: "number" },
              end_time: { type: "number" },
              position: { type: "object" },
              style: { type: "string", enum: ["title", "caption", "cta"] }
            }
          },
          description: "List of text hooks to add"
        },
        output_path: { 
          type: "string",
          description: "Output path for result"
        }
      },
      required: ["video_path", "hooks"]
    }
  },
  {
    name: "get_pipeline_status",
    description: "Check status of a running meme generation pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        pipeline_id: { 
          type: "string",
          description: "Pipeline identifier returned from generate_meme_video"
        }
      },
      required: ["pipeline_id"]
    }
  },
  {
    name: "list_available_models",
    description: "List all available models for image/video generation with descriptions.",
    inputSchema: {
      type: "object",
      properties: {
        type: { 
          type: "string", 
          enum: ["image", "video", "audio", "all"], 
          default: "all",
          description: "Filter by model type"
        }
      }
    }
  },
  {
    name: "validate_brief",
    description: "Validate a production brief for completeness and feasibility.",
    inputSchema: {
      type: "object",
      properties: {
        brief_path: { 
          type: "string",
          description: "Path to brief JSON file"
        },
        brief_json: { 
          type: "object",
          description: "Brief as JSON object (alternative to file path)"
        }
      }
    }
  },
  {
    name: "estimate_cost",
    description: "Estimate generation cost based on brief complexity.",
    inputSchema: {
      type: "object",
      properties: {
        brief_path: { 
          type: "string",
          description: "Path to brief JSON file"
        },
        scene_count: { 
          type: "number",
          description: "Number of scenes (if no brief provided)"
        },
        include_audio: { 
          type: "boolean", 
          default: true,
          description: "Whether to include audio generation"
        },
        include_lipsync: { 
          type: "boolean", 
          default: false,
          description: "Whether to include lip-sync processing"
        }
      }
    }
  }
];

// Tool name mappings for internal routing
export const TOOL_CATEGORIES: Record<string, string> = {
  research_trends: "research",
  create_production_brief: "planning",
  generate_meme_video: "generation",
  generate_scene_assets: "generation",
  add_text_hooks: "post-processing",
  get_pipeline_status: "monitoring",
  list_available_models: "info",
  validate_brief: "validation",
  estimate_cost: "planning"
};
