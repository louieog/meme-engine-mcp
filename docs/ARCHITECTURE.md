# Architecture Decision Records

## ADR 1: Use MCP Instead of Factory AI Droids

**Status**: Accepted

**Context**: The original implementation used Factory AI's Droid system with shell script orchestration. While functional, this approach had limitations:
- Dependency on external Factory AI service
- Limited debugging capabilities (executed remotely)
- Shell script orchestration was brittle and hard to test
- No local logging or visibility into execution
- Vendor lock-in concerns

**Decision**: Migrate to Anthropic's Model Context Protocol (MCP).

**Rationale**:
- Open standard with growing ecosystem support
- Better debugging and observability through local execution
- Type-safe tool definitions via JSON schemas
- No vendor lock-in - MCP is an open protocol
- Can run entirely locally without external services
- Direct integration with Claude Desktop and other MCP clients
- Simpler mental model - tools are just functions

**Consequences**:
- (+) Full control over execution environment
- (+) Can run locally without external service dependencies
- (+) Easier testing and CI/CD integration
- (+) Type-safe interfaces between components
- (+) Better error handling and retry logic
- (-) Need to implement orchestration logic ourselves
- (-) More initial setup required
- (-) Need to maintain MCP server implementations

---

## ADR 2: Python Subprocess Wrappers for MCP Servers

**Status**: Accepted

**Context**: The existing codebase had well-tested Python modules for ComfyUI interaction (`comfyui_client.py`, `workflow_builders.py`, `video_assembly.py`). We needed to expose this functionality via MCP.

Options considered:
1. **Rewrite in TypeScript** - Full port to TypeScript
2. **Python MCP SDK** - Use Python MCP SDK directly
3. **TypeScript wrappers calling Python** - Keep Python, wrap with TypeScript
4. **HTTP API** - Expose Python as REST API, MCP calls HTTP

**Decision**: Use TypeScript MCP servers that call Python via subprocess.

**Rationale**:
- Fastest migration path - minimal changes to proven Python code
- Well-tested Python logic remains intact
- TypeScript provides type safety at the MCP boundary
- Can incrementally port to TypeScript later if needed
- Subprocess overhead is acceptable for video generation (IO-bound)
- No network stack needed (stdio transport)

**Implementation**:
```typescript
// TypeScript MCP server
async function generateImage(args: GenerateImageInput): Promise<ToolResult> {
  const pythonScript = `
import asyncio
from comfyui_client import ComfyUIClient
from workflow_builders import create_image_fallback_chain

async def main():
    client = ComfyUIClient(api_key="${apiKey}")
    workflows = create_image_fallback_chain(...)
    model, prompt_id, outputs = await client.generate_with_fallback(workflows, "${stepName}")
    # ... download and return
  `;
  
  const result = await execPython(pythonScript);
  return formatToolResult(result);
}
```

**Consequences**:
- (+) Minimal code changes to Python modules
- (+) Proven Python logic preserved
- (+) Fastest path to working MCP implementation
- (+) Can migrate incrementally to pure TypeScript
- (-) Slight overhead from subprocess execution
- (-) Need to manage Python/Node interop
- (-) Two language stacks to maintain

---

## ADR 3: File-Based Status Tracking

**Status**: Accepted

**Context**: Need to track pipeline status across multiple stages (brief generation, image gen, video gen, assembly, export). The original system used JSON files in `./output/YYYY-MM-DD/status.json`.

Options considered:
1. **In-memory state** - Fast but lost on restart
2. **Database (SQLite/PostgreSQL)** - Robust but adds complexity
3. **Redis** - Good for real-time but additional infrastructure
4. **File-based (backward compatible)** - Simple, debuggable
5. **WebSocket real-time** - Good for UI but not for persistence

**Decision**: Continue using JSON status files (backward compatible) with optional WebSocket for real-time updates.

**Rationale**:
- Backward compatible with existing web UI polling
- Simple and debuggable - can inspect status files directly
- No database dependency or infrastructure
- Works well with file-based output structure
- Can add WebSocket layer on top for real-time

