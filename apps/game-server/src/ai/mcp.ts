import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import type { ToolSet } from 'ai';
import { log } from '../logger.js';

export class MCPManager {
  private clients = new Map<string, MCPClient>();

  async connect(name: string, transport: Parameters<typeof createMCPClient>[0]['transport']): Promise<void> {
    if (this.clients.has(name)) {
      await this.disconnect(name);
    }
    const client = await createMCPClient({ transport });
    this.clients.set(name, client);
    log.info(`MCP client connected: ${name}`);
  }

  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
      log.info(`MCP client disconnected: ${name}`);
    }
  }

  async getAllTools(): Promise<ToolSet> {
    const allTools: ToolSet = {};
    for (const [name, client] of this.clients) {
      try {
        const tools = await client.tools();
        Object.assign(allTools, tools);
      } catch (err) {
        log.error(`Failed to get tools from MCP client ${name}:`, err);
      }
    }
    return allTools;
  }

  async disconnectAll(): Promise<void> {
    const names = [...this.clients.keys()];
    await Promise.all(names.map(name => this.disconnect(name)));
  }
}

export const mcpManager = new MCPManager();
