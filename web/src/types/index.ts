/**
 * Meme Engine TypeScript Types
 * ============================
 * 
 * Type definitions for the AI video meme generation pipeline.
 * Re-exported and adapted from the shared schemas for Next.js use.
 * 
 * @module types
 * @version 2.0.0
 */

// ============================================
// Utility Types
// ============================================

/** ISO 8601 timestamp string */
export type Timestamp = string;

/** UUID v4 string */
export type UUID = string;

/** File path string (absolute or relative) */
export type FilePath = string;

/** ComfyUI prompt/job ID */
export type PromptId = string;

/** Cloud filename from ComfyUI upload */
export type CloudFilename = string;

// ============================================
// Enums and Literal Types
// ============================================

/** Video format types supported by the meme engine */
export type MemeFormat = 
  | "mini-drama" 
  | "text-meme" 
  | "reaction" 
  | "skit" 
  | "compilation";

/** Visual/comedic style of the meme */
export type MemeStyle = 
  | "absurdist" 
  | "wholesome" 
  | "dark-humor" 
  | "relatable" 
  | "cinematic"
  | "noir"
  | "documentary"
  | "infomercial";

/** Narrative beat type for scene structure */
export type SceneBeat = 
  | "HOOK" 
  | "SETUP" 
  | "ESCALATION" 
  | "PUNCHLINE" 
  | "TAG"
  | "HOOK + PUNCHLINE"
  | "CONFRONTATION"
  | "CASE CLOSED";

/** Video aspect ratios supported by generation models */
export type AspectRatio = "9:16" | "16:9" | "1:1";

/** Image generation model identifiers */
export type ImageModel = 
  | "gemini-3-pro-image-preview"
  | "gemini-3-flash-image"
  | "flux-kontext"
  | "flux-kontext-pro"
  | "flux-kontext-max"
  | "dalle-3"
  | "stable-diffusion-xl";

/** Video generation model identifiers */
export type VideoModel = 
  | "kling-v3-omni"
  | "kling-v2-master"
  | "kling-v2-1"
  | "kling-v2-1-master"
  | "kling-v2-5-turbo"
  | "runway-gen4"
  | "luma-ray-2"
  | "pika-2.0";

/** TTS (Text-to-Speech) model identifiers */
export type TTSModel = 
  | "eleven_v3"
  | "eleven_multilingual_v2"
  | "eleven_turbo_v2_5";

/** Voice identifiers for ElevenLabs TTS */
export type TTSVoice = 
  | "Roger (male, american)"
  | "Sarah (female, american)"
  | "Laura (female, american)"
  | "Charlie (male, australian)"
  | "George (male, british)"
  | "Callum (male, american)"
  | "River (neutral, american)"
  | "Harry (male, american)"
  | "Liam (male, american)"
  | "Alice (female, british)"
  | "Matilda (female, american)"
  | "Will (male, american)"
  | "Jessica (female, american)"
  | "Eric (male, american)"
  | "Bella (female, american)"
  | "Chris (male, american)"
  | "Brian (male, american)"
  | "Daniel (male, british)"
  | "Lily (female, british)"
  | "Adam (male, american)"
  | "Bill (male, american)";

/** Lip sync model identifiers */
export type LipSyncModel = 
  | "kling-lip-sync"
  | "sync-labs"
  | "wav2lip";

/** Generation status for tracking job state */
export type GenerationStatus = "pending" | "success" | "failed" | "skipped";

/** Pipeline stage identifiers */
export type PipelineStage = 
  | "brief_generation"
  | "image_generation" 
  | "tts_generation"
  | "video_generation"
  | "lip_sync"
  | "assembly"
  | "export";

/** Scene generation stage for progress tracking */
export type SceneStage = "image" | "tts" | "video" | "lip_sync";

/** Overall pipeline status */
export type PipelineStatusType = 
  | "pending" 
  | "generating" 
  | "brief_ready" 
  | "complete" 
  | "failed";

// ============================================
// Production Brief Types
// ============================================

/**
 * Complete production brief for AI video meme generation.
 * This is the central data structure that defines all aspects of a meme video.
 */
export interface ProductionBrief {
  /** High-level concept description */
  concept: string;
  
  /** Video format type */
  format: MemeFormat;
  
