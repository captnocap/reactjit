/**
 * Browse integration for @ilovereact/ai.
 *
 * Provides React hooks and pre-built tool definitions for controlling
 * a stealth browse session (anti-fingerprint Firefox) from React components
 * and AI agents.
 *
 * The browse session runs as a separate process on the host machine,
 * listening on a TCP port (default 7331). Commands are routed through
 * Lua's browse.lua worker thread via the QuickJS bridge.
 *
 * @example
 * // React hook usage
 * const browser = useBrowser();
 * const page = await browser.navigate('https://example.com');
 *
 * @example
 * // As AI agent tools
 * const { messages, send } = useChat({
 *   model: 'gpt-4',
 *   tools: [...createBrowserTools()],
 * });
 */

import { useState, useCallback, useRef } from 'react';
import type { ToolDefinition } from './types';

// ── Types ───────────────────────────────────────────────

export interface BrowseOptions {
  /** Browse session host (default: 127.0.0.1) */
  host?: string;
  /** Browse session TCP port (default: 7331) */
  port?: number;
}

export interface PageContent {
  url: string;
  title: string;
  text: string;
  links: { text: string; href: string }[];
  forms: { id: string; action: string; inputs: any[] }[];
}

export interface BrowseResult {
  /** Navigate to a URL. Returns extracted page content. */
  navigate: (url: string) => Promise<PageContent>;
  /** Click an element by CSS selector. */
  click: (selector: string) => Promise<PageContent>;
  /** Type text into an element by CSS selector. Does NOT submit. */
  typeText: (selector: string, text: string) => Promise<PageContent>;
  /** Re-extract content from the current page. */
  extractContent: () => Promise<PageContent>;
  /** Take a screenshot (returns base64 PNG or saves to path). */
  screenshot: (path?: string) => Promise<string>;
  /** Go back in browser history. */
  back: () => Promise<PageContent>;
  /** Go forward in browser history. */
  forward: () => Promise<PageContent>;
  /** Refresh the current page. */
  refresh: () => Promise<PageContent>;
  /** Execute JavaScript in the page context. */
  executeJs: (script: string) => Promise<any>;
  /** List all open tabs. */
  listTabs: () => Promise<{ index: number; title: string; url: string }[]>;
  /** Switch to a tab by index. */
  useTab: (index: number) => Promise<PageContent>;
  /** Open a new background tab. */
  openTab: (url: string) => Promise<void>;
  /** Ping the browse session (check if connected). */
  ping: () => Promise<boolean>;
  /** Send a raw command to the browse session. */
  raw: (cmd: Record<string, any>) => Promise<any>;
  /** Whether a request is in flight. */
  loading: boolean;
  /** Last error, if any. */
  error: Error | null;
}

// ── Bridge interface ────────────────────────────────────

declare global {
  var browseRequest: ((cmd: Record<string, any>, options?: { host?: string; port?: number }) => Promise<any>) | undefined;
}

async function sendBrowseCommand(
  cmd: Record<string, any>,
  options: BrowseOptions = {},
): Promise<any> {
  if (!globalThis.browseRequest) {
    throw new Error('Browse bridge not available. Ensure the app is running in Love2D with browse.lua loaded.');
  }
  return globalThis.browseRequest(cmd, { host: options.host, port: options.port });
}

// ── useBrowser hook ─────────────────────────────────────

/**
 * React hook for controlling a stealth browse session.
 *
 * @example
 * function MyComponent() {
 *   const browser = useBrowser();
 *
 *   const handleSearch = async () => {
 *     const page = await browser.navigate('https://duckduckgo.com');
 *     await browser.typeText('input[name="q"]', 'iLoveReact framework');
 *     const results = await browser.click('button[type="submit"]');
 *     console.log(results.text);
 *   };
 *
 *   return <Pressable onPress={handleSearch}><Text>Search</Text></Pressable>;
 * }
 */
