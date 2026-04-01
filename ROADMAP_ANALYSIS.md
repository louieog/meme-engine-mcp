# Meme Engine MCP - Roadmap Analysis
## Original Codebase Review + Migration Plan

---

## 1. ORIGINAL CODEBASE ANALYSIS

### Architecture Overview
The original system was built on the **Factory AI Droid** pattern with 4 shell-script orchestrated agents:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ORIGINAL ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   ┌───────────┐│
│   │  meme-scout  │───▶│workflow-     │───▶│comfy-        │───▶│ assembler ││
│   │  (creative)  │    │  builder     │    │  dispatcher  │   │(ffmpeg)   ││
│   └──────────────┘    └──────────────┘    └──────────────┘   └───────────┘│
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│   • Trend research      • Node discovery    • Execute on      • Multi-     │
│   • Brief creation      • JSON workflows      ComfyUI Cloud     format     │
│   • Scene planning      • Template mgmt     • Polling          export      │
│   • Model selection                           • Download                    │
│                                                                             │
│   Droid = Markdown + Shell scripts + Python dispatchers                     │
│   Communication = File-based JSON in ./output/, ./requests/                 │
│   Web UI = Next.js with hardcoded model lists                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Original Features

#### A. Model Selection in Original UI (`web/src/app/create/page.tsx`)

```typescript
// Image Models - 17 options
const IMAGE_MODELS = [
  { value: "FluxKontextProImageNode", label: "Flux Kontext Pro" },
  { value: "GeminiImage2Node:gemini-3-pro-image-preview", label: "Gemini 3 Pro" },
  { value: "GeminiNanoBanana2:Nano Banana 2", label: "Nano Banana 2" },
  { value: "OpenAIGPTImage1", label: "GPT Image 1" },
  ...
];

// Video Models - 18 options with audio capability flags
const VIDEO_MODELS = [
  { value: "kling-v2-master", label: "Kling v2 Master", hasAudio: false },
  { value: "KlingOmniProImageToVideoNode:kling-v3-omni", label: "Kling 3 OmniPro", hasAudio: true },
  { value: "Veo3VideoGenerationNode:veo-3.1-generate", label: "Veo 3.1", hasAudio: true },
  ...
];

// Voices - 22 ElevenLabs options
const VOICE_OPTIONS = [
  { value: "none", label: "None (video model handles audio)" },
  { value: "George (male, british)", label: "George (male, british)" },
  ...
];

// UI Pattern: Collapsible "Advanced" section
<button onClick={() => setShowAdvanced(!showAdvanced)}>
  Advanced: Model Selection
</button>
```

#### B. Brief Generation (meme-scout droid)

The original `meme-scout` was **an LLM-powered creative agent** that:
- Researched trending meme formats via WebSearch
- Scored 10 concepts on virality potential
- Generated **production briefs** with detailed schema
- **Selected models** based on content requirements:

```json
{
  "generation_requirements": {
    "character_consistency": true,
    "lip_sync_needed": false,
    "models_preferred": {
      "image": "model name and reason",
      "video": "model name and reason",
      "tts": "model name and reason",
      "lip_sync": "model name and reason"
    }
  }
}
```

#### C. Fallback Chain in Dispatchers (`scripts/dispatch-bodega-cat.py`)

```python
# Image generation with 3-tier fallback
attempts = [
    ("GeminiImage2Node", build_gemini2_workflow(...)),      # Primary
    ("GeminiNanoBanana2", build_gemini_nano_workflow(...)),  # Fallback 1
    ("FluxKontextProImageNode", build_flux_kontext_workflow(...)),  # Fallback 2
]

# Video generation with fallback
attempts = [
    ("KlingOmniPro-v3", v3_workflow, True),    # Native audio
    ("KlingOmniPro-v3-short", short_workflow, True),
    ("KlingV2-1-master", v2_workflow, False),  # Silent fallback
]
```

#### D. Format-Based Generation Rules (`.factory/skills/`)

Different formats had specific requirements:
- **mini-drama**: 3-8 scenes, character consistency, lip sync
- **text-meme**: Single scene, text overlay, no dialogue
- **reaction**: Split-screen, escalating reactions

---

## 2. WHAT WORKED WELL IN ORIGINAL

