# Meme Engine - Agent Instructions (MCP Edition)

## Project Overview

Viral meme video content engine using ComfyUI Cloud and the Model Context Protocol (MCP).

## Architecture

Three MCP servers replace the previous Factory AI Droid system:

1. **comfyui-server** - Image/video/audio generation via ComfyUI Cloud
2. **assembly-server** - Video post-processing using ffmpeg
3. **meme-engine-server** - High-level pipeline orchestration

### Before vs After

| Before (Factory AI) | After (MCP) |
|---------------------|-------------|
| 4 droids in `.factory/droids/` | 3 MCP servers in `mcp-servers/` |
| Shell script orchestration | Direct MCP tool calls |
| File-based status tracking | JSON-RPC over stdio |
| Remote execution | Local execution |

## Key Paths

- `./src/python/` - Python modules (comfyui_client, workflow_builders, video_assembly)
- `./mcp-servers/` - MCP server implementations (TypeScript)
- `./web/` - Next.js web interface
- `./workflows/` - ComfyUI workflow templates (JSON)
- `./output/YYYY-MM-DD/` - Generated outputs organized by date

## Using MCP Tools

### From TypeScript/JavaScript

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Create transport
const transport = new StdioClientTransport({
  command: "node",
  args: ["./mcp-servers/comfyui-server/dist/index.js"],
  env: { COMFY_CLOUD_API_KEY: "your-key" }
});

// Connect and use
const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(transport);

// Generate an image
const result = await client.callTool("generate_image", {
  prompt: "A funny cat in a business suit",
  aspect_ratio: "9:16"
});
```

### From Python

```python
from mcp import ClientSession, StdioServerParameters

# Server parameters
server_params = StdioServerParameters(
    command="node",
    args=["./mcp-servers/meme-engine-server/dist/index.js"],
    env={"COMFY_CLOUD_API_KEY": "your-key"}
)

# Use the client
async with ClientSession(server_params) as session:
    result = await session.call_tool("generate_meme_video", {
        "concept": "A bodega cat giving financial advice",
        "output_dir": "./output/test"
    })
```

## Available Tools by Server

### comfyui-server

| Tool | Description |
|------|-------------|
| `generate_image` | Generate images with fallback chain (Gemini, Flux, Nano) |
| `generate_video` | Generate video from image (Kling v3/v2) |
| `text_to_speech` | ElevenLabs TTS |
| `lip_sync` | Synchronize video with audio |
| `upload_file` | Upload to ComfyUI Cloud |
| `download_file` | Download from ComfyUI Cloud |
| `get_job_status` | Check job status |

### assembly-server

| Tool | Description |
|------|-------------|
| `concatenate_scenes` | Join video clips |
| `add_text_overlay` | Add text to video |
| `add_multiple_text_overlays` | Multiple texts in one pass |
| `mix_audio` | Combine audio tracks |
| `replace_audio` | Replace video audio |
| `export_format` | Export 9:16, 16:9 formats |
| `create_still_clip` | Image to video conversion |
| `generate_thumbnail` | Extract frame as image |
| `freeze_frame` | Pause frame for CTA |
| `get_video_info` | Video metadata |
| `assemble_full_video` | Run complete assembly |

### meme-engine-server

| Tool | Description |
|------|-------------|
| `research_trends` | Research viral trends |
| `create_production_brief` | Generate brief from concept |
| `generate_meme_video` | Full pipeline execution |
| `generate_scene_assets` | Generate single scene |
| `add_text_hooks` | Add viral text hooks |
| `get_pipeline_status` | Check pipeline progress |
| `list_available_models` | List available models |
| `validate_brief` | Validate brief completeness |
| `estimate_cost` | Estimate generation cost |

## Pipeline Execution

The `generate_meme_video` tool handles the full pipeline:

1. **Create Production Brief** - Generate scene breakdown from concept
2. **Generate Scene Assets** (parallel per scene):
   - Image generation (character/background)
   - Video generation (motion from image)
   - Audio/TTS generation (dialogue)
3. **Assemble Final Video**:
   - Concatenate scenes
   - Add text overlays
   - Mix audio tracks
   - Export multiple formats
4. **Generate Thumbnails**

### Example Full Pipeline

```typescript
// Using meme-engine-server orchestration
const result = await client.callTool("generate_meme_video", {
  concept: "A bodega cat giving financial advice about investing in catnip",
  format: "mini-drama",
  style: "absurdist",
  output_dir: "./output/bodega-cat-financial",
  export_formats: ["9:16", "16:9"]
});

