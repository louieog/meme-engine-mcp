# Meme Engine API Reference

Complete API documentation for the MCP-based Meme Engine.

## Table of Contents

- [MCP Tools](#mcp-tools)
  - [ComfyUI Server](#comfyui-server)
  - [Assembly Server](#assembly-server)
  - [Meme Engine Server](#meme-engine-server)
- [Python Modules](#python-modules)
  - [ComfyUIClient](#comfyuiclient)
  - [Workflow Builders](#workflow-builders)
  - [VideoAssembler](#videoassembler)
- [TypeScript Types](#typescript-types)
- [Web API](#web-api)

---

## MCP Tools

### ComfyUI Server

Tools for interacting with ComfyUI Cloud for media generation.

#### `generate_image`

Generate images using ComfyUI Cloud with automatic fallback chain.

**Input Schema:**
```typescript
{
  prompt: string;              // Image generation prompt
  aspect_ratio: "9:16" | "16:9" | "1:1";  // Default: "9:16"
  primary_model: "gemini-3-pro" | "flux-kontext" | "nano-banana-2";  // Default: "gemini-3-pro"
  seed?: number;               // Random seed for reproducibility
  enable_fallbacks: boolean;   // Default: true
  scene_id: number;            // Default: 1
  resolution: "1K" | "2K";     // Default: "2K"
}
```

**Output:**
```typescript
{
  local_path: string;          // Path to downloaded image
  cloud_filename: string;      // Filename on ComfyUI Cloud
  model_used: string;          // Model that succeeded
  prompt_id: string;           // ComfyUI job ID
  generation_time_ms: number;  // Time taken
}
```

**Example:**
```typescript
const result = await client.callTool("generate_image", {
  prompt: "A professional tabby cat news anchor wearing glasses",
  aspect_ratio: "9:16",
  scene_id: 1
});
```

#### `generate_video`

Generate video from an image using ComfyUI Cloud.

**Input Schema:**
```typescript
{
  image_path?: string;         // Local path to input image
  cloud_image?: string;        // Already-uploaded cloud filename (alternative)
  prompt: string;              // Motion prompt
  duration: number;            // 3-15 seconds, default: 5
  aspect_ratio: "9:16" | "16:9" | "1:1";  // Default: "9:16"
  generate_audio: boolean;     // Default: false
  model: "kling-v3-omni" | "kling-v2-master";  // Default: "kling-v3-omni"
  seed?: number;
  scene_id: number;            // Default: 1
}
```

**Output:**
```typescript
{
  local_path: string;
  cloud_filename: string;
  model_used: string;
  prompt_id: string;
  has_native_audio: boolean;   // Only for Kling v3 Omni
  generation_time_ms: number;
}
```

**Example:**
```typescript
const result = await client.callTool("generate_video", {
  image_path: "./scene1-char.png",
  prompt: "Camera slowly zooms in on the cat's face",
  duration: 5,
  generate_audio: true,
  scene_id: 1
});
```

#### `text_to_speech`

Generate speech using ElevenLabs via ComfyUI Cloud.

**Input Schema:**
```typescript
{
  text: string;                // Text to synthesize
  voice: string;               // Default: "George (male, british)"
  speed: number;               // 0.5-1.5, default: 0.9
  stability: number;           // 0.0-1.0, default: 0.4
  similarity_boost: number;    // 0.0-1.0, default: 0.8
  seed?: number;
  scene_id: number;            // Default: 1
  line_index: number;          // Default: 0
}
```

**Available Voices:**
- `"George (male, british)"` - Professional news anchor voice
- `"Sarah (female, american)"` - Female American voice
- `"Adam (male, american)"` - Male American voice
- `"Antoni"` - Male voice with warmth
- `"Bella"` - Female American voice
- `"Rachel"` - Female American voice
- `"Charlie (male, australian)"` - Australian male

**Output:**
```typescript
{
  local_path: string;
  cloud_filename: string;
  voice: string;
  model_used: string;
  prompt_id: string;
  generation_time_ms: number;
}
```

#### `lip_sync`

Synchronize video with audio to create talking head videos.

**Input Schema:**
```typescript
{
  video_path: string;          // Cloud filename of video
  audio_path: string;          // Cloud filename of audio
  model: string;               // Default: "sync-1.6.0"
  scene_id: number;            // Default: 1
}
```

**Output:**
```typescript
{
  local_path: string;
  cloud_filename: string;
  model_used: string;
  prompt_id: string;
  success: boolean;
  fallback?: string;           // Fallback method if primary failed
}
```

#### `upload_file`

Upload a local file to ComfyUI Cloud.

**Input Schema:**
```typescript
{
  file_path: string;           // Local file path
}
```

**Output:**
```typescript
{
  name: string;                // Cloud filename
  subfolder: string;
  type: string;
}
```

#### `download_file`

Download a file from ComfyUI Cloud to local storage.

**Input Schema:**
```typescript
{
  filename: string;            // Cloud filename
  dest_path: string;           // Local destination path
  subfolder?: string;          // Default: ""
}
```

**Output:**
```typescript
{
  success: boolean;
  local_path: string;
  size_bytes: number;
}
```

#### `get_job_status`

Check the status of a submitted ComfyUI job.

**Input Schema:**
```typescript
{
  prompt_id: string;           // Job ID from submission
}
```

**Output:**
```typescript
{
  status: "pending" | "running" | "success" | "failed" | "completed";
  progress?: number;           // 0-100
  outputs?: Record<string, any>;
  error?: string;
}
```

---

### Assembly Server

Tools for video post-processing using ffmpeg.

#### `concatenate_scenes`

Join multiple video clips into a single video.

**Input Schema:**
```typescript
{
  scene_paths: string[];       // List of video file paths
  output_path: string;         // Output file path
  transition: "none" | "fade" | "crossfade";  // Default: "none"
  reencode: boolean;           // Default: false
}
```

**Output:**
```typescript
{
  output_path: string;
  duration_seconds: number;
  scenes_concatenated: number;
}
```

#### `add_text_overlay`

Add text overlay to a video.

**Input Schema:**
```typescript
{
  video_path: string;
  text: string;                // Use \n for newlines
  position: {
    x: number | "center" | "left" | "right";
    y: number | "center" | "top" | "bottom";
  };                           // Default: {x: "center", y: "bottom-100"}
  font_size: number;           // Default: 72
  font_color: string;          // Default: "white"
  border_width: number;        // Default: 3
  border_color: string;        // Default: "black"
  output_path?: string;
  enable_expr?: string;        // e.g., "between(t,1,5)"
  box: boolean;                // Default: false
  box_color: string;           // Default: "black@0.5"
}
```

**Output:**
```typescript
{
  output_path: string;
  duration_seconds: number;
}
```

**Example:**
```typescript
const result = await client.callTool("add_text_overlay", {
  video_path: "./scene1.mp4",
  text: "Breaking News!\nCat becomes CEO",
  position: { x: "center", y: "bottom-100" },
  font_size: 64,
  box: true
});
```

#### `add_multiple_text_overlays`

Add multiple text overlays in a single pass for better performance.

**Input Schema:**
```typescript
{
  video_path: string;
  overlays: Array<{
    text: string;
    position?: { x: any; y: any };
    font_size?: number;
    font_color?: string;
    enable_expr?: string;
  }>;
  output_path?: string;
}
```

#### `mix_audio`

Mix external audio with video's existing audio.

**Input Schema:**
```typescript
{
  video_path: string;
  audio_path: string;
  audio_volume: number;        // 0.0-2.0, default: 1.0
  video_volume: number;        // 0.0-2.0, default: 1.0
  output_path?: string;
  duration: "first" | "longest" | "shortest";  // Default: "first"
}
```

**Output:**
```typescript
{
  output_path: string;
  mixed_tracks: number;
  duration_seconds: number;
}
```

#### `replace_audio`

Replace video's audio with external audio file.

**Input Schema:**
```typescript
{
  video_path: string;
  audio_path: string;
  output_path?: string;
  loop_audio: boolean;         // Default: false
}
```

#### `export_format`

Export video in specific aspect ratio with padding options.

**Input Schema:**
```typescript
{
  video_path: string;
  aspect_ratio: "9:16" | "16:9" | "1:1" | "4:5" | "2:3";
  output_path: string;
  resolution: "720p" | "1080p" | "1440p" | "4k";  // Default: "1080p"
  quality: number;             // 18-28 (CRF), default: 23
  pad_mode: "black" | "blur" | "color";  // Default: "black"
  pad_color?: string;          // For "color" pad_mode
}
```

**Output:**
```typescript
{
  output_path: string;
  aspect_ratio: string;
  resolution: string;
  file_size_bytes: number;
}
```

#### `create_still_clip`

Create video clip from still image.

**Input Schema:**
```typescript
{
  image_path: string;
  duration: number;            // Seconds
  output_path?: string;
  resolution: "720p" | "1080p" | "1440p" | "4k";  // Default: "1080p"
}
```

#### `generate_thumbnail`

Extract frame at timestamp as thumbnail image.

**Input Schema:**
```typescript
{
  video_path: string;
  timestamp: number;           // Seconds
  output_path: string;
  width?: number;
  height?: number;
  quality: number;             // 1-31, default: 2 (lower is better)
}
```

#### `freeze_frame`

Freeze frame at specific timestamp for CTA extension.

**Input Schema:**
```typescript
{
  video_path: string;
  freeze_at: number;           // Timestamp to freeze
  freeze_duration: number;     // Duration of freeze
  output_path: string;
  fade_duration?: number;      // Default: 0
}
```

#### `get_video_info`

Get comprehensive video metadata using ffprobe.

**Input Schema:**
```typescript
{
  video_path: string;
}
```

**Output:**
```typescript
{
  duration_seconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
  has_audio: boolean;
  audio_codec?: string;
}
```

#### `assemble_full_video`

Run full assembly pipeline from scenes using a production brief.

**Input Schema:**
```typescript
{
  brief_path: string;
  scene_assets: Record<number, {
    video?: string;
    image?: string;
    audio?: string;
  }>;
  output_dir: string;
  generate_thumbs: boolean;    // Default: true
}
```

---

### Meme Engine Server

High-level orchestration tools.

#### `research_trends`

Research current meme trends and viral content.

**Input Schema:**
```typescript
{
  topic: string;               // Topic to research
  platform: "tiktok" | "instagram" | "youtube" | "all";  // Default: "all"
  days_back: number;           // Default: 7
}
```

**Output:**
```typescript
{
  trends: Array<{
    format: string;
    hashtag: string;
    engagement_score: number;
    examples: string[];
  }>;
  recommended_format: string;
  recommended_hashtags: string[];
}
```

#### `create_production_brief`

Create a production brief from a meme concept.

**Input Schema:**
```typescript
{
  concept: string;             // Meme concept or script
  target_duration: number;     // Default: 15
  style: "news" | "sketch" | "animation" | "reaction" | "tutorial";  // Default: "news"
  characters?: string[];       // Character descriptions
  output_path?: string;        // Where to save brief JSON
}
```

**Output:**
```typescript
{
  brief_path: string;
  concept: string;
  format: string;
  scenes: Scene[];
  characters: Character[];
  duration_target_seconds: number;
}
```

#### `generate_meme_video`

Run full meme video generation pipeline.

**Input Schema:**
```typescript
{
  brief_path?: string;         // Path to brief JSON
  concept?: string;            // Direct concept (alternative)
  output_dir: string;
  scenes?: Scene[];            // Scene definitions (if no brief)
  characters?: Record<string, any>;
  skip_image_gen: boolean;     // Default: false
  skip_video_gen: boolean;     // Default: false
  skip_audio_gen: boolean;     // Default: false
  export_formats: ("9:16" | "16:9" | "1:1")[];  // Default: ["9:16", "16:9"]
}
```

**Output:**
```typescript
{
  pipeline_id: string;
  status: string;
  output_dir: string;
  final_videos: {
    "9x16"?: string;
    "16x9"?: string;
    "1x1"?: string;
  };
  thumbnails: string[];
  generation_log: GenerationLog;
}
```

#### `generate_scene_assets`

Generate assets for a single scene.

**Input Schema:**
```typescript
{
  scene_id: number;
  image_prompt?: string;
  video_prompt?: string;
  audio_script?: string;
  duration: number;            // Default: 5
  aspect_ratio: "9:16" | "16:9" | "1:1";  // Default: "9:16"
  output_dir: string;
  skip_existing: boolean;      // Default: true
}
```

**Output:**
```typescript
{
  scene_id: number;
  assets: {
    image?: string;
    video?: string;
    audio?: string;
  };
  status: string;
}
```

#### `get_pipeline_status`

Check status of a running meme generation pipeline.

**Input Schema:**
```typescript
{
  pipeline_id: string;
}
```

**Output:**
```typescript
{
  request_id: string;
  slug: string;
  status: "pending" | "generating" | "brief_ready" | "complete" | "failed";
  stage: string;
  detail: string;
  progress?: {
    total_scenes: number;
    completed_scenes: number;
    current_scene?: number;
    scene_stage?: string;
    percent_complete?: number;
  };
  outputs?: PipelineOutputs;
  errors: PipelineError[];
  started_at: string;
  updated_at: string;
}
```

#### `list_available_models`

List all available models for generation.

**Input Schema:**
```typescript
{
  type: "image" | "video" | "audio" | "all";  // Default: "all"
}
```

#### `validate_brief`

Validate a production brief for completeness.

**Input Schema:**
```typescript
{
  brief_path?: string;
  brief_json?: object;
}
```

#### `estimate_cost`

Estimate generation cost based on brief complexity.

**Input Schema:**
```typescript
{
  brief_path?: string;
  scene_count?: number;
  include_audio: boolean;      // Default: true
  include_lipsync: boolean;    // Default: false
}
```

---

## Python Modules

### ComfyUIClient

Client for interacting with ComfyUI Cloud API.

```python
from comfyui_client import ComfyUIClient

client = ComfyUIClient(
    api_key="your-api-key",
    base_url="https://cloud.comfy.org",
    client_id=None  # Auto-generated if not provided
)
```

#### Methods

##### `async upload_file(filepath: str | Path) -> str`

Upload a file to ComfyUI Cloud. Returns the cloud filename.

##### `async download_file(filename, dest_path, subfolder="", file_type="output") -> bool`

Download a file from ComfyUI Cloud.

##### `async submit_and_wait(workflow, step_name="", timeout_seconds=600) -> tuple[str, dict]`

Submit a workflow and wait for completion via WebSocket.

Returns: `(prompt_id, outputs)`

##### `async generate_with_fallback(workflows, step_name, timeout_per_attempt=600) -> tuple[str, str, dict]`

Try each workflow until one succeeds.

```python
workflows = [
    ("gemini-3-pro", gemini_workflow),
    ("flux-kontext", flux_workflow)
]
model, prompt_id, outputs = await client.generate_with_fallback(
    workflows, "scene-1-image"
)
```

##### `static extract_files(outputs: dict) -> list[dict]`

Extract file information from workflow outputs.

---

### Workflow Builders

#### ImageWorkflowBuilder

```python
from workflow_builders import ImageWorkflowBuilder

builder = ImageWorkflowBuilder()

# Gemini 2 (primary)
workflow = builder.gemini2(
    scene_id=1,
    prompt="A tabby cat news anchor",
    aspect_ratio="9:16",
    seed=42,
    resolution="2K",
    thinking_level="MINIMAL"
)

# Gemini Nano (fallback)
workflow = builder.gemini_nano(
    scene_id=1,
    prompt="A cat wearing glasses",
    aspect_ratio="9:16",
    seed=42
)

# Flux Kontext (fallback)
workflow = builder.flux_kontext(
    scene_id=1,
    prompt="News studio background",
    aspect_ratio="9:16",
    seed=42,
    guidance=3.5,
    steps=28
)
```

#### VideoWorkflowBuilder

```python
from workflow_builders import VideoWorkflowBuilder

builder = VideoWorkflowBuilder()

# Kling Omni v3 (with native audio)
workflow = builder.kling_omni(
    cloud_image="scene1-9x16-char_0001_.png",
    prompt="Camera slowly pans left",
    scene_id=1,
    duration=5,
    aspect_ratio="9:16",
    generate_audio=True,
    seed=100
)

# Kling v2 (silent)
workflow = builder.kling_v2(
    cloud_image="scene1-9x16-char_0001_.png",
    prompt="Slow zoom in",
    scene_id=1,
    aspect_ratio="9:16",
    duration="5",
    cfg_scale=0.8
)
```

#### TTSWorkflowBuilder

```python
from workflow_builders import TTSWorkflowBuilder

builder = TTSWorkflowBuilder()

workflow = builder.elevenlabs(
    text="Welcome to the Feline Report!",
    scene_id=1,
    line_index=0,
    voice="George (male, british)",
    speed=0.9,
    stability=0.4,
    similarity_boost=0.8,
    seed=42
)
```

#### LipSyncWorkflowBuilder

```python
from workflow_builders import LipSyncWorkflowBuilder

builder = LipSyncWorkflowBuilder()

workflow = builder.build(
    video_path="scene1-9x16-video_0001_.mp4",
    audio_path="scene1-tts-00.wav",
    scene_id=1,
    model="sync-1.6.0"
)
```

#### Helper Functions

```python
from workflow_builders import (
    build_scene_image_prompt,
    build_video_prompt,
    create_image_fallback_chain,
    create_video_fallback_chain
)

# Build comprehensive image prompt
prompt = build_scene_image_prompt(
    scene_visual="A professional news studio with blue lighting",
    characters={
        "anchor": "a tabby cat wearing glasses and a navy blazer"
    }
)

# Build video motion prompt
video_prompt = build_video_prompt({
    "camera_direction": "Slow zoom in on anchor",
    "character_action": "Cat looks directly at camera",
    "sfx": "Subtle newsroom ambiance"
})

# Create fallback chains
image_workflows = create_image_fallback_chain(
    scene_id=1,
    prompt="A cat news anchor",
    aspect_ratio="9:16"
)

video_workflows = create_video_fallback_chain(
    cloud_image="scene1-9x16-char_0001_.png",
    prompt="Camera slowly zooms in",
    scene_id=1
)
```

---

### VideoAssembler

```python
from video_assembly import VideoAssembler
from pathlib import Path

assembler = VideoAssembler(
    output_dir=Path("./output"),
    ffmpeg_path="ffmpeg",
    ffprobe_path="ffprobe"
)
```

#### Methods

##### `create_still_clip(image_path, duration, output_path=None, resolution="1080p") -> Path`

Create video clip from still image.

##### `add_text_overlay(video_path, text, position=("center", "bottom-100"), ...) -> Path`

Add text overlay to video.

##### `add_multiple_text_overlays(video_path, overlays, output_path=None) -> Path`

Add multiple text overlays in one pass.

##### `mix_audio(video_path, audio_path, audio_volume=1.0, video_volume=1.0, ...) -> Path`

Mix external audio with video.

##### `replace_audio(video_path, audio_path, output_path=None, loop_audio=False) -> Path`

Replace video's audio.

##### `concatenate_scenes(scene_paths, output_path, transition=None, reencode=False) -> Path`

Concatenate multiple scenes.

##### `export_format(video_path, aspect_ratio, output_path, resolution="1080p", quality=23, pad_mode="black") -> Path`

Export in specific aspect ratio.

##### `generate_thumbnail(video_path, timestamp, output_path, width=None, height=None, quality=2) -> Path`

Extract thumbnail at timestamp.

##### `generate_thumbnail_with_overlay(video_path, timestamp, output_path, overlays, ...) -> Path`

Generate thumbnail with text overlays.

##### `freeze_frame(video_path, freeze_at, freeze_duration, output_path, fade_duration=0) -> Path`

Freeze frame at timestamp.

##### `get_video_info(video_path) -> dict`

Get video metadata.

---

## TypeScript Types

### Core Types

```typescript
// Aspect ratios
type AspectRatio = "9:16" | "16:9" | "1:1";

// Meme formats
type MemeFormat = "mini-drama" | "text-meme" | "reaction" | "skit" | "compilation";

// Meme styles
type MemeStyle = "absurdist" | "wholesome" | "dark-humor" | "relatable" | "cinematic" | "noir" | "documentary" | "infomercial";

// Scene beats
type SceneBeat = "HOOK" | "SETUP" | "ESCALATION" | "PUNCHLINE" | "TAG" | "HOOK + PUNCHLINE" | "CONFRONTATION" | "CASE CLOSED";

// Generation status
type GenerationStatus = "pending" | "success" | "failed" | "skipped";

// Pipeline stages
type PipelineStage = "brief_generation" | "image_generation" | "tts_generation" | "video_generation" | "lip_sync" | "assembly" | "export";
```

### Production Brief

```typescript
interface ProductionBrief {
  concept: string;
  format: MemeFormat;
  trend_score: number;
  trend_references: string[];
  style: MemeStyle;
  duration_target_seconds: number;
  aspect_ratios: AspectRatio[];
  scenes: Scene[];
  characters: Character[];
  generation_requirements: GenerationRequirements;
}

interface Scene {
  scene_id: number;
  beat: SceneBeat;
  duration_seconds: number;
  visual: string;
  camera: string;
  characters_present: string[];
  dialogue: DialogueLine[];
  sfx: string[];
  music_cue: string;
  text_overlay: string | null;
}

interface Character {
  id: string;
  description: string;
}

interface DialogueLine {
  character: string;
  line: string;
  voice_style: string;
  emotion: string;
}

interface GenerationRequirements {
  character_consistency: boolean;
  lip_sync_needed: boolean;
  models_preferred: {
    image?: string;
    video?: string;
    tts?: string;
    lip_sync?: string;
  };
}
```

### Pipeline Status

```typescript
interface PipelineStatus {
  request_id: string;
  slug: string;
  status: "pending" | "generating" | "brief_ready" | "complete" | "failed";
  stage: string;
  detail: string;
  progress?: PipelineProgress;
  outputs?: PipelineOutputs;
  errors: PipelineError[];
  started_at: string;
  updated_at: string;
}

interface PipelineProgress {
  total_scenes: number;
  completed_scenes: number;
  current_scene?: number;
  scene_stage?: string;
  percent_complete?: number;
}
```

---

## Web API

### POST /api/requests

Create a new meme generation request.

**Request:**
```json
{
  "concept": "A bodega cat giving financial advice",
  "format": "mini-drama",
  "style": "absurdist",
  "duration": 15,
  "characters": ["tabby cat wearing a vest", "concerned customer"]
}
```

**Response:**
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "pipeline_id": "pipeline-abc123",
  "status": "generating",
  "slug": "a-bodega-cat-giving-financial",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### GET /api/requests?id={pipeline_id}

Get request status.

**Response:**
```json
{
  "request_id": "pipeline-abc123",
  "slug": "a-bodega-cat-giving-financial",
  "status": "generating",
  "stage": "video_generation",
  "detail": "Generating scene 2/3...",
  "progress": {
    "total_scenes": 3,
    "completed_scenes": 1,
    "current_scene": 2,
    "scene_stage": "video",
    "percent_complete": 45
  },
  "errors": [],
  "started_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

### GET /api/requests/{id}

Get detailed request status.

### DELETE /api/requests/{id}

Cancel a request (if still pending).

### GET /api/outputs

List all generated outputs.

**Response:**
```json
{
  "outputs": [
    {
      "id": "output-123",
      "slug": "a-bodega-cat-giving-financial",
      "videos": {
        "9x16": "/output/2024-01-15/video-9x16.mp4",
        "16x9": "/output/2024-01-15/video-16x9.mp4"
      },
      "thumbnail": "/output/2024-01-15/thumb.jpg",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Error Handling

All tools return errors in a consistent format:

```typescript
{
  error: {
    code: string;           // Error code
    message: string;        // Human-readable message
    details?: any;          // Additional context
  }
}
```

### Common Error Codes

- `INSUFFICIENT_CREDITS` - Account has insufficient ComfyUI Cloud credits
- `RATE_LIMIT_EXCEEDED` - Rate limit hit on API
- `WORKFLOW_EXECUTION_ERROR` - Workflow failed during execution
- `TIMEOUT_ERROR` - Operation exceeded timeout
- `FILE_OPERATION_ERROR` - Upload or download failed
- `FFMPEG_ERROR` - Video processing error
- `INVALID_BRIEF` - Production brief validation failed
- `MODEL_UNAVAILABLE` - Requested model not available (fallback should trigger)

---

## Rate Limits

ComfyUI Cloud API limits:
- 60 requests per minute for most endpoints
- WebSocket connections: 10 concurrent per API key
- File uploads: 100MB max per file

The client automatically handles rate limiting with exponential backoff.
