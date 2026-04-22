// =============================================================================
// CHAT EXPORT — conversation export as markdown / JSON / plain text
// =============================================================================

const host: any = globalThis;

export interface ExportOptions {
  format: 'markdown' | 'json' | 'text';
  includeSystem?: boolean;
  includeMetadata?: boolean;
}

function execCmd(cmd: string): string {
  try {
    const out = host.__exec(cmd);
    return typeof out === 'string' ? out : String(out ?? '');
  } catch { return ''; }
}

function writeFile(path: string, content: string): boolean {
  try {
    host.__fs_write(path, content);
    return true;
  } catch { return false; }
}

export interface ChatMessage {
  role: string;
  text: string;
  time?: string;
  model?: string;
  mode?: string;
}

export function exportConversation(messages: ChatMessage[], opts: ExportOptions): string {
  if (opts.format === 'json') {
    return JSON.stringify(
      messages.map(m => ({
        role: m.role,
        content: m.text,
        ...(opts.includeMetadata ? { time: m.time, model: m.model, mode: m.mode } : {}),
      })),
      null,
      2
    );
  }

  if (opts.format === 'text') {
    return messages
      .map(m => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n\n---\n\n');
  }

  // Markdown
  const lines: string[] = ['# Conversation Export\n'];
  for (const m of messages) {
    const header = m.role === 'user' ? '## You' : '## Agent';
    const meta = opts.includeMetadata && m.model ? ` *(model: ${m.model}${m.mode ? `, mode: ${m.mode}` : ''})*` : '';
    lines.push(`${header}${meta}\n`);
    lines.push(m.text);
    lines.push('');
  }
  return lines.join('\n');
}

export function copyToClipboard(text: string): boolean {
  try {
    if (typeof host.__store_set === 'function') {
      // Use store as a clipboard proxy
      host.__store_set('cursor-ide.clipboard', text);
    }
    // Try exec-based clipboard
    const escaped = text.replace(/'/g, "'\"'\"'").replace(/\\/g, '\\\\');
    execCmd(`echo '${escaped}' | xclip -selection clipboard 2>/dev/null || echo '${escaped}' | wl-copy 2>/dev/null || true`);
    return true;
  } catch { return false; }
}

export function saveConversationToFile(messages: ChatMessage[], workDir: string, opts: ExportOptions): { ok: boolean; path?: string; error?: string } {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = opts.format === 'json' ? 'json' : opts.format === 'text' ? 'txt' : 'md';
  const path = `${workDir}/.cursor-ide/conversations/${timestamp}.${ext}`;

  // Ensure directory exists
  execCmd(`mkdir -p "${workDir}/.cursor-ide/conversations"`);

  const content = exportConversation(messages, opts);
  if (writeFile(path, content)) {
    return { ok: true, path };
  }
  return { ok: false, error: 'Failed to write file' };
}
