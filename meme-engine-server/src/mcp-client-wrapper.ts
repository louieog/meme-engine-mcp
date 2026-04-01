// meme-engine-server/src/mcp-client-wrapper.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import path from "path";

export class MCPClientWrapper {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();
  private processes: Map<string, any> = new Map();

  async connect(serverName: string, serverPath: string): Promise<Client> {
    // Check if already connected
    const existing = this.clients.get(serverName);
    if (existing) return existing;

    const distPath = path.join(serverPath, "dist", "index.js");
    
    // Spawn server process
    const serverProcess = spawn("node", [distPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const transport = new StdioClientTransport({
      stdin: serverProcess.stdin!,
      stdout: serverProcess.stdout!,
      stderr: serverProcess.stderr!,
    } as any);

    const client = new Client(
      { name: `meme-engine-${serverName}`, version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);

    // Store for cleanup
    this.clients.set(serverName, client);
    this.transports.set(serverName, transport);
    this.processes.set(serverName, serverProcess);

    console.log(`[MCP] Connected to ${serverName}`);
    return client;
  }

  async connectAll(): Promise<void> {
    const basePath = path.resolve(__dirname, "..");
    
    await Promise.all([
      this.connect("comfyui", path.join(basePath, "..", "mcp-servers", "comfyui-server")),
      this.connect("assembly", path.join(basePath, "..", "mcp-servers", "assembly-server")),
    ]);
  }

  getClient(name: string): Client | undefined {
    return this.clients.get(name);
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) throw new Error(`Server ${serverName} not connected`);

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    return result;
  }

  async disconnect(): Promise<void> {
    for (const [name, transport] of this.transports) {
      await transport.close();
    }
    for (const [name, proc] of this.processes) {
      proc.kill();
    }
    this.clients.clear();
    this.transports.clear();
    this.processes.clear();
  }
}
