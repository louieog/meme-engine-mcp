/**
 * Tool definitions for the ComfyUI MCP Server
 * 
 * These tools wrap the Python comfyui_client.py module functionality
 * for image generation, video generation, text-to-speech, and lip-sync.
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
    name: "generate_image",
    description: "Generate image using ComfyUI Cloud with automatic fallback chain. Supports Gemini 2, Gemini Nano, and Flux Kontext models.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { 
          type: "string", 
          description: "Image generation prompt - detailed description of desired image" 
        },
        aspect_ratio: { 
          type: "string", 
          enum: ["9:16", "16:9", "1:1"], 
          default: "9:16",
          description: "Output aspect ratio (9:16=vertical, 16:9=horizontal, 1:1=square)"
        },
        primary_model: { 
          type: "string", 
          enum: ["gemini-3-pro", "flux-kontext", "nano-banana-2"], 
          default: "gemini-3-pro",
          description: "Primary model to try first"
        },
        seed: { 
          type: "number", 
          description: "Random seed for reproducible generation (optional)" 
        },
        enable_fallbacks: { 
          type: "boolean", 
          default: true,
          description: "Whether to try fallback models if primary fails"
        },
        scene_id: {
          type: "number",
          default: 1,
          description: "Scene identifier for filename prefixing"
        },
        resolution: {
          type: "string",
          enum: ["1K", "2K"],
          default: "2K",
          description: "Output resolution for Gemini models"
        }
      },
      required: ["prompt"]
    }
  },
  {
    name: "generate_video",
    description: "Generate video from image using ComfyUI Cloud. Supports Kling Omni Pro v3 (with native audio) and Kling v2 Master (silent).",
    inputSchema: {
      type: "object",
      properties: {
        image_path: { 
          type: "string", 
          description: "Local path to input image file (will be uploaded to ComfyUI Cloud)" 
        },
        cloud_image: {
          type: "string",
          description: "Already-uploaded image filename on ComfyUI Cloud (alternative to image_path)"
        },
        prompt: { 
          type: "string", 
          description: "Motion prompt describing desired video movement (e.g., 'Camera slowly zooms in')" 
        },
        duration: { 
          type: "number", 
          minimum: 3, 
          maximum: 15, 
          default: 5,
          description: "Video duration in seconds (3-15, recommended: 5)"
        },
        aspect_ratio: { 
          type: "string", 
          enum: ["9:16", "16:9", "1:1"], 
          default: "9:16",
          description: "Output aspect ratio"
        },
        generate_audio: { 
          type: "boolean", 
          default: false,
          description: "Whether to generate native audio (Kling Omni Pro v3 only)"
        },
        model: { 
          type: "string", 
          enum: ["kling-v3-omni", "kling-v2-master"], 
          default: "kling-v3-omni",
          description: "Video generation model (v3-omni includes native audio option)"
        },
        seed: { 
          type: "number",
          description: "Random seed for reproducible generation"
        },
        scene_id: {
          type: "number",
          default: 1,
          description: "Scene identifier for filename prefixing"
        }
      },
      required: ["prompt", "scene_id"]
    }
  },
  {
    name: "text_to_speech",
    description: "Generate speech using ElevenLabs via ComfyUI Cloud. High-quality voice synthesis with multiple voice options.",
    inputSchema: {
      type: "object",
      properties: {
        text: { 
          type: "string",
          description: "Text to synthesize into speech"
        },
        voice: { 
          type: "string", 
          default: "George (male, british)",
          description: "Voice model. Options: 'George (male, british)', 'Rachel', 'Adam', 'Antoni', 'Bella', 'Domi', 'Elli', 'Josh'"
        },
        speed: { 
          type: "number", 
          minimum: 0.5, 
          maximum: 1.5,
          default: 0.9,
          description: "Speech speed multiplier (0.5=slow, 1.0=normal, 1.5=fast)"
        },
        stability: { 
          type: "number", 
          minimum: 0.0, 
          maximum: 1.0,
          default: 0.4,
          description: "Voice stability/consistency (lower=more variable, higher=more consistent)"
        },
        similarity_boost: { 
          type: "number", 
          minimum: 0.0, 
          maximum: 1.0,
          default: 0.8,
          description: "Clarity and similarity boost (higher=clearer but potentially less natural)"
        },
        seed: { 
          type: "number",
          description: "Random seed for reproducible generation"
        },
        scene_id: {
          type: "number",
          default: 1,
          description: "Scene identifier for filename prefixing"
        },
        line_index: {
          type: "number",
          default: 0,
          description: "Line number within scene for multi-line scripts"
        }
      },
      required: ["text"]
    }
  },
  {
    name: "lip_sync",
    description: "Synchronize video with audio using lip-sync model to create talking head videos.",
    inputSchema: {
      type: "object",
      properties: {
        video_path: { 
          type: "string",
          description: "Cloud filename of video to sync (e.g., 'scene1-9x16-video_0001_.mp4')"
        },
        audio_path: { 
          type: "string",
          description: "Cloud filename of audio to sync with (e.g., 'scene1-tts-00.wav')"
        },
        model: { 
          type: "string", 
          default: "sync-1.6.0",
          description: "Lip-sync model version"
        },
        scene_id: {
          type: "number",
          default: 1,
          description: "Scene identifier for filename prefixing"
        }
      },
      required: ["video_path", "audio_path"]
    }
  },
  {
    name: "upload_file",
    description: "Upload a local file to ComfyUI Cloud for use in workflows.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { 
          type: "string",
          description: "Local path to file to upload"
        }
      },
      required: ["file_path"]
    }
  },
  {
    name: "download_file",
    description: "Download a file from ComfyUI Cloud to local storage.",
    inputSchema: {
      type: "object",
      properties: {
        filename: { 
          type: "string",
          description: "Filename on ComfyUI Cloud"
        },
        dest_path: { 
          type: "string",
          description: "Local destination path"
        },
        subfolder: { 
          type: "string", 
          default: "",
          description: "Subfolder path on server"
        }
      },
      required: ["filename", "dest_path"]
    }
  },
  {
    name: "get_job_status",
    description: "Check status of a submitted ComfyUI job using its prompt ID.",
    inputSchema: {
      type: "object",
      properties: {
        prompt_id: { 
          type: "string",
          description: "The prompt ID returned from a previous submission"
        }
      },
      required: ["prompt_id"]
    }
  },
  {
    name: "create_workflow",
    description: "Create a ComfyUI workflow JSON for inspection or manual submission.",
    inputSchema: {
      type: "object",
      properties: {
        workflow_type: { 
          type: "string", 
          enum: ["image", "video", "tts", "lipsync"],
          description: "Type of workflow to create"
        },
        params: { 
          type: "object",
          description: "Workflow-specific parameters"
        }
      },
      required: ["workflow_type", "params"]
    }
  }
];

// Map tool names to Python module functions
export const TOOL_TO_PYTHON_MAP: Record<string, string> = {
  generate_image: "generate_image",
  generate_video: "generate_video",
  text_to_speech: "text_to_speech",
  lip_sync: "lip_sync",
  upload_file: "upload_file",
  download_file: "download_file",
  get_job_status: "get_job_status",
  create_workflow: "create_workflow"
};
