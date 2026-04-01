/**
 * Model Registry for Meme Engine MCP
 * ================================
 * Comprehensive configuration for all AI generation models used in the meme engine.
 * Includes image generation, video generation, TTS, and lip sync models with
 * fallback chains, provider info, and capability metadata.
 * 
 * @module meme-engine/models
 * @version 2.0.0
 */

// =============================================================================
// Types
// =============================================================================

/** Model configuration interface */
export interface ModelConfig {
  /** ComfyUI node class name */
  nodeClass: string;
  
  /** Model identifier/name (for nodes that support multiple models) */
  modelName?: string;
  
  /** Whether this model generates native audio */
  hasAudio: boolean;
  
  /** Maximum video duration in seconds (if applicable) */
  maxDuration?: number;
  
  /** Whether this model requires an image upload */
  requiresImageUpload: boolean;
  
  /** Parameter name for enabling audio generation (if hasAudio) */
  audioParam?: string;
  
  /** Ordered list of fallback model keys to try on failure */
  fallbackChain: string[];
  
  /** Provider/company name */
  provider?: string;
  
  /** Relative generation speed */
  speed?: 'fast' | 'medium' | 'slow';
  
  /** Output quality level */
  quality?: 'good' | 'excellent' | 'best';
}

// =============================================================================
// Image Generation Models (17 models)
// =============================================================================

export const IMAGE_MODELS: Record<string, ModelConfig> = {
  // Flux Black Forest Labs Models
  "FluxKontextProImageNode": {
    nodeClass: "FluxKontextProImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["Flux2ProImageNode", "GeminiImage2Node:gemini-3-pro-image-preview"],
    provider: "Black Forest Labs",
    speed: "medium",
    quality: "excellent"
  },
  "FluxKontextMaxImageNode": {
    nodeClass: "FluxKontextMaxImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["FluxKontextProImageNode", "Flux2ProImageNode"],
    provider: "Black Forest Labs",
    speed: "slow",
    quality: "best"
  },
  "Flux2ProImageNode": {
    nodeClass: "Flux2ProImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["Flux2MaxImageNode", "FluxProUltraImageNode"],
    provider: "Black Forest Labs",
    speed: "medium",
    quality: "excellent"
  },
  "Flux2MaxImageNode": {
    nodeClass: "Flux2MaxImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["FluxProUltraImageNode", "FluxKontextProImageNode"],
    provider: "Black Forest Labs",
    speed: "slow",
    quality: "best"
  },
  "FluxProUltraImageNode": {
    nodeClass: "FluxProUltraImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["Flux2ProImageNode", "IdeogramV3"],
    provider: "Black Forest Labs",
    speed: "slow",
    quality: "best"
  },

  // Google Gemini Models
  "GeminiImage2Node:gemini-3-pro-image-preview": {
    nodeClass: "GeminiImage2Node",
    modelName: "gemini-3-pro-image-preview",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["GeminiNanoBanana2:Nano Banana 2 (Gemini 3.1 Flash Image)", "FluxKontextProImageNode"],
    provider: "Google",
    speed: "fast",
    quality: "excellent"
  },
  "GeminiNanoBanana2:Nano Banana 2 (Gemini 3.1 Flash Image)": {
    nodeClass: "GeminiNanoBanana2",
    modelName: "Nano Banana 2 (Gemini 3.1 Flash Image)",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["FluxKontextProImageNode", "GeminiImageNode:gemini-2.5-flash-image"],
    provider: "Google",
    speed: "fast",
    quality: "good"
  },
  "GeminiImageNode:gemini-2.5-flash-image": {
    nodeClass: "GeminiImageNode",
    modelName: "gemini-2.5-flash-image",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["GeminiImage2Node:gemini-3-pro-image-preview", "Flux2ProImageNode"],
    provider: "Google",
    speed: "fast",
    quality: "good"
  },

  // Google Imagen Models
  "GoogleImagenNode:imagen-4": {
    nodeClass: "GoogleImagenNode",
    modelName: "imagen-4",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["GoogleImagenNode:imagen-3", "GeminiImage2Node:gemini-3-pro-image-preview"],
    provider: "Google",
    speed: "medium",
    quality: "excellent"
  },
  "GoogleImagenNode:imagen-3": {
    nodeClass: "GoogleImagenNode",
    modelName: "imagen-3",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["GeminiImage2Node:gemini-3-pro-image-preview", "Flux2ProImageNode"],
    provider: "Google",
    speed: "fast",
    quality: "good"
  },

  // OpenAI Models
  "OpenAIDalle3": {
    nodeClass: "OpenAIDalle3",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["OpenAIGPTImage1", "Flux2ProImageNode"],
    provider: "OpenAI",
    speed: "medium",
    quality: "excellent"
  },
  "OpenAIGPTImage1": {
    nodeClass: "OpenAIGPTImage1",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["OpenAIDalle3", "FluxKontextProImageNode"],
    provider: "OpenAI",
    speed: "medium",
    quality: "excellent"
  },

  // Ideogram
  "IdeogramV3": {
    nodeClass: "IdeogramV3",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["RecraftV4TextToImageNode", "Flux2ProImageNode"],
    provider: "Ideogram",
    speed: "medium",
    quality: "excellent"
  },

  // Recraft
  "RecraftV4TextToImageNode": {
    nodeClass: "RecraftV4TextToImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["IdeogramV3", "FluxProUltraImageNode"],
    provider: "Recraft",
    speed: "medium",
    quality: "excellent"
  },

  // Stability AI
  "StabilityStableImageUltraNode": {
    nodeClass: "StabilityStableImageUltraNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["Flux2MaxImageNode", "IdeogramV3"],
    provider: "Stability AI",
    speed: "medium",
    quality: "excellent"
  },

  // Kling AI
  "KlingImageGenerationNode": {
    nodeClass: "KlingImageGenerationNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["FluxKontextProImageNode", "GeminiImage2Node:gemini-3-pro-image-preview"],
    provider: "Kling AI",
    speed: "fast",
    quality: "good"
  },

  // Luma AI
  "LumaImageNode": {
    nodeClass: "LumaImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["Flux2ProImageNode", "IdeogramV3"],
    provider: "Luma AI",
    speed: "medium",
    quality: "excellent"
  },

  // Runway
  "RunwayTextToImageNode": {
    nodeClass: "RunwayTextToImageNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["FluxKontextProImageNode", "OpenAIDalle3"],
    provider: "Runway",
    speed: "medium",
    quality: "excellent"
  }
};

