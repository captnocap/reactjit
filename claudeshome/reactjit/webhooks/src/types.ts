/** Incoming webhook event */
export interface WebhookEvent<T = any> {
  /** Auto-generated event ID */
  id: string;
  /** Timestamp (ISO string) */
  timestamp: string;
  /** HTTP method used */
  method: string;
  /** Request path */
  path: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Parsed body (JSON if Content-Type is application/json, raw string otherwise) */
  body: T;
  /** Raw body string */
  rawBody: string;
  /** Query parameters */
  query: Record<string, string>;
  /** Whether signature verification passed (null if no secret configured) */
  verified: boolean | null;
}

/** Options for useWebhook (receiver) */
export interface WebhookReceiverOptions {
  /** Shared secret for HMAC-SHA256 signature verification */
  secret?: string;
  /** Header name containing the signature. Default: 'x-hub-signature-256' (GitHub-style) */
  signatureHeader?: string;
  /** Max events to keep in queue. Default: 100 */
  maxEvents?: number;
  /** Custom response status. Default: 200 */
  responseStatus?: number;
  /** Custom response body. Default: '{"ok":true}' */
  responseBody?: string;
  /** Filter by HTTP method. Default: accepts all */
  methods?: string[];
  /** Host to bind to */
  host?: string;
}

/** Result from useWebhook */
export interface WebhookReceiverResult {
  /** Received events (newest first) */
  events: WebhookEvent[];
  /** Most recent event */
  latest: WebhookEvent | null;
  /** Server is ready to receive */
  ready: boolean;
  /** Number of events received total (including evicted) */
  totalReceived: number;
  /** Clear the event queue */
  clear: () => void;
}

/** Options for sendWebhook */
export interface WebhookSendOptions {
  /** HTTP method. Default: 'POST' */
  method?: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Shared secret for HMAC-SHA256 signature */
  secret?: string;
  /** Header name for signature. Default: 'x-hub-signature-256' */
  signatureHeader?: string;
  /** Retry count on failure. Default: 0 */
  retries?: number;
  /** Retry delay in ms (doubles each retry). Default: 1000 */
  retryDelay?: number;
}

/** Result of a webhook send attempt */
export interface WebhookSendResult {
  ok: boolean;
  status: number;
  body: string;
  attempts: number;
}

/** Options for useWebhookSender */
export interface WebhookSenderOptions {
  /** Default headers for all sends */
  headers?: Record<string, string>;
  /** Default secret for all sends */
  secret?: string;
  /** Default retry count. Default: 3 */
  retries?: number;
}

/** Result from useWebhookSender */
export interface WebhookSenderResult {
  send: (url: string, payload: any, options?: WebhookSendOptions) => Promise<WebhookSendResult>;
  sending: boolean;
  lastResult: WebhookSendResult | null;
  error: Error | null;
}