| Feature | Why It Worked |
|---------|---------------|
| **LLM meme-scout** | Actually creative - researched trends, made surprising connections |
| **Model override UI** | Power users could choose specific models |
| **Smart defaults** | "Auto" format selected best format based on concept |
| **Audio-aware UI** | Disabling TTS/lip-sync when video model has native audio |
| **Fallback chains** | Graceful degradation when primary models failed |
| **Format skills** | Structured creative guidance per format type |
| **Seed list** | Curated topics for daily auto-generation |

---

## 3. WHAT NEEDS IMPROVEMENT

| Issue | Current State | Target |
|-------|---------------|--------|
| **Droid orchestration** | Shell scripts + file watching | MCP tools + Claude Agent |
| **Model selection logic** | Hardcoded in Python dispatchers | Dynamic via LLM + user override |
| **Brief generation** | Markdown prompt | Proper agent with tool use |
| **State management** | JSON files on disk | Database + real-time status |
| **Web UI model lists** | Hardcoded arrays | Dynamic from MCP server |
| **Error handling** | Shell script retries | Structured fallback chains |
| **Progress visibility** | Log files | Real-time WebSocket updates |

---

## 4. PROPOSED ARCHITECTURE (MCP + Claude Agent)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     NEW MCP + CLAUDE AGENT ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         WEB UI (Next.js)                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │   │
│  │  │    Home      │  │    Create    │  │   Status     │  │   Gallery   │ │   │
│  │  │   (gallery)  │  │  (chat +     │  │  (progress)  │  │  (history)  │ │   │
│  │  │              │  │   models)    │  │              │  │             │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │   │
│  │                              │                                          │   │
│  │                         ┌────┴────┐                                     │   │
│  │                         │   API   │  Next.js App Router                 │   │
│  │                         │ Routes  │                                     │   │
│  │                         └────┬────┘                                     │   │
│  └──────────────────────────────┼──────────────────────────────────────────┘   │
│                                 │                                               │
│                                 ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    MCP CLIENT (stdio transport)                         │   │
│  │              ┌─────────────────────────────────────┐                    │   │
│  │              │     meme-engine-server (TS)         │                    │   │
│  │              │  • Claude Agent orchestration       │                    │   │
│  │              │  • Brief generation                 │                    │   │
│  │              │  • Pipeline state management        │                    │   │
│  │              └───────────────┬─────────────────────┘                    │   │
│  │                              │ calls via MCP                             │   │
│  │          ┌───────────────────┼───────────────────┐                      │   │
│  │          ▼                   ▼                   ▼                      │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │   │
│  │  │comfyui-server│   │assembly-     │   │   future...  │                 │   │
│  │  │  (Python)    │   │  server (TS) │   │  trend-research│               │   │
│  │  │• Workflows   │   │• ffmpeg      │   │  server      │                 │   │
│  │  │• Fallbacks   │   │• Export      │   │              │                 │   │
│  │  │• ComfyUI API │   │              │   │              │                 │   │
│  │  └──────────────┘   └──────────────┘   └──────────────┘                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    MEME-SCOUT AGENT (Claude with MCP)                   │   │
│  │                                                                         │   │
│  │  TOOLS AVAILABLE:                                                       │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐           │   │
│  │  │ research_trends │ │ get_available_  │ │ generate_brief  │           │   │
│  │  │                 │ │    models       │ │                 │           │   │
│  │  │ • Web search    │ │ • Image models  │ │ • Full brief    │           │   │
│  │  │ • Trend APIs    │ │ • Video models  │ │   with scenes   │           │   │
│  │  │ • Reddit/TikTok │ │ • TTS voices    │ │ • Model picks   │           │   │
│  │  │                 │ │ • Lip sync      │ │ • Creative dir  │           │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘           │   │
│  │                                                                         │   │
│  │  CREATIVE CAPABILITIES:                                                 │   │
│  │  • Interprets user concept → expands into full narrative                │   │
│  │  • Selects optimal format (mini-drama, text-meme, reaction)             │   │
│  │  • Picks camera angles for each scene                                   │   │
│  │  • Writes dialogue (max 8 words/line)                                   │   │
│  │  • Chooses models with reasoning                                        │   │
│  │  • References current trends for virality                               │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1)

