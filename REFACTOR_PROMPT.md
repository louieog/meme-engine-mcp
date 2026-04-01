# Meme Engine MCP — Hybrid Refactor Prompt

## Goal

Refactor `meme-engine-mcp` from a fully programmatic (stub-filled) MCP architecture into a **hybrid system** where Claude orchestrates MCP servers for execution while retaining LLM intelligence for creative decisions. The end state: droids/Claude handle creative work (briefs, prompt engineering, quality review), while deterministic TypeScript/Python code handles all mechanical API execution (ComfyUI calls, polling, file I/O, ffmpeg assembly).

## Repo

- **Target repo**: https://github.com/louieog/meme-engine-mcp (clone fresh)
- **Reference repo** (original droid-based): https://github.com/louieog/comfyui-x-droid-instant-video-meme-generator

## Current State of meme-engine-mcp

The codebase has the right structure but is mostly stubs and has several critical bugs:

### What exists and works:
- 3 MCP servers defined: `comfyui-server`, `assembly-server`, `meme-engine-server`
- Tool schemas for all 3 servers (28 tools total)
- Python backend: `comfyui_client.py` (async API client), `workflow_builders.py` (builder pattern), `video_assembly.py` (ffmpeg pipeline)
- TypeScript types in `src/schemas.ts` (~60 types)
- Next.js web UI with create, status, and gallery pages
- Architecture decision docs in `docs/`

### What's broken:
1. **Python path references**: `comfy-client.ts` and `assembly-client.ts` reference `../../../../phase1/` — should be `../../src/python/`
2. **Missing Python CLI interface**: Python modules have no `--function`/`--args` CLI argument parsing. TS wrappers call subprocess with these flags but Python ignores them
3. **MCP client connection bug**: `ServerManager.connect()` in `web/src/lib/mcp-client.ts` doesn't save connections to `this.connections` map — `getClient()` always returns null
4. **Orchestrator is all stubs**: `meme-engine-server/orchestrator.ts` returns mock data, uses `delay(1000)` simulation, never calls ComfyUI or assembly
5. **Gallery page mismatch**: expects `data.videos` but API returns `data.outputs`
6. **Missing file serving**: `/api/serve-file` endpoint referenced but not implemented
7. **Duplicated types**: `web/src/types/index.ts` is a copy of `src/schemas.ts` instead of importing
8. **No Zod validation**: `ZodSchemas` interface declared but no Zod schemas implemented

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Web UI                        │
│  Create → Brief Review → Pipeline Monitor → Gallery      │
│  Model selection dropdowns → request JSON                │
└────────────────────────┬────────────────────────────────┘
                         │ POST /api/requests
                         ▼
┌─────────────────────────────────────────────────────────┐
│              Claude Orchestrator (LLM)                   │
│  Connected to all 3 MCP servers as tools                 │
│                                                          │
│  Creative responsibilities:                              │
│  - Expand concept → production brief (scenes, dialogue)  │
│  - Optimize prompts per target model                     │
│  - Choose fallback models intelligently on failure        │
│  - Quality review between pipeline stages                │
│                                                          │
│  Delegates mechanical work to MCP tools:                 │
│  - comfyui.generate_image(params)                        │
│  - comfyui.generate_video(params)                        │
│  - comfyui.text_to_speech(params)                        │
│  - assembly.concatenate_scenes(params)                   │
│  - assembly.export_format(params)                        │
│  - engine.get_pipeline_status(id)                        │
└──────┬──────────────────┬───────────────────┬───────────┘
       │                  │                   │
       ▼                  ▼                   ▼
┌──────────────┐  ┌───────────────┐  ┌────────────────┐
│ comfyui-server│  │assembly-server│  │meme-engine-srv │
│              │  │               │  │                │
│ Deterministic│  │ Deterministic │  │ State tracking │
│ API calls:   │  │ ffmpeg calls: │  │ Pipeline CRUD  │
│ - Upload     │  │ - Concat      │  │ Model registry │
│ - Submit     │  │ - Overlay     │  │ Brief storage  │
│ - Poll       │  │ - Export      │  │ Cost tracking  │
│ - Download   │  │ - Thumbnail   │  │                │
└──────────────┘  └───────────────┘  └────────────────┘
       │                  │
       ▼                  ▼
   Python exec        Python exec
   comfyui_client     video_assembly