  /** Trend relevance score (0-100) */
  trend_score: number;
  
  /** References to current trends, news, or cultural moments */
  trend_references: string[];
  
  /** Visual/comedic style */
  style: MemeStyle;
  
  /** Target duration in seconds */
  duration_target_seconds: number;
  
  /** Supported aspect ratios for output */
  aspect_ratios: AspectRatio[];
  
  /** Scene breakdowns */
  scenes: Scene[];
  
  /** Character definitions */
  characters: Character[];
  
  /** Technical generation requirements */
  generation_requirements: GenerationRequirements;
}

/**
 * Individual scene definition within a production brief.
 */
export interface Scene {
  /** Scene identifier (1-indexed) */
  scene_id: number;
  
  /** Narrative beat type */
  beat: SceneBeat;
  
  /** Scene duration in seconds */
  duration_seconds: number;
  
  /** Detailed visual description for image/video generation */
  visual: string;
  
  /** Camera direction and movement */
  camera: string;
  
  /** Character IDs present in this scene */
  characters_present: string[];
  
  /** Dialogue lines (if any) */
  dialogue: DialogueLine[];
  
  /** Sound effects descriptions */
  sfx: string[];
  
  /** Music/atmosphere description */
  music_cue: string;
  
  /** Text overlay content (null if none) */
  text_overlay: string | null;
}

/**
 * Single dialogue line with voice direction.
 */
export interface DialogueLine {
  /** Character ID speaking this line */
  character: string;
  
  /** The spoken text */
  line: string;
  
  /** Voice performance direction */
  voice_style: string;
  
  /** Emotional state/delivery */
  emotion: string;
}

/**
 * Character definition for consistency across scenes.
 */
export interface Character {
  /** Unique character identifier */
  id: string;
  
  /** Detailed visual and personality description */
  description: string;
}

/**
 * Technical requirements for generation models.
 */
export interface GenerationRequirements {
  /** Whether character consistency is required across scenes */
  character_consistency: boolean;
  
  /** Whether lip synchronization is needed */
  lip_sync_needed: boolean;
  
  /** Preferred models for each generation type */
  models_preferred: {
    image?: string;
    video?: string;
    tts?: string;
    lip_sync?: string;
  };
}

// ============================================
// Generation Log Types
// ============================================

/**
 * Complete generation log for a pipeline run.
 * Tracks all generation attempts, successes, and failures.
 */
export interface GenerationLog {
  /** Image generation entries */
  images: ImageGenerationEntry[];
  
  /** TTS generation entries */
  tts: TTSGenerationEntry[];
  
  /** Video generation entries */
  video: VideoGenerationEntry[];
  
  /** Lip sync entries */
  lip_sync: LipSyncEntry[];
  
  /** Error records */
  errors: ErrorEntry[];
  
  /** Submitted ComfyUI workflows keyed by stage */
  submitted_workflows: Record<string, ComfyUIWorkflow>;
}

/**
 * Base interface for all generation log entries.
 */
export interface BaseGenerationEntry {
  /** Associated scene ID */
  scene_id: number;
  
  /** Model used for generation */
  model: string;
  
  /** ComfyUI prompt/job ID */
  comfy_prompt_id: string;
  
  /** Local output file path/name */
  output_file: string;
  
  /** Generation status */
  status: GenerationStatus;
  
  /** Error message if failed */
  error?: string;
}

/**
 * Image generation log entry.
 */
export interface ImageGenerationEntry extends BaseGenerationEntry {
  /** Generation prompt */
  prompt: string;
  
  /** Negative prompt (what to avoid) */
  negative_prompt?: string;
  
  /** Generation parameters */
  parameters: ImageParameters;
}

/**
 * Parameters for image generation.
 */
export interface ImageParameters {
  /** Aspect ratio */
  aspect_ratio: AspectRatio;
  
  /** Random seed for reproducibility */
  seed: number;
  
  /** Output resolution (e.g., "2K", "1080p") */
  resolution?: string;
  
  /** Thinking level for Gemini models */
  thinking_level?: "MINIMAL" | "MEDIUM" | "MAXIMUM";
  
  /** Additional model-specific parameters */
  [key: string]: any;
}

/**
 * Video generation log entry.
 */
