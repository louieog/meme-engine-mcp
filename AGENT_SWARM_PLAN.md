# Meme Engine MCP Refactor — Agent Swarm Execution Plan

## Overview

**Total Tasks:** 14 across 4 phases  
**Estimated Time:** 2-3 hours with parallel execution  
**Dependency Graph:** Phase 1 → (Phase 2 ∥ Phase 4) → Phase 3

---

## Agent Swarm Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COORDINATOR (You)                               │
│                    - Monitors progress, resolves conflicts                   │
│                    - Validates cross-agent interfaces                        │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │ spawns
    ┌─────────────────┼─────────────────┬─────────────────┐
    ▼                 ▼                 ▼                 ▼
┌─────────┐    ┌─────────┐      ┌─────────┐      ┌─────────┐
│ Phase 1 │───▶│ Phase 2 │      │ Phase 4 │      │ Phase 3 │
│Foundation│   │Executor │      │ UI Polish│      │Orchestrate│
│  (4 agents)│  │ (4 agents)│     │ (3 agents)│     │ (3 agents)│
└─────────┘    └─────────┘      └─────────┘      └─────────┘
    │               │                 │                │
    ▼               ▼                 ▼                ▼
Must complete    Needs paths        Can run          Needs all
before others   from P1, models     parallel         executors
                from P2            with P2
```

---

## Phase 1: Foundation Fixers (4 Agents)

**Parallel Execution: YES** (they touch different files)

### Agent 1.1: Python CLI Bridge Architect
**Files:** `src/python/comfyui_client.py`, `src/python/video_assembly.py`
**Task:** Add CLI entry points for subprocess bridge

```python
# Add to both files:
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--function", required=True)
    parser.add_argument("--args", required=True)
    args = parser.parse_args()
    
    # Dispatch to method
    client = ComfyUIClient()  # or VideoAssembler()
    result = getattr(client, args.function)(**json.loads(args.args))
    print(json.dumps(result))
```

**Validation:** `python src/python/comfyui_client.py --function test --args '{"x":1}'`

---

### Agent 1.2: Path Reference Fixer
**Files:** 
- `mcp-servers/comfyui-server/src/comfy-client.ts`
- `mcp-servers/assembly-server/src/assembly-client.ts`

**Task:** Fix `../../../../phase1/` → correct relative path

**Analysis needed:**
```
mcp-servers/comfyui-server/src/comfy-client.ts
  → needs to reach: src/python/comfyui_client.py
  → current: ../../../../phase1/src/python/
  → correct: ../../../src/python/ (4 levels up to repo root, then into src/python)

mcp-servers/assembly-server/src/assembly-client.ts
  → needs to reach: src/python/video_assembly.py
  → same fix pattern
```

**Validation:** Check paths resolve correctly

---

### Agent 1.3: MCP Connection Bug Hunter
**Files:** `web/src/lib/mcp-client.ts`

**Task:** Fix `ServerManager.connect()` not saving to `this.connections`

**Bug to fix:**
```typescript
// Current (broken):
async connect(name, serverPath, env = {}) {
  const existing = this.connections.get(name);  // always returns undefined
  if (existing && !existing.process.killed) return existing.client;
  // ... create connection but never saves it!
}

// Fix: Add at end of connect():
this.connections.set(name, { client, transport, process: serverProcess, name });
return client;
```

**Validation:** `getClient()` returns non-null after `connect()`

---

### Agent 1.4: Type System Consolidator
**Files:** 
- `web/src/types/index.ts`
- `src/schemas.ts`

**Task:** 
1. Make `web/src/types/index.ts` re-export from `src/schemas.ts`
2. Fix Gallery page: `data.videos` → `data.outputs`
3. Add `/api/serve-file` endpoint skeleton

**Code:**
```typescript
// web/src/types/index.ts
export * from '../../src/schemas';
```

**Validation:** `npm run build` has no type errors

---

## Phase 2: Deterministic Executor Builders (4 Agents)

**Parallel Execution: YES** (after Phase 1 completes)

### Agent 2.1: Model Registry Curator
**File:** `src/models.ts` (new)
**Task:** Create MODEL_REGISTRY with all 17 image + 20 video models

**Reference data from REFACTOR_PROMPT:**
- 17 image models (Flux, Gemini, DALL-E, etc.)
- 20 video models (Kling variants, Veo, Runway, etc.)
- TTS: ElevenLabs
- Lip sync: Kling variants

**Structure:**
```typescript
export interface ModelConfig {
  nodeClass: string;
  modelName?: string;
  hasAudio: boolean;
  maxDuration?: number;
  requiresImageUpload: boolean;
  audioParam?: string;
  fallbackChain: string[];
}

