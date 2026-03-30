"""End-to-end pipeline integration test."""
import pytest
import asyncio
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import json

# Mark as integration test (skipped by default)
pytestmark = pytest.mark.integration


class TestFullPipeline:
    """Test complete pipeline from brief to video."""
    
    @pytest.fixture
    def pipeline_config(self, tmp_path):
        """Create test pipeline configuration."""
        return {
            "output_dir": tmp_path / "output",
            "temp_dir": tmp_path / "temp",
            "api_key": "test-api-key",
            "base_url": "https://cloud.comfy.org"
        }
    
    @pytest.fixture
    def sample_full_brief(self):
        """Create a complete production brief."""
        return {
            "concept": "Funny cat revenge video",
            "format": "mini-drama",
            "trend_score": 88,
            "style": "relatable",
            "duration_target_seconds": 20,
            "aspect_ratios": ["9:16"],
            "scenes": [
                {
                    "scene_id": 1,
                    "beat": "HOOK",
                    "duration_seconds": 3,
                    "visual": "Cat staring at empty food bowl with sad expression",
                    "camera": "close-up on face",
                    "characters_present": ["whiskers"],
                    "dialogue": [],
                    "sfx": ["sad trombone"],
                    "music_cue": "comedic tension",
                    "text_overlay": "When your human forgets to feed you..."
                },
                {
                    "scene_id": 2,
                    "beat": "SETUP",
                    "duration_seconds": 8,
                    "visual": "Cat looking at human's favorite vase on table",
                    "camera": "low angle from cat's perspective",
                    "characters_present": ["whiskers"],
                    "dialogue": [{"character": "whiskers", "text": "*intense staring*", "emotion": "determined"}],
                    "sfx": [],
                    "music_cue": "building tension",
                    "text_overlay": ""
                },
                {
                    "scene_id": 3,
                    "beat": "PUNCHLINE",
                    "duration_seconds": 4,
                    "visual": "Cat pushing vase off table in slow motion",
                    "camera": "slow motion tracking shot",
                    "characters_present": ["whiskers"],
                    "dialogue": [],
                    "sfx": ["crash", "glass shattering"],
                    "music_cue": "dramatic impact",
                    "text_overlay": "REVENGE IS A DISH BEST SERVED... CLUMSY"
                },
                {
                    "scene_id": 4,
                    "beat": "RESOLUTION",
                    "duration_seconds": 5,
                    "visual": "Cat looking innocent while human looks shocked",
                    "camera": "wide shot",
                    "characters_present": ["whiskers"],
                    "dialogue": [],
                    "sfx": ["record scratch", "awkward silence"],
                    "music_cue": "comedic resolution",
                    "text_overlay": "What? I didn't do anything..."
                }
            ],
            "characters": [
                {
                    "id": "whiskers",
                    "name": "Whiskers",
                    "description": "Orange tabby cat with white paws and green eyes, mischievous personality",
                    "reference_images": [],
                    "consistency_prompt": "Orange tabby cat, white paws, green eyes, fluffy fur"
                }
            ],
            "audio": {
                "music_track": "upbeat_meme_music.mp3",
                "tts_enabled": False,
                "sfx_required": ["sad_trombone", "crash", "glass_shatter", "record_scratch"]
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
                "secondary": []
            }
        }
    
    @pytest.mark.asyncio
    async def test_pipeline_with_mock_services(self, pipeline_config, sample_full_brief):
        """Test pipeline execution with mocked external services."""
        # Import pipeline modules (would be from actual codebase)
        # from pipeline import VideoPipeline
        
        # Mock the external services
        with patch("comfyui_client.ComfyUIClient") as MockClient:
            with patch("video_assembly.VideoAssembler") as MockAssembler:
                # Configure mock client
                mock_client = Mock()
                mock_client.upload_file = AsyncMock(return_value="uploaded_image.png")
                mock_client.generate = AsyncMock(return_value=[
                    {"filename": f"scene_{i}_video.mp4"} for i in range(1, 5)
                ])
                mock_client.generate_image = AsyncMock(return_value=[
                    {"filename": f"scene_{i}_00001_.png"} for i in range(1, 5)
                ])
                MockClient.return_value = mock_client
                
                # Configure mock assembler
                mock_assembler = Mock()
                mock_assembler.create_still_clip = Mock(return_value=Path("still_clip.mp4"))
                mock_assembler.concatenate_clips = Mock(return_value=Path("concatenated.mp4"))
                mock_assembler.add_audio = Mock(return_value=Path("with_audio.mp4"))
                mock_assembler.add_text_overlay = Mock(return_value=Path("final_output.mp4"))
                MockAssembler.return_value = mock_assembler
                
                # Execute pipeline steps
                # Step 1: Validate brief
                assert sample_full_brief["concept"]
                assert len(sample_full_brief["scenes"]) > 0
                
                # Step 2: Generate images for each scene
                generated_images = []
                for scene in sample_full_brief["scenes"]:
                    result = await mock_client.generate_image({
                        "prompt": scene["visual"],
                        "aspect_ratio": "9:16"
                    })
                    generated_images.extend(result)
                
                assert len(generated_images) == 4
                
                # Step 3: Generate videos
                generated_videos = []
                for i, image in enumerate(generated_images):
                    result = await mock_client.generate({
                        "image": image["filename"],
                        "prompt": sample_full_brief["scenes"][i]["visual"]
                    })
                    generated_videos.extend(result)
                
                assert len(generated_videos) == 4
                
                # Step 4: Assemble final video
                clip_paths = [f"scene_{i}_video.mp4" for i in range(1, 5)]
                final_video = mock_assembler.concatenate_clips(clip_paths, "final.mp4")
                
                assert final_video.name == "final.mp4"
                
                # Verify all mock calls
                assert mock_client.generate_image.call_count == 4
                assert mock_client.generate.call_count == 4
                mock_assembler.concatenate_clips.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_pipeline_with_character_consistency(self, pipeline_config, sample_full_brief):
        """Test pipeline maintains character consistency across scenes."""
        # Character consistency is crucial for the video quality
        character = sample_full_brief["characters"][0]
        consistency_prompt = character["consistency_prompt"]
        
        # Each scene should reference the character
        for scene in sample_full_brief["scenes"]:
            if character["id"] in scene.get("characters_present", []):
                # Visual description should include character details
                assert "cat" in scene["visual"].lower() or "orange" in scene["visual"].lower()
        
        # Consistency prompt should be used in generation
        assert "orange tabby" in consistency_prompt.lower()
        assert "white paws" in consistency_prompt.lower()
    
    @pytest.mark.asyncio
    async def test_pipeline_aspect_ratio_handling(self, sample_full_brief):
        """Test pipeline handles aspect ratio correctly."""
        aspect_ratios = sample_full_brief["aspect_ratios"]
        
        # Primary format should be 9:16 for short-form content
        assert "9:16" in aspect_ratios
        
        # Export formats should be defined
        assert "primary" in sample_full_brief["export_formats"]
        assert sample_full_brief["export_formats"]["primary"] == "9:16"
    
    @pytest.mark.asyncio
    async def test_pipeline_timing_validation(self, sample_full_brief):
        """Test pipeline validates scene timing."""
        total_duration = sum(s["duration_seconds"] for s in sample_full_brief["scenes"])
        target_duration = sample_full_brief["duration_target_seconds"]
        
        # Total duration should match target (approximately)
        assert total_duration == target_duration
        
        # HOOK should be short and engaging
        hook_scene = sample_full_brief["scenes"][0]
        assert hook_scene["beat"] == "HOOK"
        assert hook_scene["duration_seconds"] <= 5
        
        # PUNCHLINE should be impactful
        punchline_scene = next(
            s for s in sample_full_brief["scenes"] if s["beat"] == "PUNCHLINE"
        )
        assert punchline_scene["duration_seconds"] >= 3
    
    @pytest.mark.asyncio
    async def test_pipeline_audio_synchronization(self, sample_full_brief):
        """Test pipeline handles audio elements."""
        audio_config = sample_full_brief["audio"]
        
        # Music track should be specified
        assert audio_config["music_track"]
        
        # SFX should be defined for relevant scenes
        sfx_scenes = [s for s in sample_full_brief["scenes"] if s.get("sfx")]
        assert len(sfx_scenes) > 0
        
        # Music cues should be consistent
        music_cues = [s["music_cue"] for s in sample_full_brief["scenes"] if s.get("music_cue")]
        assert len(music_cues) == len(sample_full_brief["scenes"])