export interface VideoGenerationEntry extends BaseGenerationEntry {
  /** Originally requested model */
  model_requested: string;
  
  /** Generation prompt */
  prompt: string;
  
  /** Negative prompt */
  negative_prompt?: string;
  
  /** Generation parameters */
  parameters: VideoParameters;
  
  /** Local input image filename */
  input_image?: string;
  
  /** Cloud filename after upload */
  cloud_image?: string;
  
  /** Reason for fallback if not primary model */
  fallback_reason?: string;
}

/**
 * Parameters for video generation.
 */
export interface VideoParameters {
  /** Video duration in seconds */
  duration: number;
  
  /** Aspect ratio */
  aspect_ratio: AspectRatio;
  
  /** Whether to generate native audio (Kling v3 Omni only) */
  generate_audio?: boolean;
  
  /** CFG scale (0.0-1.0) */
  cfg_scale?: number;
  
  /** Generation mode (std/pro) */
  mode?: "std" | "pro";
  
  /** Random seed */
  seed?: number;
  
  /** Output resolution */
  resolution?: "1080p" | "720p";
  
  /** Additional model-specific parameters */
  [key: string]: any;
}

/**
 * TTS generation log entry.
 */
export interface TTSGenerationEntry extends BaseGenerationEntry {
  /** Dialogue line index within scene */
  line_index: number;
  
  /** Character speaking */
  character: string;
  
  /** Text that was spoken */
  text: string;
  
  /** Voice used */
  voice: string;
  
  /** Generation parameters */
  parameters: TTSParameters;
}

/**
 * Parameters for TTS generation.
 */
export interface TTSParameters {
  /** Speech speed (0.7-1.3) */
  speed: number;
  
  /** Voice stability (0.0-1.0) */
  stability: number;
  
  /** Similarity boost (0.0-1.0) */
  similarity_boost: number;
  
  /** TTS model used */
  model?: TTSModel;
  
  /** Additional model-specific parameters */
  [key: string]: any;
}

/**
 * Lip sync generation log entry.
 */
export interface LipSyncEntry extends BaseGenerationEntry {
  /** Input video filename */
  input_video: string;
  
  /** Input audio filename */
  input_audio: string;
  
  /** Fallback method used if lip sync failed */
  fallback?: string;
}

/**
 * Error record in generation log.
 */
export interface ErrorEntry {
  /** Pipeline stage where error occurred */
  stage: string;
  
  /** Error message */
  error: string;
  
  /** Resolution or workaround applied */
  resolution: string;
}

// ============================================
// ComfyUI Types
// ============================================

/**
 * Complete ComfyUI workflow definition.
 * Keyed by node ID with node definitions.
 */
export interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUINode;
}

/**
 * Individual ComfyUI node.
 */
export interface ComfyUINode {
  /** Node class/type */
  class_type: string;
  
  /** Node input parameters */
  inputs: Record<string, any>;
  
  /** Optional metadata */
  _meta?: {
    /** Display title */
    title?: string;
    [key: string]: any;
  };
}

/**
 * Workflow manifest for documentation and validation.
 */
export interface WorkflowManifest {
  /** Workflow name */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** Node types used in this workflow */
  node_types: string[];
  
  /** Dynamic parameter paths and descriptions */
  dynamic_params: Record<string, Record<string, string>>;
  
  /** Expected inputs */
  inputs: WorkflowInput[];
  
  /** Expected outputs */
  outputs: WorkflowOutput[];
  
  /** Additional notes */
  notes?: {
    partner_api?: string;
    character_consistency?: string;
    alternative_node?: string;
    save_video_format?: string;
    generation_time?: string;
    job_status?: string;
    audio?: string;
    storyboards?: string;
    duration?: string;
    o1_model?: string;
    limitations?: string;
    upload_note?: string;
    reliability?: string;
    model_options?: string;
    output_format_options?: string[];
    voice_format?: string;
    dynamic_combo_syntax?: string;
    [key: string]: any;
  };
}

/**
 * Workflow input definition.
 */
export interface WorkflowInput {
  /** Input name */
  name: string;
  
  /** Input data type */
  type: "image" | "text" | "number" | "boolean" | "select" | "video" | "audio";
  
  /** Whether input is required */
  required: boolean;
  