```

---

## Detailed Task Breakdown

### Phase 1: Fix Critical Bugs (do first)

1. **Fix Python subprocess bridge**
   - In `comfyui_client.py` and `video_assembly.py`, add a CLI entry point that accepts `--function <name> --args <json>` and dispatches to the correct method
   - Example: `python comfyui_client.py --function submit_and_wait --args '{"workflow": {...}}'`
   - Fix paths in `comfy-client.ts` and `assembly-client.ts`: change `../../../../phase1/` to the correct relative path to `src/python/`

2. **Fix MCP client connections**
   - In `web/src/lib/mcp-client.ts`, fix `ServerManager.connect()` to store the client in `this.connections` map after creation

3. **Fix API response shapes**
   - Gallery page: change `data.videos` to `data.outputs`
   - Add `/api/outputs/[date]/[...path]/route.ts` for serving video/thumbnail files (copy pattern from reference repo)

4. **Deduplicate types**
   - Make `web/src/types/index.ts` import from `../../src/schemas` instead of duplicating

### Phase 2: Build the Deterministic Executor Layer

5. **Create MODEL_REGISTRY in `src/models.ts`**

```typescript
export interface ModelConfig {
  nodeClass: string;
  modelName?: string;
  hasAudio: boolean;
  maxDuration?: number;
  requiresImageUpload: boolean;
  audioParam?: string;
  fallbackChain: string[]; // keys of other models to try on failure
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // Image models
  "FluxKontextProImageNode": {
    nodeClass: "FluxKontextProImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["Flux2ProImageNode", "GeminiNanoBanana2:Nano Banana 2 (Gemini 3.1 Flash Image)"]
  },
  // ... all 17 image models

  // Video models
  "KlingOmniProImageToVideoNode:kling-v3-omni": {
    nodeClass: "KlingOmniProImageToVideoNode",
    modelName: "kling-v3-omni",
    hasAudio: true,
    maxDuration: 15,
    requiresImageUpload: true,
    audioParam: "generate_audio",
    fallbackChain: ["KlingImage2VideoNode:kling-v2-1-master", "Veo3VideoGenerationNode:veo-3.1-fast-generate"]
  },
  // ... all 20 video models

  // TTS
  "elevenlabs": {
    nodeClass: "ElevenLabsTextToSpeech",
    hasAudio: true,
    requiresImageUpload: false,
    fallbackChain: []
  },

  // Lip sync
  "KlingLipSyncAudioToVideoNode": {
    nodeClass: "KlingLipSyncAudioToVideoNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["KlingLipSyncTextToVideoNode"]
  }
};

