"""Tests for video assembly module."""
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
import subprocess

from video_assembly import VideoAssembler, FFmpegError, AssemblyConfig


class TestVideoAssembler:
    """Test video assembly operations."""
    
    @pytest.fixture
    def assembler(self, tmp_path):
        """Create test assembler."""
        return VideoAssembler(output_dir=tmp_path)
    
    def test_initialization(self, assembler, tmp_path):
        """Test assembler initialization."""
        assert assembler.output_dir == tmp_path
        assert assembler.ffmpeg == "ffmpeg"
        assert assembler.temp_files == []
    
    def test_initialization_custom_ffmpeg(self, tmp_path):
        """Test assembler with custom ffmpeg path."""
        assembler = VideoAssembler(
            output_dir=tmp_path,
            ffmpeg="/custom/ffmpeg"
        )
        assert assembler.ffmpeg == "/custom/ffmpeg"
    
    def test_create_still_clip_command(self, assembler, tmp_path):
        """Test still clip generation command."""
        image_path = tmp_path / "test.png"
        image_path.write_text("fake")
        
        # Mock subprocess to capture command
        commands = []
        def mock_run(cmd, **kwargs):
            commands.append(cmd)
            class Result:
                returncode = 0
                stderr = ""
            return Result()
        
        with patch("subprocess.run", mock_run):
            result = assembler.create_still_clip(image_path, duration=5.0)
            assert len(commands) == 1
            assert "ffmpeg" in commands[0]
            assert "-loop" in commands[0]
            assert "-t" in commands[0]
            assert "5.0" in commands[0] or 5.0 in commands[0]
    
    def test_create_still_clip_invalid_duration(self, assembler, tmp_path):
        """Test still clip with invalid duration."""
        image_path = tmp_path / "test.png"
        image_path.write_text("fake")
        
        with pytest.raises(ValueError, match="duration must be positive"):
            assembler.create_still_clip(image_path, duration=0)
        
        with pytest.raises(ValueError, match="duration must be positive"):
            assembler.create_still_clip(image_path, duration=-1)
    
    def test_export_format_dimensions(self, assembler):
        """Test aspect ratio to dimensions conversion."""
        dims_9x16 = assembler._get_dimensions("9:16", "1080p")
        assert dims_9x16 == (1080, 1920)
        
        dims_16x9 = assembler._get_dimensions("16:9", "1080p")
        assert dims_16x9 == (1920, 1080)
        
        dims_1x1 = assembler._get_dimensions("1:1", "1080p")
        assert dims_1x1 == (1080, 1080)
    
    def test_export_format_4k(self, assembler):
        """Test 4K dimension calculation."""
        dims_16x9_4k = assembler._get_dimensions("16:9", "4k")
        assert dims_16x9_4k == (3840, 2160)
    
    def test_export_format_720p(self, assembler):
        """Test 720p dimension calculation."""
        dims_9x16_720 = assembler._get_dimensions("9:16", "720p")
        assert dims_9x16_720 == (720, 1280)
    
    def test_invalid_aspect_ratio(self, assembler):
        """Test invalid aspect ratio handling."""
        with pytest.raises(ValueError, match="Unsupported aspect ratio"):
            assembler._get_dimensions("invalid", "1080p")
    
    def test_concatenate_clips_command(self, assembler, tmp_path):
        """Test clip concatenation command generation."""
        clip1 = tmp_path / "clip1.mp4"
        clip2 = tmp_path / "clip2.mp4"
        clip1.write_text("fake1")
        clip2.write_text("fake2")
        
        commands = []
        def mock_run(cmd, **kwargs):
            commands.append(cmd)
            class Result:
                returncode = 0
                stderr = ""
            return Result()
        
        with patch("subprocess.run", mock_run):
            with patch("os.path.exists", return_value=True):
                result = assembler.concatenate_clips([clip1, clip2], "output.mp4")
                assert len(commands) == 1
                assert "concat" in commands[0]
    
    def test_concatenate_empty_clips(self, assembler):
        """Test concatenation with empty clip list."""
        with pytest.raises(ValueError, match="At least one clip required"):
            assembler.concatenate_clips([], "output.mp4")
    
    def test_add_audio_command(self, assembler, tmp_path):
        """Test audio overlay command generation."""
        video_path = tmp_path / "video.mp4"
        audio_path = tmp_path / "audio.mp3"
        video_path.write_text("fake")
        audio_path.write_text("fake")
        
        commands = []
        def mock_run(cmd, **kwargs):
            commands.append(cmd)
            class Result:
                returncode = 0
                stderr = ""
            return Result()
        
        with patch("subprocess.run", mock_run):
            with patch("os.path.exists", return_value=True):
                result = assembler.add_audio(video_path, audio_path, "output.mp4")
                assert len(commands) == 1
                assert "-i" in commands[0]
    
    def test_add_text_overlay(self, assembler, tmp_path):
        """Test text overlay command generation."""
        video_path = tmp_path / "video.mp4"
        video_path.write_text("fake")
        
        commands = []
        def mock_run(cmd, **kwargs):
            commands = [cmd]
            class Result:
                returncode = 0
                stderr = ""
            return Result()
        
        with patch("subprocess.run", mock_run):
            with patch("os.path.exists", return_value=True):
                result = assembler.add_text_overlay(
                    video_path,
                    text="Hello World",
                    output_name="text_video.mp4",
                    position="bottom_center",
                    start_time=0,
                    duration=5.0
                )
                assert len(commands) == 1
                assert "drawtext" in commands[0] or "subtitles" in commands[0]


