import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemeEngineServer } from "../../mcp-servers/meme-engine-server/src/index";
import { BriefGenerator } from "../../mcp-servers/meme-engine-server/src/brief-generator";
import { TrendAnalyzer } from "../../mcp-servers/meme-engine-server/src/trend-analyzer";

describe("MemeEngineServer", () => {
  let server: MemeEngineServer;
  
  beforeEach(() => {
    server = new MemeEngineServer();
  });
  
  it("should initialize with correct configuration", () => {
    expect(server).toBeDefined();
  });
  
  it("should list available tools", async () => {
    const tools = await server.listTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });
  
  it("should have all required meme engine tools", async () => {
    const tools = await server.listTools();
    const toolNames = tools.map((t: any) => t.name);
    
    expect(toolNames).toContain("analyze_trends");
    expect(toolNames).toContain("generate_brief");
    expect(toolNames).toContain("evaluate_brief");
    expect(toolNames).toContain("get_template_suggestions");
  });
});

describe("BriefGenerator", () => {
  let generator: BriefGenerator;
  
  beforeEach(() => {
    generator = new BriefGenerator();
  });
  
  it("should initialize with templates", () => {
    expect(generator).toBeDefined();
    expect((generator as any).templates.size).toBeGreaterThan(0);
  });
  
  it("should generate brief with valid structure", () => {
    const trend = {
      topic: "AI fails",
      virality_score: 0.85,
      sentiment: "humorous"
    };
    
    const brief = generator.generateBrief(trend, "relatable");
    
    expect(brief).toHaveProperty("concept");
    expect(brief).toHaveProperty("format");
    expect(brief).toHaveProperty("scenes");
    expect(brief).toHaveProperty("characters");
    expect(brief).toHaveProperty("duration_target_seconds");
    expect(brief).toHaveProperty("aspect_ratios");
  });
  
  it("should generate appropriate scene count", () => {
    const trend = { topic: "test", virality_score: 0.8 };
    const brief = generator.generateBrief(trend, "quick-cut");
    
    expect(brief.scenes.length).toBeGreaterThanOrEqual(2);
    expect(brief.scenes.length).toBeLessThanOrEqual(5);
  });
  
  it("should include HOOK scene as first scene", () => {
    const trend = { topic: "test", virality_score: 0.8 };
    const brief = generator.generateBrief(trend, "relatable");
    
    expect(brief.scenes[0].beat).toBe("HOOK");
    expect(brief.scenes[0].duration_seconds).toBeLessThanOrEqual(5);
  });
  
  it("should include PUNCHLINE scene", () => {
    const trend = { topic: "test", virality_score: 0.8 };
    const brief = generation.generateBrief(trend, "relatable");
    
    const punchlineScene = brief.scenes.find((s: any) => s.beat === "PUNCHLINE");
    expect(punchlineScene).toBeDefined();
  });
  
  it("should generate characters for the brief", () => {
    const trend = { topic: "office humor", virality_score: 0.8 };
    const brief = generator.generateBrief(trend, "relatable");
    
    expect(brief.characters.length).toBeGreaterThan(0);
    expect(brief.characters[0]).toHaveProperty("id");
    expect(brief.characters[0]).toHaveProperty("description");
  });
  
  it("should set generation requirements", () => {
    const trend = { topic: "test", virality_score: 0.8 };
    const brief = generator.generateBrief(trend, "relatable");
    
    expect(brief.generation_requirements).toHaveProperty("character_consistency");
    expect(brief.generation_requirements).toHaveProperty("lip_sync_needed");
    expect(brief.generation_requirements).toHaveProperty("models_preferred");
  });
});

describe("TrendAnalyzer", () => {
  let analyzer: TrendAnalyzer;
  
  beforeEach(() => {
    analyzer = new TrendAnalyzer();
  });
  
  it("should initialize with trend data", () => {
    expect(analyzer).toBeDefined();
  });
  
  it("should analyze input keywords", async () => {
    const result = await analyzer.analyzeTrends(["AI", "funny", "cats"]);
    
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("topic");
    expect(result[0]).toHaveProperty("virality_score");
    expect(result[0]).toHaveProperty("sentiment");
  });
  
  it("should return scored trends", async () => {
    const result = await analyzer.analyzeTrends(["test"]);
    
    expect(result[0].virality_score).toBeGreaterThanOrEqual(0);
    expect(result[0].virality_score).toBeLessThanOrEqual(1);
  });
  
  it("should sort trends by virality score", async () => {
    const result = await analyzer.analyzeTrends(["AI", "cats", "memes"]);
    
    for (let i = 1; i < result.length; i++) {
      expect(result[i].virality_score).toBeLessThanOrEqual(
        result[i - 1].virality_score
      );
    }
  });
  
  it("should handle empty keywords", async () => {
    const result = await analyzer.analyzeTrends([]);
    
    expect(Array.isArray(result)).toBe(true);
  });
  
  it("should provide trend context", async () => {
    const result = await analyzer.analyzeTrends(["AI fails"]);
    
    expect(result[0]).toHaveProperty("context");
    expect(result[0].context).toHaveProperty("peak_time");
    expect(result[0].context).toHaveProperty("demographic");
    expect(result[0].context).toHaveProperty("platforms");
  });
});

