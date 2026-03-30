# Migration Guide: Factory AI to MCP

This guide helps you migrate existing Factory AI installations to the new MCP-based architecture.

## Overview

### What Changed

| Aspect | Before (Factory AI) | After (MCP) |
|--------|---------------------|-------------|
| Orchestration | Droid definitions + shell scripts | MCP servers + TypeScript |
| Communication | JSON files + shell exec | MCP protocol + stdio |
| Execution | Remote (Factory AI cloud) | Local (your machine) |
| Debugging | Limited (remote logs) | Full local logging |
| Type Safety | None | TypeScript throughout |
| Testing | Difficult | Easy with test suite |

### What Stayed the Same

- Python modules (`comfyui_client.py`, `workflow_builders.py`, `video_assembly.py`)
- ComfyUI Cloud API integration
- Output directory structure (`./output/YYYY-MM-DD/`)
- Production brief JSON format
- Web UI concepts (brief → scenes → video)

## Migration Steps

### Step 1: Backup Your Current Setup

```bash
# Create backup
cp -r .meme-engine .meme-engine-backup-$(date +%Y%m%d)

# Or if using git
git add -A
git commit -m "Pre-MCP migration backup"
```

### Step 2: Install Node.js Dependencies

The MCP servers require Node.js 18+:

```bash
# Check Node version
node --version  # Should be 18+

# If needed, install/update Node.js
# macOS
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 3: Install MCP Servers

```bash
# Clone or navigate to the MCP refactor deliverables
cd mcp-refactor-swarm/deliverables/phase2/mcp-servers

# Install comfyui-server
cd comfyui-server
npm install
npm run build
cd ..

# Install assembly-server
cd assembly-server
npm install
npm run build
cd ..

# Install meme-engine-server
cd meme-engine-server
npm install
npm run build
cd ..
```

Verify builds:
```bash
ls comfyui-server/dist/index.js
ls assembly-server/dist/index.js
ls meme-engine-server/dist/index.js
```

### Step 4: Update Python Modules

Copy the refactored Python modules to your project:

```bash
# Copy from deliverables
cp mcp-refactor-swarm/deliverables/phase1/comfyui_client.py .meme-engine/src/python/
cp mcp-refactor-swarm/deliverables/phase1/workflow_builders.py .meme-engine/src/python/
cp mcp-refactor-swarm/deliverables/phase1/video_assembly.py .meme-engine/src/python/
```

Install Python dependencies:
```bash
cd .meme-engine
pip install websockets certifi
```

### Step 5: Update Environment Configuration

Your existing `.env` file will work, but add MCP server paths:

```bash
cd .meme-engine

# Add to .env
cat >> .env << 'EOF'

# MCP Server Paths (adjust to your actual paths)
COMFYUI_MCP_SERVER_PATH=/absolute/path/to/mcp-servers/comfyui-server
ASSEMBLY_MCP_SERVER_PATH=/absolute/path/to/mcp-servers/assembly-server
MEME_ENGINE_MCP_SERVER_PATH=/absolute/path/to/mcp-servers/meme-engine-server

# Optional: Node path (if not in PATH)
# NODE_PATH=/usr/local/bin/node
EOF
```

### Step 6: Update Web UI (if applicable)

If you're using the Next.js web UI:

```bash
cd .meme-engine/web

# Backup current web
cp -r . web-backup-$(date +%Y%m%d)

