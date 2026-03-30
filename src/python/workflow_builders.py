#!/usr/bin/env python3
"""
ComfyUI Workflow Builders

A reusable Python module for building ComfyUI API-format workflows using
the builder pattern. Supports image generation, video generation, text-to-speech,
and lip-sync workflows with fallback chains.

Example:
    >>> from workflow_builders import ImageWorkflowBuilder, VideoWorkflowBuilder
    >>> 
    >>> # Build an image workflow
    >>> builder = ImageWorkflowBuilder()
    >>> workflow = builder.gemini2(
    ...     scene_id=1,
    ...     prompt="A tabby cat wearing glasses",
    ...     aspect_ratio="9:16"
    ... )
    >>> 
    >>> # Build a video workflow
    >>> video_builder = VideoWorkflowBuilder()
    >>> video_workflow = video_builder.kling_omni(
    ...     cloud_image="scene1-char.png",
    ...     prompt="Cat looking around",
    ...     scene_id=1
    ... )
"""

from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Callable, Optional

# Configure logging
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Base Builder Classes
# ─────────────────────────────────────────────────────────────────────────────

class WorkflowBuilder(ABC):
    """Base class for all ComfyUI workflow builders."""
    
    @abstractmethod
    def build(self, **kwargs) -> dict:
        """Build and return ComfyUI API-format workflow dict.
        
        Returns:
            A ComfyUI workflow dictionary with node definitions in the format:
            {
                "1": {"class_type": "NodeClass", "inputs": {...}},
                "2": {"class_type": "SaveImage", "inputs": {...}}
            }
        """
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Image Workflow Builder
# ─────────────────────────────────────────────────────────────────────────────