// Returns:
// {
//   pipeline_id: "pipeline-abc123",
//   status: "complete",
//   final_videos: {
//     "9x16": "./output/.../video-9x16.mp4",
//     "16x9": "./output/.../video-16x9.mp4"
//   },
//   thumbnails: ["./output/.../thumb.jpg"]
// }
```

## Workflow Builders (Python)

For direct workflow construction, use the Python builders:

```python
from workflow_builders import (
    ImageWorkflowBuilder,
    VideoWorkflowBuilder,
    TTSWorkflowBuilder,
    create_image_fallback_chain
)

# Build image workflow
image_builder = ImageWorkflowBuilder()
workflow = image_builder.gemini2(
    scene_id=1,
    prompt="A professional tabby cat news anchor",
    aspect_ratio="9:16"
)

# Submit via client
from comfyui_client import ComfyUIClient
client = ComfyUIClient(api_key="your-key")
prompt_id, outputs = await client.submit_and_wait(workflow)
```

### Builder Methods

**ImageWorkflowBuilder:**
- `gemini2(scene_id, prompt, aspect_ratio, seed, resolution, thinking_level)`
- `gemini_nano(scene_id, prompt, aspect_ratio, seed)`
- `flux_kontext(scene_id, prompt, aspect_ratio, seed, guidance, steps)`

**VideoWorkflowBuilder:**
- `kling_omni(cloud_image, prompt, scene_id, duration, aspect_ratio, generate_audio, seed)`
- `kling_v2(cloud_image, prompt, scene_id, aspect_ratio, duration, cfg_scale)`

**TTSWorkflowBuilder:**
- `elevenlabs(text, scene_id, line_index, voice, speed, stability, similarity_boost, seed)`

**LipSyncWorkflowBuilder:**
- `build(video_path, audio_path, scene_id, model)`

## Error Handling

### Model Fallback

The system automatically falls back to available models:

```
Image: gemini-3-pro → flux-kontext → nano-banana-2
Video: kling-v3-omni → kling-v2-master
```

Check logs for fallback chain execution:
```
[scene-1-image] Trying gemini-3-pro...
[scene-1-image] gemini-3-pro failed: Model unavailable
[scene-1-image] Trying flux-kontext...
[scene-1-image] flux-kontext succeeded
```

### Failed Scene Retry

Individual scenes can be retried:

```typescript
// Retry just scene 2
const result = await client.callTool("generate_scene_assets", {
  scene_id: 2,
  image_prompt: "...",
  video_prompt: "...",
  audio_script: "...",
  output_dir: "./output/bodega-cat-financial"
});
```

### Status Tracking

Pipeline status is tracked in `./output/{date}/status.json`:

```json
{
  "request_id": "req-123",
  "status": "generating",
  "stage": "video_generation",
  "progress": {
    "total_scenes": 3,
    "completed_scenes": 1,
    "current_scene": 2,
    "percent_complete": 45
  },
  "errors": []
}
```

## Conventions

### File Naming

- Output: `{concept-slug}-{format}-{aspect}.mp4`
- Scenes: `scene{scene_id}-{aspect_ratio}-{type}.{ext}`
  - Examples: `scene1-9x16-character.png`, `scene1-9x16-video.mp4`
- Workflows: `{type}-scene{scene_id}.json`
  - Examples: `image-scene1.json`, `video-scene1.json`

### Directory Structure

```
output/
├── 2024-01-15/
│   ├── my-meme-9x16.mp4
│   ├── my-meme-16x9.mp4
│   ├── thumbnails/
│   │   └── my-meme-thumb.jpg
│   └── workflows/
│       ├── image-scene1.json
│       └── video-scene1.json
└── briefs/
    └── my-meme-brief.json
