# Quick Start Guide

Get up and running with Meme Engine MCP in 5 minutes.

## Prerequisites

- Node.js 18+ and npm
- Python 3.10+
- ffmpeg installed
- ComfyUI Cloud API key

## Installation

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd meme-engine-mcp

# Install all dependencies
npm run setup
```

This installs:
- Node.js dependencies for MCP servers and web UI
- Python dependencies from requirements.txt
- Builds all MCP servers

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your COMFY_CLOUD_API_KEY
```

Get your API key from: https://cloud.comfy.org

### 3. Verify Installation

```bash
# Run tests
npm test

# Check ffmpeg
ffmpeg -version

# Verify Python modules
python -c "from src.python import ComfyUIClient; print('✓ Python modules OK')"
```

## Generate Your First Meme Video

### Option 1: Using MCP Tools (Recommended)

```bash
# Start MCP servers and generate
kimi mcp call generate_meme_video --concept "funny cat video" --format mini-drama
```

### Option 2: Using Python Directly

```python
import asyncio
from src.python import ComfyUIClient, ImageWorkflowBuilder

async def main():
    client = ComfyUIClient()
    builder = ImageWorkflowBuilder()
    
    # Generate image
    workflow = builder.gemini2(
        scene_id=1,
        prompt="A funny cat wearing a business suit",
        aspect_ratio="9:16"
    )
    
    prompt_id, outputs = await client.submit_and_wait(workflow)
    print(f"Generated: {outputs}")

asyncio.run(main())
```

### Option 3: Using Web UI

```bash
# Start development server
npm run dev:web

# Open http://localhost:3000
# Enter your concept and click Generate
```

## Project Structure

```
meme-engine-mcp/
├── src/
│   ├── python/           # Python modules
│   │   ├── comfyui_client.py
│   │   ├── workflow_builders.py
│   │   └── video_assembly.py
│   └── schemas.ts        # TypeScript types
├── mcp-servers/
│   ├── comfyui-server/   # ComfyUI Cloud MCP server
│   ├── assembly-server/  # ffmpeg MCP server
│   └── meme-engine-server/  # Orchestration MCP server
├── web/                  # Next.js web interface
├── tests/                # Test suites
├── workflows/            # ComfyUI workflow templates
└── docs/                 # Documentation
```

## Common Tasks

### Generate Image

```bash
kimi mcp call generate_image --prompt "A funny cat" --aspect-ratio 9:16
```

### Generate Video from Image

```bash
kimi mcp call generate_video \
  --image-path ./output/scene1-image.png \
  --prompt "Cat walking confidently" \
  --duration 5
```

### Assemble Full Video

```bash
kimi mcp call assemble_full_video \
  --brief-path ./output/brief.json \
  --output-dir ./output/final
```

### Check Pipeline Status

```bash
kimi mcp call get_pipeline_status --request-id req_123
```

## Troubleshooting

### WebSocket Connection Failed

- Verify `COMFY_CLOUD_API_KEY` is set correctly
- Check network connectivity to cloud.comfy.org

### ffmpeg Not Found

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg
```

### MCP Server Won't Start

```bash
# Rebuild MCP servers
npm run build:mcp-servers

# Check for errors
npm run build:mcp-servers 2>&1 | head -50
```

## Next Steps

- Read [API.md](./docs/API.md) for complete API reference
- Check [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for design decisions
- See [MIGRATION.md](./docs/MIGRATION.md) if migrating from Factory AI
- Review [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for production setup

## Getting Help

- Open an issue on GitHub
- Check existing documentation in `docs/`
- Review test files for usage examples