  /** Human-readable description */
  description: string;
  
  /** Default value */
  default?: any;
  
  /** Options for select type */
  options?: string[];
}

/**
 * Workflow output definition.
 */
export interface WorkflowOutput {
  /** Output name */
  name: string;
  
  /** Output data type */
  type: "image" | "video" | "audio" | "gif";
  
  /** Source node ID */
  node_id: string;
  
  /** Output index on the node */
  output_index: number;
}

// ============================================
// ComfyUI Cloud API Types
// ============================================

/**
 * Request body for submitting a workflow to ComfyUI Cloud.
 */
export interface SubmitWorkflowRequest {
  /** The workflow to execute */
  prompt: ComfyUIWorkflow;
  
  /** Additional data for partner APIs */
  extra_data?: {
    api_key_comfy_org?: string;
    [key: string]: any;
  };
  
  /** Client identifier for WebSocket */
  client_id?: string;
}

/**
 * Response from workflow submission.
 */
export interface SubmitWorkflowResponse {
  /** Prompt/job ID */
  prompt_id: string;
  
  /** Queue number */
  number?: number;
  
  /** Node-specific errors during validation */
  node_errors?: Record<string, any>;
}

/**
 * Job status response from ComfyUI Cloud.
 */
export interface JobStatusResponse {
  /** Current status */
  status: "pending" | "running" | "success" | "failed" | "completed";
  
  /** Progress percentage (0-100) */
  progress?: number;
  
  /** Output files by node */
  outputs?: Record<string, any>;
  
  /** Error message if failed */
  error?: string;
}

/**
 * Response from file upload.
 */
export interface UploadResponse {
  /** Cloud filename */
  name: string;
  
  /** Subfolder path */
  subfolder: string;
  
  /** File type */
  type: string;
}

/**
 * WebSocket message from ComfyUI Cloud.
 */
export interface WebSocketMessage {
  /** Message type */
  type: "executing" | "progress" | "executed" | "execution_success" | "execution_error" | "status";
  
  /** Message data payload */
  data: {
    prompt_id?: string;
    node?: string;
    value?: number;
    max?: number;
    output?: any;
    exception_message?: string;
    status?: {
      exec_info?: {
        queue_remaining?: number;
      };
    };
    [key: string]: any;
  };
}

// ============================================
// Pipeline Status Types
// ============================================

/**
 * Complete pipeline status for tracking generation progress.
 */
export interface PipelineStatus {
  /** Unique request identifier */
  request_id: string;
  
  /** URL-friendly slug */
  slug: string;
  
  /** Overall pipeline status */
  status: PipelineStatusType;
  
  /** Current pipeline stage */
  stage: string;
  
  /** Human-readable status detail */
  detail: string;
  
  /** Progress information */
  progress?: PipelineProgress;
  
  /** Generated outputs */
  outputs?: PipelineOutputs;
  
  /** Error records */
  errors: PipelineError[];
  
  /** Start time (ISO 8601) */
  started_at: Timestamp;
  
  /** Last update time (ISO 8601) */
  updated_at: Timestamp;
}

/**
 * Pipeline progress information.
 */
export interface PipelineProgress {
  /** Total number of scenes */
  total_scenes: number;
  
  /** Number of completed scenes */
  completed_scenes: number;
  
  /** Currently processing scene (if any) */
  current_scene?: number;
  
  /** Current stage within scene (if any) */
  scene_stage?: SceneStage;
  
  /** Percentage complete (0-100) */
  percent_complete?: number;
}

/**
 * Pipeline outputs collection.
 */
export interface PipelineOutputs {
  /** Path to generated brief JSON */
  brief?: string;
  
  /** Scene outputs keyed by scene ID */
  scenes?: Record<string, SceneOutputs>;
  
  /** Final assembled videos */
  final_videos?: FinalVideos;
}

/**
 * Outputs for a single scene.
 */
export interface SceneOutputs {
  /** Generated image path */
  image?: string;
  
  /** Generated video path */
  video?: string;
  
  /** Generated audio path */
  audio?: string;
  
  /** Lip-synced video path */
  lip_sync?: string;
}

/**
 * Final assembled video outputs.
 */
export interface FinalVideos {
  /** Vertical mobile format */
  "9x16": string;
  
