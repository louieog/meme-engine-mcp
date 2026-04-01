// src/llm-adapters.ts
// Model-agnostic LLM interface with tool calling support

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export interface ToolResult {
  tool_call_id: string;
  result: any;
  error?: string;
}

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string | any[];
}

export interface LLMResponse {
  content: string | any[];
  tool_calls?: ToolCall[];
  stop_reason: "end_turn" | "tool_calls" | "max_tokens" | "error";
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface LLMConfig {
  model: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
}

// Universal LLM interface
export interface LLMProvider {
  generate(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    config: LLMConfig
  ): Promise<LLMResponse>;
  
  generateWithTools(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    config: LLMConfig
  ): Promise<LLMResponse>;
}

// ============================================================
// ANTHROPIC (CLAUDE) ADAPTER
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

export class ClaudeAdapter implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: config.model,
      max_tokens: config.max_tokens || 4096,
      temperature: config.temperature,
      system: config.system,
      tools: tools as any,
      messages: messages as any,
    });

    return this.normalizeResponse(response);
  }

  async generateWithTools(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // Add tool results to messages
    const updatedMessages: LLMMessage[] = [
      ...messages,
      {
        role: "user",
        content: toolResults.map(tr => ({
          type: "tool_result",
          tool_use_id: tr.tool_call_id,
          content: tr.error 
            ? `Error: ${tr.error}` 
            : JSON.stringify(tr.result),
        })),
      },
    ];

    return this.generate(updatedMessages, tools, config);
  }

  private normalizeResponse(response: Anthropic.Message): LLMResponse {
    const toolCalls: ToolCall[] = [];
    let textContent = "";

    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
      } else if (block.type === "text") {
        textContent += block.text;
      }
    }

    return {
      content: textContent || response.content,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      stop_reason: response.stop_reason === "tool_use" 
        ? "tool_calls" 
        : response.stop_reason === "end_turn" 
        ? "end_turn" 
        : "error",
      usage: {
        input_tokens: response.usage?.input_tokens || 0,
        output_tokens: response.usage?.output_tokens || 0,
      },
    };
  }
}

// ============================================================
// OPENAI (GPT-4) ADAPTER
// ============================================================

import OpenAI from "openai";

export class OpenAIAdapter implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // Convert our tool format to OpenAI format
    const openaiTools = tools.map(t => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: config.model, // e.g., "gpt-4-turbo-preview"
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      tools: openaiTools,
      tool_choice: "auto",
      messages: [
        ...(config.system ? [{ role: "system" as const, content: config.system }] : []),
        ...messages.map(m => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
      ],
    });

    return this.normalizeResponse(response);
  }

  async generateWithTools(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // Add assistant message with tool calls
    const assistantMessage = messages[messages.length - 1];
    
    // Add tool results
    const toolResultMessages = toolResults.map(tr => ({
      role: "tool" as const,
      tool_call_id: tr.tool_call_id,
      content: tr.error ? `Error: ${tr.error}` : JSON.stringify(tr.result),
    }));

    const updatedMessages = [
      ...messages,
      ...toolResultMessages,
    ];

    return this.generate(updatedMessages, tools, config);
  }

  private normalizeResponse(response: OpenAI.Chat.Completions.ChatCompletion): LLMResponse {
    const choice = response.choices[0];
    const message = choice.message;

    const toolCalls = message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments),
    }));

    return {
      content: message.content || "",
      tool_calls: toolCalls,
      stop_reason: choice.finish_reason === "tool_calls" 
        ? "tool_calls" 
        : choice.finish_reason === "stop" 
        ? "end_turn" 
        : "error",
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };
  }
}

// ============================================================
// GOOGLE (GEMINI) ADAPTER
// ============================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiAdapter implements LLMProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    const model = this.client.getGenerativeModel({
      model: config.model, // e.g., "gemini-pro"
      systemInstruction: config.system,
    });

    // Convert tools to Gemini format
    const geminiTools = tools.map(t => ({
      functionDeclarations: [{
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      }],
    }));

    const chat = model.startChat({
      tools: geminiTools,
    });

    // Convert messages to Gemini format
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(
      typeof lastMessage.content === "string" ? lastMessage.content : JSON.stringify(lastMessage.content)
    );

    return this.normalizeResponse(result);
  }

  async generateWithTools(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // Add function responses to conversation
    const functionResponses = toolResults.map(tr => ({
      role: "user" as const,
      content: JSON.stringify({
        functionResponse: {
          name: tr.tool_call_id,
          response: tr.error ? { error: tr.error } : tr.result,
        },
      }),
    }));

    const updatedMessages = [...messages, ...functionResponses];
    return this.generate(updatedMessages, tools, config);
  }

  private normalizeResponse(result: any): LLMResponse {
    const response = result.response;
    const functionCalls = response.functionCalls?.map((fc: any) => ({
      id: fc.name, // Gemini doesn't have tool call IDs, use name
      name: fc.name,
      input: fc.args,
    }));

    return {
      content: response.text?.() || "",
      tool_calls: functionCalls,
      stop_reason: functionCalls ? "tool_calls" : "end_turn",
    };
  }
}

// ============================================================
// LITELLM ADAPTER (Universal - Recommended!)
// ============================================================

import { LiteLLM } from "litellm";

export class LiteLLMAdapter implements LLMProvider {
  async generate(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // LiteLLM handles the translation between providers
    const response = await LiteLLM.completion({
      model: config.model, // "claude-3-sonnet", "gpt-4", "gemini-pro", etc.
      messages: [
        ...(config.system ? [{ role: "system", content: config.system }] : []),
        ...messages.map(m => ({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        })),
      ],
      tools: tools.map(t => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      max_tokens: config.max_tokens,
      temperature: config.temperature,
    });

    return this.normalizeResponse(response);
  }

  async generateWithTools(
    messages: LLMMessage[],
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    // LiteLLM handles tool result formatting
    const toolResultMessages = toolResults.map(tr => ({
      role: "tool" as const,
      tool_call_id: tr.tool_call_id,
      content: tr.error ? `Error: ${tr.error}` : JSON.stringify(tr.result),
    }));

    const updatedMessages = [...messages, ...toolResultMessages];
    return this.generate(updatedMessages, tools, config);
  }

  private normalizeResponse(response: any): LLMResponse {
    const choice = response.choices[0];
    const message = choice.message;

    return {
      content: message.content || "",
      tool_calls: message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      })),
      stop_reason: choice.finish_reason === "tool_calls" 
        ? "tool_calls" 
        : choice.finish_reason === "stop" 
        ? "end_turn" 
        : "error",
      usage: response.usage,
    };
  }
}

// ============================================================
// FACTORY - Create provider based on env
// ============================================================

export function createLLMProvider(provider: string, apiKey: string): LLMProvider {
  switch (provider.toLowerCase()) {
    case "claude":
    case "anthropic":
      return new ClaudeAdapter(apiKey);
    case "openai":
    case "gpt":
      return new OpenAIAdapter(apiKey);
    case "gemini":
    case "google":
      return new GeminiAdapter(apiKey);
    case "litellm":
      return new LiteLLMAdapter();
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

// Get provider from environment
export function getLLMProviderFromEnv(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "claude";
  const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || "";
  
  if (!apiKey) {
    throw new Error("No LLM API key found. Set LLM_API_KEY or provider-specific key.");
  }
  
  return createLLMProvider(provider, apiKey);
}
