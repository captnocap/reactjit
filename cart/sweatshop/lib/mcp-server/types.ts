export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (args: any) => any | Promise<any>;
};

export type McpCallLogEntry = {
  id: string;
  time: number;
  tool: string;
  args: any;
  result?: any;
  error?: string;
};

export type McpClientRecord = {
  id: string;
  label: string;
  connectedAt: number;
  lastSeenAt: number;
  transport: 'http' | 'stdio' | 'unknown';
  active: boolean;
};

export type McpServerState = {
  running: boolean;
  transport: 'http' | 'bridge' | 'stdio' | 'disabled';
  port: number | null;
  url: string | null;
  startedAt: number | null;
  lastError: string | null;
  capabilityBanner: string | null;
  clients: McpClientRecord[];
};
