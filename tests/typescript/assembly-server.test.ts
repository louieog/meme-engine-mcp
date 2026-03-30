import { describe, it, expect, beforeEach, vi } from "vitest";
import { AssemblyServer } from "../../mcp-servers/assembly-server/src/index";
import { FFmpegWrapper } from "../../mcp-servers/assembly-server/src/ffmpeg-wrapper";

describe("AssemblyServer", () => {
  let server: AssemblyServer;
  
  beforeEach(() => {
    server = new AssemblyServer();
  });
  
  it("should initialize with correct configuration", () => {
    expect(server).toBeDefined();
  });
  
  it("should list available tools", async () => {
    const tools = await server.listTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });
  
  it("should have all required assembly tools", async () => {
    const tools = await server.listTools();
    const toolNames = tools.map((t: any) => t.name);
    
    expect(toolNames).toContain("assemble_video");
    expect(toolNames).toContain("concatenate_clips");
    expect(toolNames).toContain("add_audio");
    expect(toolNames).toContain("add_text_overlay");
    expect(toolNames).toContain("create_still_clip");
  });
});

describe("FFmpegWrapper", () => {
  let wrapper: FFmpegWrapper;
  
  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });
  
  it("should initialize with default settings", () => {
    expect(wrapper).toBeDefined();
    expect((wrapper as any).ffmpegPath).toBe("ffmpeg");
  });
  
  it("should initialize with custom ffmpeg path", () => {
    const customWrapper = new FFmpegWrapper("/custom/ffmpeg");
    expect((customWrapper as any).ffmpegPath).toBe("/custom/ffmpeg");
  });
  
  it("should build correct ffmpeg command for still clip", () => {
    const cmd = (wrapper as any).buildStillClipCommand(
      "input.png",
      "output.mp4",
      5.0,
      { width: 1080, height: 1920 }
    );
    
    expect(cmd).toContain("ffmpeg");
    expect(cmd).toContain("-loop");
    expect(cmd).toContain("1");
    expect(cmd).toContain("-t");
    expect(cmd).toContain("5.0");
  });
  
  it("should build correct ffmpeg command for concatenation", () => {
    const clips = ["clip1.mp4", "clip2.mp4", "clip3.mp4"];
    const cmd = (wrapper as any).buildConcatCommand(clips, "output.mp4");
    
    expect(cmd).toContain("ffmpeg");
    expect(cmd).toContain("concat");
    expect(cmd).toContain("clip1.mp4");
  });
  
  it("should build correct ffmpeg command for audio overlay", () => {
    const cmd = (wrapper as any).buildAudioOverlayCommand(
      "video.mp4",
      "audio.mp3",
      "output.mp4",
      { fade_in: 0.5, fade_out: 0.5, volume: 0.8 }
    );
    
    expect(cmd).toContain("ffmpeg");
    expect(cmd).toContain("-i");
    expect(cmd).toContain("video.mp4");
    expect(cmd).toContain("audio.mp3");
  });
  
  it("should build correct ffmpeg command for text overlay", () => {
    const cmd = (wrapper as any).buildTextOverlayCommand(
      "video.mp4",
      "Hello World",
      "output.mp4",
      { x: "center", y: "bottom", fontsize: 48 }
    );
    
    expect(cmd).toContain("ffmpeg");
    expect(cmd).toContain("drawtext");
  });
});

describe("Tool Schema Validation", () => {
  let server: AssemblyServer;
  
  beforeEach(() => {
    server = new AssemblyServer();
  });
  
  it("should validate assemble_video schema", async () => {
    const tools = await server.listTools();
    const tool = tools.find((t: any) => t.name === "assemble_video");
    
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty("brief");
    expect(tool.inputSchema.properties).toHaveProperty("assets");
    expect(tool.inputSchema.required).toContain("brief");
    expect(tool.inputSchema.required).toContain("assets");
  });
  
  it("should validate create_still_clip schema", async () => {
    const tools = await server.listTools();
    const tool = tools.find((t: any) => t.name === "create_still_clip");
    
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty("image_path");
    expect(tool.inputSchema.properties).toHaveProperty("duration");
    expect(tool.inputSchema.required).toContain("image_path");
  });
  
  it("should validate add_text_overlay schema", async () => {
    const tools = await server.listTools();
    const tool = tools.find((t: any) => t.name === "add_text_overlay");
    
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty("video_path");
    expect(tool.inputSchema.properties).toHaveProperty("text");
    expect(tool.inputSchema.properties).toHaveProperty("position");
  });
});

describe("Aspect Ratio Handling", () => {
  let wrapper: FFmpegWrapper;
  
  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });
  
  it("should convert 9:16 to correct dimensions", () => {
    const dims = (wrapper as any).getDimensions("9:16", "1080p");
    expect(dims).toEqual({ width: 1080, height: 1920 });
  });
  
  it("should convert 16:9 to correct dimensions", () => {
    const dims = (wrapper as any).getDimensions("16:9", "1080p");
    expect(dims).toEqual({ width: 1920, height: 1080 });
  });
  
  it("should convert 1:1 to correct dimensions", () => {
    const dims = (wrapper as any).getDimensions("1:1", "1080p");
    expect(dims).toEqual({ width: 1080, height: 1080 });
  });
  
  it("should support 4k resolution", () => {
    const dims = (wrapper as any).getDimensions("16:9", "4k");
    expect(dims).toEqual({ width: 3840, height: 2160 });
  });
  
  it("should throw on invalid aspect ratio", () => {
    expect(() => {
      (wrapper as any).getDimensions("invalid", "1080p");
    }).toThrow(/Invalid aspect ratio/);
  });
  
  it("should throw on invalid resolution", () => {
    expect(() => {
      (wrapper as any).getDimensions("16:9", "invalid");
    }).toThrow(/Invalid resolution/);
  });
});

