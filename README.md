# Meme Engine - MCP Edition

Viral meme video generation using Anthropic's Model Context Protocol (MCP) and ComfyUI Cloud.

## Quick Start

```bash
# 1. Clone and setup
git clone <repo>
cd meme-engine

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install MCP servers
cd mcp-servers/comfyui-server && npm install && npm run build
cd ../assembly-server && npm install && npm run build
cd ../meme-engine-server && npm install && npm run build

# 4. Configure environment
cp .env.example .env
# Edit .env with your COMFY_CLOUD_API_KEY

# 5. Run a generation
python -m meme_engine generate --concept "funny cat video" --format mini-drama
```

## Architecture

### Before (Factory AI Droids)
- Droid definitions in `.factory/droids/`
- Skills in `.factory/skills/`
- Shell script orchestration with `droid exec`

### After (MCP Servers)
- TypeScript MCP servers in `mcp-servers/`
- Python modules in `src/python/`
- Direct tool calling via MCP protocol

### Benefits
- **Open Standard**: Vendor-neutral MCP protocol
- **Better Debugging**: Full control and local logging
- **Type Safety**: TypeScript throughout
- **Testability**: Proper separation of concerns

## Project Structure

```
meme-engine/
├── src/
│   └── python/
│       ├── comfyui_client.py      # ComfyUI Cloud API client
│       ├── workflow_builders.py   # Workflow template builders
│       ├── video_assembly.py      # ffmpeg video assembly
│       └── pipeline.py            # High-level orchestration
├── mcp-servers/
│   ├── comfyui-server/            # MCP server for ComfyUI
│   ├── assembly-server/           # MCP server for ffmpeg
│   └── meme-engine-server/        # MCP server for orchestration
├── web/                           # Next.js web UI
├── workflows/                     # ComfyUI workflow templates
└── tests/                         # Test suite
```

## MCP Servers

### comfyui-server
Tools for image/video generation via ComfyUI Cloud:
- `generate_image` - Generate images with fallback chain
- `generate_video` - Generate video from image
- `text_to_speech` - ElevenLabs TTS
- `lip_sync` - Synchronize video with audio
- `get_job_status` - Check generation status

### assembly-server
Tools for video post-processing:
- `concatenate_scenes` - Join video clips
- `add_text_overlay` - Add text to video
- `mix_audio` - Combine audio tracks
- `export_format` - Export 9:16, 16:9 formats
- `assemble_full_video` - Run complete assembly

### meme-engine-server
High-level orchestration:
- `create_production_brief` - Generate brief from concept
- `generate_meme_video` - Full pipeline execution
- `get_pipeline_status` - Check pipeline progress

## Usage Examples

### Using MCP Tools Directly

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const client = new Client({ name: "my-app", version: "1.0.0" });

// Generate an image
const imageResult = await client.callTool("generate_image", {
  prompt: "A funny cat in a business suit",
  aspect_ratio: "9:16"
});

// Generate video from image
const videoResult = await client.callTool("generate_video", {
  image_path: imageResult.local_path,
  prompt: "Cat walking confidently down hallway",
  duration: 5
});
```

### Using Python Modules

```python
import asyncio
from comfyui_client import ComfyUIClient
from workflow_builders import ImageWorkflowBuilder

async def main():
    client = ComfyUIClient(api_key="your-key")
    builder = ImageWorkflowBuilder()
    
    workflow = builder.gemini2(
        scene_id=1,
        prompt="A funny cat",
        aspect_ratio="9:16"
    )
    
    prompt_id, outputs = await client.submit_and_wait(workflow)
    print(f"Generated: {outputs}")

asyncio.run(main())
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `COMFY_CLOUD_API_KEY` | ComfyUI Cloud API key | Required |
| `OUTPUT_DIR` | Output directory | `./output` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Model Preferences

Set in `generation_requirements.models_preferred`:

```json
{
  "image": "gemini-3-pro",
  "video": "kling-v3-omni",
  "tts": "elevenlabs",
  "lip_sync": "sync-1.6.0"
}
```

Available models are automatically discovered from ComfyUI Cloud.

## Development

### Running Tests

```bash
# Python tests
pytest tests/python/

# TypeScript tests
npm test --workspace=mcp-servers

# Integration tests
pytest tests/integration/ -m integration
```

### Adding New Workflow Builders

1. Add builder method to appropriate class in `workflow_builders.py`
2. Add corresponding tool in MCP server
3. Add tests
4. Update documentation

## Troubleshooting

### WebSocket Connection Issues
- Ensure `COMFY_CLOUD_API_KEY` is set correctly
- Check network connectivity to `cloud.comfy.org`
- Verify WebSocket port 443 is not blocked

### ffmpeg Errors
- Install ffmpeg: `brew install ffmpeg` (macOS) or `apt-get install ffmpeg` (Linux)
- Verify installation: `ffmpeg -version`

### Model Not Available
The system will automatically fall back to available models. Check logs for fallback chain execution.

## Migration from Factory AI

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide.

## License

MIT