export function useBrowser(options: BrowseOptions = {}): BrowseResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  const exec = useCallback(async (cmd: Record<string, any>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sendBrowseCommand(cmd, optsRef.current);
      return result;
    } catch (err: any) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const navigate = useCallback(async (url: string): Promise<PageContent> => {
    return exec({ cmd: 'navigate', url });
  }, [exec]);

  const click = useCallback(async (selector: string): Promise<PageContent> => {
    return exec({ cmd: 'click', selector });
  }, [exec]);

  const typeText = useCallback(async (selector: string, text: string): Promise<PageContent> => {
    return exec({ cmd: 'type_text', selector, text });
  }, [exec]);

  const extractContent = useCallback(async (): Promise<PageContent> => {
    return exec({ cmd: 'extract_content' });
  }, [exec]);

  const screenshot = useCallback(async (path?: string): Promise<string> => {
    return exec({ cmd: 'screenshot', path });
  }, [exec]);

  const back = useCallback(async (): Promise<PageContent> => {
    return exec({ cmd: 'back' });
  }, [exec]);

  const forward = useCallback(async (): Promise<PageContent> => {
    return exec({ cmd: 'forward' });
  }, [exec]);

  const refresh = useCallback(async (): Promise<PageContent> => {
    return exec({ cmd: 'refresh' });
  }, [exec]);

  const executeJs = useCallback(async (script: string): Promise<any> => {
    return exec({ cmd: 'execute_js', script });
  }, [exec]);

  const listTabs = useCallback(async () => {
    return exec({ cmd: 'list_tabs' });
  }, [exec]);

  const useTab = useCallback(async (index: number): Promise<PageContent> => {
    return exec({ cmd: 'use_tab', index });
  }, [exec]);

  const openTab = useCallback(async (url: string): Promise<void> => {
    return exec({ cmd: 'open_tab', url });
  }, [exec]);

  const ping = useCallback(async (): Promise<boolean> => {
    try {
      await exec({ cmd: 'ping' });
      return true;
    } catch {
      return false;
    }
  }, [exec]);

  const raw = useCallback(async (cmd: Record<string, any>): Promise<any> => {
    return exec(cmd);
  }, [exec]);

  return {
    navigate, click, typeText, extractContent, screenshot,
    back, forward, refresh, executeJs,
    listTabs, useTab, openTab,
    ping, raw,
    loading, error,
  };
}

// ── AI Tool Definitions ─────────────────────────────────

/**
 * Create ToolDefinition[] for AI agents to control the browser.
 *
 * These tools let an LLM autonomously browse the web, fill forms,
 * click buttons, and extract content — all through the stealth
 * browse session that avoids captchas and fingerprinting.
 *
 * @example
 * const { messages, send } = useChat({
 *   model: 'gpt-4',
 *   tools: [calculatorTool, ...createBrowserTools()],
 *   maxToolRounds: 20,
 * });
 * await send('Search DuckDuckGo for "React framework" and summarize the top 3 results');
 */