export const NATIVE_AUDIO_MODELS = [
  "KlingOmniProImageToVideoNode:kling-v3-omni",
  "KlingOmniProTextToVideoNode:kling-v3-omni",
  "KlingTextToVideoWithAudio:kling-v2-6",
  "KlingImageToVideoWithAudio:kling-v2-6",
  "Veo3VideoGenerationNode:veo-3.1-generate",
  "Veo3VideoGenerationNode:veo-3.1-fast-generate",
  "Veo3VideoGenerationNode:veo-3.0-generate-001",
  "WanSoundImageToVideo"
];
```

6. **Build workflow template parameterizer in `src/python/workflow_builders.py`**
   - Already has builder classes but needs to be connected to the model registry
   - Must handle the colon-separated `NodeClass:model_name` format
   - Must apply these proven schema rules:
     - ElevenLabs voice: full label format `"George (male, british)"`
     - ElevenLabs sub-inputs: dot-notation `"model.speed": 0.9`
     - SaveVideo format: `"mp4"` not `"video/h264-mp4"`
     - SaveAudio: uses `filename_prefix`
     - Always include `extra_data.api_key_comfy_org`

7. **Wire up comfyui-server tools to real execution**
   - `generate_image`: Look up model in registry → build workflow via Python → submit to ComfyUI Cloud → poll (max 10 min timeout) → download → return file path
   - `generate_video`: Same flow, plus handle native audio flag (if model hasAudio and user wants audio, set `generate_audio=true` and include dialogue in prompt)
   - `text_to_speech`: Build ElevenLabs workflow with correct dot-notation schema → submit → download
   - `lip_sync`: Submit lip sync workflow → on failure, fall back to ffmpeg audio overlay
   - `upload_file`: POST to `/api/upload/image` (works for all file types)
   - `get_job_status`: GET `/api/job/{id}/status`, return parsed status

8. **Wire up assembly-server tools to real execution**
   - Already have `video_assembly.py` with full ffmpeg implementation
   - Just need the CLI bridge (Phase 1, task 1) and correct path references
   - `assemble_full_video` should run the full pipeline: prepare clips → overlays → audio mix → concat → export 16:9 + 9:16 → thumbnail

### Phase 3: Claude Orchestration Layer

9. **Create orchestrator endpoint: `POST /api/requests`**
   - Receives request JSON from web UI
   - Spawns a Claude API call with all 3 MCP servers connected as tools
   - Claude receives a system prompt (see below) that tells it to:
     1. Read the concept + model_overrides
     2. Generate a production brief (creative work)
     3. For each scene, call the appropriate MCP tools (mechanical work)
     4. Review outputs between stages (creative work)
     5. Call assembly tools to produce final video
   - Stream pipeline status updates to a status file for the UI to poll

10. **Claude orchestrator system prompt** (store in `src/orchestrator-prompt.ts`):

```
You are the orchestrator for a viral meme video engine. You have 3 MCP tool servers:

1. comfyui — generate images, videos, TTS audio, lip sync via ComfyUI Cloud
2. assembly — ffmpeg video post-production (concat, overlay, export, thumbnails)
3. engine — pipeline state management, model registry, brief storage

## Your workflow for each request:

### Stage 1: Creative Brief (YOU do this — creative work)
- Expand the user's concept into a full production brief
- Design 2-5 scenes with: visual descriptions, dialogue, camera angles, text overlays
- Follow these rules:
  - HOOK must work with sound OFF
  - Hard cuts between scenes
  - Dialogue lines under 8 words
  - Final beat must be screenshot-worthy
- Save the brief via engine.save_brief()

### Stage 2: Asset Generation (DELEGATE to tools — mechanical work)
For each scene, in order:
1. Call comfyui.generate_image() with the scene visual description
2. If TTS is not "none" OR video model lacks native audio: call comfyui.text_to_speech()
3. Call comfyui.generate_video() with the generated image
4. If lip sync is not "none": call comfyui.lip_sync()

If any generation fails:
- YOU decide the best fallback model (creative decision, not just next in list)
- YOU rewrite the prompt if needed for the fallback model
- Call the tool again with new parameters

### Stage 3: Quality Review (YOU do this — creative work)
- Check that generated assets match the brief
- If a scene looks wrong, regenerate with adjusted prompt

### Stage 4: Assembly (DELEGATE to tools — mechanical work)
- Call assembly.assemble_full_video() with all scene assets
- Call assembly.export_format() for 9:16 and 16:9
- Call assembly.generate_thumbnail()

### Stage 5: Metadata (YOU do this)
- Write metadata.json with concept, files, suggested captions/hashtags
- Update pipeline status to "complete"