  /** Horizontal desktop format */
  "16x9": string;
  
  /** Thumbnail image */
  thumbnail: string;
}

/**
 * Pipeline error record.
 */
export interface PipelineError {
  /** Stage where error occurred */
  stage: string;
  
  /** Scene ID (if applicable) */
  scene_id?: number;
  
  /** Error message */
  error: string;
  
  /** Resolution or fallback applied */
  resolution?: string;
  
  /** Error timestamp */
  timestamp: Timestamp;
}

// ============================================
// MCP Tool Types
// ============================================

/**
 * Input parameters for generate_image tool.
 */
export interface GenerateImageInput {
  /** Generation prompt */
  prompt: string;
  
  /** Output aspect ratio */
  aspect_ratio?: AspectRatio;
  
  /** Primary model to use */
  primary_model?: "gemini-3-pro" | "flux-kontext";
  
  /** Random seed for reproducibility */
  seed?: number;
  
  /** Whether to enable fallback models on failure */
  enable_fallbacks?: boolean;
}

/**
 * Output from generate_image tool.
 */
export interface GenerateImageOutput {
  /** Local file path */
  local_path: FilePath;
  
  /** Cloud filename after upload */
  cloud_filename: CloudFilename;
  
  /** Model that was used */
  model_used: string;
  
  /** ComfyUI prompt ID */
  prompt_id: PromptId;
  
  /** Generation time in milliseconds */
  generation_time_ms: number;
}

/**
 * Input parameters for generate_video tool.
 */
export interface GenerateVideoInput {
  /** Path to input image */
  image_path: FilePath;
  
  /** Motion/prompt description */
  prompt: string;
  
  /** Video duration in seconds */
  duration?: number;
  
  /** Output aspect ratio */
  aspect_ratio?: AspectRatio;
  
  /** Whether to generate native audio (Kling v3 Omni only) */
  generate_audio?: boolean;
  
  /** Video model to use */
  model?: "kling-v3-omni" | "kling-v2-master";
  
  /** Random seed */
  seed?: number;
}

/**
 * Output from generate_video tool.
 */
export interface GenerateVideoOutput {
  /** Local file path */
  local_path: FilePath;
  
  /** Cloud filename */
  cloud_filename: CloudFilename;
  
  /** Model that was used */
  model_used: VideoModel;
  
  /** ComfyUI prompt ID */
  prompt_id: PromptId;
  
  /** Whether video has native audio */
  has_native_audio: boolean;
  
  /** Generation time in milliseconds */
  generation_time_ms: number;
}

/**
 * Input parameters for text_to_speech tool.
 */
export interface TextToSpeechInput {
  /** Text to speak */
  text: string;
  
  /** Voice to use */
  voice: TTSVoice;
  
  /** Speech speed (0.7-1.3) */
  speed?: number;
  
  /** Voice stability (0.0-1.0) */
  stability?: number;
  
  /** Similarity boost (0.0-1.0) */
  similarity_boost?: number;
  
  /** TTS model */
  model?: TTSModel;
}

/**
 * Output from text_to_speech tool.
 */
export interface TextToSpeechOutput {
  /** Local file path */
  local_path: FilePath;
  
  /** Cloud filename */
  cloud_filename: CloudFilename;
  
  /** Voice used */
  voice: TTSVoice;
  
  /** Model used */
  model_used: TTSModel;
  
  /** ComfyUI prompt ID */
  prompt_id: PromptId;
  
  /** Generation time in milliseconds */
  generation_time_ms: number;
}

/**
 * Input parameters for lip_sync tool.
 */
export interface LipSyncInput {
  /** Path to input video */
  video_path: FilePath;
  
  /** Path to input audio */
  audio_path: FilePath;
  
  /** Lip sync model to use */
  model?: LipSyncModel;
  
  /** Voice language */
  voice_language?: "zh" | "en";
}

/**
 * Output from lip_sync tool.
 */
export interface LipSyncOutput {
  /** Local file path */
  local_path: FilePath;
  
  /** Cloud filename */
  cloud_filename: CloudFilename;
  
  /** Model used */
  model_used: LipSyncModel;
  
  /** ComfyUI prompt ID */
  prompt_id: PromptId;
  
  /** Whether lip sync succeeded */
  success: boolean;
  
