
import type { Message } from '../../lib/ai/types';

// Cheap heuristic token counter. OpenAI BPE is ~4 chars/token on
// English prose; we use 3.7 to bias slightly high so UI budget
// indicators don't underestimate. Good enough for dashboards + a
// "you've used X / cap Y" indicator. Not a substitute for the
// server-reported usage counts you get back in responses.

const CHARS_PER_TOKEN = 3.7;
const OVERHEAD_PER_MESSAGE = 4; // role/content envelope rough cost

function stringify(content: Message['content']): string {
  if (typeof content === 'string') return content;
  let s = '';
  for (const b of content) {
    if (b.type === 'text' && b.text) s += b.text;
    else if (b.type === 'image_url') s += '[image]';
  }
  return s;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessageTokens(m: Message): number {
  let total = OVERHEAD_PER_MESSAGE;
  total += estimateTokens(stringify(m.content));
  if (m.toolCalls) {
    for (const tc of m.toolCalls) {
      total += estimateTokens(tc.name) + estimateTokens(tc.arguments || '') + 4;
    }
  }
  return total;
}

export function useTokenCount(messages: Message[]): { total: number; perMessage: number[] } {
  return useMemo(() => {
    const perMessage = messages.map(estimateMessageTokens);
    let total = 0;
    for (const n of perMessage) total += n;
    return { total, perMessage };
  }, [messages]);
}