// =============================================================================
// Video Generation Models (20 models)
// =============================================================================

export const VIDEO_MODELS: Record<string, ModelConfig> = {
  // Kling AI Models (with native audio support)
  "KlingOmniProImageToVideoNode:kling-v3-omni": {
    nodeClass: "KlingOmniProImageToVideoNode",
    modelName: "kling-v3-omni",
    hasAudio: true,
    maxDuration: 15,
    requiresImageUpload: true,
    audioParam: "generate_audio",
    fallbackChain: ["KlingImage2VideoNode:kling-v2-1-master", "Veo3VideoGenerationNode:veo-3.1-generate"],
    provider: "Kling AI",
    speed: "medium",
    quality: "excellent"
  },
  "KlingImage2VideoNode:kling-v2-1-master": {
    nodeClass: "KlingImage2VideoNode",
    modelName: "kling-v2-1-master",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: true,
    fallbackChain: ["KlingImage2VideoNode:kling-v2-master", "KlingImage2VideoNode:kling-v2-5-turbo"],
    provider: "Kling AI",
    speed: "medium",
    quality: "excellent"
  },
  "KlingImage2VideoNode:kling-v2-master": {
    nodeClass: "KlingImage2VideoNode",
    modelName: "kling-v2-master",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: true,
    fallbackChain: ["KlingImage2VideoNode:kling-v2-5-turbo", "RunwayGen4ImageToVideoNode"],
    provider: "Kling AI",
    speed: "fast",
    quality: "good"
  },
  "KlingImage2VideoNode:kling-v2-5-turbo": {
    nodeClass: "KlingImage2VideoNode",
    modelName: "kling-v2-5-turbo",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: true,
    fallbackChain: ["KlingImage2VideoNode:kling-v2-master", "LumaRay2ImageToVideoNode"],
    provider: "Kling AI",
    speed: "fast",
    quality: "good"
  },
  "KlingImage2VideoNode:kling-v2-6": {
    nodeClass: "KlingImage2VideoNode",
    modelName: "kling-v2-6",
    hasAudio: true,
    maxDuration: 10,
    requiresImageUpload: true,
    audioParam: "generate_audio",
    fallbackChain: ["KlingOmniProImageToVideoNode:kling-v3-omni", "KlingImage2VideoNode:kling-v2-1-master"],
    provider: "Kling AI",
    speed: "medium",
    quality: "best"
  },
  "KlingTextToVideoNode:kling-v2-5-turbo": {
    nodeClass: "KlingTextToVideoNode",
    modelName: "kling-v2-5-turbo",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: false,
    fallbackChain: ["KlingTextToVideoNode:kling-v2-master", "RunwayGen4TextToVideoNode"],
    provider: "Kling AI",
    speed: "fast",
    quality: "good"
  },
  "KlingTextToVideoNode:kling-v2-master": {
    nodeClass: "KlingTextToVideoNode",
    modelName: "kling-v2-master",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: false,
    fallbackChain: ["KlingTextToVideoNode:kling-v2-5-turbo", "LumaRay2TextToVideoNode"],
    provider: "Kling AI",
    speed: "medium",
    quality: "excellent"
  },

  // Google Veo Models (with native audio support)
  "Veo3VideoGenerationNode:veo-3.1-generate": {
    nodeClass: "Veo3VideoGenerationNode",
    modelName: "veo-3.1-generate",
    hasAudio: true,
    maxDuration: 8,
    requiresImageUpload: false,
    audioParam: "generate_audio",
    fallbackChain: ["Veo3VideoGenerationNode:veo-3.1-fast-generate", "Veo3VideoGenerationNode:veo-3.0-generate"],
    provider: "Google",
    speed: "slow",
    quality: "best"
  },
  "Veo3VideoGenerationNode:veo-3.1-fast-generate": {
    nodeClass: "Veo3VideoGenerationNode",
    modelName: "veo-3.1-fast-generate",
    hasAudio: true,
    maxDuration: 8,
    requiresImageUpload: false,
    audioParam: "generate_audio",
    fallbackChain: ["Veo3VideoGenerationNode:veo-3.0-generate", "KlingOmniProImageToVideoNode:kling-v3-omni"],
    provider: "Google",
    speed: "medium",
    quality: "excellent"
  },
  "Veo3VideoGenerationNode:veo-3.0-generate": {
    nodeClass: "Veo3VideoGenerationNode",
    modelName: "veo-3.0-generate",
    hasAudio: false,
    maxDuration: 8,
    requiresImageUpload: false,
    fallbackChain: ["Veo2VideoGenerationNode", "KlingImage2VideoNode:kling-v2-1-master"],
    provider: "Google",
    speed: "medium",
    quality: "excellent"
  },
  "Veo2VideoGenerationNode": {
    nodeClass: "Veo2VideoGenerationNode",
    hasAudio: false,
    maxDuration: 8,
    requiresImageUpload: false,
    fallbackChain: ["KlingImage2VideoNode:kling-v2-1-master", "RunwayGen4ImageToVideoNode"],
    provider: "Google",
    speed: "fast",
    quality: "good"
  },

  // Runway Gen-4
  "RunwayGen4ImageToVideoNode": {
    nodeClass: "RunwayGen4ImageToVideoNode",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: true,
    fallbackChain: ["RunwayGen4TextToVideoNode", "LumaRay2ImageToVideoNode"],
    provider: "Runway",
    speed: "medium",
    quality: "excellent"
  },
  "RunwayGen4TextToVideoNode": {
    nodeClass: "RunwayGen4TextToVideoNode",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: false,
    fallbackChain: ["RunwayGen4ImageToVideoNode", "KlingTextToVideoNode:kling-v2-master"],
    provider: "Runway",
    speed: "medium",
    quality: "excellent"
  },

  // Luma AI
  "LumaRay2ImageToVideoNode": {
    nodeClass: "LumaRay2ImageToVideoNode",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: true,
    fallbackChain: ["LumaRay2TextToVideoNode", "KlingImage2VideoNode:kling-v2-1-master"],
    provider: "Luma AI",
    speed: "medium",
    quality: "excellent"
  },
  "LumaRay2TextToVideoNode": {
    nodeClass: "LumaRay2TextToVideoNode",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: false,
    fallbackChain: ["LumaRay2ImageToVideoNode", "RunwayGen4TextToVideoNode"],
    provider: "Luma AI",
    speed: "medium",
    quality: "excellent"
  },

  // Minimax/Hailuo
  "HailuoImageToVideoNode": {
    nodeClass: "HailuoImageToVideoNode",
    hasAudio: false,
    maxDuration: 6,
    requiresImageUpload: true,
    fallbackChain: ["HailuoTextToVideoNode", "KlingImage2VideoNode:kling-v2-5-turbo"],
    provider: "Hailuo (MiniMax)",
    speed: "fast",
    quality: "good"
  },
  "HailuoTextToVideoNode": {
    nodeClass: "HailuoTextToVideoNode",
    hasAudio: false,
    maxDuration: 6,
    requiresImageUpload: false,
    fallbackChain: ["HailuoImageToVideoNode", "KlingTextToVideoNode:kling-v2-5-turbo"],
    provider: "Hailuo (MiniMax)",
    speed: "fast",
    quality: "good"
  },

  // Vidu
  "Vidu3ImageToVideoNode": {
    nodeClass: "Vidu3ImageToVideoNode",
    hasAudio: false,
    maxDuration: 8,
    requiresImageUpload: true,
    fallbackChain: ["Vidu3TextToVideoNode", "KlingImage2VideoNode:kling-v2-master"],
    provider: "Vidu",
    speed: "medium",
    quality: "excellent"
  },
  "Vidu3TextToVideoNode": {
    nodeClass: "Vidu3TextToVideoNode",
    hasAudio: false,
    maxDuration: 8,
    requiresImageUpload: false,
    fallbackChain: ["Vidu3ImageToVideoNode", "KlingTextToVideoNode:kling-v2-master"],
    provider: "Vidu",
    speed: "medium",
    quality: "excellent"
  },

  // Wan Models
  "WanImageToVideoNode:wan-2.1": {
    nodeClass: "WanImageToVideoNode",
    modelName: "wan-2.1",
    hasAudio: false,
    maxDuration: 8,
    requiresImageUpload: true,
    fallbackChain: ["WanTextToVideoNode:wan-2.1", "KlingImage2VideoNode:kling-v2-master"],
    provider: "Wan",
    speed: "slow",
    quality: "best"
  },
  "WanTextToVideoNode:wan-2.1": {
    nodeClass: "WanTextToVideoNode",
    modelName: "wan-2.1",
    hasAudio: false,
    maxDuration: 8,
    requiresImageUpload: false,
    fallbackChain: ["WanImageToVideoNode:wan-2.1", "KlingTextToVideoNode:kling-v2-master"],
    provider: "Wan",
    speed: "slow",
    quality: "best"
  },

  // Hunyuan
  "HunyuanVideoNode": {
    nodeClass: "HunyuanVideoNode",
    hasAudio: false,
    maxDuration: 8,
    requiresImageUpload: false,
    fallbackChain: ["KlingTextToVideoNode:kling-v2-master", "LumaRay2TextToVideoNode"],
    provider: "Hunyuan",
    speed: "slow",
    quality: "best"
  },

  // OpenAI Sora
  "Sora2VideoNode": {
    nodeClass: "Sora2VideoNode",
    hasAudio: false,
    maxDuration: 10,
    requiresImageUpload: false,
    fallbackChain: ["Veo3VideoGenerationNode:veo-3.1-generate", "RunwayGen4TextToVideoNode"],
    provider: "OpenAI",
    speed: "slow",
    quality: "best"
  }
};

