/**
 * MCPClient — High-level MCP client for connecting to MCP servers.
 *
 * Handles the full lifecycle: connect → initialize → list tools → call tools → close.
 * Used by both the useMCPServer hook (runtime) and the linter (discovery).
 */

import type { MCPTool, MCPToolCallResult, MCPServerConfig } from './protocol';
import {
  createInitializeRequest,
  createInitializedNotification,
  createToolsListRequest,
  createToolCallRequest,
  parseResponse,
} from './protocol';
import { createTransport } from './transport';
import type { MCPTransport } from './transport';

export type MCPClientStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

export class MCPClient {
  private transport: MCPTransport | null = null;
  private _status: MCPClientStatus = 'disconnected';
  private _error: Error | null = null;
  private config: MCPServerConfig;
  private serverInfo: { name: string; version?: string } | null = null;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  get status(): MCPClientStatus { return this._status; }
  get error(): Error | null { return this._error; }

  /**
   * Connect to the MCP server and complete the initialize handshake.
   */
  async connect(): Promise<void> {
    this._status = 'connecting';
    this._error = null;

    try {
      this.transport = createTransport({
        transport: this.config.transport,
        command: this.config.command,
        args: this.config.args,
        env: this.config.env,
        url: this.config.url,
        headers: this.config.headers,
        timeout: this.config.timeout,
      });

      // Send initialize request
      const initReq = createInitializeRequest();
      const initResp = await this.transport.send(initReq);
      const result = parseResponse(initResp);

      this.serverInfo = result.serverInfo || null;

      // Send initialized notification (required by MCP spec)
      const notification = createInitializedNotification();
      this.transport.notify(notification);

      this._status = 'ready';
    } catch (err: any) {
      this._status = 'error';
      this._error = err instanceof Error ? err : new Error(String(err));
      throw this._error;
    }
  }

  /**
   * List all tools the server exposes.
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.transport || this._status !== 'ready') {
      throw new Error('MCPClient not connected — call connect() first');
    }

    const req = createToolsListRequest();
    const resp = await this.transport.send(req);
    const result = parseResponse(resp);

    return (result.tools || []) as MCPTool[];
  }

  /**
   * Call a tool on the server.
   */
  async callTool(name: string, args: Record<string, any>): Promise<MCPToolCallResult> {
    if (!this.transport || this._status !== 'ready') {
      throw new Error('MCPClient not connected — call connect() first');
    }

    const req = createToolCallRequest(name, args);
    const resp = await this.transport.send(req);
    const result = parseResponse(resp);

    return result as MCPToolCallResult;
  }

  /**
   * Close the connection and clean up.
   */
  close(): void {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    this._status = 'disconnected';
  }

  /**
   * Get server info from the initialize handshake.
   */
  getServerInfo(): { name: string; version?: string } | null {
    return this.serverInfo;
  }
}
