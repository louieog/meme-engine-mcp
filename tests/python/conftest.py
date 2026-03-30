"""Pytest configuration and shared fixtures."""
import pytest
import asyncio
import json
from pathlib import Path


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def sample_brief():
    """Sample production brief for testing."""
    return {
        "concept": "Test meme video",
        "format": "mini-drama",
        "trend_score": 75,
        "style": "relatable",
        "duration_target_seconds": 30,
        "aspect_ratios": ["9:16", "16:9"],
        "scenes": [
            {
                "scene_id": 1,
                "beat": "HOOK",
                "duration_seconds": 5,
                "visual": "Funny cat expression",
                "camera": "close-up",
                "characters_present": ["cat"],
                "dialogue": [],
                "sfx": ["record scratch"],
                "music_cue": "comedic tension",
                "text_overlay": "When you realize..."
            },
            {
                "scene_id": 2,
                "beat": "SETUP",
                "duration_seconds": 10,
                "visual": "Cat looking at empty food bowl",
                "camera": "medium shot",
                "characters_present": ["cat"],
                "dialogue": [
                    {"character": "cat", "text": "Meow?", "emotion": "confused"}
                ],
                "sfx": [],
                "music_cue": "comedic tension",
                "text_overlay": ""
            },
            {
                "scene_id": 3,
                "beat": "PUNCHLINE",
                "duration_seconds": 5,
                "visual": "Cat knocking things off table",
                "camera": "slow motion",
                "characters_present": ["cat"],
                "dialogue": [],
                "sfx": ["crash", "glass breaking"],
                "music_cue": "dramatic reveal",
                "text_overlay": "REVENGE"
            }
        ],
        "characters": [
            {
                "id": "cat",
                "name": "Whiskers",
                "description": "Orange tabby cat with white paws",
                "reference_images": ["ref1.png", "ref2.png"],
                "consistency_prompt": "Orange tabby cat, white paws, green eyes"
            }
        ],
        "audio": {
            "music_track": "upbeat_meme_music.mp3",
            "tts_enabled": False,
            "sfx_required": ["record_scratch", "glass_break"]
        },
        "generation_requirements": {
            "character_consistency": True,
            "lip_sync_needed": False,
            "models_preferred": {
                "image": "gemini-3-pro",
                "video": "kling-v3-omni"
            },
            "fallback_chain": ["kling-v3-omni", "runway-gen3", "luma-dream-machine"]
        },
        "export_formats": {
            "primary": "9:16",
            "secondary": ["16:9", "1:1"]
        }
    }


@pytest.fixture
def sample_workflow():
    """Sample ComfyUI workflow for testing."""
    return {
        "1": {
            "class_type": "GeminiImage2Node",
            "inputs": {
                "prompt": "A scenic mountain view",
                "model": "gemini-3-pro-image-preview",
                "aspect_ratio": "9:16",
                "seed": 42
            }
        },
        "2": {
            "class_type": "SaveImage",
            "inputs": {
                "images": ["1", 0],
                "filename_prefix": "scene_1"
            }
        }
    }


@pytest.fixture
def sample_video_workflow():
    """Sample video generation workflow."""
    return {
        "1": {
            "class_type": "LoadImage",
            "inputs": {
                "image": "scene_1.png"
            }
        },
        "2": {
            "class_type": "KlingOmniProImageToVideoNode",
            "inputs": {
                "image": ["1", 0],
                "prompt": "Camera pan across mountains",
                "model_name": "kling-v3-omni",
                "duration": 5,
                "generate_audio": True
            }
        },
        "3": {
            "class_type": "SaveVideo",
            "inputs": {
                "video": ["2", 0],
                "filename_prefix": "scene_1_video"
            }
        }
    }


@pytest.fixture
def mock_comfyui_response():
    """Sample ComfyUI API response."""
    return {
        "prompt_id": "test-prompt-123",
        "number": 1,
        "node_errors": {}
    }


@pytest.fixture
def mock_execution_outputs():
    """Sample execution output with generated files."""
    return {
        "2": {
            "images": [
                {"filename": "scene_1_00001_.png", "subfolder": "", "type": "output"}
            ]
        },
        "3": {
            "video": [
                {"filename": "scene_1_video.mp4", "subfolder": "video", "type": "output"}
            ]
        }
    }


@pytest.fixture
def temp_project_dir(tmp_path):
    """Create a temporary project directory structure."""
    project_dir = tmp_path / "test_project"
    project_dir.mkdir()
    
    # Create subdirectories
    (project_dir / "assets" / "images").mkdir(parents=True)
    (project_dir / "assets" / "video").mkdir(parents=True)
    (project_dir / "assets" / "audio").mkdir(parents=True)
    (project_dir / "output").mkdir()
    (project_dir / "temp").mkdir()
    
    return project_dir


@pytest.fixture
def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "integration: marks tests as integration (requires external services)")
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "requires_ffmpeg: marks tests requiring ffmpeg installation")


@pytest.fixture(scope="session")
def test_data_dir():
    """Return path to test data directory."""
    return Path(__file__).parent.parent / "fixtures"


# Async fixtures
@pytest.fixture
async def async_sample_brief():
    """Async fixture for sample brief."""
    return {
        "concept": "Async test brief",
        "format": "quick-cut",
        "scenes": []
    }