// =============================================================================
// TTS (Text-to-Speech) Models
// =============================================================================

export const TTS_MODELS: Record<string, ModelConfig> = {
  "elevenlabs-multilingual-v2": {
    nodeClass: "ElevenLabsTextToSpeech",
    modelName: "eleven_multilingual_v2",
    hasAudio: true,
    requiresImageUpload: false,
    fallbackChain: ["elevenlabs-turbo-v2-5", "elevenlabs-v3"],
    provider: "ElevenLabs",
    speed: "medium",
    quality: "excellent"
  },
  "elevenlabs-turbo-v2-5": {
    nodeClass: "ElevenLabsTextToSpeech",
    modelName: "eleven_turbo_v2_5",
    hasAudio: true,
    requiresImageUpload: false,
    fallbackChain: ["elevenlabs-v3", "elevenlabs-multilingual-v2"],
    provider: "ElevenLabs",
    speed: "fast",
    quality: "good"
  },
  "elevenlabs-v3": {
    nodeClass: "ElevenLabsTextToSpeech",
    modelName: "eleven_v3",
    hasAudio: true,
    requiresImageUpload: false,
    fallbackChain: ["elevenlabs-multilingual-v2", "elevenlabs-turbo-v2-5"],
    provider: "ElevenLabs",
    speed: "fast",
    quality: "good"
  },
  "elevenlabs-scribe-v1": {
    nodeClass: "ElevenLabsScribe",
    modelName: "scribe_v1",
    hasAudio: true,
    requiresImageUpload: false,
    fallbackChain: [],
    provider: "ElevenLabs",
    speed: "medium",
    quality: "excellent"
  }
};