#### 1.1 MCP Server Enhancements
```typescript
// meme-engine-server/src/tools/modelRegistry.ts

export const AVAILABLE_MODELS = {
  image: [
    {
      id: "gemini-3-pro",
      name: "Gemini 3 Pro",
      provider: "Google",
      class_type: "GeminiImage2Node",
      model_param: "gemini-3-pro-image-preview",
      supports_character_consistency: true,
      speed: "fast",
      quality: "excellent",
      best_for: ["character portraits", "detailed scenes", "text rendering"],
    },
    {
      id: "flux-kontext",
      name: "Flux Kontext Pro",
      provider: "Black Forest Labs",
      class_type: "FluxKontextProImageNode",
      supports_character_consistency: true,
      speed: "medium",
      quality: "excellent",
      best_for: ["character references", "style consistency", "professional"],
    },
    // ... more models
  ],
  
  video: [
    {
      id: "kling-v3-omni",
      name: "Kling 3 OmniPro",
      provider: "Kling AI",
      class_type: "KlingOmniProImageToVideoNode",
      model_param: "kling-v3-omni",
      has_native_audio: true,
      duration_range: [3, 15],
      speed: "medium",
      quality: "excellent",
      best_for: ["character motion", "native audio", "cinematic"],
    },
    // ... more models
  ],
  
  tts: [
    {
      id: "elevenlabs-v3",
      name: "ElevenLabs v3",
      class_type: "ElevenLabsTextToSpeech",
      voices: [
        { id: "George", name: "George", style: "male, british" },
        { id: "Sarah", name: "Sarah", style: "female, american" },
        // ...
      ],
    },
  ],
  
  lip_sync: [
    {
      id: "kling-lip-sync",
      name: "Kling Lip Sync",
      class_type: "KlingLipSyncAudioToVideoNode",
      quality: "good",
    },
    { id: "none", name: "None (skip)", class_type: null },
  ],
};

// Tools exposed via MCP
export const tools = [
  {
    name: "get_available_models",
    description: "Get list of available models with capabilities",
    inputSchema: {
      type: "object",
      properties: {
        category: { enum: ["image", "video", "tts", "lip_sync", "all"] },
      },
    },
  },
  {
    name: "recommend_models",
    description: "Get AI-recommended models for a specific concept",
    inputSchema: {
      type: "object",
      properties: {
        concept: { type: "string" },
        format: { enum: ["mini-drama", "text-meme", "reaction", "skit"] },
        requires_character_consistency: { type: "boolean" },
        has_dialogue: { type: "boolean" },
      },
    },
  },
];
```

#### 1.2 Enhanced Python Workflow Builders
```python
# src/python/workflow_builders.py

@dataclass
class ModelCapability:
    """Model metadata for selection logic"""
    model_id: str
    name: str
    provider: str
    speed: str  # "fast" | "medium" | "slow"
    quality: str  # "good" | "excellent" | "best"
    supports_character_consistency: bool
    best_for: list[str]
    fallback_chain: list[str]  # Ordered list of fallback model IDs

class SmartModelSelector:
    """LLM-assisted model selection with user override"""
    
    MODEL_REGISTRY = {
        "image": {
            "gemini-3-pro": ModelCapability(
                model_id="gemini-3-pro",
                name="Gemini 3 Pro",
                speed="fast",
                quality="excellent",
                supports_character_consistency=True,
                best_for=["character portraits", "detailed scenes", "text rendering"],
                fallback_chain=["nano-banana-2", "flux-kontext"]
            ),
            # ... more models
        },
        "video": {
            "kling-v3-omni": ModelCapability(
                model_id="kling-v3-omni",
                name="Kling 3 OmniPro",
                speed="medium",
                quality="excellent",
                supports_character_consistency=True,
                has_native_audio=True,
                best_for=["character motion", "native audio"],
                fallback_chain=["kling-v2-master"]
            ),
        }
    }
    
    @classmethod
    def recommend_for_brief(cls, brief: dict) -> dict:
        """
        Analyze brief and recommend optimal models.
        Called by meme-scout agent via MCP tool.
        """
        format_type = brief.get("format", "mini-drama")
        has_dialogue = any(
            scene.get("dialogue") for scene in brief.get("scenes", [])
        )
        needs_consistency = brief.get("generation_requirements", {}).get(
            "character_consistency", False
        )
        
        recommendations = {
            "image": cls._select_image_model(format_type, needs_consistency),
            "video": cls._select_video_model(format_type, has_dialogue),
            "tts": cls._select_tts_model(has_dialogue),
            "lip_sync": cls._select_lip_sync(has_dialogue),
            "reasoning": []
        }
        
        # Add reasoning for each choice
        recommendations["reasoning"].append(
            f"Selected {recommendations['image']['name']} for images "
            f"because {'character consistency is required' if needs_consistency else 'fast generation preferred'}"
        )
        
        return recommendations
    
    @classmethod
    def get_fallback_chain(cls, model_id: str, category: str) -> list[str]:
        """Get ordered fallback chain for a model"""
        model = cls.MODEL_REGISTRY[category].get(model_id)
        if not model:
            return []
        return model.fallback_chain
```