export const MODEL_REGISTRY: Record<string, ModelConfig> = { ... };
export const NATIVE_AUDIO_MODELS: string[] = [ ... ];
```

**Validation:** Import in orchestrator works, no TypeScript errors

---

### Agent 2.2: Workflow Template Engineer
**File:** `src/python/workflow_builders.py`
**Task:** Connect builders to model registry, handle colon-separated format

**Key changes:**
1. Parse `NodeClass:model_name` format
2. Apply proven schema rules:
   - ElevenLabs voice: `"George (male, british)"`
   - Dot notation: `"model.speed": 0.9`
   - SaveVideo format: `"mp4"`
   - Always include `extra_data.api_key_comfy_org`

**Validation:** Generate sample workflows for each model type

---

### Agent 2.3: ComfyUI Tool Implementer
**Files:** `mcp-servers/comfyui-server/src/index.ts`
**Task:** Wire tools to real execution via Python bridge

**Tools to implement:**
- `generate_image`: registry → build → submit → poll (10min timeout) → download
- `generate_video`: same + native audio handling
- `text_to_speech`: ElevenLabs workflow → submit → download
- `lip_sync`: lip sync workflow → fallback to ffmpeg overlay
- `upload_file`: POST to `/api/upload/image`
- `get_job_status`: GET `/api/job/{id}/status`

**Validation:** Each tool returns real file paths (or errors gracefully)

---

### Agent 2.4: Assembly Pipeline Wirer
**Files:** `mcp-servers/assembly-server/src/index.ts`
**Task:** Wire assembly tools to `video_assembly.py` CLI

**Tools to implement:**
- `assemble_full_video`: full ffmpeg pipeline
- `concatenate_scenes`: join clips
- `add_text_overlays`: burn in text
- `mix_audio`: layer audio tracks
- `export_format`: 16:9 + 9:16
- `generate_thumbnail`: poster frame

**Validation:** Can assemble test video from sample clips

---

## Phase 3: Claude Orchestration Builders (3 Agents)

**Parallel Execution: PARTIAL** (Agent 3.3 needs 3.1 and 3.2)

### Agent 3.1: Orchestrator API Builder
**Files:** `web/src/app/api/requests/route.ts`
**Task:** Create POST endpoint that spawns Claude orchestration

**Flow:**
1. Receive request JSON from UI
2. Validate with Zod (new)
3. Create pipeline record
4. Spawn Claude agent (async, don't block response)
5. Return `{ id, status: "pending" }`

**Validation:** POST returns pipeline ID, status file created

---

### Agent 3.2: Claude Integration Specialist
**Files:** 
- `meme-engine-server/src/claude-orchestrator.ts` (new)
- `meme-engine-server/src/mcp-client-wrapper.ts` (new)

**Task:** 
1. Connect to Anthropic SDK
2. Connect 3 MCP servers as tool providers
3. Handle tool_use/tool_result loop
4. Stream status to `{id}.status.json`
5. Store conversation in `{id}.log.json`

**Pseudocode:**
```typescript
class ClaudeOrchestrator {
  async runPipeline(requestId: string, params: RequestParams) {
    const mcpTools = await this.connectMCPServers();
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      system: ORCHESTRATOR_PROMPT,
      tools: mcpTools,
      messages: [this.buildInitialMessage(params)]
    });
    
    // Handle tool loop
    while (response.stop_reason === "tool_use") {
      const toolResults = await this.executeTools(response.tool_calls);
      response = await anthropic.messages.create({
        ...,
        messages: [...response.messages, ...toolResults]
      });
      this.updateStatus(requestId, response);
    }
  }
}
```

**Validation:** Can complete a full conversation with tool calls

---

### Agent 3.3: Prompt Engineer
**File:** `src/orchestrator-prompt.ts`
**Task:** Create comprehensive system prompt for Claude

**Sections needed:**
1. Available MCP tools (comfyui, assembly, engine)
2. Creative workflow (brief generation rules)
3. Asset generation stages
4. Quality review criteria
5. Audio decision tree
6. Error handling / fallback strategy

**Validation:** Prompt is < 200k tokens, covers all edge cases

---

## Phase 4: UI Polish Team (3 Agents)

**Parallel Execution: YES** (mostly independent, after Phase 1)

### Agent 4.1: UI Feature Porter
**Files:** `web/src/app/create/page.tsx`, `web/src/app/create/[id]/brief/page.tsx`
**Task:** Port missing features from reference repo

**Features to add:**
1. Format description info box (FORMAT_DESCRIPTIONS dict)
2. "Other..." style option with custom input
3. Model selection dropdowns from MODEL_REGISTRY
4. Native audio banner (auto-set voice/lip sync to "none")
5. Brief review page with inline editing
6. Brief revision chat flow

**Validation:** UI matches reference repo functionality

---

### Agent 4.2: File Server Implementer
**Files:** 
- `web/src/app/api/outputs/[date]/[...path]/route.ts` (new)
- `web/src/app/gallery/page.tsx`

**Task:**
1. Create catch-all route for serving output files
2. Handle nested paths (thumbnails/file.jpg)
3. Normalize metadata reading (both patterns)
4. Match video files by metadata filename prefix

**Validation:** Gallery displays videos with thumbnails

---

### Agent 4.3: Real-time Updates Specialist
**Files:** `web/src/app/status/[id]/page.tsx`
**Task:** Add pipeline monitoring with progress updates

**Implementation:**
```typescript
// Option A: Polling (simpler, chosen)
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetch(`/api/requests/${id}`).then(r => r.json());
    setStatus(status);
  }, 3000);
  return () => clearInterval(interval);
}, [id]);