describe("Error Handling", () => {
  let wrapper: FFmpegWrapper;
  
  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });
  
  it("should handle ffmpeg not found error", async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error("spawn ffmpeg ENOENT"));
    (wrapper as any).execAsync = mockExec;
    
    await expect(
      (wrapper as any).createStillClip("test.png", "out.mp4", 5)
    ).rejects.toThrow(/FFmpeg not found/);
  });
  
  it("should handle ffmpeg processing error", async () => {
    const error = new Error("Conversion failed");
    (error as any).stderr = "Unknown encoder 'invalid'";
    
    const mockExec = vi.fn().mockRejectedValue(error);
    (wrapper as any).execAsync = mockExec;
    
    await expect(
      (wrapper as any).createStillClip("test.png", "out.mp4", 5)
    ).rejects.toThrow(/Unknown encoder/);
  });
  
  it("should validate input file exists", async () => {
    const mockExists = vi.fn().mockReturnValue(false);
    (wrapper as any).fileExists = mockExists;
    
    await expect(
      (wrapper as any).createStillClip("nonexistent.png", "out.mp4", 5)
    ).rejects.toThrow(/File not found/);
  });
});

describe("Text Overlay Options", () => {
  let wrapper: FFmpegWrapper;
  
  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });
  
  it("should support different text positions", () => {
    const positions = ["top_left", "top_center", "top_right", "center", 
                       "bottom_left", "bottom_center", "bottom_right"];
    
    for (const position of positions) {
      const cmd = (wrapper as any).buildTextOverlayCommand(
        "video.mp4",
        "Test",
        "out.mp4",
        { position }
      );
      expect(cmd).toContain("drawtext");
    }
  });
  
  it("should support font customization", () => {
    const cmd = (wrapper as any).buildTextOverlayCommand(
      "video.mp4",
      "Test",
      "out.mp4",
      { 
        fontfile: "/path/to/font.ttf",
        fontsize: 72,
        fontcolor: "white"
      }
    );
    
    expect(cmd).toContain("fontfile=/path/to/font.ttf");
    expect(cmd).toContain("fontsize=72");
    expect(cmd).toContain("fontcolor=white");
  });
  
  it("should support text with timing", () => {
    const cmd = (wrapper as any).buildTextOverlayCommand(
      "video.mp4",
      "Test",
      "out.mp4",
      { 
        start_time: 1.5,
        duration: 3.0
      }
    );
    
    expect(cmd).toContain("enable=");
  });
});

describe("Audio Processing", () => {
  let wrapper: FFmpegWrapper;
  
  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });
  
  it("should support audio fade in/out", () => {
    const cmd = (wrapper as any).buildAudioOverlayCommand(
      "video.mp4",
      "audio.mp3",
      "out.mp4",
      { fade_in: 1.0, fade_out: 1.0 }
    );
    
    expect(cmd).toContain("afade");
  });
  
  it("should support volume adjustment", () => {
    const cmd = (wrapper as any).buildAudioOverlayCommand(
      "video.mp4",
      "audio.mp3",
      "out.mp4",
      { volume: 0.5 }
    );
    
    expect(cmd).toContain("volume=0.5");
  });
  
  it("should support audio trimming", () => {
    const cmd = (wrapper as any).buildAudioOverlayCommand(
      "video.mp4",
      "audio.mp3",
      "out.mp4",
      { start_time: 5.0, end_time: 15.0 }
    );
    
    expect(cmd).toContain("-ss");
    expect(cmd).toContain("5.0");
  });
});

describe("Cleanup Operations", () => {
  let wrapper: FFmpegWrapper;
  
  beforeEach(() => {
    wrapper = new FFmpegWrapper();
  });
  
  it("should track temporary files", () => {
    (wrapper as any).tempFiles.push("/tmp/temp1.mp4");
    (wrapper as any).tempFiles.push("/tmp/temp2.mp4");
    
    expect((wrapper as any).tempFiles.length).toBe(2);
  });
  
  it("should clean up temporary files", async () => {
    const mockUnlink = vi.fn().mockResolvedValue(undefined);
    (wrapper as any).unlinkAsync = mockUnlink;
    (wrapper as any).tempFiles = ["/tmp/temp1.mp4", "/tmp/temp2.mp4"];
    
    await wrapper.cleanup();
    
    expect(mockUnlink).toHaveBeenCalledTimes(2);
    expect((wrapper as any).tempFiles.length).toBe(0);
  });
  
  it("should handle cleanup errors gracefully", async () => {
    const mockUnlink = vi.fn().mockRejectedValue(new Error("Permission denied"));
    (wrapper as any).unlinkAsync = mockUnlink;
    (wrapper as any).tempFiles = ["/tmp/temp1.mp4"];
    
    // Should not throw
    await expect(wrapper.cleanup()).resolves.not.toThrow();
  });
});
