"""Tests for workflow builder modules."""
import pytest
from workflow_builders import (
    ImageWorkflowBuilder,
    VideoWorkflowBuilder,
    TTSWorkflowBuilder,
    build_scene_image_prompt,
    build_video_prompt,
    WorkflowTemplate
)


class TestImageWorkflowBuilder:
    """Test image generation workflow builders."""
    
    def test_gemini2_workflow_structure(self):
        """Test Gemini2 workflow has correct structure."""
        builder = ImageWorkflowBuilder()
        workflow = builder.gemini2(
            scene_id=1,
            prompt="test prompt",
            aspect_ratio="9:16",
            seed=42
        )
        
        assert "1" in workflow
        assert workflow["1"]["class_type"] == "GeminiImage2Node"
        assert workflow["1"]["inputs"]["model"] == "gemini-3-pro-image-preview"
        assert workflow["1"]["inputs"]["aspect_ratio"] == "9:16"
        assert workflow["1"]["inputs"]["seed"] == 42
    
    def test_save_image_node_connection(self):
        """Test SaveImage node is connected to generator."""
        builder = ImageWorkflowBuilder()
        workflow = builder.gemini2(scene_id=1, prompt="test")
        
        # Check SaveImage node exists
        assert "2" in workflow
        assert workflow["2"]["class_type"] == "SaveImage"
        # Check connection: SaveImage.inputs.images = [generator_node, output_index]
        assert workflow["2"]["inputs"]["images"] == ["1", 0]
    
    def test_gemini2_with_custom_parameters(self):
        """Test Gemini2 with all custom parameters."""
        builder = ImageWorkflowBuilder()
        workflow = builder.gemini2(
            scene_id=5,
            prompt="A cat playing piano",
            aspect_ratio="16:9",
            seed=12345,
            negative_prompt="blur, low quality"
        )
        
        assert workflow["1"]["inputs"]["prompt"] == "A cat playing piano"
        assert workflow["1"]["inputs"]["aspect_ratio"] == "16:9"
        assert workflow["1"]["inputs"]["negative_prompt"] == "blur, low quality"
    
    def test_aspect_ratio_validation(self):
        """Test invalid aspect ratio handling."""
        builder = ImageWorkflowBuilder()
        
        with pytest.raises(ValueError, match="Invalid aspect ratio"):
            builder.gemini2(scene_id=1, prompt="test", aspect_ratio="invalid")


class TestVideoWorkflowBuilder:
    """Test video generation workflow builders."""
    
    def test_kling_omni_workflow(self):
        """Test KlingOmniPro workflow structure."""
        builder = VideoWorkflowBuilder()
        workflow = builder.kling_omni(
            cloud_image="uploaded.png",
            prompt="test motion",
            scene_id=1,
            duration=5,
            generate_audio=True
        )
        
        assert workflow["2"]["class_type"] == "KlingOmniProImageToVideoNode"
        assert workflow["2"]["inputs"]["generate_audio"] == True
        assert workflow["2"]["inputs"]["model_name"] == "kling-v3-omni"
        assert workflow["2"]["inputs"]["duration"] == 5
    
    def test_kling_omni_duration_limits(self):
        """Test KlingOmni respects duration limits."""
        builder = VideoWorkflowBuilder()
        
        # Test max duration clamping
        workflow = builder.kling_omni(
            cloud_image="test.png",
            prompt="motion",
            duration=15  # Exceeds max
        )
        assert workflow["2"]["inputs"]["duration"] == 10  # Clamped to max
        
        # Test min duration
        workflow = builder.kling_omni(
            cloud_image="test.png",
            prompt="motion",
            duration=1  # Below min
        )
        assert workflow["2"]["inputs"]["duration"] == 5  # Clamped to min
    
    def test_kling_omni_without_audio(self):
        """Test KlingOmni without audio generation."""
        builder = VideoWorkflowBuilder()
        workflow = builder.kling_omni(
            cloud_image="uploaded.png",
            prompt="test motion",
            generate_audio=False
        )
        
        assert workflow["2"]["inputs"]["generate_audio"] == False
    
    def test_runway_workflow(self):
        """Test Runway workflow structure."""
        builder = VideoWorkflowBuilder()
        workflow = builder.runway(
            cloud_image="uploaded.png",
            prompt="camera pan left",
            scene_id=1
        )
        
        assert workflow["1"]["class_type"] == "RunwayImageToVideoNode"
        assert "motion" in workflow["1"]["inputs"]


