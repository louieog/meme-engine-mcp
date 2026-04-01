#!/usr/bin/env python3
"""
Video Assembly Module

A reusable Python module for assembling meme videos from scene assets using ffmpeg.
Handles still image to video conversion, text overlays, audio mixing, scene concatenation,
aspect ratio exports, thumbnail generation, and more.

Example:
    >>> from pathlib import Path
    >>> from video_assembly import VideoAssembler, AssemblyPipeline
    >>> 
    >>> assembler = VideoAssembler(output_dir=Path("./output"))
    >>> pipeline = AssemblyPipeline(assembler, brief_path=Path("./brief.json"))
    >>> 
    >>> # Assemble scenes and export
    >>> scene_assets = {
    ...     1: {"video": Path("scene1.mp4"), "image": Path("scene1.png")},
    ...     2: {"video": Path("scene2.mp4"), "image": Path("scene2.png")},
    ... }
    >>> results = pipeline.run_full_assembly(scene_assets, Path("./output"))
    >>> print(f"Exported: {results['9x16']}, {results['16x9']}")
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

# Configure logging
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Error Classes
# ─────────────────────────────────────────────────────────────────────────────

class FFmpegError(Exception):
    """Raised when ffmpeg command fails."""
    
    def __init__(self, message: str, command: Optional[str] = None, stderr: Optional[str] = None):
        super().__init__(message)
        self.command = command
        self.stderr = stderr


# ─────────────────────────────────────────────────────────────────────────────
# Utility Functions
# ─────────────────────────────────────────────────────────────────────────────

def find_system_font() -> Optional[str]:
    """Find available system font for ffmpeg drawtext filter.
    
    Checks common paths in order of preference:
    - macOS: /System/Library/Fonts/, /Library/Fonts/
    - Linux: /usr/share/fonts/
    
    Returns:
        Path to font file if found, None otherwise.
    """
    font_paths = [
        # macOS system fonts
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        # Linux system fonts
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
        # Additional common paths
        "/usr/share/fonts/TTF/DejaVuSans.ttf",
        "/usr/local/share/fonts/DejaVuSans.ttf",
    ]
    
    for font_path in font_paths:
        if os.path.exists(font_path):
            logger.debug(f"Found system font: {font_path}")
            return font_path
    
    logger.warning("No system font found for drawtext filter")
    return None


def escape_text_for_ffmpeg(text: str) -> str:
    """Escape special characters for ffmpeg drawtext filter.
    
    Args:
        text: Raw text string.
        
    Returns:
        Escaped text safe for ffmpeg drawtext.
    """
    # Escape backslashes first
    text = text.replace("\\", "\\\\")
    # Escape single quotes (ffmpeg uses single quotes to wrap text)
    text = text.replace("'", "'\\''")
    # Escape special characters in drawtext
    text = text.replace(":", "\\:")
    text = text.replace("%", "\\%")
    return text


def create_concat_list(scene_paths: List[Path]) -> Path:
    """Create temporary concat list file for ffmpeg.
    
    Args:
        scene_paths: List of video file paths to concatenate.
        
    Returns:
        Path to the temporary concat list file.
    """
    concat_file = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False)
    for scene_path in scene_paths:
        # Use absolute paths and escape single quotes
        escaped_path = str(scene_path.absolute()).replace("'", "'\\''")
        concat_file.write(f"file '{escaped_path}'\n")
    concat_file.close()
    return Path(concat_file.name)


def parse_position(
    position: Tuple[Union[int, str], Union[int, str]],
    text_width: str = "text_w",
    text_height: str = "text_h"
) -> Tuple[str, str]:
    """Parse position tuple into ffmpeg drawtext x,y expressions.
    
    Args:
        position: Tuple of (x, y) where each can be:
            - int: absolute pixel coordinate
            - str: expression like "center", "bottom-100", "top+50"
        text_width: Expression for text width (default: "text_w")
        text_height: Expression for text height (default: "text_h")
        
    Returns:
        Tuple of (x_expression, y_expression) for ffmpeg.
        
    Examples:
        >>> parse_position(("center", "bottom-100"))
        ('(w-text_w)/2', 'h-text_h-100')
        >>> parse_position((100, 200))
        ('100', '200')
    """
    x_expr = _parse_axis(position[0], "w", text_width, text_height)
    y_expr = _parse_axis(position[1], "h", text_width, text_height)
    return x_expr, y_expr


def _parse_axis(
    value: Union[int, str],
    dim: str,
    text_width: str,
    text_height: str
) -> str:
    """Parse a single axis position value."""
    if isinstance(value, int):
        return str(value)
    
    value = value.lower().strip()
    
    if value == "center":
        return f"({dim}-{text_width})/2"
    elif value == "left":
        return "0"
    elif value == "right":
        return f"{dim}-{text_width}"
    elif value == "top":
        return "0"
    elif value == "bottom":
        return f"{dim}-{text_height}"
    elif value.startswith("center-"):
        offset = int(value[7:])
        return f"({dim}-{text_width})/2-{offset}"
    elif value.startswith("center+"):
        offset = int(value[7:])
        return f"({dim}-{text_width})/2+{offset}"
    elif value.startswith("bottom-"):
        offset = int(value[7:])
        return f"{dim}-{text_height}-{offset}"
    elif value.startswith("bottom+"):
        offset = int(value[7:])
        return f"{dim}-{text_height}+{offset}"
    elif value.startswith("top-"):
        offset = int(value[4:])
        return f"-{offset}"
    elif value.startswith("top+"):
        offset = int(value[4:])
        return str(offset)
    elif value.startswith("left-"):
        offset = int(value[5:])
        return f"-{offset}"
    elif value.startswith("left+"):
        offset = int(value[5:])
        return str(offset)
    elif value.startswith("right-"):
        offset = int(value[6:])
        return f"{dim}-{text_width}-{offset}"
    elif value.startswith("right+"):
        offset = int(value[6:])
        return f"{dim}-{text_width}+{offset}"
    else:
        return value


def get_resolution_dimensions(resolution: str, aspect_ratio: str) -> Tuple[int, int]:
    """Get width and height for given resolution and aspect ratio.
    
    Args:
        resolution: Resolution string (e.g., "1080p", "720p", "4k")
        aspect_ratio: Aspect ratio string (e.g., "9:16", "16:9", "1:1")
        
    Returns:
        Tuple of (width, height).
    """
    # Base heights for common resolutions
    heights = {
        "480p": 480,
        "720p": 720,
        "1080p": 1080,
        "1440p": 1440,
        "2k": 1440,
        "4k": 2160,
        "2160p": 2160,
    }
    
    height = heights.get(resolution.lower(), 1080)
    
    # Parse aspect ratio
    if ":" in aspect_ratio:
        w_ratio, h_ratio = aspect_ratio.split(":")
        ar_width = int(w_ratio)
        ar_height = int(h_ratio)
    else:
        ar_width, ar_height = 9, 16
    
    # Calculate width maintaining aspect ratio
    if aspect_ratio == "9:16":
        width = int(height * 9 / 16)
        # Ensure dimensions are even (required for some codecs)
        width = width if width % 2 == 0 else width + 1
        return (width, height)
    elif aspect_ratio == "16:9":
        width = int(height * 16 / 9)
        width = width if width % 2 == 0 else width + 1
        return (width, height)
    elif aspect_ratio == "1:1":
        return (height, height)
    else:
        width = int(height * ar_width / ar_height)
        width = width if width % 2 == 0 else width + 1
        return (width, height)


# ─────────────────────────────────────────────────────────────────────────────
# Video Assembler Class
# ─────────────────────────────────────────────────────────────────────────────

class VideoAssembler:
    """Assemble meme videos from scene assets using ffmpeg."""
    
    def __init__(self, output_dir: Path, ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe"):
        """Initialize the VideoAssembler.
        
        Args:
            output_dir: Directory for output files.
            ffmpeg_path: Path to ffmpeg executable (default: "ffmpeg").
            ffprobe_path: Path to ffprobe executable (default: "ffprobe").
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ffmpeg = ffmpeg_path
        self.ffprobe = ffprobe_path
        self.temp_files: List[Path] = []
        self._font_path: Optional[str] = None
    
    def _get_font_path(self) -> Optional[str]:
        """Lazy load and cache font path."""
        if self._font_path is None:
            self._font_path = find_system_font()
        return self._font_path
    
    def _run_ffmpeg(
        self,
        args: List[str],
        check: bool = True,
        capture_output: bool = True
    ) -> subprocess.CompletedProcess:
        """Run ffmpeg command with given arguments.
        
        Args:
            args: List of ffmpeg arguments.
            check: Whether to raise exception on non-zero exit.
            capture_output: Whether to capture stdout/stderr.
            
        Returns:
            CompletedProcess instance.
            
        Raises:
            FFmpegError: If ffmpeg command fails.
        """
        cmd = [self.ffmpeg] + args
        cmd_str = " ".join(cmd)
        logger.debug(f"Running: {cmd_str}")
        
        try:
            result = subprocess.run(
                cmd,
                check=check,
                capture_output=capture_output,
                text=True
            )
            return result
        except subprocess.CalledProcessError as e:
            error_msg = f"FFmpeg command failed: {e}"
            logger.error(error_msg)
            logger.error(f"stderr: {e.stderr}")
            raise FFmpegError(error_msg, command=cmd_str, stderr=e.stderr)
    
    def _run_ffprobe(
        self,
        args: List[str],
        check: bool = True,
        capture_output: bool = True
    ) -> subprocess.CompletedProcess:
        """Run ffprobe command with given arguments."""
        cmd = [self.ffprobe] + args
        cmd_str = " ".join(cmd)
        logger.debug(f"Running: {cmd_str}")
        
        try:
            result = subprocess.run(
                cmd,
                check=check,
                capture_output=capture_output,
                text=True
            )
            return result
        except subprocess.CalledProcessError as e:
            error_msg = f"FFprobe command failed: {e}"
            logger.error(error_msg)
            raise FFmpegError(error_msg, command=cmd_str, stderr=e.stderr)
    
    def create_still_clip(
        self,
        image_path: Path,
        duration: float,
        output_path: Optional[Path] = None,
        resolution: str = "1080p"
    ) -> Path:
        """Create video clip from still image.
        
        Uses ffmpeg to convert a static image into a video clip of specified
        duration using libx264 codec with yuv420p pixel format for compatibility.
        
        Args:
            image_path: Path to input image file.
            duration: Duration of output video in seconds.
            output_path: Optional output path (default: auto-generated in output_dir).
            resolution: Output resolution (default: "1080p").
            
        Returns:
            Path to output video file.
            
        Example:
            >>> assembler = VideoAssembler(Path("./output"))
            >>> clip = assembler.create_still_clip(Path("photo.jpg"), duration=5.0)
        """
        image_path = Path(image_path)
        
        if output_path is None:
            output_path = self.output_dir / f"{image_path.stem}_still.mp4"
        else:
            output_path = Path(output_path)
        
        width, height = get_resolution_dimensions(resolution, "9:16")
        
        args = [
            "-y",  # Overwrite output
            "-loop", "1",
            "-i", str(image_path),
            "-c:v", "libx264",
            "-t", str(duration),
            "-pix_fmt", "yuv420p",
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black",
            "-preset", "fast",
            "-crf", "18",
            str(output_path)
        ]
        
        self._run_ffmpeg(args)
        logger.info(f"Created still clip: {output_path}")
        return output_path
    
    def add_text_overlay(
        self,
        video_path: Path,
        text: str,
        position: Tuple[Union[int, str], Union[int, str]] = ("center", "bottom-100"),
        font_size: int = 72,
        font_color: str = "white",
        border_width: int = 3,
        border_color: str = "black",
        font_file: Optional[str] = None,
        output_path: Optional[Path] = None,
        enable_expr: Optional[str] = None,
        line_spacing: int = 10,
        box: bool = False,
        box_color: str = "black@0.5",
        box_border_radius: int = 0,
        shadow_x: int = 2,
        shadow_y: int = 2,
        shadow_color: str = "black@0.5"
    ) -> Path:
        """Add text overlay to video.
        
        Args:
            video_path: Path to input video.
            text: Text to overlay (supports newlines with \\n).
            position: Tuple of (x, y) position. Can use:
                - "center", "top", "bottom", "left", "right"
                - "center-100", "bottom+50" for offsets
                - Absolute pixel values (int)
            font_size: Font size in pixels.
            font_color: Font color name or hex.
            border_width: Width of text border/outline.
            border_color: Color of text border.
            font_file: Path to font file (auto-detected if None).
            output_path: Optional output path.
            enable_expr: FFmpeg expression for when to show text (e.g., "between(t,1,3)").
            line_spacing: Line spacing for multiline text.
            box: Whether to draw a background box.
            box_color: Box color (supports alpha with @).
            box_border_radius: Border radius for box.
            shadow_x: Shadow X offset.
            shadow_y: Shadow Y offset.
            shadow_color: Shadow color with alpha.
            
        Returns:
            Path to output video file.
        """
        video_path = Path(video_path)
        
        if output_path is None:
            output_path = self.output_dir / f"{video_path.stem}_text.mp4"
        else:
            output_path = Path(output_path)
        
        # Get font path
        if font_file is None:
            font_file = self._get_font_path()
        
        # Parse position
        x_expr, y_expr = parse_position(position)
        
        # Escape text for ffmpeg
        escaped_text = escape_text_for_ffmpeg(text)
        
        # Build drawtext filter
        drawtext_opts = [
            f"text='{escaped_text}'",
            f"fontsize={font_size}",
            f"fontcolor={font_color}",
            f"borderw={border_width}",
            f"bordercolor={border_color}",
            f"x={x_expr}",
            f"y={y_expr}",
            f"line_spacing={line_spacing}",
        ]
        
        if font_file:
            drawtext_opts.append(f"fontfile={font_file}")
        
        if box:
            drawtext_opts.append(f"box=1")
            drawtext_opts.append(f"boxcolor={box_color}")
            if box_border_radius > 0:
                drawtext_opts.append(f"boxborderw={box_border_radius}")
        
        if shadow_x != 0 or shadow_y != 0:
            drawtext_opts.append(f"shadowx={shadow_x}")
            drawtext_opts.append(f"shadowy={shadow_y}")
            drawtext_opts.append(f"shadowcolor={shadow_color}")
        
        if enable_expr:
            drawtext_opts.append(f"enable={enable_expr}")
        
        vf_filter = f"drawtext={':'.join(drawtext_opts)}"
        
        args = [
            "-y",
            "-i", str(video_path),
            "-vf", vf_filter,
            "-c:a", "copy",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            str(output_path)
        ]
        
        self._run_ffmpeg(args)
        logger.info(f"Added text overlay: {output_path}")
        return output_path
    
    def add_multiple_text_overlays(
        self,
        video_path: Path,
        overlays: List[Dict[str, Any]],
        output_path: Optional[Path] = None
    ) -> Path:
        """Add multiple text overlays to a video in a single pass.
        
        Args:
            video_path: Path to input video.
            overlays: List of overlay dictionaries with keys matching add_text_overlay params.
            output_path: Optional output path.
            
        Returns:
            Path to output video file.
        """
        video_path = Path(video_path)
        
        if output_path is None:
            output_path = self.output_dir / f"{video_path.stem}_overlays.mp4"
        else:
            output_path = Path(output_path)
        
        # Build multiple drawtext filters
        vf_filters = []
        
        for overlay in overlays:
            text = overlay.get("text", "")
            position = overlay.get("position", ("center", "bottom-100"))
            font_size = overlay.get("font_size", 72)
            font_color = overlay.get("font_color", "white")
            border_width = overlay.get("border_width", 3)
            border_color = overlay.get("border_color", "black")
            font_file = overlay.get("font_file", self._get_font_path())
            enable_expr = overlay.get("enable_expr")
            line_spacing = overlay.get("line_spacing", 10)
            box = overlay.get("box", False)
            box_color = overlay.get("box_color", "black@0.5")
            box_border_radius = overlay.get("box_border_radius", 0)
            
            x_expr, y_expr = parse_position(position)
            escaped_text = escape_text_for_ffmpeg(text)
            
            opts = [
                f"text='{escaped_text}'",
                f"fontsize={font_size}",
                f"fontcolor={font_color}",
                f"borderw={border_width}",
                f"bordercolor={border_color}",
                f"x={x_expr}",
                f"y={y_expr}",
                f"line_spacing={line_spacing}",
            ]
            
            if font_file:
                opts.append(f"fontfile={font_file}")
            if box:
                opts.append(f"box=1")
                opts.append(f"boxcolor={box_color}")
                if box_border_radius > 0:
                    opts.append(f"boxborderw={box_border_radius}")
            if enable_expr:
                opts.append(f"enable={enable_expr}")
            
            vf_filters.append(f"drawtext={':'.join(opts)}")
        
        # Combine filters
        vf_chain = ",".join(vf_filters)
        
        args = [
            "-y",
            "-i", str(video_path),
            "-vf", vf_chain,
            "-c:a", "copy",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            str(output_path)
        ]
        
        self._run_ffmpeg(args)
        logger.info(f"Added multiple text overlays: {output_path}")
        return output_path
    
    def mix_audio(
        self,
        video_path: Path,
        audio_path: Path,
        audio_volume: float = 1.0,
        video_volume: float = 1.0,
        output_path: Optional[Path] = None,
        duration: str = "first"  # "first", "longest", or "shortest"
    ) -> Path:
        """Mix external audio with video's audio.
        
        Args:
            video_path: Path to input video.
            audio_path: Path to external audio file.
            audio_volume: Volume multiplier for external audio (0.0 to 2.0).
            video_volume: Volume multiplier for video audio (0.0 to 2.0).
            output_path: Optional output path.
            duration: Duration handling - "first", "longest", or "shortest".
            
        Returns:
            Path to output video file.
        """
        video_path = Path(video_path)
        audio_path = Path(audio_path)
        
        if output_path is None:
            output_path = self.output_dir / f"{video_path.stem}_mixed.mp4"
        else:
            output_path = Path(output_path)
        
        # Build filter complex for audio mixing
        filter_complex = (
            f"[0:a]volume={video_volume}[a0];"
            f"[1:a]volume={audio_volume}[a1];"
            f"[a0][a1]amix=inputs=2:duration={duration}:dropout_transition=2[aout]"
        )
        
        args = [
            "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-filter_complex", filter_complex,
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            str(output_path)
        ]
        
        self._run_ffmpeg(args)
        logger.info(f"Mixed audio: {output_path}")
        return output_path
    
    def replace_audio(
        self,
        video_path: Path,
        audio_path: Path,
        output_path: Optional[Path] = None,
        loop_audio: bool = False
    ) -> Path:
        """Replace video's audio with external audio file.
        
        Args:
            video_path: Path to input video.
            audio_path: Path to external audio file.
            output_path: Optional output path.
            loop_audio: Whether to loop audio to match video duration.
            
        Returns:
            Path to output video file.
        """
        video_path = Path(video_path)
        audio_path = Path(audio_path)
        
        if output_path is None:
            output_path = self.output_dir / f"{video_path.stem}_newaudio.mp4"
        else:
            output_path = Path(output_path)
        
        args = [
            "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-map", "0:v",
            "-map", "1:a",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
        ]
        
        if loop_audio:
            args.insert(-1, "-stream_loop")
            args.insert(-1, "-1")
        
        args.append(str(output_path))
        
        self._run_ffmpeg(args)
        logger.info(f"Replaced audio: {output_path}")
        return output_path
    
    def concatenate_scenes(
        self,
        scene_paths: List[Path],
        output_path: Path,
        transition: Optional[str] = None,
        reencode: bool = False
    ) -> Path:
        """Concatenate multiple scene clips.
        
        Args:
            scene_paths: List of video file paths to concatenate.
            output_path: Path for output video.
            transition: Optional transition type ("fade", "crossfade" - requires reencode).
            reencode: Whether to re-encode (required for different formats/codecs).
            
        Returns:
            Path to output video file.
        """
        if not scene_paths:
            raise ValueError("scene_paths cannot be empty")
        
        output_path = Path(output_path)
        
        # Create concat list file
        concat_list = create_concat_list(scene_paths)
        self.temp_files.append(concat_list)
        
        if transition or reencode:
            # Re-encode for transitions or format compatibility
            args = [
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_list),
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "18",
                "-c:a", "aac",
                "-b:a", "192k",
                str(output_path)
            ]
        else:
            # Stream copy for faster concatenation (same format required)
            args = [
                "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_list),
                "-c", "copy",
                str(output_path)
            ]
        
        self._run_ffmpeg(args)
        logger.info(f"Concatenated {len(scene_paths)} scenes: {output_path}")
        return output_path
    
    def export_format(
        self,
        video_path: Path,
        aspect_ratio: str,  # "9:16", "16:9", "1:1", "4:5", etc.
        output_path: Path,
        resolution: str = "1080p",
        quality: int = 23,  # CRF value (lower = higher quality)
        pad_mode: str = "black",  # "black", "blur", or "color"
        pad_color: str = "black",
        audio_bitrate: str = "192k"
    ) -> Path:
        """Export video in specific aspect ratio.
        
        Args:
            video_path: Path to input video.
            aspect_ratio: Target aspect ratio ("9:16", "16:9", "1:1", etc.).
            output_path: Path for output video.
            resolution: Output resolution.
            quality: CRF quality value (18-28 range, lower is better).
            pad_mode: How to handle aspect ratio mismatch ("black", "blur", "color").
            pad_color: Color for padding when pad_mode is "color".
            audio_bitrate: Audio bitrate for output.
            
        Returns:
            Path to output video file.
        """
        video_path = Path(video_path)
        output_path = Path(output_path)
        
        width, height = get_resolution_dimensions(resolution, aspect_ratio)
        
        if pad_mode == "blur":
            # Create blurred background with sharp center video
            filter_complex = (
                f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                f"boxblur=30:10[bg];"
                f"[0:v]scale=-2:{height}[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2[out]"
            )
            
            args = [
                "-y",
                "-i", str(video_path),
                "-filter_complex", filter_complex,
                "-map", "[out]",
                "-map", "0:a",
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", str(quality),
                "-c:a", "aac",
                "-b:a", audio_bitrate,
                str(output_path)
            ]
        elif pad_mode == "color":
            # Scale to fit with colored padding
            vf = (
                f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:{pad_color}"
            )
            
            args = [
                "-y",
                "-i", str(video_path),
                "-vf", vf,
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", str(quality),
                "-c:a", "aac",
                "-b:a", audio_bitrate,
                str(output_path)
            ]
        else:  # black
            # Scale to fit with black padding (default)
            vf = (
                f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
            )
            
            args = [
                "-y",
                "-i", str(video_path),
                "-vf", vf,
                "-c:v", "libx264",
                "-preset", "medium",
                "-crf", str(quality),
                "-c:a", "aac",
                "-b:a", audio_bitrate,
                str(output_path)
            ]
        
        self._run_ffmpeg(args)
        logger.info(f"Exported {aspect_ratio} format: {output_path}")
        return output_path
    
    def generate_thumbnail(
        self,
        video_path: Path,
        timestamp: float,  # seconds
        output_path: Path,
        width: Optional[int] = None,
        height: Optional[int] = None,
        quality: int = 2  # JPEG quality (1-31, lower is better)
    ) -> Path:
        """Extract frame at timestamp as thumbnail.
        
        Args:
            video_path: Path to input video.
            timestamp: Time in seconds to extract frame.
            output_path: Path for output image.
            width: Optional output width (scales proportionally if height not set).
            height: Optional output height.
            quality: JPEG quality (1-31, lower is better quality).
            
        Returns:
            Path to output thumbnail file.
        """
        video_path = Path(video_path)
        output_path = Path(output_path)
        
        # Ensure output directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        vf_filters = []
        if width or height:
            w = width if width else -1
            h = height if height else -1
            vf_filters.append(f"scale={w}:{h}")
        
        args = [
            "-y",
            "-ss", str(timestamp),
            "-i", str(video_path),
            "-frames:v", "1",
            "-q:v", str(quality),
        ]
        
        if vf_filters:
            args.extend(["-vf", ",".join(vf_filters)])
        
        args.append(str(output_path))
        
        self._run_ffmpeg(args)
        logger.info(f"Generated thumbnail at {timestamp}s: {output_path}")
        return output_path
    
    def generate_thumbnail_with_overlay(
        self,
        video_path: Path,
        timestamp: float,
        output_path: Path,
        overlays: List[Dict[str, Any]],
        width: Optional[int] = None,
        height: Optional[int] = None,
        pad_mode: str = "blur",
        target_aspect: Optional[str] = None
    ) -> Path:
        """Generate thumbnail with text overlays.
        
        Args:
            video_path: Path to input video.
            timestamp: Time in seconds to extract frame.
            output_path: Path for output image.
            overlays: List of text overlay dictionaries.
            width: Output width.
            height: Output height.
            pad_mode: "blur" for blurred background, "black" for black bars.
            target_aspect: Target aspect ratio for padding (e.g., "16:9").
            
        Returns:
            Path to output thumbnail file.
        """
        video_path = Path(video_path)
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Set default dimensions
        if width is None:
            width = 1080
        if height is None:
            height = 1920 if target_aspect == "9:16" else 1080
        
        # Build video filters
        vf_filters = []
        
        # Handle aspect ratio padding
        if target_aspect:
            if pad_mode == "blur":
                # Complex filter for blurred background
                filter_complex = (
                    f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                    f"boxblur=30:10[bg];"
                    f"[0:v]scale=-2:{height}[fg];"
                    f"[bg][fg]overlay=(W-w)/2:(H-h)/2[base]"
                )
                
                # Add drawtext filters after overlay
                for i, overlay in enumerate(overlays):
                    text = overlay.get("text", "")
                    position = overlay.get("position", ("center", "bottom-100"))
                    font_size = overlay.get("font_size", 72)
                    font_color = overlay.get("font_color", "white")
                    border_width = overlay.get("border_width", 3)
                    border_color = overlay.get("border_color", "black")
                    font_file = overlay.get("font_file", self._get_font_path())
                    
                    x_expr, y_expr = parse_position(position)
                    escaped_text = escape_text_for_ffmpeg(text)
                    
                    opts = [
                        f"text='{escaped_text}'",
                        f"fontsize={font_size}",
                        f"fontcolor={font_color}",
                        f"borderw={border_width}",
                        f"bordercolor={border_color}",
                        f"x={x_expr}",
                        f"y={y_expr}",
                    ]
                    
                    if font_file:
                        opts.append(f"fontfile={font_file}")
                    
                    if i == 0:
                        filter_complex += f";[base]drawtext={':'.join(opts)}[v1]"
                    else:
                        filter_complex += f";[v{i}]drawtext={':'.join(opts)}[v{i+1}]"
                
                # Final output mapping
                if overlays:
                    filter_complex += f";[v{len(overlays)}]"
                else:
                    filter_complex += ";[base]"
                
                args = [
                    "-y",
                    "-ss", str(timestamp),
                    "-i", str(video_path),
                    "-filter_complex", filter_complex,
                    "-frames:v", "1",
                    "-q:v", "2",
                    str(output_path)
                ]
                
                self._run_ffmpeg(args)
                logger.info(f"Generated thumbnail with overlay (blur bg): {output_path}")
                return output_path
            else:
                # Simple padding
                vf_filters.append(
                    f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
                )
        
        # Add drawtext overlays
        for overlay in overlays:
            text = overlay.get("text", "")
            position = overlay.get("position", ("center", "bottom-100"))
            font_size = overlay.get("font_size", 72)
            font_color = overlay.get("font_color", "white")
            border_width = overlay.get("border_width", 3)
            border_color = overlay.get("border_color", "black")
            font_file = overlay.get("font_file", self._get_font_path())
            
            x_expr, y_expr = parse_position(position)
            escaped_text = escape_text_for_ffmpeg(text)
            
            opts = [
                f"text='{escaped_text}'",
                f"fontsize={font_size}",
                f"fontcolor={font_color}",
                f"borderw={border_width}",
                f"bordercolor={border_color}",
                f"x={x_expr}",
                f"y={y_expr}",
            ]
            
            if font_file:
                opts.append(f"fontfile={font_file}")
            
            vf_filters.append(f"drawtext={':'.join(opts)}")
        
        args = [
            "-y",
            "-ss", str(timestamp),
            "-i", str(video_path),
            "-frames:v", "1",
            "-q:v", "2",
        ]
        
        if vf_filters:
            args.extend(["-vf", ",".join(vf_filters)])
        
        args.append(str(output_path))
        
        self._run_ffmpeg(args)
        logger.info(f"Generated thumbnail with overlays: {output_path}")
        return output_path
    
    def freeze_frame(
        self,
        video_path: Path,
        freeze_at: float,  # timestamp to freeze
        freeze_duration: float,
        output_path: Path,
        fade_duration: float = 0.0
    ) -> Path:
        """Freeze frame at specific timestamp (for CTA extension).
        
        Args:
            video_path: Path to input video.
            freeze_at: Timestamp in seconds to freeze.
            freeze_duration: Duration of freeze in seconds.
            output_path: Path for output video.
            fade_duration: Optional fade in/out duration for smooth transition.
            
        Returns:
            Path to output video file.
        """
        video_path = Path(video_path)
        output_path = Path(output_path)
        
        # Use trim and loop filters to freeze frame
        # This creates: [first part] + [frozen frame loop] + [rest if any]
        
        args = [
            "-y",
            "-i", str(video_path),
            "-vf", (
                f"trim=0:{freeze_at},setpts=PTS-STARTPTS[begin];"
                f"[0:v]trim={freeze_at}:{freeze_at + 0.04},setpts=PTS-STARTPTS[freeze];"
                f"[freeze]loop=loop={int(freeze_duration * 25)}:size=1:start=0[extended];"
                f"[begin][extended]concat=n=2:v=1:a=0[outv]"
            ),
            "-map", "[outv]",
            "-map", "0:a",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "18",
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", str(self.get_duration(video_path) + freeze_duration - 0.04),
            str(output_path)
        ]
        
        self._run_ffmpeg(args)
        logger.info(f"Created freeze frame at {freeze_at}s for {freeze_duration}s: {output_path}")
        return output_path
    
    def get_duration(self, video_path: Path) -> float:
        """Get video duration in seconds using ffprobe.
        
        Args:
            video_path: Path to video file.
            
        Returns:
            Duration in seconds as float.
        """
        video_path = Path(video_path)
        
        args = [
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        
        result = self._run_ffprobe(args)
        duration_str = result.stdout.strip()
        
        try:
            return float(duration_str)
        except ValueError:
            raise FFmpegError(f"Could not parse duration from ffprobe output: {duration_str}")
    
    def get_video_info(self, video_path: Path) -> Dict[str, Any]:
        """Get comprehensive video information using ffprobe.
        
        Args:
            video_path: Path to video file.
            
        Returns:
            Dictionary with video metadata.
        """
        video_path = Path(video_path)
        
        args = [
            "-v", "error",
            "-show_format",
            "-show_streams",
            "-of", "json",
            str(video_path)
        ]
        
        result = self._run_ffprobe(args)
        
        try:
            info = json.loads(result.stdout)
            return info
        except json.JSONDecodeError as e:
            raise FFmpegError(f"Could not parse ffprobe JSON output: {e}")
    
    def cleanup(self):
        """Remove all temporary files created during processing."""
        for temp_file in self.temp_files:
            try:
                if temp_file.exists():
                    temp_file.unlink()
                    logger.debug(f"Cleaned up temp file: {temp_file}")
            except Exception as e:
                logger.warning(f"Could not remove temp file {temp_file}: {e}")
        
        self.temp_files.clear()
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - cleanup temp files."""
        self.cleanup()


# ─────────────────────────────────────────────────────────────────────────────
# Assembly Pipeline Class
# ─────────────────────────────────────────────────────────────────────────────

class AssemblyPipeline:
    """High-level pipeline for assembling full meme videos."""
    
    def __init__(self, assembler: VideoAssembler, brief_path: Path):
        """Initialize the pipeline.
        
        Args:
            assembler: VideoAssembler instance.
            brief_path: Path to brief JSON file.
        """
        self.assembler = assembler
        self.brief_path = Path(brief_path)
        self.brief = self._load_brief(brief_path)
    
    def _load_brief(self, brief_path: Path) -> Dict[str, Any]:
        """Load brief JSON file."""
        with open(brief_path, "r") as f:
            return json.load(f)
    
    def assemble_scenes(
        self,
        scene_assets: Dict[int, Dict[str, Path]],
        output_dir: Path,
        add_overlays: bool = True
    ) -> List[Path]:
        """Process each scene: select best clip, add text, mix audio.
        
        Args:
            scene_assets: Dict mapping scene_id to asset dict with keys like:
                - "video": Path to video file
                - "image": Path to image file
                - "audio": Path to external audio
            output_dir: Directory for processed scene files.
            add_overlays: Whether to add text overlays from brief.
            
        Returns:
            List of processed scene video paths in order.
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        processed_scenes: List[Path] = []
        scene_briefs = {s["scene_id"]: s for s in self.brief.get("pipeline_log", {}).get("stages", {}).get("video", {}).get("per_scene", [])}
        
        for scene_id in sorted(scene_assets.keys()):
            assets = scene_assets[scene_id]
            scene_output = output_dir / f"scene{scene_id}_processed.mp4"
            
            # Start with video or create from image
            if "video" in assets and assets["video"].exists():
                current_video = assets["video"]
            elif "image" in assets and assets["image"].exists():
                duration = scene_briefs.get(scene_id, {}).get("parameters", {}).get("duration", 3)
                current_video = self.assembler.create_still_clip(
                    assets["image"],
                    duration=duration,
                    output_path=output_dir / f"scene{scene_id}_from_image.mp4"
                )
                self.assembler.temp_files.append(current_video)
            else:
                logger.warning(f"No video or image asset for scene {scene_id}")
                continue
            
            # Add text overlays if specified in brief
            if add_overlays and scene_id in scene_briefs:
                text_overlay = scene_briefs[scene_id].get("text_overlay", "")
                if text_overlay:
                    current_video = self.assembler.add_text_overlay(
                        current_video,
                        text=text_overlay,
                        output_path=output_dir / f"scene{scene_id}_with_text.mp4"
                    )
            
            # Mix audio if external audio provided
            if "audio" in assets and assets["audio"].exists():
                current_video = self.assembler.mix_audio(
                    current_video,
                    assets["audio"],
                    output_path=output_dir / f"scene{scene_id}_with_audio.mp4"
                )
            
            # Copy to final scene output
            if current_video != scene_output:
                import shutil
                shutil.copy2(current_video, scene_output)
            
            processed_scenes.append(scene_output)
        
        return processed_scenes
    
    def export_final_videos(
        self,
        concatenated_path: Path,
        output_dir: Path,
        slug: str
    ) -> Dict[str, Path]:
        """Export both 9:16 and 16:9 versions.
        
        Args:
            concatenated_path: Path to concatenated video.
            output_dir: Directory for output files.
            slug: Base filename slug.
            
        Returns:
            Dictionary mapping format name to output path.
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        outputs = {}
        
        # Export 9:16 (vertical)
        output_9x16 = output_dir / f"{slug}-9x16.mp4"
        self.assembler.export_format(
            concatenated_path,
            aspect_ratio="9:16",
            output_path=output_9x16,
            resolution="1080p",
            pad_mode="black"
        )
        outputs["9x16"] = output_9x16
        
        # Export 16:9 (horizontal with blurred background)
        output_16x9 = output_dir / f"{slug}-16x9.mp4"
        self.assembler.export_format(
            concatenated_path,
            aspect_ratio="16:9",
            output_path=output_16x9,
            resolution="1080p",
            pad_mode="blur"
        )
        outputs["16x9"] = output_16x9
        
        return outputs
    
    def generate_thumbnails(
        self,
        video_path: Path,
        output_dir: Path,
        slug: str,
        timestamp: float = 1.5
    ) -> Dict[str, Path]:
        """Generate thumbnails for both aspect ratios.
        
        Args:
            video_path: Path to source video (typically scene 3 for final frame).
            output_dir: Directory for thumbnails.
            slug: Base filename slug.
            timestamp: Time in seconds to extract frame.
            
        Returns:
            Dictionary mapping format to thumbnail path.
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        thumbnails = {}
        
        # Generate 9:16 thumbnail
        thumb_9x16 = output_dir / f"{slug}-thumb.jpg"
        self.assembler.generate_thumbnail(
            video_path,
            timestamp=timestamp,
            output_path=thumb_9x16,
            width=1080,
            height=1920
        )
        thumbnails["9x16"] = thumb_9x16
        
        # Generate 16:9 thumbnail
        thumb_16x9 = output_dir / f"{slug}-thumb-16x9.jpg"
        self.assembler.generate_thumbnail_with_overlay(
            video_path,
            timestamp=timestamp,
            output_path=thumb_16x9,
            overlays=[],
            width=1920,
            height=1080,
            pad_mode="blur",
            target_aspect="16:9"
        )
        thumbnails["16x9"] = thumb_16x9
        
        return thumbnails
    
    def run_full_assembly(
        self,
        scene_assets: Dict[int, Dict[str, Path]],
        output_dir: Path,
        generate_thumbs: bool = True
    ) -> Dict[str, Any]:
        """Run complete assembly pipeline.
        
        Args:
            scene_assets: Dict mapping scene_id to asset dict.
            output_dir: Directory for all output files.
            generate_thumbs: Whether to generate thumbnails.
            
        Returns:
            Dictionary with output paths and metadata:
            {
                "9x16": Path,
                "16x9": Path,
                "thumbnail": Path,
                "thumbnail_16x9": Path,
                "metadata": dict
            }
        """
        output_dir = Path(output_dir)
        slug = self.brief.get("slug", "output")
        
        # Step 1: Process individual scenes
        logger.info("Processing individual scenes...")
        processed_scenes = self.assemble_scenes(scene_assets, output_dir / "temp")
        
        # Step 2: Concatenate scenes
        logger.info("Concatenating scenes...")
        concatenated = output_dir / "temp" / "concatenated.mp4"
        self.assembler.concatenate_scenes(
            processed_scenes,
            output_path=concatenated,
            reencode=True
        )
        
        # Step 3: Export final formats
        logger.info("Exporting final formats...")
        outputs = self.export_final_videos(concatenated, output_dir, slug)
        
        # Step 4: Generate thumbnails
        thumbnails = {}
        if generate_thumbs:
            logger.info("Generating thumbnails...")
            # Use the last scene video for thumbnail
            last_scene_id = max(scene_assets.keys())
            if "video" in scene_assets[last_scene_id]:
                thumbnails = self.generate_thumbnails(
                    scene_assets[last_scene_id]["video"],
                    output_dir / "thumbnails",
                    slug
                )
        
        # Build result
        result = {
            "9x16": outputs["9x16"],
            "16x9": outputs["16x9"],
            "thumbnail": thumbnails.get("9x16"),
            "thumbnail_16x9": thumbnails.get("16x9"),
            "metadata": {
                "slug": slug,
                "duration_seconds": self.assembler.get_duration(outputs["9x16"]),
                "aspect_ratios": ["9:16", "16:9"],
                "output_files": {
                    "9x16": str(outputs["9x16"]),
                    "16x9": str(outputs["16x9"]),
                    "thumbnail_9x16": str(thumbnails.get("9x16")),
                    "thumbnail_16x9": str(thumbnails.get("16x9")),
                }
            }
        }
        
        logger.info(f"Assembly complete: {result['9x16']}, {result['16x9']}")
        return result


# ─────────────────────────────────────────────────────────────────────────────
# Main / Test
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse
    import sys
    
    parser = argparse.ArgumentParser()
    parser.add_argument("--function", required=True, help="Method name to call")
    parser.add_argument("--args", required=True, help="JSON string of arguments")
    parser.add_argument("--output-dir", default="./output", help="Output directory for video files")
    args = parser.parse_args()
    
    # Parse arguments
    try:
        func_args = json.loads(args.args)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)
    
    # Create client instance
    client = VideoAssembler(output_dir=args.output_dir)
    
    # Get method
    if not hasattr(client, args.function):
        print(json.dumps({"success": False, "error": f"Unknown function: {args.function}"}))
        sys.exit(1)
    
    method = getattr(client, args.function)
    
    # Call method (handle async)
    try:
        if asyncio.iscoroutinefunction(method):
            result = asyncio.run(method(**func_args))
        else:
            result = method(**func_args)
        print(json.dumps({"success": True, "data": result}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