class TestAssemblyConfig:
    """Test AssemblyConfig dataclass."""
    
    def test_default_config(self):
        """Test default configuration."""
        config = AssemblyConfig()
        assert config.resolution == "1080p"
        assert config.frame_rate == 30
        assert config.video_codec == "libx264"
    
    def test_custom_config(self):
        """Test custom configuration."""
        config = AssemblyConfig(
            resolution="4k",
            frame_rate=60,
            video_codec="libx265"
        )
        assert config.resolution == "4k"
        assert config.frame_rate == 60
        assert config.video_codec == "libx265"


class TestFFmpegError:
    """Test FFmpegError exception."""
    
    def test_error_creation(self):
        """Test error creation."""
        error = FFmpegError("Conversion failed", returncode=1)
        assert str(error) == "Conversion failed"
        assert error.returncode == 1
    
    def test_error_with_stderr(self):
        """Test error with stderr output."""
        error = FFmpegError(
            "Invalid format",
            returncode=1,
            stderr="Unknown encoder 'invalid'"
        )
        assert "Unknown encoder" in error.stderr


class TestVideoAssemblerCleanup:
    """Test cleanup operations."""
    
    def test_cleanup_temp_files(self, tmp_path):
        """Test temporary file cleanup."""
        assembler = VideoAssembler(output_dir=tmp_path)
        
        # Create temp file
        temp_file = tmp_path / "temp_clip.mp4"
        temp_file.write_text("fake")
        assembler.temp_files.append(temp_file)
        
        # Cleanup
        assembler.cleanup()
        
        assert not temp_file.exists()
        assert len(assembler.temp_files) == 0
    
    def test_context_manager(self, tmp_path):
        """Test context manager usage."""
        with VideoAssembler(output_dir=tmp_path) as assembler:
            assert isinstance(assembler, VideoAssembler)
        # Cleanup should be called automatically


# Integration test (optional, requires ffmpeg)
@pytest.mark.integration
class TestVideoAssemblyIntegration:
    """Integration tests requiring actual ffmpeg."""
    
    def test_ffmpeg_available(self):
        """Check ffmpeg is installed."""
        result = subprocess.run(["ffmpeg", "-version"], capture_output=True)
        assert result.returncode == 0
    
    def test_actual_still_clip_creation(self, tmp_path):
        """Test actual still clip creation with ffmpeg."""
        # Create a simple test image
        from PIL import Image
        
        img_path = tmp_path / "test.png"
        img = Image.new('RGB', (100, 100), color='red')
        img.save(img_path)
        
        assembler = VideoAssembler(output_dir=tmp_path)
        output_path = assembler.create_still_clip(img_path, duration=1.0)
        
        assert output_path.exists()
        # Check it's a valid video file
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", 
             "-of", "default=noprint_wrappers=1", str(output_path)],
            capture_output=True,
            text=True
        )
        assert result.returncode == 0
