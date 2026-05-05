import type { ToolDefinition } from './types';

// Browser-automation agent tools. The reference ships a ~400 line
// wrapper around Love2D's browser bridge; sweatshop exposes `__exec`
// (one-shot shell) only, so we drive the existing `browse` Python
// package through it. Each tool spawns a short Python script that
// attaches to the user's browser session and returns JSON.
//
// If `__exec` is missing (non-dev host), registerBrowseTools returns an
// empty list so the AI playground renders without crashing.

function hostExec(): ((cmd: string) => Promise<string>) | null {
  const host: any = globalThis as any;
  if (typeof host.__exec !== 'function') return null;
  return (cmd: string) => {
    try {
      const out = host.__exec(cmd);
      if (out && typeof out.then === 'function') return out;
      return Promise.resolve(typeof out === 'string' ? out : String(out ?? ''));
    } catch (e: any) {
      return Promise.reject(e);
    }
  };
}

function escapePy(s: string): string {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function py(script: string): string {
  // Run via python3 -c. Caller builds the script body; we quote + exec.
  return "python3 -c \"" + script.replace(/"/g, '\\"').replace(/\n/g, ';') + "\"";
}

function attachBlock(tail: string): string {
  return [
    'from browse import AgentBrowser',
    'agent = AgentBrowser.connect()',
    tail,
    'agent.detach()',
  ].join('\n');
}

export const browseGoto: ToolDefinition = {
  name: 'browseGoto',
  description: 'Navigate to a URL in the user\'s browser; returns page text + links as JSON.',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string', description: 'Destination URL' } },
    required: ['url'],
  },
  async execute(args: { url: string }) {
    const exec = hostExec();
    if (!exec) return { ok: false, error: 'host __exec unavailable' };
    const script = attachBlock([
      'c = agent.navigate("' + escapePy(args.url) + '")',
      'import json',
      'print(json.dumps({"title": c.title, "url": c.url, "text": c.for_llm()[:6000], "links": c.links[:40]}))',
    ].join('\n'));
    const out = await exec(py(script));
    try { return JSON.parse(out); } catch { return { ok: false, raw: out }; }
  },
};

export const browseClick: ToolDefinition = {
  name: 'browseClick',
  description: 'Click an element by CSS selector in the user\'s browser.',
  parameters: {
    type: 'object',
    properties: { selector: { type: 'string', description: 'CSS selector to click' } },
    required: ['selector'],
  },
  async execute(args: { selector: string }) {
    const exec = hostExec();
    if (!exec) return { ok: false, error: 'host __exec unavailable' };
    const script = attachBlock([
      'agent.click("' + escapePy(args.selector) + '")',
      'c = agent.extract_content()',
      'import json',
      'print(json.dumps({"title": c.title, "url": c.url, "text": c.for_llm()[:6000]}))',
    ].join('\n'));
    const out = await exec(py(script));
    try { return JSON.parse(out); } catch { return { ok: false, raw: out }; }
  },
};

export const browseExtract: ToolDefinition = {
  name: 'browseExtract',
  description: 'Re-extract current page content as text + links + forms.',
  parameters: { type: 'object', properties: {} },
  async execute(_args: any) {
    const exec = hostExec();
    if (!exec) return { ok: false, error: 'host __exec unavailable' };
    const script = attachBlock([
      'c = agent.extract_content()',
      'import json',
      'print(json.dumps({"title": c.title, "url": c.url, "text": c.for_llm()[:8000], "links": c.links[:40], "forms": c.forms[:10]}))',
    ].join('\n'));
    const out = await exec(py(script));
    try { return JSON.parse(out); } catch { return { ok: false, raw: out }; }
  },
};

export function browseTools(): ToolDefinition[] {
  if (!hostExec()) return [];
  return [browseGoto, browseClick, browseExtract];
}