### Phase 2: Claude Meme-Scout Agent (Week 2)

#### 2.1 Agent Definition
```typescript
// meme-engine-server/src/agents/memeScout.ts

import { Anthropic } from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

interface MemeScoutConfig {
  apiKey: string;
  mcpClient: Client;  // Connected to comfyui-server, etc.
}

export class MemeScoutAgent {
  private anthropic: Anthropic;
  private mcpClient: Client;
  
  async generateBrief(params: {
    userConcept: string;
    format?: "auto" | "mini-drama" | "text-meme" | "reaction";
    style?: string;
    duration?: number;
    userModelOverrides?: Partial<ModelSelection>;
  }): Promise<ProductionBrief> {
    
    // Step 1: Research trends (if daily auto mode)
    const trends = await this.researchTrends(params.userConcept);
    
    // Step 2: Get available models from MCP
    const availableModels = await this.mcpClient.callTool("get_available_models", {
      category: "all"
    });
    
    // Step 3: Call Claude to generate the brief
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      tools: [
        // Tools available to Claude during brief generation
        {
          name: "get_format_guidelines",
          description: "Get creative guidelines for a specific format",
          input_schema: { type: "object", properties: { format: { type: "string" } } }
        },
        {
          name: "recommend_models",
          description: "Get model recommendations for this concept",
          input_schema: { type: "object", properties: { 
            concept: { type: "string" },
            format: { type: "string" }
          }}
        }
      ],
      messages: [{
        role: "user",
        content: this.buildPrompt(params, trends, availableModels)
      }]
    });
    
    // Step 4: Parse and enhance brief
    const brief = this.parseBrief(response.content[0].text);
    
    // Step 5: Apply user model overrides if provided
    if (params.userModelOverrides) {
      brief.generation_requirements.models_preferred = {
        ...brief.generation_requirements.models_preferred,
        ...params.userModelOverrides
      };
    }
    
    // Step 6: Validate and store brief
    await this.storeBrief(brief);
    
    return brief;
  }
  
  private buildPrompt(params, trends, models): string {
    return `
You are the Meme-Scout creative director for a viral video meme engine.

USER CONCEPT: "${params.userConcept}"
FORMAT: ${params.format}
STYLE: ${params.style}
TARGET DURATION: ${params.duration}s

CURRENT TRENDS:
${trends.map(t => `- ${t.name}: ${t.description}`).join('\n')}

AVAILABLE MODELS:
${JSON.stringify(models, null, 2)}

Your task:
1. Expand the user concept into a complete narrative with HOOK → SETUP → ESCALATION → PUNCHLINE structure
2. Create 3-8 scenes with detailed visual descriptions
3. Write dialogue (max 8 words per line) for each speaking character
4. Pick camera angles for each scene that maximize visual impact
5. Select the optimal models with reasoning for each choice
6. Ensure the concept incorporates current trend patterns for virality

Use the get_format_guidelines tool if you need format-specific guidance.
Use the recommend_models tool to get AI-suggested models.

Output a complete production brief as JSON.
`;
  }
}
```

#### 2.2 System Prompt for Creative Direction
```typescript
const MEME_SCOUT_SYSTEM_PROMPT = `
You are Meme-Scout, the creative brain of a viral meme video engine.