```

### MCP Tool Call Format

All tool calls use JSON arguments:

```typescript
// Good
await client.callTool("generate_image", {
  prompt: "A funny cat",
  aspect_ratio: "9:16",
  scene_id: 1
});

// Bad (positional args not supported)
await client.callTool("generate_image", "A funny cat", "9:16", 1);
```

## Common Tasks

### Generate a Single Image

```typescript
const result = await client.callTool("generate_image", {
  prompt: "A tabby cat wearing a business suit",
  aspect_ratio: "9:16",
  scene_id: 1
});
// result.local_path = "./output/.../scene1-9x16-char_0001_.png"
```

### Generate Video from Image

```typescript
// First upload or use local path
const result = await client.callTool("generate_video", {
  image_path: "./scene1-char.png",
  prompt: "Camera slowly zooms in on the cat's face",
  duration: 5,
  generate_audio: true,
  scene_id: 1
});
```

### Add Text Overlay

```typescript
await client.callTool("add_text_overlay", {
  video_path: "./scene1-video.mp4",
  text: "Breaking News!\nCat becomes CEO",
  position: { x: "center", y: "bottom-100" },
  font_size: 64,
  box: true,
  box_color: "black@0.7"
});
```

### Export Multiple Formats

```typescript
// Generate 9:16 (vertical/mobile)
await client.callTool("export_format", {
  video_path: "./raw-video.mp4",
  aspect_ratio: "9:16",
  output_path: "./output/video-9x16.mp4"
});

// Generate 16:9 (horizontal/desktop)
await client.callTool("export_format", {
  video_path: "./raw-video.mp4",
  aspect_ratio: "16:9",
  output_path: "./output/video-16x9.mp4",
  pad_mode: "blur"  // Blurred background for aspect ratio mismatch
});
```

### Full Meme Generation

```typescript
// One call does everything
const result = await client.callTool("generate_meme_video", {
  concept: "A bodega cat giving financial advice",
  output_dir: "./output/my-meme"
});

// Check status
const status = await client.callTool("get_pipeline_status", {
  pipeline_id: result.pipeline_id
});
```

## Development Workflow

### Adding a New Tool

1. **Add to appropriate server** (`comfyui-server`, `assembly-server`, or `meme-engine-server`):
   ```typescript
   // In src/tools.ts
   {
     name: "my_new_tool",
     description: "What it does",
     inputSchema: { ... }
   }
   ```

2. **Implement handler** in `src/index.ts`:
   ```typescript
   case "my_new_tool": {
     const result = await handleMyNewTool(args);
     return formatToolResult(result);
   }
   ```

3. **Add tests** in `tests/typescript/`

4. **Update documentation** (this file and API.md)

### Testing Changes

```bash
# TypeScript tests
cd tests/typescript
npm test

# Python tests
cd tests/python
pytest -m unit

# Integration tests
pytest -m integration

# End-to-end
python scripts/test-e2e.py
```

### Debugging

```bash
# Run MCP server directly to see logs
node mcp-servers/comfyui-server/dist/index.js

# In another terminal, send test request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  node mcp-servers/comfyui-server/dist/index.js

# Python module test
python -c "from comfyui_client import ComfyUIClient; print('OK')"
```

## Environment Variables

Required:
- `COMFY_CLOUD_API_KEY` - ComfyUI Cloud API access

Optional:
- `COMFYUI_MCP_SERVER_PATH` - Path to comfyui-server
- `ASSEMBLY_MCP_SERVER_PATH` - Path to assembly-server
- `MEME_ENGINE_MCP_SERVER_PATH` - Path to meme-engine-server
- `OUTPUT_DIR` - Output directory (default: `./output`)
- `LOG_LEVEL` - Logging level (default: `INFO`)

## Resources

- [README.md](./README.md) - Project overview
- [API.md](./API.md) - Complete API reference
- [MIGRATION.md](./MIGRATION.md) - Migration from Factory AI
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture decisions

## Support

For issues:
1. Check MCP server logs (stderr output)
2. Review `./output/YYYY-MM-DD/status.json`
3. Verify environment variables
4. Test individual tools before full pipeline
5. Check [Troubleshooting](./README.md#troubleshooting)