// Show:
// - Current stage (brief/images/videos/audio/assembly/export)
// - Per-scene progress
// - Log viewer (from {id}.log.json)
// - Generated assets preview
```

**Validation:** Status page updates every 3 seconds, shows progress

---

## Execution Order & Dependencies

```
WAVE 1: Phase 1 (Foundation) - 4 agents in parallel
├── Agent 1.1: Python CLI Bridge
├── Agent 1.2: Path Reference Fixer  
├── Agent 1.3: MCP Connection Fix
└── Agent 1.4: Type Consolidation
    ↓
    All must complete before Wave 2

WAVE 2: Phase 2 + Phase 4 in parallel
├── Phase 2 Agents (Executor Layer):
│   ├── Agent 2.1: Model Registry
│   ├── Agent 2.2: Workflow Builder
│   ├── Agent 2.3: ComfyUI Tools
│   └── Agent 2.4: Assembly Tools
│
└── Phase 4 Agents (UI Polish):
    ├── Agent 4.1: UI Features
    ├── Agent 4.2: File Server
    └── Agent 4.3: Real-time Updates
    ↓
    Agents 2.3 and 2.4 must complete before Wave 3

WAVE 3: Phase 3 (Orchestration) - 3 agents
├── Agent 3.1: Orchestrator API
├── Agent 3.2: Claude Integration
└── Agent 3.3: Prompt Engineer (needs 3.1, 3.2)
    ↓
    Final integration testing
```

---

## Cross-Agent Interfaces

### Interface 1: Python Bridge
**Defined by:** Agent 1.1  
**Used by:** Agents 2.3, 2.4

```typescript
// All Python subprocess calls follow this pattern:
const result = spawn("python", [
  "src/python/comfyui_client.py",
  "--function", functionName,
  "--args", JSON.stringify(args)
]);
// Expects: { success: boolean, data?: any, error?: string }
```

### Interface 2: Model Registry
**Defined by:** Agent 2.1  
**Used by:** Agents 2.2, 2.3, 3.2, 4.1

```typescript
// Single source of truth for all model configurations
import { MODEL_REGISTRY, NATIVE_AUDIO_MODELS } from "@/models";