// =============================================================================
// Lip Sync Models
// =============================================================================

export const LIP_SYNC_MODELS: Record<string, ModelConfig> = {
  "KlingLipSyncAudioToVideoNode": {
    nodeClass: "KlingLipSyncAudioToVideoNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["KlingLipSyncTextToVideoNode", "sync-labs"],
    provider: "Kling AI"
  },
  "KlingLipSyncTextToVideoNode": {
    nodeClass: "KlingLipSyncTextToVideoNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["sync-labs", "wav2lip"],
    provider: "Kling AI"
  },
  "sync-labs": {
    nodeClass: "SyncLabsLipSyncNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: ["wav2lip"],
    provider: "Sync Labs"
  },
  "wav2lip": {
    nodeClass: "Wav2LipNode",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: [],
    provider: "Wav2Lip (Open Source)"
  },
  "none": {
    nodeClass: "",
    hasAudio: false,
    requiresImageUpload: false,
    fallbackChain: [],
    provider: "None"
  }
};

// =============================================================================
// Combined Model Registry
// =============================================================================

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  ...IMAGE_MODELS,
  ...VIDEO_MODELS,
  ...TTS_MODELS,
  ...LIP_SYNC_MODELS
};

// =============================================================================
// Helper Arrays
// =============================================================================