class ImageWorkflowBuilder(WorkflowBuilder):
    """Builder for image generation workflows.
    
    Supports multiple image generation models:
    - Gemini 2 (gemini-3-pro-image-preview): Primary high-quality model
    - Gemini Nano: Lightweight fallback
    - Flux Kontext Pro: Alternative fallback with more control
    
    Example:
        >>> builder = ImageWorkflowBuilder()
        >>> 
        >>> # Primary model
        >>> workflow = builder.gemini2(
        ...     scene_id=1,
        ...     prompt="A professional cat news anchor",
        ...     aspect_ratio="9:16",
        ...     resolution="2K"
        ... )
        >>> 
        >>> # Fallback models
        >>> nano_workflow = builder.gemini_nano(scene_id=1, prompt="...")
        >>> flux_workflow = builder.flux_kontext(scene_id=1, prompt="...")
    """
    
    def build(self, **kwargs) -> dict:
        """Default build method - delegates to gemini2."""
        return self.gemini2(**kwargs)
    
    def gemini2(
        self,
        scene_id: int,
        prompt: str,
        aspect_ratio: str = "9:16",
        seed: int = 42,
        resolution: str = "2K",
        thinking_level: str = "MINIMAL"
    ) -> dict:
        """Build GeminiImage2Node workflow.
        
        Creates a workflow using Google's Gemini 2 image generation model
        (gemini-3-pro-image-preview) which produces high-quality images with
        excellent prompt understanding.
        
        Args:
            scene_id: Scene identifier for filename prefixing
            prompt: The image generation prompt
            aspect_ratio: Output aspect ratio (default: "9:16")
            seed: Random seed for reproducibility (default: 42)
            resolution: Output resolution - "2K" or "1K" (default: "2K")
            thinking_level: Thinking level - "MINIMAL", "MEDIUM", or "HIGH" (default: "MINIMAL")
            
        Returns:
            ComfyUI workflow dictionary with GeminiImage2Node and SaveImage nodes
            
        Example:
            >>> workflow = builder.gemini2(
            ...     scene_id=1,
            ...     prompt="A tabby cat news anchor at a desk",
            ...     aspect_ratio="9:16",
            ...     seed=12345
            ... )
        """
        workflow: dict[str, Any] = {
            "1": {
                "class_type": "GeminiImage2Node",
                "inputs": {
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "seed": seed,
                    "model": "gemini-3-pro-image-preview",
                    "resolution": resolution,
                    "thinking_level": thinking_level
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
        return workflow
    
    def gemini_nano(
        self,
        scene_id: int,
        prompt: str,
        aspect_ratio: str = "9:16",
        seed: int = 42
    ) -> dict:
        """Build GeminiNanoBanana2 fallback workflow.
        
        Lightweight fallback model for when Gemini 2 is unavailable.
        Faster but potentially lower quality than the primary model.
        
        Args:
            scene_id: Scene identifier for filename prefixing
            prompt: The image generation prompt
            aspect_ratio: Output aspect ratio (default: "9:16")
            seed: Random seed for reproducibility (default: 42)
            
        Returns:
            ComfyUI workflow dictionary with GeminiNanoBanana2 node
        """
        workflow: dict[str, Any] = {
            "1": {
                "class_type": "GeminiNanoBanana2",
                "inputs": {
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "seed": seed
                }
            },
            "2": {
                "class_type": "SaveImage",
                "inputs": {
                    "images": ["1", 0],
                    "filename_prefix": f"scene{scene_id}-{aspect_ratio.replace(':', 'x')}-char-nano"
                }
            }
        }
        return workflow
    
    def flux_kontext(
        self,
        scene_id: int,
        prompt: str,
        aspect_ratio: str = "9:16",
        seed: int = 42,
        guidance: float = 3.5,
        steps: int = 28
    ) -> dict:
        """Build FluxKontextProImageNode fallback workflow.
        
        Flux Kontext Pro offers excellent prompt adherence and is a good
        alternative when Gemini models are unavailable.
        
        Args:
            scene_id: Scene identifier for filename prefixing
            prompt: The image generation prompt
            aspect_ratio: Output aspect ratio (default: "9:16")
            seed: Random seed for reproducibility (default: 42)
            guidance: CFG guidance scale (default: 3.5)
            steps: Number of inference steps (default: 28)
            
        Returns:
            ComfyUI workflow dictionary with FluxKontextProImageNode
        """
        workflow: dict[str, Any] = {
            "1": {
                "class_type": "FluxKontextProImageNode",
                "inputs": {
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "seed": seed,
                    "guidance": guidance,
                    "steps": steps
                }
            },
            "2": {
                "class_type": "SaveImage",
                "inputs": {
                    "images": ["1", 0],
                    "filename_prefix": f"scene{scene_id}-{aspect_ratio.replace(':', 'x')}-char-flux"
                }
            }
        }
        return workflow


# ─────────────────────────────────────────────────────────────────────────────
# Video Workflow Builder
# ─────────────────────────────────────────────────────────────────────────────

class VideoWorkflowBuilder(WorkflowBuilder):
    """Builder for video generation workflows.
    
    Supports video generation from images using Kling models:
    - Kling Omni Pro v3: Primary with native audio generation
    - Kling v2 Master: Fallback without audio
    
    Example:
        >>> builder = VideoWorkflowBuilder()
        >>> 
        >>> # With native audio (v3)
        >>> workflow = builder.kling_omni(
        ...     cloud_image="scene1-char.png",
        ...     prompt="Camera slowly zooms in",
        ...     scene_id=1,
        ...     duration=5,
        ...     generate_audio=True
        ... )
        >>> 
        >>> # Silent video (v2)
        >>> workflow = builder.kling_v2(
        ...     cloud_image="scene1-char.png",
        ...     prompt="Slow pan across the scene",
        ...     scene_id=1
        ... )
    """
    
    def build(self, **kwargs) -> dict:
        """Default build method - delegates to kling_omni."""
        return self.kling_omni(**kwargs)
    
    def kling_omni(
        self,
        cloud_image: str,
        prompt: str,
        scene_id: int,
        duration: int = 5,
        aspect_ratio: str = "9:16",
        generate_audio: bool = True,
        seed: int = 100
    ) -> dict:
        """Build KlingOmniProImageToVideoNode workflow (v3 with native audio).
        
        Creates a workflow using Kling Omni Pro v3 which generates video from
        an image with optional native audio generation.
        
        Args:
            cloud_image: Filename of image already uploaded to ComfyUI Cloud
            prompt: Motion prompt describing the video movement
            scene_id: Scene identifier for filename prefixing
            duration: Video duration in seconds - 5 or 10 (default: 5)
            aspect_ratio: Output aspect ratio (default: "9:16")
            generate_audio: Whether to generate native audio (default: True)
            seed: Random seed for reproducibility (default: 100)
            
        Returns:
            ComfyUI workflow dictionary with KlingOmniProImageToVideoNode
            
        Example:
            >>> workflow = builder.kling_omni(
            ...     cloud_image="scene1-9x16-char_0001_.png",
            ...     prompt="Camera slowly pans left across the news desk",
            ...     scene_id=1,
            ...     duration=5,
            ...     generate_audio=True
            ... )
        """
        workflow: dict[str, Any] = {
            "1": {
                "class_type": "KlingOmniProImageToVideoNode",
                "inputs": {
                    "image": cloud_image,
                    "prompt": prompt,
                    "duration": duration,
                    "aspect_ratio": aspect_ratio,
                    "generate_audio": generate_audio,
                    "seed": seed
                }
            },
            "2": {
                "class_type": "SaveVideo",
                "inputs": {
                    "video": ["1", 0],
                    "filename_prefix": f"scene{scene_id}-{aspect_ratio.replace(':', 'x')}-video"
                }
            }
        }
        return workflow
    
    def kling_v2(
        self,
        cloud_image: str,
        prompt: str,
        scene_id: int,
        aspect_ratio: str = "9:16",
        duration: str = "5",
        cfg_scale: float = 0.8
    ) -> dict:
        """Build KlingImage2VideoNode workflow (v2, silent).
        
        Fallback video model without native audio support. Use this when
        Kling Omni Pro is unavailable or for silent video generation.
        
        Args:
            cloud_image: Filename of image already uploaded to ComfyUI Cloud
            prompt: Motion prompt describing the video movement
            scene_id: Scene identifier for filename prefixing
            aspect_ratio: Output aspect ratio (default: "9:16")
            duration: Video duration as string - "5" or "10" (default: "5")
            cfg_scale: CFG scale for motion adherence (default: 0.8)
            
        Returns:
            ComfyUI workflow dictionary with KlingImage2VideoNode
        """
        workflow: dict[str, Any] = {
            "1": {
                "class_type": "KlingImage2VideoNode",
                "inputs": {
                    "image": cloud_image,
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                    "duration": duration,
                    "cfg_scale": cfg_scale
                }
            },
            "2": {
                "class_type": "SaveVideo",
                "inputs": {
                    "video": ["1", 0],
                    "filename_prefix": f"scene{scene_id}-{aspect_ratio.replace(':', 'x')}-video-v2"
                }
            }
        }
        return workflow


# ─────────────────────────────────────────────────────────────────────────────
# TTS Workflow Builder
# ─────────────────────────────────────────────────────────────────────────────

class TTSWorkflowBuilder(WorkflowBuilder):
    """Builder for text-to-speech workflows.
    
    Uses ElevenLabs for high-quality voice synthesis with support for
    voice selection, speed control, and emotional tuning.
    
    Example:
        >>> builder = TTSWorkflowBuilder()
        >>> workflow = builder.elevenlabs(
        ...     text="Welcome to the Feline Report!",
        ...     scene_id=1,
        ...     voice="George (male, british)",
        ...     speed=0.9
        ... )
    """
    
    def build(self, **kwargs) -> dict:
        """Default build method - delegates to elevenlabs."""
        return self.elevenlabs(**kwargs)
    
    def elevenlabs(
        self,
        text: str,
        scene_id: int,
        line_index: int = 0,
        voice: str = "George (male, british)",
        speed: float = 0.9,
        stability: float = 0.4,
        similarity_boost: float = 0.8,
        seed: int = 42
    ) -> dict:
        """Build ElevenLabsTextToSpeech workflow.
        
        Creates a workflow for text-to-speech generation using ElevenLabs API.
        
        IMPORTANT: ElevenLabs uses dot-notation for model sub-inputs:
            "model.speed": 0.9
            "model.similarity_boost": 0.8
            
        Available voices include:
        - "George (male, british)" - Professional news anchor voice
        - "Rachel" - Female American voice
        - "Adam" - Male American voice
        - "Antoni" - Male voice with warmth
        
        Args:
            text: The text to synthesize into speech
            scene_id: Scene identifier for filename prefixing
            line_index: Line number within the scene (default: 0)
            voice: Voice model name (default: "George (male, british)")
            speed: Speech speed multiplier - 0.5 to 1.5 (default: 0.9)
            stability: Voice stability - 0.0 to 1.0 (default: 0.4)
            similarity_boost: Clarity/similarity boost - 0.0 to 1.0 (default: 0.8)
            seed: Random seed for reproducibility (default: 42)
            
        Returns:
            ComfyUI workflow dictionary with ElevenLabsTextToSpeech node
            
        Example:
            >>> workflow = builder.elevenlabs(
            ...     text="Breaking news from the Feline Report!",
            ...     scene_id=1,
            ...     line_index=0,
            ...     voice="George (male, british)",
            ...     speed=0.85
            ... )
        """
        workflow: dict[str, Any] = {
            "1": {
                "class_type": "ElevenLabsTextToSpeech",
                "inputs": {
                    "text": text,
                    "voice": voice,
                    "seed": seed,
                    "model.speed": speed,
                    "model.stability": stability,
                    "model.similarity_boost": similarity_boost
                }
            },
            "2": {
                "class_type": "SaveAudio",
                "inputs": {
                    "audio": ["1", 0],
                    "filename_prefix": f"scene{scene_id}-tts-{line_index:02d}"
                }
            }
        }
        return workflow


# ─────────────────────────────────────────────────────────────────────────────
# Lip Sync Workflow Builder
# ─────────────────────────────────────────────────────────────────────────────

class LipSyncWorkflowBuilder(WorkflowBuilder):
    """Builder for lip-sync workflows.
    
    Synchronizes video with audio to create talking head videos.
    Uses sync models to match lip movements with spoken audio.
    
    Example:
        >>> builder = LipSyncWorkflowBuilder()
        >>> workflow = builder.build(
        ...     video_path="scene1-video.mp4",
        ...     audio_path="scene1-tts-00.mp3",
        ...     scene_id=1,
        ...     model="sync-1.6.0"
        ... )
    """
    
    def build(
        self,
        video_path: str,
        audio_path: str,
        scene_id: int,
        model: str = "sync-1.6.0"
    ) -> dict:
        """Build lip-sync workflow.
        
        Creates a workflow that synchronizes a video with audio to match
        lip movements with the spoken words.
        
        Args:
            video_path: Cloud filename of the video to sync
            audio_path: Cloud filename of the audio to sync with
            scene_id: Scene identifier for filename prefixing
            model: Lip-sync model version (default: "sync-1.6.0")
            
        Returns:
            ComfyUI workflow dictionary with lip-sync node
            
        Example:
            >>> workflow = builder.build(
            ...     video_path="scene1-9x16-video_0001_.mp4",
            ...     audio_path="scene1-tts-00.wav",
            ...     scene_id=1
            ... )
        """
        workflow: dict[str, Any] = {
            "1": {
                "class_type": "LipSyncNode",
                "inputs": {
                    "video": video_path,
                    "audio": audio_path,
                    "model": model
                }
            },
            "2": {
                "class_type": "SaveVideo",
                "inputs": {
                    "video": ["1", 0],
                    "filename_prefix": f"scene{scene_id}-sync"
                }
            }
        }
        return workflow


# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

def build_scene_image_prompt(scene_visual: str, characters: dict[str, str]) -> str:
    """Combine scene visual description with character details.
    
    Builds a comprehensive image generation prompt by combining the scene
    visual description with character appearance details.
    
    Args:
        scene_visual: The visual description of the scene setting
        characters: Dictionary mapping character names to their descriptions
        
    Returns:
        Combined prompt string ready for image generation
        
    Example:
        >>> prompt = build_scene_image_prompt(
        ...     scene_visual="A news studio with blue lighting",
        ...     characters={
        ...         "anchor": "tabby cat wearing glasses and a blazer"
        ...     }
        ... )
        >>> print(prompt)
        A news studio with blue lighting. Characters: anchor is tabby cat...
    """
    parts = [scene_visual]
    
    if characters:
        char_descriptions = []
        for name, desc in characters.items():
            char_descriptions.append(f"{name} is {desc}")
        parts.append("Characters: " + ", ".join(char_descriptions))
    
    return ". ".join(parts)


def build_video_prompt(scene: dict[str, Any], include_sfx: bool = True) -> str:
    """Build video prompt including SFX and music cues from scene data.
    
    Constructs a motion prompt for video generation by combining camera
    directions, character actions, and optionally sound effects.
    
    Args:
        scene: Scene dictionary containing:
            - camera_direction: Camera movement description
            - character_action: Character movement/action
            - sfx: Sound effects description (optional)
            - music_cue: Music style (optional)
        include_sfx: Whether to include SFX/music in the prompt (default: True)
        
    Returns:
        Motion prompt string for video generation
        
    Example:
        >>> scene = {
        ...     "camera_direction": "Slow zoom in on anchor",
        ...     "character_action": "Cat looks directly at camera",
        ...     "sfx": "Subtle newsroom ambiance"
        ... }
        >>> prompt = build_video_prompt(scene)
    """
    parts: list[str] = []
    
    if "camera_direction" in scene:
        parts.append(scene["camera_direction"])
    
    if "character_action" in scene:
        parts.append(scene["character_action"])
    
    if include_sfx:
        if "sfx" in scene:
            parts.append(f"Audio: {scene['sfx']}")
        if "music_cue" in scene:
            parts.append(f"Music: {scene['music_cue']}")
    
    return ". ".join(parts) if parts else "Subtle movement, gentle motion"


def load_template(template_name: str) -> dict:
    """Load base template from workflows/{template_name}.json.
    
    Loads a JSON workflow template from the workflows directory.
    
    Args:
        template_name: Name of the template file (without .json extension)
        
    Returns:
        Parsed template as dictionary
        
    Raises:
        FileNotFoundError: If template file doesn't exist
        json.JSONDecodeError: If template file contains invalid JSON
        
    Example:
        >>> template = load_template("character-image-api")
        >>> print(template["1"]["class_type"])
        'GeminiImage2Node'
    """
    # Look for templates in common locations
    search_paths = [
        Path("workflows") / f"{template_name}.json",
        Path("mcp-refactor-swarm/workflows") / f"{template_name}.json",
        Path(__file__).parent / "workflows" / f"{template_name}.json",
    ]
    
    for path in search_paths:
        if path.exists():
            with open(path, "r") as f:
                return json.load(f)
    
    raise FileNotFoundError(
        f"Template '{template_name}' not found in: "
        + ", ".join(str(p) for p in search_paths)
    )


def customize_template(template: dict, overrides: dict) -> dict:
    """Apply parameter overrides to template.
    
    Deep-merges override values into a template dictionary, creating
    a new customized workflow.
    
    Args:
        template: Base template dictionary
        overrides: Dictionary of values to override in the template
            Format: {"node_id.input_name": value} or nested dict
            
    Returns:
        New template dictionary with overrides applied
        
    Example:
        >>> template = load_template("character-image-api")
        >>> customized = customize_template(template, {
        ...     "1.prompt": "A cat wearing glasses",
        ...     "1.seed": 12345,
        ...     "2.filename_prefix": "custom-scene"
        ... })
    """
    import copy
    result = copy.deepcopy(template)
    
    for key, value in overrides.items():
        if "." in key:
            # Handle dot-notation: "1.prompt" -> result["1"]["inputs"]["prompt"]
            parts = key.split(".")
            if len(parts) >= 2:
                node_id = parts[0]
                input_name = parts[1]
                
                if node_id in result and "inputs" in result[node_id]:
                    result[node_id]["inputs"][input_name] = value
        elif isinstance(value, dict) and key in result:
            # Merge nested dictionaries
            result[key].update(value)
        else:
            # Direct assignment
            result[key] = value
    
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Fallback Chain Support
# ─────────────────────────────────────────────────────────────────────────────

# Registry of available image builders for fallback chains
IMAGE_BUILDERS: dict[str, Callable[..., dict]] = {
    "gemini-3-pro": ImageWorkflowBuilder.gemini2,
    "nano-banana-2": ImageWorkflowBuilder.gemini_nano,
    "flux-kontext": ImageWorkflowBuilder.flux_kontext
}

# Registry of available video builders for fallback chains
VIDEO_BUILDERS: dict[str, Callable[..., dict]] = {
    "kling-v3-omni": VideoWorkflowBuilder.kling_omni,
    "kling-v2-master": VideoWorkflowBuilder.kling_v2
}


def build_with_fallback(
    builders: list[tuple[str, Callable[..., dict]]],
    **kwargs
) -> tuple[str, dict]:
    """Try each builder until one produces valid workflow.
    
    This is a static utility for building fallback chains. Each builder
    is called in order until one returns a non-empty workflow dict.
    
    Args:
        builders: List of (model_name, builder_method) tuples to try
        **kwargs: Arguments to pass to each builder method
        
    Returns:
        Tuple of (model_name, workflow_dict) where:
        - model_name: Name of the builder that succeeded
        - workflow_dict: The generated workflow
        
    Raises:
        RuntimeError: If all builders fail to produce a workflow
        
    Example:
        >>> from workflow_builders import IMAGE_BUILDERS, build_with_fallback
        >>> 
        >>> # Create fallback chain
        >>> builders = [
        ...     ("gemini-3-pro", IMAGE_BUILDERS["gemini-3-pro"]),
        ...     ("flux-kontext", IMAGE_BUILDERS["flux-kontext"])
        ... ]
        >>> 
        >>> model_name, workflow = build_with_fallback(
        ...     builders,
        ...     scene_id=1,
        ...     prompt="A cat news anchor"
        ... )
        >>> print(f"Using model: {model_name}")
    """
    last_error: Optional[Exception] = None
    
    for model_name, builder_func in builders:
        try:
            # Create instance if method is unbound
            if isinstance(builder_func, type(lambda: None)) and hasattr(builder_func, '__self__'):
                workflow = builder_func(**kwargs)
            else:
                # It's a method, need an instance
                if builder_func.__qualname__.startswith("ImageWorkflowBuilder"):
                    instance = ImageWorkflowBuilder()
                elif builder_func.__qualname__.startswith("VideoWorkflowBuilder"):
                    instance = VideoWorkflowBuilder()
                elif builder_func.__qualname__.startswith("TTSWorkflowBuilder"):
                    instance = TTSWorkflowBuilder()
                else:
                    raise RuntimeError(f"Unknown builder type: {builder_func}")
                
                # Get the actual method name
                method_name = builder_func.__name__
                method = getattr(instance, method_name)
                workflow = method(**kwargs)
            
            if workflow and isinstance(workflow, dict):
                logger.info(f"Builder '{model_name}' succeeded")
                return model_name, workflow
                
        except Exception as e:
            last_error = e
            logger.warning(f"Builder '{model_name}' failed: {e}")
            continue
    
    raise RuntimeError(
        f"All {len(builders)} builder attempts failed. "
        f"Last error: {last_error}"
    )


def create_image_fallback_chain(
    scene_id: int,
    prompt: str,
    aspect_ratio: str = "9:16",
    seed: int = 42
) -> list[tuple[str, dict]]:
    """Create a list of image workflows to try in order.
    
    Convenience function to build a fallback chain for image generation
    with the most common models.
    
    Args:
        scene_id: Scene identifier
        prompt: Image generation prompt
        aspect_ratio: Output aspect ratio (default: "9:16")
        seed: Random seed (default: 42)
        
    Returns:
        List of (model_name, workflow_dict) tuples ready for fallback
        
    Example:
        >>> workflows = create_image_fallback_chain(
        ...     scene_id=1,
        ...     prompt="A cat news anchor"
        ... )
        >>> # Use with ComfyUIClient.generate_with_fallback()
        >>> model, prompt_id, outputs = await client.generate_with_fallback(
        ...     workflows, "scene-1-image"
        ... )
    """
    image_builder = ImageWorkflowBuilder()
    
    return [
        ("gemini-3-pro", image_builder.gemini2(scene_id, prompt, aspect_ratio, seed)),
        ("nano-banana-2", image_builder.gemini_nano(scene_id, prompt, aspect_ratio, seed)),
        ("flux-kontext", image_builder.flux_kontext(scene_id, prompt, aspect_ratio, seed))
    ]


def create_video_fallback_chain(
    cloud_image: str,
    prompt: str,
    scene_id: int,
    aspect_ratio: str = "9:16"
) -> list[tuple[str, dict]]:
    """Create a list of video workflows to try in order.
    
    Convenience function to build a fallback chain for video generation
    with the most common models.
    
    Args:
        cloud_image: Uploaded image filename on ComfyUI Cloud
        prompt: Motion prompt for video generation
        scene_id: Scene identifier
        aspect_ratio: Output aspect ratio (default: "9:16")
        
    Returns:
        List of (model_name, workflow_dict) tuples ready for fallback
        
    Example:
        >>> workflows = create_video_fallback_chain(
        ...     cloud_image="scene1-9x16-char_0001_.png",
        ...     prompt="Camera slowly zooms in",
        ...     scene_id=1
        ... )
        >>> model, prompt_id, outputs = await client.generate_with_fallback(
        ...     workflows, "scene-1-video"
        ... )
    """
    video_builder = VideoWorkflowBuilder()
    
    return [
        ("kling-v3-omni", video_builder.kling_omni(cloud_image, prompt, scene_id, aspect_ratio=aspect_ratio)),
        ("kling-v2-master", video_builder.kling_v2(cloud_image, prompt, scene_id, aspect_ratio=aspect_ratio))
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Test Code
# ─────────────────────────────────────────────────────────────────────────────

def _test_builders():
    """Test the workflow builders."""
    print("=" * 70)
    print("Workflow Builders Test Suite")
    print("=" * 70)
    
    # Test ImageWorkflowBuilder
    print("\n📸 Image Workflow Builder Tests")
    print("-" * 40)
    
    image_builder = ImageWorkflowBuilder()
    
    # Test Gemini 2
    gemini_workflow = image_builder.gemini2(
        scene_id=1,
        prompt="A professional tabby cat news anchor wearing glasses",
        aspect_ratio="9:16",
        seed=42
    )
    assert "1" in gemini_workflow
    assert gemini_workflow["1"]["class_type"] == "GeminiImage2Node"
    assert gemini_workflow["1"]["inputs"]["model"] == "gemini-3-pro-image-preview"
    print("✓ Gemini 2 workflow built successfully")
    print(f"  - Filename prefix: {gemini_workflow['2']['inputs']['filename_prefix']}")
    
    # Test Gemini Nano
    nano_workflow = image_builder.gemini_nano(
        scene_id=1,
        prompt="A cat wearing a blazer",
        seed=123
    )
    assert nano_workflow["1"]["class_type"] == "GeminiNanoBanana2"
    print("✓ Gemini Nano workflow built successfully")
    
    # Test Flux Kontext
    flux_workflow = image_builder.flux_kontext(
        scene_id=2,
        prompt="A news studio with blue lighting",
        guidance=3.5,
        steps=28
    )
    assert flux_workflow["1"]["class_type"] == "FluxKontextProImageNode"
    assert flux_workflow["1"]["inputs"]["guidance"] == 3.5
    print("✓ Flux Kontext workflow built successfully")
    
    # Test VideoWorkflowBuilder
    print("\n🎬 Video Workflow Builder Tests")
    print("-" * 40)
    
    video_builder = VideoWorkflowBuilder()
    
    # Test Kling Omni
    omni_workflow = video_builder.kling_omni(
        cloud_image="scene1-9x16-char_0001_.png",
        prompt="Camera slowly pans across the news desk",
        scene_id=1,
        duration=5,
        generate_audio=True
    )
    assert omni_workflow["1"]["class_type"] == "KlingOmniProImageToVideoNode"
    assert omni_workflow["1"]["inputs"]["generate_audio"] is True
    print("✓ Kling Omni v3 workflow built successfully")
    
    # Test Kling v2
    v2_workflow = video_builder.kling_v2(
        cloud_image="scene1-9x16-char_0001_.png",
        prompt="Slow zoom in on the anchor",
        scene_id=1
    )
    assert v2_workflow["1"]["class_type"] == "KlingImage2VideoNode"
    print("✓ Kling v2 workflow built successfully")
    
    # Test TTSWorkflowBuilder
    print("\n🔊 TTS Workflow Builder Tests")
    print("-" * 40)
    
    tts_builder = TTSWorkflowBuilder()
    
    tts_workflow = tts_builder.elevenlabs(
        text="Welcome to the Feline Report!",
        scene_id=1,
        line_index=0,
        voice="George (male, british)",
        speed=0.9
    )
    assert tts_workflow["1"]["class_type"] == "ElevenLabsTextToSpeech"
    assert tts_workflow["1"]["inputs"]["model.speed"] == 0.9
    assert tts_workflow["1"]["inputs"]["model.similarity_boost"] == 0.8
    print("✓ ElevenLabs TTS workflow built successfully")
    
    # Test LipSyncWorkflowBuilder
    print("\n🎭 Lip Sync Workflow Builder Tests")
    print("-" * 40)
    
    lip_builder = LipSyncWorkflowBuilder()
    
    lip_workflow = lip_builder.build(
        video_path="scene1-9x16-video_0001_.mp4",
        audio_path="scene1-tts-00.wav",
        scene_id=1,
        model="sync-1.6.0"
    )
    assert lip_workflow["1"]["class_type"] == "LipSyncNode"
    assert lip_workflow["1"]["inputs"]["model"] == "sync-1.6.0"
    print("✓ Lip Sync workflow built successfully")
    
    # Test Helper Functions
    print("\n🔧 Helper Functions Tests")
    print("-" * 40)
    
    # Test build_scene_image_prompt
    prompt = build_scene_image_prompt(
        scene_visual="A professional news studio with blue lighting",
        characters={
            "anchor": "a tabby cat wearing reading glasses and a navy blazer",
            "co_host": "a siamese cat with a red bow tie"
        }
    )
    assert "news studio" in prompt
    assert "tabby cat" in prompt
    assert "siamese cat" in prompt
    print("✓ build_scene_image_prompt works correctly")
    
    # Test build_video_prompt
    video_prompt = build_video_prompt({
        "camera_direction": "Slow zoom in on the anchor",
        "character_action": "Cat looks at camera with serious expression",
        "sfx": "Newsroom ambiance",
        "music_cue": "Upbeat news intro"
    })
    assert "zoom in" in video_prompt
    assert "Newsroom ambiance" in video_prompt
    print("✓ build_video_prompt works correctly")
    
    # Test customize_template
    template = {
        "1": {
            "class_type": "TestNode",
            "inputs": {"prompt": "original", "seed": 42}
        }
    }
    customized = customize_template(template, {"1.prompt": "customized prompt"})
    assert customized["1"]["inputs"]["prompt"] == "customized prompt"
    assert customized["1"]["inputs"]["seed"] == 42  # Unchanged
    print("✓ customize_template works correctly")
    
    # Test Fallback Chain Creation
    print("\n⛓️  Fallback Chain Tests")
    print("-" * 40)
    
    image_chain = create_image_fallback_chain(
        scene_id=1,
        prompt="A cat news anchor",
        aspect_ratio="9:16"
    )
    assert len(image_chain) == 3
    assert image_chain[0][0] == "gemini-3-pro"
    print(f"✓ Image fallback chain created with {len(image_chain)} models")
    
    video_chain = create_video_fallback_chain(
        cloud_image="test.png",
        prompt="Camera pan",
        scene_id=1
    )
    assert len(video_chain) == 2
    assert video_chain[0][0] == "kling-v3-omni"
    print(f"✓ Video fallback chain created with {len(video_chain)} models")
    
    # Print sample workflows
    print("\n📋 Sample Workflow Outputs")
    print("-" * 40)
    
    print("\n--- Gemini 2 Workflow (excerpt) ---")
    print(json.dumps(gemini_workflow, indent=2)[:500] + "...")
    
    print("\n--- ElevenLabs TTS Workflow (excerpt) ---")
    print(json.dumps(tts_workflow, indent=2)[:500] + "...")
    
    print("\n" + "=" * 70)
    print("All tests passed! ✅")
    print("=" * 70)
    
    return True


if __name__ == "__main__":
    # Configure logging for test mode
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S"
    )
    
    # Run tests
    try:
        _test_builders()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
