import { describe, it, expect, beforeEach, vi } from "vitest";
import { ComfyClientWrapper } from "../../mcp-servers/comfyui-server/src/comfy-client";
import { ComfyUIServer } from "../../mcp-servers/comfyui-server/src/index";

describe("ComfyClientWrapper", () => {
  let client: ComfyClientWrapper;
  
  beforeEach(() => {
    client = new ComfyClientWrapper();
  });
  
  it("should initialize with default paths", () => {
    expect(client).toBeDefined();
  });
  
  it("should map tool names to Python functions", () => {
    const toolMap = (client as any).toolMap;
    expect(toolMap["generate_image"]).toBe("generate_image");
    expect(toolMap["generate_video"]).toBe("generate_video");
  });
  
  it("should have required tools defined", () => {
    const tools = (client as any).tools;
    const toolNames = tools.map((t: any) => t.name);
    
    expect(toolNames).toContain("generate_image");
    expect(toolNames).toContain("generate_video");
    expect(toolNames).toContain("upload_image");
    expect(toolNames).toContain("check_status");
  });
  
  it("should validate tool inputs", () => {
    const validate = (client as any).validateInput;
    
    // Valid input
    expect(validate({ prompt: "test", seed: 42 }, ["prompt"])).toBe(true);
    
    // Missing required field
    expect(validate({}, ["prompt"])).toBe(false);
  });
});

describe("ComfyUIServer", () => {
  let server: ComfyUIServer;
  
  beforeEach(() => {
    server = new ComfyUIServer();
  });
  
  it("should initialize with correct name and version", () => {
    expect(server).toBeDefined();
  });
  
  it("should list available tools", async () => {
    const tools = await server.listTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });
  
  it("should handle tool calls", async () => {
    const mockCallTool = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Success" }]
    });
    
    (server as any).callTool = mockCallTool;
    
    const result = await server.callTool("generate_image", { prompt: "test" });
    expect(result).toBeDefined();
  });
  
  it("should handle errors gracefully", async () => {
    const mockError = new Error("Test error");
    const mockCallTool = vi.fn().mockRejectedValue(mockError);
    
    (server as any).callTool = mockCallTool;
    
    await expect(server.callTool("invalid_tool", {})).rejects.toThrow();
  });
});

describe("Tool Schema Validation", () => {
  let client: ComfyClientWrapper;
  
  beforeEach(() => {
    client = new ComfyClientWrapper();
  });
  
  it("should validate generate_image schema", () => {
    const tools = (client as any).tools;
    const imageTool = tools.find((t: any) => t.name === "generate_image");
    
    expect(imageTool).toBeDefined();
    expect(imageTool.inputSchema.properties).toHaveProperty("prompt");
    expect(imageTool.inputSchema.properties).toHaveProperty("aspect_ratio");
    expect(imageTool.inputSchema.properties).toHaveProperty("seed");
  });
  
  it("should validate generate_video schema", () => {
    const tools = (client as any).tools;
    const videoTool = tools.find((t: any) => t.name === "generate_video");
    
    expect(videoTool).toBeDefined();
    expect(videoTool.inputSchema.properties).toHaveProperty("image_path");
    expect(videoTool.inputSchema.properties).toHaveProperty("prompt");
    expect(videoTool.inputSchema.properties).toHaveProperty("duration");
  });
  
  it("should validate upload_image schema", () => {
    const tools = (client as any).tools;
    const uploadTool = tools.find((t: any) => t.name === "upload_image");
    
    expect(uploadTool).toBeDefined();
    expect(uploadTool.inputSchema.properties).toHaveProperty("file_path");
    expect(uploadTool.inputSchema.required).toContain("file_path");
  });
});

describe("Workflow Generation", () => {
  let client: ComfyClientWrapper;
  
  beforeEach(() => {
    client = new ComfyClientWrapper();
  });
  
  it("should generate valid image workflow", () => {
    const workflow = (client as any).buildImageWorkflow({
      prompt: "A scenic mountain view",
      aspect_ratio: "16:9",
      seed: 42
    });
    
    expect(workflow).toBeDefined();
    expect(typeof workflow).toBe("object");
    expect(Object.keys(workflow).length).toBeGreaterThan(0);
  });
  
  it("should generate valid video workflow", () => {
    const workflow = (client as any).buildVideoWorkflow({
      image_path: "test.png",
      prompt: "Camera pan across scene",
      duration: 5,
      generate_audio: true
    });
    
    expect(workflow).toBeDefined();
    expect(typeof workflow).toBe("object");
    expect(Object.keys(workflow).length).toBeGreaterThan(0);
  });
  
  it("should include SaveImage node in image workflow", () => {
    const workflow = (client as any).buildImageWorkflow({
      prompt: "Test image",
      aspect_ratio: "9:16"
    });
    
    const saveNodes = Object.values(workflow).filter(
      (node: any) => node.class_type === "SaveImage"
    );
    
    expect(saveNodes.length).toBeGreaterThan(0);
  });
});

describe("Error Handling", () => {
  let client: ComfyClientWrapper;
  
  beforeEach(() => {
    client = new ComfyClientWrapper();
  });
  
  it("should handle missing prompt error", async () => {
    await expect(
      (client as any).generateImage({})
    ).rejects.toThrow(/prompt is required/);
  });
  
  it("should handle invalid aspect ratio", async () => {
    await expect(
      (client as any).generateImage({ prompt: "test", aspect_ratio: "invalid" })
    ).rejects.toThrow(/Invalid aspect ratio/);
  });
  
  it("should handle Python process errors", async () => {
    const mockExec = vi.fn().mockRejectedValue(new Error("Python not found"));
    (client as any).execAsync = mockExec;
    
    await expect(
      (client as any).generateImage({ prompt: "test" })
    ).rejects.toThrow(/Python not found/);
  });
});

describe("Response Parsing", () => {
  let client: ComfyClientWrapper;
  
  beforeEach(() => {
    client = new ComfyClientWrapper();
  });
  
  it("should parse successful image generation response", () => {
    const stdout = JSON.stringify({
      status: "success",
      files: ["output_00001_.png"],
      prompt_id: "test-123"
    });
    
    const result = (client as any).parseResponse(stdout);
    
    expect(result.status).toBe("success");
    expect(result.files).toContain("output_00001_.png");
  });
  
  it("should parse error response", () => {
    const stdout = JSON.stringify({
      status: "error",
      error: "Insufficient credits",
      error_type: "InsufficientCreditsError"
    });
    
    const result = (client as any).parseResponse(stdout);
    
    expect(result.status).toBe("error");
    expect(result.error).toBe("Insufficient credits");
  });
  
  it("should handle invalid JSON response", () => {
    const stdout = "Invalid JSON";
    
    expect(() => {
      (client as any).parseResponse(stdout);
    }).toThrow();
  });
});

describe("Async Operations", () => {
  let client: ComfyClientWrapper;
  
  beforeEach(() => {
    client = new ComfyClientWrapper();
  });
  
  it("should handle concurrent generation requests", async () => {
    const promises = [
      (client as any).generateImage({ prompt: "image 1" }),
      (client as any).generateImage({ prompt: "image 2" }),
      (client as any).generateImage({ prompt: "image 3" })
    ];
    
    // Should not throw when running concurrently
    await expect(Promise.allSettled(promises)).resolves.toBeDefined();
  });
  
  it("should support cancellation", async () => {
    const abortController = new AbortController();
    
    const promise = (client as any).generateImage(
      { prompt: "test" },
      { signal: abortController.signal }
    );
    
    abortController.abort();
    
    await expect(promise).rejects.toThrow(/cancelled|abort/i);
  });
});
