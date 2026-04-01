# Meme Engine MCP

AI-powered viral meme video generation using **Model Context Protocol (MCP)** and **ComfyUI Cloud**. Built with Next.js, TypeScript, and Python.

![Meme Engine MCP](https://img.shields.io/badge/Meme%20Engine-MCP-purple)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Python](https://img.shields.io/badge/Python-3.11-yellow)

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/louieog/meme-engine-mcp.git
cd meme-engine-mcp

# 2. Install dependencies
npm install
cd web && npm install && cd ..

# 3. Install MCP servers
cd mcp-servers/comfyui-server && npm install && npm run build
cd ../assembly-server && npm install && npm run build
cd ../meme-engine-server && npm install && npm run build
cd ../..

# 4. Configure environment
cp .env.example .env
# Edit .env with your API keys:
# - COMFY_CLOUD_API_KEY (from comfy.org)
# - ANTHROPIC_API_KEY (optional, for Claude)
# - OPENAI_API_KEY (optional, for GPT-4)

# 5. Start the web UI
cd web && npm run dev

# 6. Start MCP servers (in separate terminals)
cd mcp-servers/comfyui-server && npm start
cd mcp-servers/assembly-server && npm start
cd mcp-servers/meme-engine-server && npm start
```

Open http://localhost:3000

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js Web UI                           │
│  React + TypeScript + Tailwind CSS                               │
│  Routes: /, /create, /gallery, /settings, /status/[id]          │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Routes (App Router)                       │
│  /api/requests      - Create video requests                      │
│  /api/settings/keys - Secure API key storage                     │
│  /api/gallery       - Browse generated videos                    │
│  /api/outputs/...   - Serve video files                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│   UniversalOrchestrator │  │    MCP Client Wrapper   │
│   (Model-Agnostic LLM)  │  │   (stdio transport)    │
└───────────┬─────────────┘  └───────────┬─────────────┘
            │                            │
            ▼                            ▼
┌─────────────────────────┐  ┌─────────────────────────┐
│  LLM Adapters           │  │  MCP Servers            │
│  - Claude (Anthropic)   │  │  - comfyui-server       │
│  - GPT-4 (OpenAI)       │  │  - assembly-server      │
│  - Gemini (Google)      │  │  - meme-engine-server   │
└─────────────────────────┘  └───────────┬─────────────┘
                                         │
                              ┌──────────┴──────────┐
                              ▼                     ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │  Python Bridge  │    │  Python Bridge  │
                    │ comfyui_client  │    │ video_assembly  │
                    └────────┬────────┘    └────────┬────────┘
                             │                      │
                             ▼                      ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │ ComfyUI Cloud   │    │    ffmpeg       │
                    │  - Gemini       │    │  - concat       │
                    │  - Flux         │    │  - overlays     │
                    │  - Kling        │    │  - export       │
                    │  - ElevenLabs   │    │  - thumbnails   │
                    └─────────────────┘    └─────────────────┘
```

---

## ✨ Features

### Multi-Provider LLM Support
- **Claude** (Anthropic) - Default, excellent tool calling
- **GPT-4** (OpenAI) - Strong reasoning
- **Gemini** (Google) - Cost-effective
- **Any model** via LiteLLM proxy

Switch providers with environment variable:
```bash
export LLM_PROVIDER=openai  # or claude, gemini
export LLM_API_KEY=sk-...
```

### Intelligent Model Selection
50+ AI models in registry with fallback chains:
- **Image**: Gemini 3 Pro, Flux, DALL-E, Ideogram, etc.
- **Video**: Kling v3 Omni, Veo 3, Runway, etc.
- **Audio**: ElevenLabs TTS
- **Lip Sync**: Kling, Wav2Lip

Native audio detection - skips TTS/lip-sync when video model supports it.

### Secure API Key Storage
- AES-256-GCM encryption
- PBKDF2 key derivation (100k iterations)
- Keys stored in `~/.meme-engine/` (user-only access)
- Never touches browser storage (XSS-safe)
- Falls back to environment variables

### Web UI
- **Create**: Enter concept, select format, override models
- **Brief Review**: AI-generated scene breakdown
- **Pipeline Monitor**: Real-time progress tracking
- **Gallery**: Browse completed videos
- **Settings**: Secure API key management

---

## 📁 Project Structure

```
meme-engine-mcp/
├── src/
│   ├── schemas.ts                    # Shared TypeScript types
│   ├── models.ts                     # Model registry (50+ models)
│   ├── orchestrator-prompt.ts        # Claude system prompt
│   ├── llm-adapters.ts               # Multi-provider LLM interface
│   ├── secure-key-storage.ts         # Encrypted key storage
│   └── python/
│       ├── comfyui_client.py         # ComfyUI Cloud API client
│       ├── workflow_builders.py      # Workflow template builders
│       └── video_assembly.py         # ffmpeg pipeline
│
├── mcp-servers/
│   ├── comfyui-server/               # Image/video/audio generation
│   ├── assembly-server/              # Video post-processing
│   └── meme-engine-server/           # Orchestration layer
│       └── src/
│           ├── universal-orchestrator.ts  # Model-agnostic orchestrator
│           └── mcp-client-wrapper.ts      # MCP connection manager
│
├── web/                              # Next.js 15 web UI
│   └── src/
│       ├── app/
│       │   ├── page.tsx              # Home
│       │   ├── create/page.tsx       # Create video
│       │   ├── settings/page.tsx     # API key management
│       │   ├── gallery/page.tsx      # Video gallery
│       │   ├── status/[id]/page.tsx  # Pipeline monitor
│       │   └── api/                  # API routes
│       ├── components/               # React components
│       └── lib/                      # Utilities
│
├── docs/                             # Documentation
│   ├── API_KEY_SECURITY.md
│   ├── MODEL_AGNOSTIC_SETUP.md
│   └── REFACTOR_PROMPT.md
│
└── workflows/                        # ComfyUI workflow templates
```

---

## 🔧 MCP Servers

### comfyui-server
Generative AI via ComfyUI Cloud:

| Tool | Description | Timeout |
|------|-------------|---------|
| `generate_image` | Generate images with fallback chain | 10 min |
| `generate_video` | Animate images to video | 12 min |
| `text_to_speech` | ElevenLabs TTS | 2 min |
| `lip_sync` | Synchronize video with audio | 10 min |
| `upload_file` | Upload to ComfyUI Cloud | 2 min |
| `get_job_status` | Check generation status | - |

### assembly-server
Video post-processing with ffmpeg:

| Tool | Description |
|------|-------------|
| `assemble_full_video` | Complete pipeline: concat → overlays → audio |
| `concatenate_scenes` | Join video clips |
| `add_text_overlay` | Burn text onto video |
| `mix_audio` | Layer audio tracks |
| `export_format` | Export 9:16, 16:9, etc. |
| `generate_thumbnail` | Extract poster frame |

### meme-engine-server
High-level orchestration with LLM:

| Tool | Description |
|------|-------------|
| `generate_meme_video` | Full pipeline with LLM brief generation |
| `get_pipeline_status` | Check pipeline progress |

---

## 💻 Usage

### Web UI

1. **Configure API Keys**
   - Go to http://localhost:3000/settings
   - Enter ComfyUI Cloud API Key
   - Select LLM provider and enter key
   - Create master password for encryption

2. **Create Video**
   - Go to http://localhost:3000/create
   - Enter concept (e.g., "A cat news anchor reporting on the apocalypse")
   - Select format (mini-drama, text-meme, reaction, skit)
   - Override models if desired
   - Click "Generate"

3. **Monitor Progress**
   - Watch real-time status at /status/[id]
   - See scene-by-scene progress
   - View logs

4. **View Results**
   - Browse gallery at /gallery
   - Download 9:16 (mobile) and 16:9 (desktop) versions

### Programmatic API

```typescript
// Create video request
const response = await fetch('/api/requests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    concept: "A cat news anchor",
    format: "mini-drama",
    style: "dark-humor",
    duration_target: 30,
    model_overrides: {
      image: "GeminiImage2Node:gemini-3-pro-image-preview",
      video: "KlingOmniProImageToVideoNode:kling-v3-omni"
    }
  })
});

const { id, status } = await response.json();
// Poll /api/requests/${id} for status
```

### Python Direct

```python
import asyncio
from src.python.comfyui_client import ComfyUIClient
from src.python.workflow_builders import ImageWorkflowBuilder, VideoWorkflowBuilder

async def main():
    client = ComfyUIClient(api_key="your-key")
    
    # Generate image
    image_builder = ImageWorkflowBuilder()
    workflow = image_builder.build_for_model(
        model_key="GeminiImage2Node:gemini-3-pro-image-preview",
        scene_id=1,
        prompt="A funny cat in a business suit",
        aspect_ratio="9:16"
    )
    
    prompt_id, outputs = await client.submit_and_wait(workflow)
    print(f"Generated: {outputs}")
    
    # Generate video from image
    video_builder = VideoWorkflowBuilder()
    video_workflow = video_builder.build_for_model(
        model_key="KlingOmniProImageToVideoNode:kling-v3-omni",
        cloud_image="uploaded_image.png",
        scene_id=1,
        prompt="Cat walking confidently",
        duration=5,
        generate_audio=True
    )
    
    await client.submit_and_wait(video_workflow)

asyncio.run(main())
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `COMFY_CLOUD_API_KEY` | ComfyUI Cloud API key | Yes |
| `LLM_PROVIDER` | `claude`, `openai`, `gemini` | No (default: claude) |
| `LLM_API_KEY` | Generic LLM API key | No* |
| `ANTHROPIC_API_KEY` | Claude-specific key | No* |
| `OPENAI_API_KEY` | OpenAI-specific key | No* |
| `GOOGLE_API_KEY` | Gemini-specific key | No* |

*At least one LLM API key required

### Model Registry

Models defined in `src/models.ts`:

```typescript
// Image models
GeminiImage2Node:gemini-3-pro-image-preview
FluxKontextProImageNode
OpenAIGPTImage1
...

// Video models  
KlingOmniProImageToVideoNode:kling-v3-omni  // Native audio
Veo3VideoGenerationNode:veo-3.1-generate     // Native audio
KlingImage2VideoNode:kling-v2-1-master       // Silent
...
```

Each model has:
- `nodeClass` - ComfyUI node type
- `hasAudio` - Native audio support
- `fallbackChain` - Alternative models on failure
- `speed`/`quality` - Performance indicators

---

## 🧪 Development

### Build All

```bash
# Root dependencies
npm install

# Web UI
cd web && npm install && npm run build

# MCP servers
cd mcp-servers/comfyui-server && npm run build
cd ../assembly-server && npm run build
cd ../meme-engine-server && npm run build
```

### Running Locally

```bash
# Terminal 1: Web UI
cd web && npm run dev

# Terminal 2: ComfyUI MCP Server
cd mcp-servers/comfyui-server && npm start

# Terminal 3: Assembly MCP Server  
cd mcp-servers/assembly-server && npm start

# Terminal 4: Meme Engine MCP Server
cd mcp-servers/meme-engine-server && npm start
```

### Testing

```bash
# Type check
npm run typecheck

# Build test
npm run build

# Python tests
cd src/python && python -m pytest
```

---

## 🐛 Troubleshooting

### "Internal Server Error" on page load
- Check all MCP servers are running
- Verify API keys are configured
- Check logs: `web/.next/logs`

### "Module not found" errors
- Run `npm install` in all directories
- Run `npm run build` in all MCP servers

### MCP servers won't start
- Check port availability (default: stdio transport)
- Verify Node.js version (18+)

### ffmpeg errors
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Verify
ffmpeg -version
```

### ComfyUI Cloud errors
- Verify `COMFY_CLOUD_API_KEY` is set
- Check key has sufficient credits
- Verify network connectivity to `cloud.comfy.org`

### Model fallback issues
- Check `src/models.ts` for model availability
- Review logs for fallback chain execution
- Verify model names match ComfyUI Cloud exactly

---

## 📚 Documentation

- [API Key Security](./docs/API_KEY_SECURITY.md) - How keys are encrypted and stored
- [Model Agnostic Setup](./docs/MODEL_AGNOSTIC_SETUP.md) - Using different LLM providers
- [Refactor Prompt](./docs/REFACTOR_PROMPT.md) - Original migration specification
- [Agent Swarm Plan](./AGENT_SWARM_PLAN.md) - Development execution plan

---

## 🔄 Migration from Factory AI

This project was refactored from Factory AI Droid architecture to MCP:

| Before (Factory) | After (MCP) |
|------------------|-------------|
| Droid markdown files | TypeScript MCP servers |
| Shell script orchestration | Direct tool calling |
| File-based communication | In-memory/stdio transport |
| Single provider | Multi-provider LLM support |
| Hardcoded models | Dynamic model registry |
| Environment-only keys | Encrypted file storage |

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) file

---

## 🙏 Acknowledgments

- [ComfyUI](https://comfy.org/) for the amazing generative AI platform
- [Anthropic](https://anthropic.com/) for Claude and MCP
- [Next.js](https://nextjs.org/) for the React framework
- Factory AI for the original droid architecture inspiration