  /** Fallback method if primary failed */
  fallback?: string;
}

/**
 * Input parameters for generate_brief tool.
 */
export interface GenerateBriefInput {
  /** Core meme concept */
  concept: string;
  
  /** Desired format */
  format?: MemeFormat;
  
  /** Target style */
  style?: MemeStyle;
  
  /** Target duration in seconds */
  duration_seconds?: number;
  
  /** Required aspect ratios */
  aspect_ratios?: AspectRatio[];
  
  /** Character descriptions (if predefined) */
  characters?: Pick<Character, "id" | "description">[];
}

/**
 * Output from generate_brief tool.
 */
export interface GenerateBriefOutput {
  /** Generated production brief */
  brief: ProductionBrief;
  
  /** Path to saved brief JSON */
  brief_path: FilePath;
  
  /** Brief slug identifier */
  slug: string;
}

/**
 * Input parameters for assemble_video tool.
 */
export interface AssembleVideoInput {
  /** Path to brief JSON */
  brief_path: FilePath;
  
  /** Output directory */
  output_dir: FilePath;
  
  /** Scene assets mapping */
  scene_assets: Record<number, SceneAssetPaths>;
}

/**
 * Output from assemble_video tool.
 */
export interface AssembleVideoOutput {
  /** Final assembled videos */
  videos: FinalVideos;
  
  /** Assembly metadata */
  metadata: AssemblyMetadata;
}

// ============================================
// Video Assembly Types
// ============================================

/**
 * Text overlay configuration.
 */
export interface TextOverlay {
  /** Text content */
  text: string;
  
  /** Position configuration */
  position: Position;
  
  /** Font size in pixels */
  font_size?: number;
  
  /** Font color */
  font_color?: string;
  
  /** Border width for readability */
  border_width?: number;
  
  /** Border color */
  border_color?: string;
  
  /** Background box */
  box?: {
    enabled: boolean;
    color: string;
    border_width: number;
  };
}

/**
 * Text position - can be centered or absolute.
 */
export type Position = 
  | { type: "center"; offset_y?: number }
  | { type: "top"; offset_y?: number }
  | { type: "bottom"; offset_y?: number }
  | { type: "absolute"; x: number; y: number };

/**
 * Asset paths for a single scene.
 */
export interface SceneAssetPaths {
  /** Image asset path */
  image?: FilePath;
  
  /** Video asset path */
  video?: FilePath;
  
  /** Audio asset path */
  audio?: FilePath;
  
  /** Lip-synced video path */
  lip_sync?: FilePath;
}

/**
 * Video assembly configuration.
 */
export interface AssemblyConfig {
  /** Path to brief JSON */
  brief_path: FilePath;
  
  /** Output directory */
  output_dir: FilePath;
  
  /** Scene assets keyed by scene ID */
  scene_assets: Record<number, SceneAssetPaths>;
  
  /** Output formats to generate */
  output_formats?: ("9:16" | "16:9" | "1:1")[];
  
  /** Whether to generate thumbnails */
  generate_thumbnails?: boolean;
}

/**
 * Video assembly result.
 */
export interface AssemblyResult {
  /** Vertical format output */
  "9x16": FilePath;
  
  /** Horizontal format output */
  "16x9": FilePath;
  
  /** Thumbnail image */
  thumbnail: FilePath;
  
  /** Assembly metadata */
  metadata: AssemblyMetadata;
}

/**
 * Assembly metadata.
 */
export interface AssemblyMetadata {
  /** Source concept */
  concept: string;
  
  /** Total duration in seconds */
  duration_seconds: number;
  
  /** FFmpeg commands used */
  ffmpeg_commands: string[];
  
  /** Scene assembly info */
  scenes?: Array<{
    scene_id: number;
    beat: string;
    asset_used: string;
    duration_actual: number;
    text_overlay?: string | null;
  }>;
  
  /** Assembly notes */
  assembly_notes?: {
    lip_sync?: string;
    scene_extensions?: string;
    aspect_ratio_method?: string;
    [key: string]: any;
  };
}

// ============================================
// Export/Metadata Types
// ============================================

/**
 * Final export metadata.
 */
export interface ExportMetadata {
  /** Source concept */
  concept: string;
  