/** List of video models that support native audio generation */
export const NATIVE_AUDIO_MODELS = Object.entries(VIDEO_MODELS)
  .filter(([_, config]) => config.hasAudio)
  .map(([key, _]) => key);

/** List of image model keys for quick access */
export const IMAGE_MODEL_KEYS = Object.keys(IMAGE_MODELS);

/** List of video model keys for quick access */
export const VIDEO_MODEL_KEYS = Object.keys(VIDEO_MODELS);

/** List of TTS model keys for quick access */
export const TTS_MODEL_KEYS = Object.keys(TTS_MODELS);

/** List of lip sync model keys for quick access */
export const LIP_SYNC_MODEL_KEYS = Object.keys(LIP_SYNC_MODELS);

/** ElevenLabs voice options */
export const VOICE_OPTIONS = [
  "George (male, british)",
  "Roger (male, american)",
  "Sarah (female, american)",
  "Laura (female, american)",
  "Charlie (male, australian)",
  "Callum (male, american)",
  "River (neutral, american)",
  "Harry (male, american)",
  "Liam (male, american)",
  "Alice (female, british)",
  "Matilda (female, american)",
  "Will (male, american)",
  "Jessica (female, american)",
  "Eric (male, american)",
  "Bella (female, american)",
  "Chris (male, american)",
  "Brian (male, american)",
  "Daniel (male, british)",
  "Lily (female, british)",
  "Adam (male, american)",
  "Bill (male, american)"
];