## Your Role
Transform user concepts into production-ready viral video briefs that maximize shareability.

## Creative Principles
1. HOOK FIRST: The first 3 seconds must stop the scroll - visual-first for autoplay feeds
2. FAST CUTS: Hard cuts between scenes, no transitions (retention hack)
3. SHORT LINES: Max 8 words per dialogue line (quotable = shareable)
4. SCREENSHOT MOMENT: The punchline must be screenshot-worthy
5. RELATABLE: Universal humor over niche references
6. TREND-SAVVY: Weave in current meme formats and viral patterns

## Scene Structure Guidelines
- HOOK (0-3s): Jarring visual or line
- SETUP (3-15s): Establish situation
- ESCALATION (15-45s): Build conflict with 2-3 beats
- PUNCHLINE (45-70s): Subverted expectation
- TAG (70-90s): Final reaction or callback

## Camera Angle Vocabulary
Use these terms for camera direction:
- "close-up": Emotional intensity, reactions
- "medium shot": Dialogue scenes
- "wide": Establishing context
- "tracking": Following movement
- "static": Dialogue-heavy moments
- "slow-motion": Emphasis beats
- "overhead": Dramatic reveals
- "POV": Immersion moments

## Model Selection Strategy
Consider these factors when picking models:
- Character consistency needed? → Flux Kontext or Gemini 3 Pro
- Fast iteration? → Nano Banana 2
- Native audio (no lip sync needed)? → Kling 3 Omni or Veo 3
- Professional quality? → Kling 3 Omni or Flux
- Budget conscious? → Gemini Nano, Kling v2

## Output Format
Return a valid JSON object matching the ProductionBrief schema with:
- concept: one-line summary
- format: mini-drama | text-meme | reaction | skit
- scenes[]: array with beat, duration, visual, camera, dialogue, sfx, music
- characters[]: detailed descriptions for consistency
- generation_requirements.models_preferred: with reasoning for each choice
`;
```

### Phase 3: Web UI Integration (Week 3)

#### 3.1 Create Page - Chat-First Interface
```tsx
// web/src/app/create/page.tsx

"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ModelSelector } from "@/components/ModelSelector";
import { BriefPreview } from "@/components/BriefPreview";

type CreationPhase = "chat" | "models" | "review" | "generating";

export default function CreatePage() {
  const [phase, setPhase] = useState<CreationPhase>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingBrief, setPendingBrief] = useState<ProductionBrief | null>(null);
  const [modelOverrides, setModelOverrides] = useState<ModelSelection>({});
  
  async function handleSendMessage(content: string) {
    // Add user message
    setMessages(prev => [...prev, { role: "user", content }]);
    
    // Call meme-scout agent via API
    const response = await fetch("/api/generate-brief", {
      method: "POST",
      body: JSON.stringify({
        concept: content,
        conversationHistory: messages,
      }),
    });
    
    const { brief, agentMessage } = await response.json();
    
    // Add agent response
    setMessages(prev => [...prev, { role: "assistant", content: agentMessage }]);
    
    // If we got a complete brief, move to review
    if (brief) {
      setPendingBrief(brief);
      setPhase("review");
    }
  }
  
  async function handleAdjustBrief(feedback: string) {
    // Send feedback to agent to revise the brief
    const response = await fetch("/api/adjust-brief", {
      method: "POST",
      body: JSON.stringify({
        currentBrief: pendingBrief,
        feedback,
      }),
    });
    
    const { updatedBrief } = await response.json();
    setPendingBrief(updatedBrief);
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      {phase === "chat" && (
        <ChatInterface
          messages={messages}
          onSend={handleSendMessage}
          placeholder="Describe your meme video idea..."
        />
      )}
      
      {phase === "review" && pendingBrief && (
        <div className="space-y-6">
          <BriefPreview brief={pendingBrief} />
          
          <ModelSelector
            recommended={pendingBrief.generation_requirements.models_preferred}
            overrides={modelOverrides}
            onChange={setModelOverrides}
          />
          
          <div className="flex gap-4">
            <Button onClick={() => setPhase("chat")}>
              Revise Brief
            </Button>
            <Button onClick={() => setPhase("generating")} variant="primary">
              Generate Video
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### 3.2 Dynamic Model Selector
```tsx
// web/src/components/ModelSelector.tsx