  /** URL-friendly slug */
  slug: string;
  
  /** Video format */
  format: MemeFormat;
  
  /** Visual style */
  style: MemeStyle;
  
  /** Total duration in seconds */
  duration_seconds: number;
  
  /** Output files */
  outputs: {
    "16x9": VideoOutputInfo;
    "9x16": VideoOutputInfo;
  };
  
  /** Thumbnail paths */
  thumbnails: {
    "16x9": string;
    "9x16": string;
  };
  
  /** Suggested social media caption */
  suggested_caption: string;
  
  /** Suggested hashtags */
  suggested_hashtags: string[];
  
  /** Scene details */
  scenes: Array<{
    scene_id: number;
    beat: string;
    asset_used: string;
    duration_actual: number;
    text_overlay?: string | null;
  }>;
  
  /** Assembly notes */
  assembly_notes?: Record<string, string>;
}

/**
 * Video output file information.
 */
export interface VideoOutputInfo {
  /** Filename */
  file: string;
  
  /** Resolution (e.g., "1920x1080") */
  resolution: string;
  
  /** File size in bytes */
  size_bytes: number;
}

// ============================================
// API Request/Response Types
// ============================================

/**
 * Request body for creating a new meme generation request
 */
export interface CreateMemeRequest {
  /** Meme concept/description */
  concept: string;
  
  /** Video format */
  format?: MemeFormat;
  
  /** Visual style */
  style?: MemeStyle;
  
  /** Target duration in seconds */
  duration?: number;
  
  /** Export formats */
  exportFormats?: ("9:16" | "16:9" | "1:1")[];
}

/**
 * Response from creating a meme generation request
 */
export interface CreateMemeResponse {
  /** Unique request ID */
  request_id: string;
  
  /** Pipeline ID for tracking */
  pipeline_id: string;
  
  /** Current status */
  status: "pending" | "generating" | "brief_ready" | "complete" | "failed";
  
  /** URL-friendly slug */
  slug: string;
  
  /** Timestamp */
  created_at: string;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  /** Error message */
  error: string;
  
  /** Error code */
  code?: string;
  
  /** Additional details */
  details?: Record<string, any>;
}

// ============================================
// Constants
// ============================================

/** Available meme formats */
export const MEME_FORMATS: MemeFormat[] = [
  "mini-drama",
  "text-meme",
  "reaction",
  "skit",
  "compilation"
];

/** Available meme styles */
export const MEME_STYLES: MemeStyle[] = [
  "absurdist",
  "wholesome",
  "dark-humor",
  "relatable",
  "cinematic",
  "noir",
  "documentary",
  "infomercial"
];

/** Available scene beats */
export const SCENE_BEATS: SceneBeat[] = [
  "HOOK",
  "SETUP",
  "ESCALATION",
  "PUNCHLINE",
  "TAG"
];

/** Available aspect ratios */
export const ASPECT_RATIOS: AspectRatio[] = [
  "9:16",
  "16:9",
  "1:1"
];

/** Available TTS voices */
export const TTS_VOICES: TTSVoice[] = [
  "Roger (male, american)",
  "Sarah (female, american)",
  "Laura (female, american)",
  "Charlie (male, australian)",
  "George (male, british)",
  "Callum (male, american)",
  "River (neutral, american)",
  "Harry (male, american)",
  "Liam (male, american)",
  "Alice (female, british)",
  "Matilda (female, american)",
  "Will (male, american)",
  "Jessica (female, american)",
  "Eric (male, american)",
  "Bella (female, american)",
  "Chris (male, american)",
  "Brian (male, american)",
  "Daniel (male, british)",
  "Lily (female, british)",
  "Adam (male, american)",
  "Bill (male, american)"
];

/** Default generation parameters */
export const DEFAULTS = {
  aspect_ratio: "9:16" as AspectRatio,
  duration_seconds: 15,
  image_seed: 42,
  video_seed: 100,
  tts_speed: 1.0,
  tts_stability: 0.5,
  tts_similarity_boost: 0.75,
  video_cfg_scale: 0.8,
  video_mode: "pro" as "std" | "pro",
  image_resolution: "2K",
  thinking_level: "MINIMAL" as "MINIMAL" | "MEDIUM" | "MAXIMUM"
};