/** Providers organized by category */
export const PROVIDERS = {
  image: [
    "Black Forest Labs",
    "Google",
    "OpenAI",
    "Ideogram",
    "Recraft",
    "Stability AI",
    "Kling AI",
    "Luma AI",
    "Runway"
  ],
  video: [
    "Kling AI",
    "Google",
    "Runway",
    "Luma AI",
    "Hailuo (MiniMax)",
    "Vidu",
    "Wan",
    "Hunyuan",
    "OpenAI"
  ],
  tts: ["ElevenLabs"],
  lipSync: ["Kling AI", "Sync Labs", "Wav2Lip (Open Source)"]
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the configuration for a specific model.
 * @param modelKey - The unique key of the model
 * @returns The ModelConfig or undefined if not found
 */
export function getModelConfig(modelKey: string): ModelConfig | undefined {
  return MODEL_REGISTRY[modelKey];
}

/**
 * Check if a video model supports native audio generation.
 * @param modelKey - The video model key to check
 * @returns True if the model generates native audio
 */
export function isNativeAudioModel(modelKey: string): boolean {
  return NATIVE_AUDIO_MODELS.includes(modelKey);
}

/**
 * Get the fallback chain for a model.
 * @param modelKey - The model key to look up
 * @returns Array of fallback model keys (empty if not found)
 */
export function getFallbackChain(modelKey: string): string[] {
  return MODEL_REGISTRY[modelKey]?.fallbackChain || [];
}

/**
 * Get all models by provider.
 * @param provider - The provider name to filter by
 * @returns Record of model keys to configs for that provider
 */
export function getModelsByProvider(provider: string): Record<string, ModelConfig> {
  return Object.fromEntries(
    Object.entries(MODEL_REGISTRY).filter(([_, config]) => config.provider === provider)
  );
}

/**
 * Get all models with a specific quality level.
 * @param quality - The quality level to filter by
 * @returns Record of model keys to configs with that quality
 */
export function getModelsByQuality(quality: 'good' | 'excellent' | 'best'): Record<string, ModelConfig> {
  return Object.fromEntries(
    Object.entries(MODEL_REGISTRY).filter(([_, config]) => config.quality === quality)
  );
}

/**
 * Get all models with a specific speed level.
 * @param speed - The speed level to filter by
 * @returns Record of model keys to configs with that speed
 */
export function getModelsBySpeed(speed: 'fast' | 'medium' | 'slow'): Record<string, ModelConfig> {
  return Object.fromEntries(
    Object.entries(MODEL_REGISTRY).filter(([_, config]) => config.speed === speed)
  );
}

/**
 * Get the primary/default image model.
 * @returns The recommended primary image model key
 */
export function getPrimaryImageModel(): string {
  return "FluxKontextProImageNode";
}

/**
 * Get the primary/default video model.
 * @returns The recommended primary video model key
 */
export function getPrimaryVideoModel(): string {
  return "KlingOmniProImageToVideoNode:kling-v3-omni";
}

/**
 * Get the primary/default TTS model.
 * @returns The recommended primary TTS model key
 */
export function getPrimaryTTSModel(): string {
  return "elevenlabs-multilingual-v2";
}

/**
 * Get the primary/default lip sync model.
 * @returns The recommended primary lip sync model key
 */
export function getPrimaryLipSyncModel(): string {
  return "KlingLipSyncAudioToVideoNode";
}

/**
 * Validate that a model key exists in the registry.
 * @param modelKey - The model key to validate
 * @returns True if the model exists
 */
export function isValidModel(modelKey: string): boolean {
  return modelKey in MODEL_REGISTRY;
}

/**
 * Get recommended model chain for a generation type with fallback options.
 * @param type - The generation type
 * @param preferAudio - For video, prefer models with native audio
 * @returns Ordered array of model keys to try
 */
export function getRecommendedModelChain(
  type: 'image' | 'video' | 'tts' | 'lipSync',
  preferAudio: boolean = false
): string[] {
  switch (type) {
    case 'image':
      return [
        "FluxKontextProImageNode",
        "Flux2ProImageNode",
        "GeminiImage2Node:gemini-3-pro-image-preview",
        "FluxKontextMaxImageNode",
        "IdeogramV3"
      ];
    case 'video':
      if (preferAudio) {
        return [
          "KlingOmniProImageToVideoNode:kling-v3-omni",
          "KlingImage2VideoNode:kling-v2-6",
          "Veo3VideoGenerationNode:veo-3.1-generate",
          "Veo3VideoGenerationNode:veo-3.1-fast-generate"
        ];
      }
      return [
        "KlingImage2VideoNode:kling-v2-1-master",
        "KlingOmniProImageToVideoNode:kling-v3-omni",
        "RunwayGen4ImageToVideoNode",
        "LumaRay2ImageToVideoNode",
        "Veo3VideoGenerationNode:veo-3.1-generate"
      ];
    case 'tts':
      return [
        "elevenlabs-multilingual-v2",
        "elevenlabs-v3",
        "elevenlabs-turbo-v2-5"
      ];
    case 'lipSync':
      return [
        "KlingLipSyncAudioToVideoNode",
        "KlingLipSyncTextToVideoNode",
        "sync-labs"
      ];
    default:
      return [];
  }
}

// =============================================================================
// Statistics
// =============================================================================

/** Model registry statistics */
export const MODEL_STATS = {
  image: Object.keys(IMAGE_MODELS).length,
  video: Object.keys(VIDEO_MODELS).length,
  tts: Object.keys(TTS_MODELS).length,
  lipSync: Object.keys(LIP_SYNC_MODELS).length,
  total: Object.keys(MODEL_REGISTRY).length,
  nativeAudioModels: NATIVE_AUDIO_MODELS.length,
  voices: VOICE_OPTIONS.length
};

// Default export for convenience
export default MODEL_REGISTRY;