## Audio Decision Tree:
- If model_overrides.tts == "none" AND video model has native audio → include dialogue in video prompt, set generate_audio=true
- If model_overrides.tts == "none" AND video model does NOT have native audio → OVERRIDE: generate TTS with ElevenLabs "George (male, british)", log warning
- If model_overrides.tts has a voice name → generate TTS with that voice
```

11. **Implement Claude API integration**
    - Use Anthropic SDK (`@anthropic-ai/sdk`)
    - Connect 3 MCP servers as tool providers
    - Handle tool_use/tool_result message loop
    - Stream status updates to `requests/{id}.status.json`
    - Store the full conversation (brief generation, tool calls, results) in `requests/{id}.log.json`

### Phase 4: Web UI Polish

12. **Port missing UI features from reference repo**
    - Format description info box below format selector (FORMAT_DESCRIPTIONS dict)
    - "Other..." style option with custom text input
    - Model selection dropdowns with all models from MODEL_REGISTRY
    - Native audio banner when hasAudio model selected (auto-set voice/lip sync to "none")
    - Brief review page with inline editing
    - Pipeline monitor with per-stage progress + log viewer
    - Output page with side-by-side 16:9/9:16 players

13. **Fix output file serving**
    - Add catch-all route `web/src/app/api/outputs/[date]/[...path]/route.ts`
    - Handle nested paths (thumbnails/file.jpg)
    - Normalize metadata reading (both `metadata.json` and `*-metadata.json`)
    - Match video files by metadata filename prefix, then slug prefix, then exclusion-based last resort

14. **Add real-time pipeline updates**
    - Option A: Poll `/api/requests/{id}` every 3s (simpler)
    - Option B: Server-Sent Events from the orchestrator (better UX)

---

## ComfyUI Cloud API Reference

Base URL: `https://cloud.comfy.org`