**Structure**:
```json
{
  "request_id": "req-123",
  "slug": "my-meme-video",
  "status": "generating",
  "stage": "video_generation",
  "progress": {
    "total_scenes": 3,
    "completed_scenes": 1,
    "current_scene": 2,
    "percent_complete": 45
  },
  "outputs": {
    "scenes": {
      "1": {"image": "...", "video": "..."}
    }
  },
  "errors": [],
  "started_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:35:00Z"
}
```

**Consequences**:
- (+) Backward compatible with existing UI
- (+) Simple to debug and inspect
- (+) No additional infrastructure
- (+) Works with simple file polling
- (-) Not ideal for concurrent updates
- (-) File I/O overhead (minimal)
- (-) Not easily queryable like a database

---

## ADR 4: Three Separate MCP Servers

**Status**: Accepted

**Context**: We need to expose functionality via MCP. Should we have one monolithic server or multiple specialized servers?

Options considered:
1. **Single monolithic server** - One MCP server for everything
2. **Two servers** - Generation + Assembly
3. **Three servers** - ComfyUI, Assembly, Orchestration
4. **Many small servers** - One per tool

**Decision**: Three specialized MCP servers:
- `comfyui-server` - ComfyUI Cloud interaction
- `assembly-server` - ffmpeg video assembly
- `meme-engine-server` - High-level orchestration

**Rationale**:
- Clear separation of concerns
- Can scale/optimize each independently
- Different error handling needs
- Assembly server can be used standalone for other projects
- Orchestration server coordinates between others
- Matches the original 3-droid architecture (scout, workflow-builder, assembler)

**Responsibilities**:

| Server | Responsibility | Tools |
|--------|---------------|-------|
| comfyui-server | Media generation via ComfyUI | generate_image, generate_video, text_to_speech, lip_sync |
| assembly-server | Video post-processing | concatenate_scenes, add_text_overlay, export_format |
| meme-engine-server | Pipeline orchestration | generate_meme_video, create_production_brief, get_pipeline_status |

**Consequences**:
- (+) Clear separation of concerns
- (+) Can use servers independently
- (+) Easier to test and maintain
- (+) Matches conceptual architecture
- (-) More processes to manage
- (-) Need inter-server communication for full pipeline
- (-) More configuration

---

## ADR 5: Stdio Transport for MCP

**Status**: Accepted

**Context**: MCP supports multiple transports (stdio, HTTP, WebSocket). Which should we use?

Options considered:
1. **stdio** - Standard input/output pipes
2. **HTTP** - REST API transport
3. **WebSocket** - Real-time bidirectional
4. **SSE** - Server-sent events

**Decision**: Use stdio transport for local servers, HTTP for remote.

**Rationale**:
- Stdio is simplest for local execution
- No network stack or port management needed
- Secure - no exposed ports
- Fast for local communication
- MCP SDK has excellent stdio support
- HTTP can be added later for remote access

**Architecture**:
```
Next.js API Route
      │
      ▼
MCP Client (stdio)
      │
      ├──▶ comfyui-server (stdio)
      ├──▶ assembly-server (stdio)
      └──▶ meme-engine-server (stdio)
```

**Consequences**:
- (+) Simplest implementation
- (+) No network configuration
- (+) Secure by default
- (+) Fast local communication
- (-) Servers must be local (or use SSH tunnel)
- (-) Can't access from remote machines directly
- (-) Process lifecycle tied together

---

## ADR 6: Async/Await Throughout

**Status**: Accepted

**Context**: Video generation involves multiple IO-bound operations (API calls, file downloads, ffmpeg processing). Should we use callbacks, promises, or async/await?

**Decision**: Use async/await exclusively throughout the codebase.

**Rationale**:
- Async/await is most readable for sequential operations
- Python has excellent asyncio support
- TypeScript/JavaScript async/await is standard
- Easier error handling with try/catch
- ComfyUI Cloud API is naturally async (WebSocket)
- ffmpeg operations can run in subprocess async

**Patterns**:

Python:
```python
async def generate_scene(client, scene_config):
    # Upload image
    cloud_file = await client.upload_file(image_path)
    
    # Generate video
    workflow = builder.kling_omni(cloud_file, ...)
    prompt_id, outputs = await client.submit_and_wait(workflow)
    
    # Download result
    await client.download_outputs(outputs, output_dir)
```