interface ModelSelectorProps {
  recommended: ModelSelection;
  overrides: ModelSelection;
  onChange: (overrides: ModelSelection) => void;
}

export function ModelSelector({ recommended, overrides, onChange }: ModelSelectorProps) {
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null);
  
  useEffect(() => {
    // Fetch from MCP via API
    fetch("/api/models")
      .then(r => r.json())
      .then(setAvailableModels);
  }, []);
  
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Model Selection</h3>
      <p className="text-sm text-muted-foreground mb-4">
        AI recommended these models. Override if you have specific preferences.
      </p>
      
      <div className="space-y-4">
        {/* Image Model */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            Image Generation
            {recommended.image && (
              <Badge variant="secondary">AI Pick: {recommended.image.name}</Badge>
            )}
          </label>
          <Select
            value={overrides.image || recommended.image?.id}
            onChange={(val) => onChange({ ...overrides, image: val })}
          >
            {availableModels?.image.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.best_for.join(", ")}
              </option>
            ))}
          </Select>
          {recommended.image_reasoning && (
            <p className="text-xs text-muted-foreground mt-1">
              {recommended.image_reasoning}
            </p>
          )}
        </div>
        
        {/* Video Model */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            Video Generation
            {recommended.video && (
              <Badge variant="secondary">AI Pick: {recommended.video.name}</Badge>
            )}
          </label>
          <Select
            value={overrides.video || recommended.video?.id}
            onChange={(val) => onChange({ ...overrides, video: val })}
          >
            {availableModels?.video.map(model => (
              <option key={model.id} value={model.id}>
                {model.name} {model.has_native_audio ? "(with audio)" : ""}
              </option>
            ))}
          </Select>
          {recommended.video?.has_native_audio && (
            <p className="text-xs text-primary mt-1">
              This model generates audio natively - TTS and lip sync will be skipped
            </p>
          )}
        </div>
        
        {/* TTS - only show if video model doesn't have native audio */}
        {!recommended.video?.has_native_audio && (
          <div>
            <label className="text-sm font-medium">Voice (TTS)</label>
            <Select
              value={overrides.tts || recommended.tts?.id}
              onChange={(val) => onChange({ ...overrides, tts: val })}
            >
              {availableModels?.tts[0]?.voices.map(voice => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} ({voice.style})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </Card>
  );
}
```

### Phase 4: Orchestration & Pipeline (Week 4)

#### 4.1 Enhanced Orchestrator with Agent Loop
```typescript
// meme-engine-server/src/orchestrator.ts

export class MemeEngineOrchestrator {
  private memeScout: MemeScoutAgent;
  private mcpClients: Map<string, Client>;
  
  async createVideoRequest(params: CreateVideoRequest): Promise<Pipeline> {
    // Step 1: Generate brief with Claude agent
    const brief = await this.memeScout.generateBrief({
      userConcept: params.concept,
      format: params.format,
      style: params.style,
      userModelOverrides: params.modelOverrides,
    });
    
    // Step 2: Create pipeline state
    const pipeline = await this.createPipeline(brief);
    
    // Step 3: Start generation asynchronously
    this.runPipeline(pipeline.id).catch(console.error);
    
    return pipeline;
  }
  
  private async runPipeline(pipelineId: string): Promise<void> {
    const pipeline = await this.getPipeline(pipelineId);
    const { brief } = pipeline;
    
    // Get model selections (user overrides take precedence)
    const models = {
      image: brief.generation_requirements.models_preferred.image,
      video: brief.generation_requirements.models_preferred.video,
      tts: brief.generation_requirements.models_preferred.tts,
      lip_sync: brief.generation_requirements.models_preferred.lip_sync,
    };
    
    // Stage 1: Generate images for each scene
    await this.updatePipelineStatus(pipelineId, "images");
    for (const scene of brief.scenes) {
      const result = await this.generateSceneImage(scene, models.image);
      await this.storeSceneAsset(pipelineId, scene.scene_id, "image", result);
    }
    
    // Stage 2: Generate videos
    await this.updatePipelineStatus(pipelineId, "videos");
    for (const scene of brief.scenes) {
      const imageAsset = await this.getSceneAsset(pipelineId, scene.scene_id, "image");
      const result = await this.generateSceneVideo(scene, imageAsset, models.video);
      await this.storeSceneAsset(pipelineId, scene.scene_id, "video", result);
    }
    
    // Stage 3: Generate audio (if needed)
    if (!models.video.has_native_audio && brief.has_dialogue) {
      await this.updatePipelineStatus(pipelineId, "audio");
      for (const scene of brief.scenes) {
        if (scene.dialogue) {
          const result = await this.generateSceneAudio(scene, models.tts);
          await this.storeSceneAsset(pipelineId, scene.scene_id, "audio", result);
        }
      }
      
      // Stage 4: Lip sync
      await this.updatePipelineStatus(pipelineId, "lipsync");
      for (const scene of brief.scenes) {
        if (scene.dialogue) {
          const videoAsset = await this.getSceneAsset(pipelineId, scene.scene_id, "video");
          const audioAsset = await this.getSceneAsset(pipelineId, scene.scene_id, "audio");
          const result = await this.generateLipSync(scene, videoAsset, audioAsset, models.lip_sync);
          await this.storeSceneAsset(pipelineId, scene.scene_id, "video", result);
        }
      }
    }
    
    // Stage 5: Assembly
    await this.updatePipelineStatus(pipelineId, "assembly");
    const finalVideo = await this.assembleVideo(pipelineId, brief);
    
    // Stage 6: Export
    await this.updatePipelineStatus(pipelineId, "export");
    await this.exportFormats(pipelineId, finalVideo, brief.aspect_ratios);
    
    await this.updatePipelineStatus(pipelineId, "completed");
  }
  
  private async generateSceneImage(scene: Scene, model: ImageModel): Promise<Asset> {
    // Use fallback chain from model registry
    const fallbackChain = SmartModelSelector.getFallbackChain(model.id, "image");
    
    const result = await this.mcpClients.get("comfyui").callTool("generate_image_with_fallback", {
      prompt: scene.visual,
      aspect_ratio: scene.aspect_ratio,
      primary_model: model.id,
      fallback_chain: fallbackChain,
    });
    
    return result;
  }
}
```

---

## 6. API ENDPOINTS

```typescript
// web/src/app/api/generate-brief/route.ts

export async function POST(req: Request) {
  const { concept, format, style, modelOverrides, conversationHistory } = await req.json();
  
  // Connect to meme-engine-server via MCP
  const client = await getMcpClient();
  
  // Call the meme-scout agent
  const result = await client.callTool("generate_brief", {
    concept,
    format,
    style,
    model_overrides: modelOverrides,
    conversation_history: conversationHistory,
  });
  
  return Response.json(result);
}

// web/src/app/api/pipelines/route.ts

export async function POST(req: Request) {
  const { briefId, modelOverrides } = await req.json();
  
  const client = await getMcpClient();
  
  // Start pipeline
  const pipeline = await client.callTool("start_pipeline", {
    brief_id: briefId,
    model_overrides: modelOverrides,
  });
  
  return Response.json(pipeline);
}

// Real-time status via WebSocket or Server-Sent Events
// web/src/app/api/pipelines/[id]/status/route.ts

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const client = await getMcpClient();
  
  const status = await client.callTool("get_pipeline_status", {
    pipeline_id: params.id,
  });
  
  return Response.json(status);
}
```

---

## 7. DATABASE SCHEMA (Prisma)

```prisma
// prisma/schema.prisma

model Pipeline {
  id            String   @id @default(uuid())
  status        String   // pending | briefing | images | videos | audio | assembly | export | completed | failed
  progress      Int      // 0-100
  currentStep   String?
  error         String?
  
  // Brief
  brief         Json     // ProductionBrief JSON
  
  // Model selections
  selectedModels Json   // { image, video, tts, lip_sync }
  
  // Assets per scene
  scenes        SceneAsset[]
  
  // Final outputs
  outputs       OutputAsset[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model SceneAsset {
  id          String   @id @default(uuid())
  pipelineId  String
  pipeline    Pipeline @relation(fields: [pipelineId], references: [id])
  
  sceneId     Int      // Scene number (1, 2, 3...)
  assetType   String   // image | video | audio | lipsync
  
  // Generation metadata
  modelUsed   String
  promptId    String?  // ComfyUI prompt ID
  status      String   // pending | generating | completed | failed
  error       String?
  
  // File paths
  filePath    String?
  cloudUrl    String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model OutputAsset {
  id          String   @id @default(uuid())
  pipelineId  String
  pipeline    Pipeline @relation(fields: [pipelineId], references: [id])
  
  format      String   // 9:16 | 16:9
  filePath    String
  duration    Int      // seconds
  fileSize    Int      // bytes
  
  createdAt   DateTime @default(now())
}
```

---

## 8. KEY DECISIONS & TRADEOFFS

### Decision 1: Keep Original Model Selection UI Pattern?
**Options:**
- A) Keep hardcoded model lists (simple, fast)
- B) Dynamic from MCP (flexible, requires caching)
- C) Hybrid: Hardcoded popular + dynamic fetch for advanced

**Recommendation: C (Hybrid)**
- Default view: Curated "Recommended" models
- Advanced toggle: Full dynamic list from MCP

### Decision 2: Meme-Scout Agent Location?
**Options:**
- A) Client-side (direct Anthropic API from browser)
- B) Server-side in meme-engine-server (secure, can use MCP tools)
- C) Separate agent service (scalable, complex)

**Recommendation: B (Server-side in meme-engine-server)**
- Meme-scout needs MCP tools (get_available_models, research_trends)
- Keeps API keys secure
- Easier to add persistent state

### Decision 3: Brief Revision Flow?
**Options:**
- A) One-shot (simpler, faster)
- B) Chat-based iteration (better results, more complex UI)

**Recommendation: B (Chat-based with one-shot shortcut)**
- Default: Quick single-turn if user just wants to generate
- "Refine" button: Opens chat to iterate with agent

### Decision 4: Fallback Chain Implementation?
**Options:**
- A) Python-side only (current)
- B) TypeScript orchestrator manages fallbacks
- C) Both: TS for orchestration, Python for execution

**Recommendation: C (Both)**
- TS orchestrator decides when to fallback
- Python client executes with retry logic

---

## 9. SUCCESS CRITERIA

| Metric | Target |
|--------|--------|
| Brief generation time | < 30 seconds |
| User model override rate | > 20% (people care about models) |
| Fallback success rate | > 95% (fallbacks actually work) |
| Pipeline success rate | > 90% (full video generation) |
| Agent satisfaction | "Feels creative" vs "just procedural" |

---

## 10. NEXT STEPS

1. **Immediate (this session):**
   - [ ] Create meme-scout agent skeleton in TypeScript
   - [ ] Add model registry to comfyui-server
   - [ ] Create database schema

2. **This week:**
   - [ ] Implement brief generation API endpoint
   - [ ] Build chat-based create page
   - [ ] Add dynamic model selector

3. **Next week:**
   - [ ] Integrate agent with pipeline orchestration
   - [ ] Add real-time status updates
   - [ ] Test end-to-end flow

---

## Appendix: Model Registry JSON

```json
{
  "version": "2025.03",
  "categories": {
    "image": {
      "gemini-3-pro": {
        "name": "Gemini 3 Pro",
        "provider": "Google",
        "class_type": "GeminiImage2Node",
        "model_param": "gemini-3-pro-image-preview",
        "capabilities": {
          "character_consistency": true,
          "text_rendering": true,
          "speed": "fast",
          "quality": "excellent"
        },
        "fallback_chain": ["nano-banana-2", "flux-kontext"],
        "cost_estimate": "medium"
      }
    },
    "video": {
      "kling-v3-omni": {
        "name": "Kling 3 OmniPro",
        "provider": "Kling AI",
        "class_type": "KlingOmniProImageToVideoNode",
        "model_param": "kling-v3-omni",
        "capabilities": {
          "native_audio": true,
          "character_motion": true,
          "duration_range": [3, 15],
          "speed": "medium",
          "quality": "excellent"
        },
        "fallback_chain": ["kling-v2-master"],
        "cost_estimate": "high"
      }
    }
  }
}
```