describe("Brief Evaluation", () => {
  let generator: BriefGenerator;
  
  beforeEach(() => {
    generator = new BriefGenerator();
  });
  
  it("should evaluate brief completeness", () => {
    const brief = {
      concept: "Test concept",
      format: "mini-drama",
      scenes: [{ scene_id: 1, beat: "HOOK" }],
      characters: [{ id: "char1" }],
      duration_target_seconds: 30
    };
    
    const evaluation = generator.evaluateBrief(brief);
    
    expect(evaluation).toHaveProperty("completeness");
    expect(evaluation).toHaveProperty("virality_score");
    expect(evaluation).toHaveProperty("suggestions");
  });
  
  it("should detect missing required fields", () => {
    const incompleteBrief = {
      concept: "Test",
      scenes: []
    };
    
    const evaluation = generator.evaluateBrief(incompleteBrief);
    
    expect(evaluation.completeness).toBeLessThan(1.0);
    expect(evaluation.suggestions.length).toBeGreaterThan(0);
  });
  
  it("should calculate virality potential", () => {
    const brief = {
      concept: "Trending topic",
      format: "relatable",
      trend_score: 85,
      scenes: [
        { beat: "HOOK", duration_seconds: 3 },
        { beat: "PUNCHLINE", duration_seconds: 5 }
      ]
    };
    
    const evaluation = generator.evaluateBrief(brief);
    
    expect(evaluation.virality_score).toBeGreaterThan(0);
    expect(evaluation.virality_score).toBeLessThanOrEqual(1);
  });
  
  it("should provide improvement suggestions", () => {
    const brief = {
      concept: "Test",
      format: "mini-drama",
      scenes: [
        { scene_id: 1, beat: "HOOK", duration_seconds: 10 } // Too long for hook
      ]
    };
    
    const evaluation = generator.evaluateBrief(brief);
    
    const hookSuggestion = evaluation.suggestions.find(
      (s: string) => s.toLowerCase().includes("hook")
    );
    expect(hookSuggestion).toBeDefined();
  });
});

describe("Template System", () => {
  let generator: BriefGenerator;
  
  beforeEach(() => {
    generator = new BriefGenerator();
  });
  
  it("should support multiple format templates", () => {
    const formats = ["relatable", "mini-drama", "quick-cut", "story-time"];
    
    for (const format of formats) {
      const trend = { topic: "test", virality_score: 0.8 };
      const brief = generator.generateBrief(trend, format);
      
      expect(brief.format).toBe(format);
      expect(brief.scenes.length).toBeGreaterThan(0);
    }
  });
  
  it("should apply format-specific scene structures", () => {
    const trend = { topic: "test", virality_score: 0.8 };
    
    const miniDrama = generator.generateBrief(trend, "mini-drama");
    const quickCut = generator.generateBrief(trend, "quick-cut");
    
    // Quick-cut should have more, shorter scenes
    expect(quickCut.scenes.length).toBeGreaterThanOrEqual(
      miniDrama.scenes.length
    );
  });
  
  it("should get template suggestions", () => {
    const suggestions = generator.getTemplateSuggestions("funny AI fails");
    
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toHaveProperty("format");
    expect(suggestions[0]).toHaveProperty("reason");
    expect(suggestions[0]).toHaveProperty("score");
  });
  
  it("should suggest appropriate templates for content type", () => {
    const funnySuggestions = generator.getTemplateSuggestions("funny cats");
    const emotionalSuggestions = generator.getTemplateSuggestions("touching story");
    
    // Both should return suggestions
    expect(funnySuggestions.length).toBeGreaterThan(0);
    expect(emotionalSuggestions.length).toBeGreaterThan(0);
  });
});

describe("Tool Schema Validation", () => {
  let server: MemeEngineServer;
  
  beforeEach(() => {
    server = new MemeEngineServer();
  });
  
  it("should validate analyze_trends schema", async () => {
    const tools = await server.listTools();
    const tool = tools.find((t: any) => t.name === "analyze_trends");
    
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty("keywords");
    expect(tool.inputSchema.required).toContain("keywords");
  });
  
  it("should validate generate_brief schema", async () => {
    const tools = await server.listTools();
    const tool = tools.find((t: any) => t.name === "generate_brief");
    
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty("trend");
    expect(tool.inputSchema.properties).toHaveProperty("format");
    expect(tool.inputSchema.required).toContain("trend");
  });
  
  it("should validate evaluate_brief schema", async () => {
    const tools = await server.listTools();
    const tool = tools.find((t: any) => t.name === "evaluate_brief");
    
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty("brief");
    expect(tool.inputSchema.required).toContain("brief");
  });
});

describe("Error Handling", () => {
  let server: MemeEngineServer;
  
  beforeEach(() => {
    server = new MemeEngineServer();
  });
  
  it("should handle invalid trend data", async () => {
    await expect(
      server.callTool("generate_brief", { trend: null, format: "relatable" })
    ).rejects.toThrow();
  });
  
  it("should handle invalid format", async () => {
    const trend = { topic: "test", virality_score: 0.8 };
    
    await expect(
      server.callTool("generate_brief", { trend, format: "invalid_format" })
    ).rejects.toThrow(/Invalid format/);
  });
  
  it("should handle missing required fields in brief evaluation", async () => {
    await expect(
      server.callTool("evaluate_brief", { brief: {} })
    ).rejects.toThrow();
  });
});

describe("Async Operations", () => {
  let analyzer: TrendAnalyzer;
  
  beforeEach(() => {
    analyzer = new TrendAnalyzer();
  });
  
  it("should handle concurrent trend analysis", async () => {
    const promises = [
      analyzer.analyzeTrends(["AI"]),
      analyzer.analyzeTrends(["cats"]),
      analyzer.analyzeTrends(["memes"])
    ];
    
    const results = await Promise.all(promises);
    
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(Array.isArray(result)).toBe(true);
    });
  });
  
  it("should support cancellation", async () => {
    const abortController = new AbortController();
    
    const promise = analyzer.analyzeTrends(["AI"], { 
      signal: abortController.signal 
    });
    
    abortController.abort();
    
    await expect(promise).rejects.toThrow(/cancelled|abort/i);
  });
});