TypeScript:
```typescript
async function generateScene(config: SceneConfig): Promise<SceneResult> {
  try {
    const imageResult = await mcpClient.callTool("generate_image", {...});
    const videoResult = await mcpClient.callTool("generate_video", {...});
    return { image: imageResult, video: videoResult };
  } catch (error) {
    logger.error("Scene generation failed", error);
    throw error;
  }
}
```

**Consequences**:
- (+) Clean, readable code
- (+) Proper error stack traces
- (+) Easy sequential composition
- (+) Can parallelize with Promise.all when needed
- (-) Need to understand async/await
- (-) Potential for unhandled promise rejections
- (-) Debugging can be more complex

---

## ADR 7: Model Fallback Chains

**Status**: Accepted

**Context**: ComfyUI Cloud model availability varies. Sometimes Gemini 2 is unavailable, sometimes Kling v3 is down. Need a strategy for handling this.

Options considered:
1. **Fail fast** - Return error if primary model unavailable
2. **Manual fallback** - User specifies backup models
3. **Automatic fallback chain** - Try models in priority order
4. **Dynamic model selection** - Query available models first

**Decision**: Implement automatic fallback chains with configurable primary model.

**Rationale**:
- Models can become unavailable without notice
- User shouldn't need to handle this manually
- Different models work better for different content
- Fallback should be transparent to user when possible
- Can log which model was actually used

**Implementation**:

```python
# Image generation fallback chain
IMAGE_FALLBACK_CHAIN = [
    ("gemini-3-pro", ImageWorkflowBuilder.gemini2),
    ("flux-kontext", ImageWorkflowBuilder.flux_kontext),
    ("nano-banana-2", ImageWorkflowBuilder.gemini_nano)
]

# Usage
model_used, prompt_id, outputs = await client.generate_with_fallback(
    [(name, builder(scene_id, prompt)) for name, builder in IMAGE_FALLBACK_CHAIN],
    step_name="scene-1-image"
)
```

**Consequences**:
- (+) Resilient to model unavailability
- (+) Transparent to users
- (+) Logs show which model succeeded
- (-) Different models produce different quality
- (-) Fallback adds latency
- (-) Need to maintain fallback chains

---

## ADR 8: Builder Pattern for Workflows

**Status**: Accepted

**Context**: ComfyUI workflows are complex JSON structures. Need a way to construct them programmatically.

Options considered:
1. **Raw JSON manipulation** - Direct dict manipulation
2. **Template strings** - JSON with placeholders
3. **Builder pattern** - Fluent API for construction
4. **Class-based nodes** - Full object model

**Decision**: Use builder pattern with method chaining.

**Rationale**:
- Workflows have common patterns (image → save, video → save)
- Builder provides discoverable API
- Type hints help with IDE autocomplete
- Easy to add new model variants
- Fluent API is readable

**Implementation**:
```python
class ImageWorkflowBuilder(WorkflowBuilder):
    def gemini2(self, scene_id, prompt, aspect_ratio="9:16", seed=42):
        return {
            "1": {
                "class_type": "GeminiImage2Node",
                "inputs": {
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "seed": seed,
                    "model": "gemini-3-pro-image-preview"
                }
            },
            "2": {
                "class_type": "SaveImage",
                "inputs": {
                    "images": ["1", 0],
                    "filename_prefix": f"scene{scene_id}-{aspect_ratio.replace(':', 'x')}-char"
                }
            }
        }
```

**Consequences**:
- (+) Clean, discoverable API
- (+) Type hints and IDE support
- (+) Easy to extend with new models
- (+) Encapsulates workflow structure
- (-) Need to update builder when ComfyUI nodes change
- (-) Some complexity in builder implementation

---

## Summary

| ADR | Decision | Impact |
|-----|----------|--------|
| 1 | MCP over Factory AI | High - Architecture change |
| 2 | TypeScript wrappers over Python | Medium - Implementation |
| 3 | File-based status tracking | Low - Backward compatible |
| 4 | Three separate MCP servers | Medium - Organization |
| 5 | Stdio transport | Low - Implementation detail |
| 6 | Async/await throughout | Medium - Code style |
| 7 | Model fallback chains | Medium - Reliability |
| 8 | Builder pattern | Low - API design |
