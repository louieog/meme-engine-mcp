# Meme Engine Web UI - MCP Migration

This directory contains the updated Next.js web application that uses MCP (Model Context Protocol) servers instead of shell script execution.

## Files Included

```
web-updated/
├── .env.example                    # Environment configuration template
├── MIGRATION.md                    # Detailed migration guide
├── package.json                    # Updated dependencies
├── README.md                       # This file
└── src/
    ├── lib/
    │   ├── mcp-client.ts          # MCP client wrapper
    │   └── utils.ts               # Utility functions
    ├── types/
    │   └── index.ts               # TypeScript type definitions
    └── app/
        └── api/
            ├── outputs/
            │   └── route.ts       # GET /api/outputs - List/get outputs
            └── requests/
                ├── route.ts       # POST/GET /api/requests
                └── [id]/
                    └── route.ts   # GET/DELETE /api/requests/[id]
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build MCP Servers

```bash
# From the project root
cd ../mcp-servers/comfyui-server && npm install && npm run build
cd ../assembly-server && npm install && npm run build
cd ../meme-engine-server && npm install && npm run build
```

### 3. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your API keys
```

### 4. Run Development Server

```bash
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/requests` | Create new meme generation request |
| GET | `/api/requests?id={id}` | Get request status |
| GET | `/api/requests/{id}` | Get detailed request status |
| DELETE | `/api/requests/{id}` | Cancel request |
| GET | `/api/outputs` | List all outputs |
| GET | `/api/outputs?id={id}` | Get specific output |

## Example Usage

### Create a Meme

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "concept": "A bodega cat giving financial advice",
    "format": "mini-drama",
    "style": "absurdist",
    "duration": 15
  }'
```

Response:
```json
{
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "pipeline_id": "pipeline-abc123",
  "status": "generating",
  "slug": "a-bodega-cat-giving-financial",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Check Status

```bash
curl "http://localhost:3000/api/requests/pipeline-abc123"
```

Response:
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

## Architecture

The web UI communicates with MCP servers via stdio transport:

```
Next.js API Route
      │
      ▼
MCP Client (lib/mcp-client.ts)
      │
      ├─────────────┬─────────────┐
      │             │             │
      ▼             ▼             ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ comfyui  │ │ assembly │ │ meme-    │
│ -server  │ │ -server  │ │ engine   │
└──────────┘ └──────────┘ └──────────┘
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `COMFY_CLOUD_API_KEY` | ComfyUI Cloud API key | Yes |
| `COMFYUI_MCP_SERVER_PATH` | Path to comfyui-server | Yes |
| `ASSEMBLY_MCP_SERVER_PATH` | Path to assembly-server | Yes |
| `MEME_ENGINE_MCP_SERVER_PATH` | Path to meme-engine-server | Yes |
| `OUTPUT_DIR` | Output directory for videos | No (default: ./output) |

## Migration from Shell Script

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions.

## Troubleshooting

### MCP Server Not Found

Ensure MCP servers are built:
```bash
ls ../mcp-servers/comfyui-server/dist/index.js
```

### Connection Errors

Check that paths in `.env.local` are correct and absolute if needed.

### Type Errors

Run typecheck:
```bash
npm run typecheck
```

## License

Same as parent project.