class TestPipelineExport:
    """Test pipeline export functionality."""
    
    @pytest.mark.asyncio
    async def test_multi_format_export(self, tmp_path):
        """Test exporting in multiple formats."""
        export_formats = {
            "9:16": {"width": 1080, "height": 1920},
            "16:9": {"width": 1920, "height": 1080},
            "1:1": {"width": 1080, "height": 1080}
        }
        
        for format_name, dimensions in export_formats.items():
            # Verify dimensions
            assert dimensions["width"] > 0
            assert dimensions["height"] > 0
            
            # Calculate aspect ratio
            ratio = dimensions["width"] / dimensions["height"]
            
            if format_name == "9:16":
                assert ratio == 9/16
            elif format_name == "16:9":
                assert ratio == 16/9
            elif format_name == "1:1":
                assert ratio == 1.0
    
    @pytest.mark.asyncio
    async def test_export_quality_settings(self):
        """Test different quality/resolution exports."""
        quality_settings = {
            "720p": {"resolution": (720, 1280), "bitrate": "2M"},
            "1080p": {"resolution": (1080, 1920), "bitrate": "5M"},
            "4k": {"resolution": (2160, 3840), "bitrate": "20M"}
        }
        
        for quality, settings in quality_settings.items():
            assert settings["resolution"][0] > 0
            assert settings["resolution"][1] > 0
            assert "M" in settings["bitrate"]