export function createBrowserTools(options: BrowseOptions = {}): ToolDefinition[] {
  const opts = { host: options.host, port: options.port };

  return [
    {
      name: 'browser_navigate',
      description: 'Navigate the browser to a URL. Returns the page content including text, links, and forms. Use this to visit websites.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to (e.g., "https://example.com")',
          },
        },
        required: ['url'],
      },
      execute: async ({ url }: { url: string }) => {
        const result = await sendBrowseCommand({ cmd: 'navigate', url }, opts);
        return formatPageResult(result);
      },
    },
    {
      name: 'browser_click',
      description: 'Click an element on the page by CSS selector. Returns the updated page content after clicking. Use this to follow links, submit forms, press buttons, etc.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the element to click (e.g., "button.submit", "a[href=\'/about\']", "#login-btn")',
          },
        },
        required: ['selector'],
      },
      execute: async ({ selector }: { selector: string }) => {
        const result = await sendBrowseCommand({ cmd: 'click', selector }, opts);
        return formatPageResult(result);
      },
    },
    {
      name: 'browser_type',
      description: 'Type text into an input field identified by CSS selector. Does NOT submit the form — use browser_click on the submit button after typing. Use for search boxes, form fields, text areas, etc.',
      parameters: {
        type: 'object',
        properties: {
          selector: {
            type: 'string',
            description: 'CSS selector for the input element (e.g., "input[name=\'q\']", "#search-box", "textarea.message")',
          },
          text: {
            type: 'string',
            description: 'The text to type into the input field',
          },
        },
        required: ['selector', 'text'],
      },
      execute: async ({ selector, text }: { selector: string; text: string }) => {
        const result = await sendBrowseCommand({ cmd: 'type_text', selector, text }, opts);
        return formatPageResult(result);
      },
    },
    {
      name: 'browser_extract',
      description: 'Re-extract the current page content without navigating. Use this after interactions that change the page (AJAX updates, dynamic content loading) to see the updated content.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const result = await sendBrowseCommand({ cmd: 'extract_content' }, opts);
        return formatPageResult(result);
      },
    },
    {
      name: 'browser_back',
      description: 'Go back to the previous page in browser history. Returns the page content.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const result = await sendBrowseCommand({ cmd: 'back' }, opts);
        return formatPageResult(result);
      },
    },
    {
      name: 'browser_tabs',
      description: 'List all open browser tabs with their titles and URLs. Use this to see what tabs are available before switching.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        return sendBrowseCommand({ cmd: 'list_tabs' }, opts);
      },
    },
    {
      name: 'browser_use_tab',
      description: 'Switch to a specific browser tab by its index number. Call browser_tabs first to see available tabs and their indices.',
      parameters: {
        type: 'object',
        properties: {
          index: {
            type: 'number',
            description: 'The tab index to switch to (0-based)',
          },
        },
        required: ['index'],
      },
      execute: async ({ index }: { index: number }) => {
        const result = await sendBrowseCommand({ cmd: 'use_tab', index }, opts);
        return formatPageResult(result);
      },
    },
    {
      name: 'browser_open_tab',
      description: 'Open a new browser tab in the background with the given URL. Does NOT switch to the new tab — use browser_tabs + browser_use_tab to switch.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to open in the new tab',
          },
        },
        required: ['url'],
      },
      execute: async ({ url }: { url: string }) => {
        await sendBrowseCommand({ cmd: 'open_tab', url }, opts);
        return { success: true, message: `Opened ${url} in a new background tab` };
      },
    },
    {
      name: 'browser_execute_js',
      description: 'Execute JavaScript code in the browser page context. Returns the result of the script. Use for extracting specific data, manipulating DOM, or interacting with page APIs.',
      parameters: {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description: 'JavaScript code to execute in the page context',
          },
        },
        required: ['script'],
      },
      execute: async ({ script }: { script: string }) => {
        return sendBrowseCommand({ cmd: 'execute_js', script }, opts);
      },
    },
    {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current browser page. Returns the screenshot as base64-encoded PNG data.',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        return sendBrowseCommand({ cmd: 'screenshot' }, opts);
      },
    },
  ];
}

// ── Helpers ─────────────────────────────────────────────

/**
 * Format a page content result for LLM consumption.
 * Truncates very long text to avoid flooding the context window.
 */
function formatPageResult(result: any): any {
  if (!result) return result;

  const formatted: any = {
    url: result.url,
    title: result.title,
  };

  // Truncate text for LLM context management
  if (result.text) {
    const maxLen = 8000;
    formatted.text = result.text.length > maxLen
      ? result.text.slice(0, maxLen) + '\n... [truncated]'
      : result.text;
  }

  // Include links (limit to first 50 for context size)
  if (result.links && result.links.length > 0) {
    formatted.links = result.links.slice(0, 50);
    if (result.links.length > 50) {
      formatted.links_truncated = `Showing 50 of ${result.links.length} links`;
    }
  }

  // Include forms
  if (result.forms && result.forms.length > 0) {
    formatted.forms = result.forms;
  }

  return formatted;
}
