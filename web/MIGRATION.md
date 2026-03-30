# Web UI Migration Guide: Shell Script to MCP

## Overview

This guide documents the migration of the Meme Engine Web UI from a shell script-based execution model to a Model Context Protocol (MCP) server architecture.

## Architecture Changes

### Before (Shell Script Approach)

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   Next.js   │────▶│  File Queue │────▶│ run-pipeline.sh  │
│   Web UI    │     │  (JSON)     │     │                  │
└─────────────┘     └─────────────┘     └────────┬─────────┘
                                                 │
                    ┌────────────────────────────┼─────────┐
                    │                            │         │
                    ▼                            ▼         ▼
              ┌──────────┐              ┌──────────┐ ┌──────────┐
              │  Python  │              │  ComfyUI │ │  FFmpeg  │
              │  Scripts │              │  Cloud   │ │          │
              └──────────┘              └──────────┘ └──────────┘
```

**Problems:**
- File-based queue was brittle and hard to scale
- Shell script execution was difficult to debug
- Status tracking required polling JSON files
- Limited error handling and retry logic
- No type safety between components

### After (MCP Approach)

```
┌─────────────┐     ┌─────────────┐     ┌───────────────────────────┐
│   Next.js   │────▶│   MCP       │────▶│  meme-engine-server       │
│   Web UI    │     │   Client    │     │  (Orchestrator)           │
└─────────────┘     └─────────────┘     └──────────┬────────────────┘
                                                   │
                              ┌────────────────────┼────────────────────┐
                              │                    │                    │
                              ▼                    ▼                    ▼
                    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
                    │ comfyui-server  │  │ assembly-server │  │  Other Tools    │
                    │ (Generation)    │  │  (Assembly)     │  │                 │
                    └─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Benefits:**
- Type-safe communication via MCP protocol
- Direct function calls instead of file I/O
- Better error handling and logging
- Easier to extend with new capabilities
- Cleaner separation of concerns

## Changes Made

### 1. New Dependencies

Added to `package.json`:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "zod": "^3.22.0"
  }
}
```

Install with:
```bash
npm install
```

### 2. New Files Created

#### Core MCP Client (`src/lib/mcp-client.ts`)

The main client that manages connections to MCP servers:

```typescript
// Usage example
import { getMCPClient } from "@/lib/mcp-client";

const client = await getMCPClient();
const result = await client.generateMemeVideo({
  concept: "A cat explaining quantum physics",
  outputDir: "./output/my-meme",
});
```

Key features:
- Manages stdio transport to MCP servers
- Auto-reconnection if servers crash
- Singleton pattern for connection reuse
- Comprehensive error wrapping

#### Type Definitions (`src/types/index.ts`)

Complete TypeScript types for:
- `ProductionBrief` - Video generation specification
- `PipelineStatus` - Generation progress tracking
- `GenerateImageInput/Output` - Image generation types
- `AssembleVideoInput/Output` - Assembly types
- And many more...

#### Updated API Routes

**`src/app/api/requests/route.ts`**
- POST: Creates meme generation requests via MCP
- GET: Retrieves pipeline status via MCP

**`src/app/api/requests/[id]/route.ts`**
- GET: Detailed status for specific request
- DELETE: Request cancellation (stub)

**`src/app/api/outputs/route.ts`**
- GET: List generated outputs
- Scans output directory for completed videos

### 3. Configuration Changes

New environment variables in `.env.example`:

```bash
# MCP Server Paths
COMFYUI_MCP_SERVER_PATH=../mcp-servers/comfyui-server
ASSEMBLY_MCP_SERVER_PATH=../mcp-servers/assembly-server
MEME_ENGINE_MCP_SERVER_PATH=../mcp-servers/meme-engine-server

# API Key
COMFY_CLOUD_API_KEY=your_api_key_here