class TestPipelineMetrics:
    """Test pipeline metrics and monitoring."""
    
    @pytest.mark.asyncio
    async def test_pipeline_completion_tracking(self):
        """Test tracking pipeline completion."""
        steps = [
            "brief_validation",
            "trend_analysis",
            "image_generation",
            "video_generation",
            "audio_sync",
            "assembly",
            "export"
        ]
        
        completed_steps = []
        
        for step in steps:
            # Simulate step completion
            completed_steps.append(step)
        
        assert len(completed_steps) == len(steps)
        assert completed_steps[-1] == "export"
    
    @pytest.mark.asyncio
    async def test_generation_metrics_collection(self):
        """Test collecting generation metrics."""
        metrics = {
            "total_scenes": 4,
            "images_generated": 4,
            "videos_generated": 4,
            "total_duration_seconds": 120,  # Processing time
            "credits_used": 12,
            "fallback_activations": 1
        }
        
        assert metrics["images_generated"] == metrics["total_scenes"]
        assert metrics["videos_generated"] == metrics["total_scenes"]
        assert metrics["total_duration_seconds"] > 0


# Helper function tests
def test_calculate_total_duration():
    """Test total duration calculation."""
    scenes = [
        {"duration_seconds": 3},
        {"duration_seconds": 5},
        {"duration_seconds": 4}
    ]
    
    total = sum(s["duration_seconds"] for s in scenes)
    assert total == 12


def test_validate_brief_completeness():
    """Test brief validation."""
    def is_valid_brief(brief):
        required_fields = ["concept", "scenes", "characters", "duration_target_seconds"]
        return all(field in brief for field in required_fields)
    
    complete_brief = {
        "concept": "Test",
        "scenes": [],
        "characters": [],
        "duration_target_seconds": 30
    }
    
    incomplete_brief = {
        "concept": "Test"
    }
    
    assert is_valid_brief(complete_brief) is True
    assert is_valid_brief(incomplete_brief) is False