# Copy new files from deliverables
cp -r ../../mcp-refactor-swarm/deliverables/phase3/web-updated/src/* src/
cp ../../mcp-refactor-swarm/deliverables/phase3/web-updated/package.json .
cp ../../mcp-refactor-swarm/deliverables/phase3/web-updated/.env.example .

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your settings
```

### Step 7: Test the Migration

#### Test Python Modules

```bash
cd .meme-engine/src/python

# Test imports
python3 -c "from comfyui_client import ComfyUIClient; from workflow_builders import ImageWorkflowBuilder; print('✓ Imports work')"

# Test basic functionality (without API key)
python3 comfyui_client.py
```

#### Test MCP Servers

```bash
# Test comfyui-server
cd mcp-servers/comfyui-server
node dist/index.js
# Should output: {"jsonrpc":"2.0","id":1... (initialization message)
# Press Ctrl+C to exit
```

#### Test End-to-End

```bash
# Using Python directly
source .meme-engine/.env
cd .meme-engine
python3 << 'EOF'
import asyncio
from src.python.comfyui_client import ComfyUIClient
from src.python.workflow_builders import ImageWorkflowBuilder

async def test():
    client = ComfyUIClient(api_key="test")
    builder = ImageWorkflowBuilder()
    workflow = builder.gemini2(scene_id=1, prompt="test", aspect_ratio="9:16")
    print("✓ Workflow built:", "GeminiImage2Node" in str(workflow))

asyncio.run(test())
EOF
```

## API Changes

### Before: Factory AI Shell Script

```bash
# Old way - shell script
echo '{"concept": "funny cat", "format": "mini-drama"}' > ./requests/test.json
./scripts/run-pipeline.sh ./requests/test.json
```

### After: MCP Direct

```bash
# New way - using MCP client directly
# Or through web API
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"concept": "funny cat", "format": "mini-drama"}'
```

### Code Migration Examples

#### Python: Before

```python
# Old: Direct execution
import subprocess
import json

request = {"concept": "funny cat", "format": "mini-drama"}
with open("./requests/test.json", "w") as f:
    json.dump(request, f)

result = subprocess.run(
    ["./scripts/run-pipeline.sh", "./requests/test.json"],
    capture_output=True,
    text=True
)
```

#### Python: After

```python
# New: MCP client
from mcp import ClientSession, StdioServerParameters

server_params = StdioServerParameters(
    command="node",
    args=["./mcp-servers/meme-engine-server/dist/index.js"],
    env={"COMFY_CLOUD_API_KEY": "your-key"}
)

async with ClientSession(server_params) as session:
    result = await session.call_tool("generate_meme_video", {
        "concept": "funny cat",
        "format": "mini-drama",
        "output_dir": "./output/test"
    })
```

#### TypeScript: Before

```typescript
// Old: File-based queue
await writeFile("./requests/test.json", JSON.stringify(request));
await exec("./scripts/run-pipeline.sh ./requests/test.json");
const status = await readFile("./requests/test.status.json");
```

#### TypeScript: After

```typescript
// New: MCP client
import { getMCPClient } from "./lib/mcp-client";

const client = await getMCPClient();
const result = await client.generateMemeVideo({
  concept: "funny cat",
  format: "mini-drama",
  outputDir: "./output/test"
});
const status = await client.getPipelineStatus(result.pipeline_id);
```

## Feature Parity

### Supported Features (MCP Edition)

- ✅ Image generation (Gemini 2, Flux, Nano)
- ✅ Video generation (Kling v3 Omni, Kling v2)
- ✅ Text-to-speech (ElevenLabs)
- ✅ Lip-sync
- ✅ Video assembly (ffmpeg)
- ✅ Multi-format export (9:16, 16:9)
- ✅ Text overlays
- ✅ Thumbnail generation
- ✅ Production brief generation
- ✅ Pipeline status tracking
- ✅ Model fallback chains
- ✅ Web UI (updated)

### Deprecated Features

- ❌ Factory AI droid definitions (`.factory/droids/`)
- ❌ Shell script orchestration
- ❌ File-based request queue (replaced with direct MCP calls)

### New Features (MCP Edition)

- 🆕 Type-safe API
- 🆕 Better error handling
- 🆕 Direct MCP tool access
- 🆕 Improved logging
- 🆕 Test suite
- 🆕 WebSocket-ready architecture

## Troubleshooting Migration

### "MCP Server not found"

```bash
# Check paths
ls $COMFYUI_MCP_SERVER_PATH/dist/index.js
ls $ASSEMBLY_MCP_SERVER_PATH/dist/index.js

# If missing, rebuild
cd $COMFYUI_MCP_SERVER_PATH
npm run build
```

### "Module not found" in Python

```bash
# Ensure correct Python path
cd .meme-engine
export PYTHONPATH="${PYTHONPATH}:./src/python"

# Or install as package
pip install -e .
```

### "WebSocket connection failed"

```bash
# Check API key
source .env
echo $COMFY_CLOUD_API_KEY

# Test connectivity
curl -H "X-API-Key: $COMFY_CLOUD_API_KEY" \
  https://cloud.comfy.org/api/system_stats
```

### "ffmpeg not found"

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Verify
ffmpeg -version
```

## Rollback Plan

If you need to rollback to Factory AI:

```bash
# Restore from backup
cd .meme-engine
rm -rf src/python
mv src/python-backup src/python

# Or restore git state
git reset --hard HEAD~1  # Or appropriate commit

# Remove MCP servers
rm -rf ../mcp-servers

# Test old way still works
./scripts/run-pipeline.sh ./requests/example.json
```

## Post-Migration Checklist

- [ ] MCP servers built and paths configured
- [ ] Python modules updated and importing correctly
- [ ] Environment variables set
- [ ] Test generation works: `python -m meme_engine test`
- [ ] Web UI starts without errors: `npm run dev`
- [ ] API endpoints respond: `curl http://localhost:3000/api/outputs`
- [ ] File outputs appear in `./output/` directory
- [ ] Logs show successful MCP tool calls
- [ ] Can generate a full meme video end-to-end
- [ ] Backed up old configuration

## Getting Help

### Logs to Check

1. **MCP Server logs** - Check stderr output
2. **Web UI console** - Browser developer tools
3. **Python logs** - `./output/YYYY-MM-DD/generation-log.json`
4. **System logs** - `journalctl` (Linux) or Console app (macOS)

### Debug Commands

```bash
# Test MCP server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \
  node mcp-servers/comfyui-server/dist/index.js

# Test Python module
python3 -c "from src.python.comfyui_client import ComfyUIClient; print('OK')"

# Check environment
env | grep -E "(COMFY|MCP|NODE)"
```

## Migration Timeline

| Phase | Task | Estimated Time |
|-------|------|----------------|
| 1 | Backup and preparation | 15 min |
| 2 | Install dependencies | 30 min |
| 3 | Install MCP servers | 20 min |
| 4 | Update Python modules | 10 min |
| 5 | Update configuration | 10 min |
| 6 | Update Web UI (optional) | 30 min |
| 7 | Testing and verification | 30 min |
| | **Total** | **~2.5 hours** |

## Next Steps After Migration

1. **Explore MCP tools** - Try individual tools via Claude Desktop
2. **Customize workflow builders** - Add your own ComfyUI node wrappers
3. **Extend assembly tools** - Add custom ffmpeg filters
4. **Contribute** - Submit PRs for new features
5. **Join community** - Share your meme creations!

---

For additional help, see:
- [API Reference](./API.md)
- [Architecture Decisions](./ARCHITECTURE.md)
- [Troubleshooting Guide](./README.md#troubleshooting)