# Output Directory
OUTPUT_DIR=./output
```

## Setup Instructions

### Step 1: Install Dependencies

```bash
# In the web directory
npm install
```

### Step 2: Build MCP Servers

Each MCP server must be built before use:

```bash
# Build comfyui-server
cd ../mcp-servers/comfyui-server
npm install
npm run build

# Build assembly-server
cd ../assembly-server
npm install
npm run build

# Build meme-engine-server
cd ../meme-engine-server
npm install
npm run build
```

### Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env.local

# Edit .env.local with your settings
# - Set COMFY_CLOUD_API_KEY
# - Adjust MCP server paths if needed
```

### Step 4: Run Development Server

```bash
npm run dev
```

### Step 5: Test the API

Create a meme:
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"concept": "A bodega cat giving financial advice"}'
```

Check status:
```bash
curl "http://localhost:3000/api/requests?id=YOUR_PIPELINE_ID"
```

## API Compatibility

### Request Format (Unchanged)

```json
POST /api/requests
{
  "concept": "Your meme concept here",
  "format": "mini-drama",
  "style": "absurdist",
  "duration": 15
}
```

### Response Format (Enhanced)

```json
{
  "request_id": "uuid-string",
  "pipeline_id": "pipeline-uuid",
  "status": "generating",
  "slug": "your-meme-concept",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Status Endpoint (Enhanced)

```json
GET /api/requests?id=PIPELINE_ID
{
  "request_id": "uuid",
  "slug": "meme-slug",
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
  "outputs": { ... },
  "errors": [],
  "started_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

## Migration Checklist

- [ ] Backup existing `web/` directory
- [ ] Copy new files from `deliverables/phase3/web-updated/`
- [ ] Install new npm dependencies
- [ ] Build all MCP servers
- [ ] Configure environment variables
- [ ] Test API endpoints
- [ ] Update frontend to use new response format
- [ ] Remove old shell script references
- [ ] Update documentation

## Troubleshooting

### MCP Server Connection Fails

**Symptom:** `Error: Meme engine server not connected`

**Solutions:**
1. Check that MCP servers are built:
   ```bash
   ls ../mcp-servers/comfyui-server/dist/index.js
   ```

2. Verify paths in `.env.local`:
   ```bash
   COMFYUI_MCP_SERVER_PATH=/absolute/path/to/comfyui-server
   ```

3. Check server logs for errors

### API Key Issues

**Symptom:** `Error: COMFY_CLOUD_API_KEY not set`

**Solution:**
Add to `.env.local`:
```bash
COMFY_CLOUD_API_KEY=your_actual_api_key
```

### Type Errors

**Symptom:** TypeScript compilation errors

**Solution:**
Ensure types are imported correctly:
```typescript
import { ProductionBrief } from "@/types";
```

## Performance Considerations

### Connection Pooling

The MCP client maintains persistent connections to servers:
- Connections are reused across requests
- Auto-reconnect on server restart
- Graceful shutdown on app termination

### Error Handling

All MCP errors are wrapped and logged:
```typescript
try {
  const result = await client.generateMemeVideo(...);
} catch (error) {
  // Error is already logged to console
  // Return user-friendly error response
}
```

## Future Enhancements

1. **WebSocket Support**: Real-time status updates
2. **Queue Management**: Handle multiple concurrent requests
3. **Caching**: Cache brief generation results
4. **Monitoring**: Add metrics and health checks
5. **Authentication**: API key or JWT-based auth

## Rollback Plan

If issues occur, rollback to shell script approach:

1. Restore backup of original `web/` directory
2. Stop MCP servers (they'll exit when parent process ends)
3. Restart original Next.js app

## Support

For issues with:
- **MCP Client**: Check `src/lib/mcp-client.ts` logs
- **API Routes**: Check server console output
- **MCP Servers**: Check individual server stderr

## References

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Meme Engine Schemas](../phase2/schemas.ts)
- [MCP Server Sources](../phase2/mcp-servers/)