### Endpoints:
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/upload/image` | Upload any file (image/video/audio) |
| POST | `/api/prompt` | Submit workflow for execution |
| GET | `/api/job/{prompt_id}/status` | Poll job status (returns "success" not "completed") |
| GET | `/api/history_v2/{prompt_id}` | Get job outputs after completion |
| GET | `/api/view?filename={f}&subfolder=&type=output` | Download output file (follows 302) |
| GET | `/api/object_info` | Discover available nodes and their schemas |

### Headers:
All requests need: `X-API-Key: <COMFY_CLOUD_API_KEY>`

### Prompt submission body:
```json
{
  "prompt": {
    "1": { "class_type": "NodeName", "inputs": { ... } },
    "2": { "class_type": "AnotherNode", "inputs": { "input_ref": ["1", 0] } }
  },
  "extra_data": { "api_key_comfy_org": "<key>" }
}
```

### Node connections: `["node_id_string", output_index]`

---

## Proven Workflow Templates

### Character Image (FluxKontextProImageNode)
```json
{
  "1": { "class_type": "FluxKontextProImageNode", "inputs": { "prompt": "<visual>", "aspect_ratio": "9:16", "seed": 0 } },
  "2": { "class_type": "SaveImage", "inputs": { "filename_prefix": "<prefix>", "images": ["1", 0] } }
}
```

### Image-to-Video (Kling v2)
```json
{
  "1": { "class_type": "KlingImage2VideoNode", "inputs": { "prompt": "<motion>", "negative_prompt": "blurry, distorted", "model_name": "kling-v2-master", "duration": "5", "mode": "pro", "cfg_scale": 0.5, "seed": 0, "image": ["2", 0] } },
  "2": { "class_type": "LoadImage", "inputs": { "image": "<uploaded_filename>" } },
  "3": { "class_type": "SaveVideo", "inputs": { "filename_prefix": "<prefix>", "format": "mp4", "video": ["1", 0] } }
}
```

### Image-to-Video (Kling v3 OmniPro — with native audio)
```json
{
  "1": { "class_type": "KlingOmniProImageToVideoNode", "inputs": { "prompt": "<motion + dialogue>", "negative_prompt": "blurry", "model_name": "kling-v3-omni", "duration": 5, "aspect_ratio": "9:16", "cfg_scale": 0.5, "generate_audio": true, "seed": 0, "image": ["2", 0] } },
  "2": { "class_type": "LoadImage", "inputs": { "image": "<uploaded_filename>" } },
  "3": { "class_type": "SaveVideo", "inputs": { "filename_prefix": "<prefix>", "format": "mp4", "video": ["1", 0] } }
}
```

### TTS (ElevenLabs)
```json
{
  "1": { "class_type": "ElevenLabsVoiceSelector", "inputs": { "voice": "George (male, british)" } },
  "2": { "class_type": "ElevenLabsTextToSpeech", "inputs": { "text": "<dialogue>", "model.speed": 0.9, "model.stability": 0.5, "model.similarity_boost": 0.8, "model_id": "eleven_v3", "voice": ["1", 0] } },
  "3": { "class_type": "SaveAudio", "inputs": { "filename_prefix": "<prefix>", "audio": ["2", 0] } }
}
```

### Lip Sync (Kling)
```json
{
  "1": { "class_type": "LoadVideo", "inputs": { "video": "<uploaded_video>" } },
  "2": { "class_type": "LoadAudio", "inputs": { "audio": "<uploaded_audio>" } },
  "3": { "class_type": "KlingLipSyncAudioToVideoNode", "inputs": { "video": ["1", 0], "audio": ["2", 0] } },
  "4": { "class_type": "SaveVideo", "inputs": { "filename_prefix": "<prefix>", "format": "mp4", "video": ["3", 0] } }
}
```

---

## Voice Options (ElevenLabs)
Full label format required: `George (male, british)`, `Roger (male, american)`, `Sarah (female, american)`, `Laura (female, american)`, `Charlie (male, australian)`, `Callum (male, american)`, `River (neutral, american)`, `Harry (male, american)`, `Liam (male, american)`, `Alice (female, british)`, `Matilda (female, american)`, `Will (male, american)`, `Jessica (female, american)`, `Eric (male, american)`, `Bella (female, american)`, `Chris (male, american)`, `Brian (male, american)`, `Daniel (male, british)`, `Lily (female, british)`, `Adam (male, american)`, `Bill (male, american)`

---

## Environment Variables
```
COMFY_CLOUD_API_KEY=<key>
ANTHROPIC_API_KEY=<key>  # NEW — needed for Claude orchestration
```

---

## File Structure Target

```
meme-engine-mcp/
├── src/
│   ├── schemas.ts              # Shared types (fix, don't duplicate)
│   ├── models.ts               # NEW: MODEL_REGISTRY with all configs
│   ├── orchestrator-prompt.ts   # NEW: Claude system prompt
│   └── python/
│       ├── comfyui_client.py   # Fix: add CLI entry point
│       ├── workflow_builders.py # Fix: wire to model registry
│       └── video_assembly.py   # Fix: add CLI entry point
├── mcp-servers/
│   ├── comfyui-server/         # Fix: paths, wire to real execution
│   ├── assembly-server/        # Fix: paths, wire to real execution
│   └── meme-engine-server/     # Fix: replace stubs with real state management
├── web/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── requests/   # Fix: spawn Claude orchestrator
│   │   │   │   └── outputs/    # Fix: file serving, metadata normalization
│   │   │   ├── create/         # Port: model dropdowns, format descriptions
│   │   │   ├── status/         # Port: pipeline monitor with log viewer
│   │   │   └── gallery/        # Fix: response shape, video serving
│   │   ├── lib/
│   │   │   └── mcp-client.ts   # Fix: connection storage bug
│   │   └── types/
│   │       └── index.ts        # Fix: import from src/schemas, don't duplicate
├── output/                     # Generated videos (gitignored)
├── requests/                   # Request + status JSONs (gitignored)
└── workflows/                  # Reference templates
```

---

## Validation Criteria

The refactor is complete when:
1. `npm run build` succeeds with no TypeScript errors
2. All 3 MCP servers start and respond to tool calls
3. A request submitted via the web UI triggers Claude orchestration
4. Claude generates a production brief (creative) then delegates to MCP tools (mechanical)
5. ComfyUI Cloud generates real images/videos/TTS via the deterministic executor
6. ffmpeg assembles the final video in 16:9 and 9:16
7. The gallery page displays the completed video with thumbnail
8. Model selection in the UI maps deterministically to the correct ComfyUI node
9. Native audio models skip TTS/lip sync automatically
10. Failed generations trigger intelligent fallback (Claude picks alternative model + rewrites prompt)