// Key lookups:
// - Agent 2.2: Build workflows based on registry config
// - Agent 2.3: Determine native audio, fallback chain
// - Agent 3.2: Pass available models to Claude
// - Agent 4.1: Populate dropdowns
```

### Interface 3: Status File Format
**Defined by:** Agent 3.2  
**Used by:** Agents 4.3, 3.1

```typescript
// {requestId}.status.json
{
  "id": "uuid",
  "status": "pending|briefing|images|videos|audio|assembly|export|completed|failed",
  "progress": 45, // 0-100
  "currentStage": "Generating scene 2 video...",
  "scenes": [
    { "id": 1, "status": "completed", "assets": { "image": "...", "video": "..." } }
  ],
  "outputs": {
    "16:9": "/output/...",
    "9:16": "/output/..."
  },
  "updatedAt": "ISO timestamp"
}
```

### Interface 4: MCP Tool Schemas
**Defined by:** Agents 2.3, 2.4  
**Used by:** Agent 3.2

```typescript
// Tools exposed to Claude must match these signatures:
interface ComfyUITools {
  generate_image(params: { prompt: string, model: string, aspect_ratio: string }): Promise<string>; // returns file path
  generate_video(params: { image_path: string, prompt: string, model: string }): Promise<string>;
  text_to_speech(params: { text: string, voice: string }): Promise<string>;
  lip_sync(params: { video_path: string, audio_path: string }): Promise<string>;
  upload_file(params: { path: string }): Promise<string>; // returns cloud filename
  get_job_status(params: { prompt_id: string }): Promise<JobStatus>;
}

interface AssemblyTools {
  assemble_full_video(params: { scenes: SceneAsset[], brief: Brief }): Promise<string>;
  export_format(params: { video_path: string, aspect_ratio: string }): Promise<string>;
  generate_thumbnail(params: { video_path: string }): Promise<string>;
}

interface EngineTools {
  save_brief(params: { brief: Brief }): Promise<void>;
  get_pipeline_status(params: { id: string }): Promise<PipelineStatus>;
  update_pipeline_status(params: { id: string, status: Partial<PipelineStatus> }): Promise<void>;
}
```

---

## Validation Checkpoints

### After Wave 1 (Foundation):
```bash
cd /Users/orlando/meme-engine-mcp
npm run build  # Should succeed with no TS errors
python src/python/comfyui_client.py --function test --args '{}'  # Should run
```

### After Wave 2 (Executors):
```bash
# Test each MCP server tool manually:
# 1. Start servers
node mcp-servers/comfyui-server/dist/index.js &
node mcp-servers/assembly-server/dist/index.js &

# 2. Test via MCP client (or direct HTTP if they expose HTTP)
# Each tool should return real file paths or proper errors
```

### After Wave 3 (Orchestration):
```bash
# End-to-end test:
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"concept": "A cat news anchor", "format": "mini-drama", "duration": 30}'

# Should:
# 1. Return { id, status: "pending" }
# 2. Spawn Claude agent
# 3. Create {id}.status.json with progress
# 4. Eventually create {id}.log.json with full conversation
```

### Final Validation:
All 10 criteria from REFACTOR_PROMPT must pass.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Python/TS interface mismatch | Agent 1.1 defines JSON schema, all agents validate |
| Model registry incomplete | Reference repo has full lists, agent 2.1 ports them |
| Claude rate limits | Implement request queue, exponential backoff |
| ComfyUI Cloud failures | Fallback chains in registry, agent 2.3 implements |
| File path issues | Agent 4.2 tests all path resolution edge cases |
| Build failures | Run `npm run build` after each wave |

---

## Ready to Execute?

**Estimated Timeline:**
- Wave 1: 30 min (4 agents parallel)
- Wave 2: 45 min (4 agents parallel)
- Wave 3: 45 min (3 agents sequential)
- Wave 4: 30 min (3 agents parallel)
- Integration: 30 min
- **Total: ~3 hours**

**Ready to approve?** I'll spawn the agents in the dependency order above.

Or would you like to:
1. **Modify the plan** (add/remove agents, change scope)
2. **Start with just Wave 1** (safer, validate foundation first)
3. **Adjust priorities** (focus on specific phases)
4. **Add more agents** (parallelize further)

Your call!