class TestTTSWorkflowBuilder:
    """Test TTS workflow builders."""
    
    def test_elevenlabs_tts_workflow(self):
        """Test ElevenLabs TTS workflow."""
        builder = TTSWorkflowBuilder()
        workflow = builder.elevenlabs(
            text="Hello world",
            voice_id="voice123",
            scene_id=1
        )
        
        assert workflow["1"]["class_type"] == "ElevenLabsTTSNode"
        assert workflow["1"]["inputs"]["text"] == "Hello world"
        assert workflow["1"]["inputs"]["voice_id"] == "voice123"
    
    def test_tts_with_custom_settings(self):
        """Test TTS with custom voice settings."""
        builder = TTSWorkflowBuilder()
        workflow = builder.elevenlabs(
            text="Test speech",
            voice_id="custom_voice",
            stability=0.5,
            clarity=0.8,
            scene_id=2
        )
        
        assert workflow["1"]["inputs"]["stability"] == 0.5
        assert workflow["1"]["inputs"]["clarity"] == 0.8


class TestPromptBuilders:
    """Test prompt construction helpers."""
    
    def test_build_scene_image_prompt(self):
        """Test image prompt combines scene and characters."""
        scene_visual = "A cat sitting on a counter"
        characters = {
            "cat": "Orange tabby with white paws"
        }
        
        prompt = build_scene_image_prompt(scene_visual, characters)
        assert "cat sitting on a counter" in prompt
        assert "Orange tabby" in prompt
    
    def test_build_scene_image_prompt_multiple_characters(self):
        """Test image prompt with multiple characters."""
        scene_visual = "Two friends at a coffee shop"
        characters = {
            "friend1": "Tall person with glasses",
            "friend2": "Short person with hat"
        }
        
        prompt = build_scene_image_prompt(scene_visual, characters)
        assert "coffee shop" in prompt
        assert "glasses" in prompt
        assert "hat" in prompt
    
    def test_build_scene_image_prompt_no_characters(self):
        """Test image prompt without characters."""
        scene_visual = "A sunset over mountains"
        
        prompt = build_scene_image_prompt(scene_visual, {})
        assert "sunset over mountains" in prompt
    
    def test_build_video_prompt_with_sfx(self):
        """Test video prompt includes SFX."""
        scene = {
            "visual": "Cat jumping",
            "camera": "slow-motion",
            "sfx": ["whoosh sound", "landing thud"],
            "music_cue": "upbeat electronic"
        }
        
        prompt = build_video_prompt(scene, include_sfx=True)
        assert "Cat jumping" in prompt
        assert "slow-motion" in prompt
        assert "whoosh" in prompt
        assert "upbeat electronic" in prompt
    
    def test_build_video_prompt_without_sfx(self):
        """Test video prompt without SFX."""
        scene = {
            "visual": "Person walking",
            "camera": "steady shot",
            "sfx": ["footsteps"]
        }
        
        prompt = build_video_prompt(scene, include_sfx=False)
        assert "Person walking" in prompt
        assert "footsteps" not in prompt


class TestWorkflowTemplate:
    """Test WorkflowTemplate base class."""
    
    def test_template_creation(self):
        """Test creating a workflow template."""
        template = WorkflowTemplate(
            name="test_template",
            nodes={},
            version="1.0"
        )
        
        assert template.name == "test_template"
        assert template.version == "1.0"
    
    def test_template_validation(self):
        """Test template validation."""
        template = WorkflowTemplate(
            name="test",
            nodes={
                "1": {"class_type": "SaveImage", "inputs": {}}
            }
        )
        
        is_valid, errors = template.validate()
        assert is_valid == True
        assert errors == []
    
    def test_template_validation_missing_class_type(self):
        """Test validation catches missing class_type."""
        template = WorkflowTemplate(
            name="test",
            nodes={
                "1": {"inputs": {}}  # Missing class_type
            }
        )
        
        is_valid, errors = template.validate()
        assert is_valid == False
        assert len(errors) > 0


class TestWorkflowBuildersIntegration:
    """Integration tests for workflow builders."""
    
    def test_complete_scene_workflow(self):
        """Test building a complete scene workflow."""
        image_builder = ImageWorkflowBuilder()
        video_builder = VideoWorkflowBuilder()
        
        # Build image workflow
        image_wf = image_builder.gemini2(
            scene_id=1,
            prompt="A scenic mountain view",
            aspect_ratio="16:9"
        )
        
        # Build video workflow referencing image
        video_wf = video_builder.kling_omni(
            cloud_image="mountain_scene.png",
            prompt="Clouds moving across mountains",
            scene_id=1
        )
        
        # Both should have valid node IDs
        assert image_wf
        assert video_wf
        assert len(image_wf) > 0
        assert len(video_wf) > 0
