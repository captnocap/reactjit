import type { Message } from './types';

// Prompt templates + few-shot builders. Two common shapes:
//  1. render(template, vars)      — fill {{var}} placeholders
//  2. buildMessages(spec)          — assemble system + few-shot + user

export type PromptTemplate = {
  id: string;
  title: string;
  description?: string;
  system?: string;
  user: string;   // may contain {{placeholders}}
  examples?: Array<{ user: string; assistant: string }>;
};

const registry = new Map<string, PromptTemplate>();

export function registerTemplate(tmpl: PromptTemplate): void {
  registry.set(tmpl.id, tmpl);
}

export function getTemplate(id: string): PromptTemplate | undefined {
  return registry.get(id);
}

export function listTemplates(): PromptTemplate[] {
  return Array.from(registry.values());
}

export function render(text: string, vars: Record<string, string | number> = {}): string {
  return String(text).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? '' : String(v);
  });
}

export function buildMessages(
  template: PromptTemplate,
  vars: Record<string, string | number>,
): Message[] {
  const out: Message[] = [];
  if (template.system) out.push({ role: 'system', content: render(template.system, vars) });
  for (const ex of (template.examples || [])) {
    out.push({ role: 'user', content: render(ex.user, vars) });
    out.push({ role: 'assistant', content: render(ex.assistant, vars) });
  }
  out.push({ role: 'user', content: render(template.user, vars) });
  return out;
}

// Bundled baseline templates — useful defaults for the playground.
registerTemplate({
  id: 'default.chat',
  title: 'Generic chat',
  system: 'You are a helpful assistant.',
  user: '{{input}}',
});

registerTemplate({
  id: 'default.rewrite',
  title: 'Rewrite for clarity',
  system: 'Rewrite the user\'s text for clarity and brevity. Preserve meaning; do not add claims.',
  user: '{{input}}',
});

registerTemplate({
  id: 'default.code-review',
  title: 'Code review',
  system: 'Review the supplied code. Point out bugs, concurrency issues, and unused code. Cite line numbers.',
  user: '```\n{{code}}\n```',
});
