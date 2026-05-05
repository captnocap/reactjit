
import { stripDotSlash } from '../../theme';

export type MarkdownInlineNode =
  | { type: 'text'; content: string }
  | { type: 'code'; content: string }
  | { type: 'strong'; content: string }
  | { type: 'em'; content: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'image'; alt: string; src: string };

export type MarkdownBlock =
  | { type: 'heading'; level: number; id: string; content: MarkdownInlineNode[]; text: string; line: number }
  | { type: 'paragraph'; content: MarkdownInlineNode[]; text: string; line: number }
  | { type: 'list'; ordered: boolean; items: MarkdownInlineNode[][]; text: string; line: number }
  | { type: 'quote'; content: MarkdownInlineNode[]; text: string; line: number }
  | { type: 'codeblock'; language: string; content: string; text: string; line: number }
  | { type: 'table'; header: MarkdownInlineNode[][]; rows: MarkdownInlineNode[][][]; text: string; line: number }
  | { type: 'image'; alt: string; src: string; text: string; line: number }
  | { type: 'hr'; text: string; line: number };

export type MarkdownHeading = { id: string; level: number; text: string; line: number };

export type MarkdownSearchEntry = { id: string; label: string; text: string; line: number; kind: string };

export type MarkdownAst = {
  blocks: MarkdownBlock[];
  headings: MarkdownHeading[];
  search: MarkdownSearchEntry[];
};

const INLINE_PATTERNS = [
  { type: 'image', regex: /!\[([^\]]*)\]\(([^)]+)\)/ },
  { type: 'link', regex: /\[([^\]]+)\]\(([^)]+)\)/ },
  { type: 'code', regex: /`([^`]+)`/ },
  { type: 'strong', regex: /\*\*([^*]+)\*\*/ },
  { type: 'em', regex: /\*([^*]+)\*/ },
];

function slugify(text: string): string {
  const slug = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || 'section';
}

function plainText(nodes: MarkdownInlineNode[]): string {
  return nodes.map((node) => {
    if (node.type === 'link') return node.text;
    if (node.type === 'image') return node.alt;
    return node.content;
  }).join('');
}

function parseInline(text: string): MarkdownInlineNode[] {
  const nodes: MarkdownInlineNode[] = [];
  let remaining = String(text || '');
  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; type: MarkdownInlineNode['type'] } | null = null;
    for (const pattern of INLINE_PATTERNS) {
      const match = remaining.match(pattern.regex);
      if (match && match.index != null && (earliest === null || match.index < earliest.index)) {
        earliest = { index: match.index, match, type: pattern.type as any };
      }
    }
    if (!earliest) {
      nodes.push({ type: 'text', content: remaining });
      break;
    }
    if (earliest.index > 0) nodes.push({ type: 'text', content: remaining.slice(0, earliest.index) });
    if (earliest.type === 'link') nodes.push({ type: 'link', text: earliest.match[1], url: earliest.match[2] });
    else if (earliest.type === 'image') nodes.push({ type: 'image', alt: earliest.match[1], src: earliest.match[2] });
    else nodes.push({ type: earliest.type, content: earliest.match[1] });
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }
  return nodes;
}

export function parseInlineMarkdown(text: string): MarkdownInlineNode[] {
  return parseInline(text);
}

function splitTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isDividerRow(line: string): boolean {
  return /^\s*\|?[:\-\s|]+\|?\s*$/.test(line) && /-/.test(line);
}

function parseTable(lines: string[], start: number): { block: MarkdownBlock; next: number } | null {
  if (start + 1 >= lines.length) return null;
  const headerLine = lines[start];
  const dividerLine = lines[start + 1];
  if (!headerLine.includes('|') || !isDividerRow(dividerLine)) return null;
  const header = splitTableRow(headerLine).map(parseInline);
  const rows: MarkdownInlineNode[][][] = [];
  let i = start + 2;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) break;
    if (!line.includes('|')) break;
    rows.push(splitTableRow(line).map(parseInline));
    i += 1;
  }
  const text = [headerLine, ...lines.slice(start + 2, i)].join('\n');
  return { block: { type: 'table', header, rows, text, line: start + 1 }, next: i };
}

function parseMarkdown(source: string): MarkdownAst {
  const lines = String(source || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  const headings: MarkdownHeading[] = [];
  const search: MarkdownSearchEntry[] = [];
  let i = 0;

  const pushBlock = (block: MarkdownBlock) => {
    blocks.push(block);
    if (block.type === 'heading') headings.push({ id: block.id, level: block.level, text: block.text, line: block.line });
    search.push({
      id: block.type === 'heading' ? block.id : `${block.type}-${block.line}-${blocks.length}`,
      label: block.type,
      text: block.text,
      line: block.line,
      kind: block.type,
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') { i += 1; continue; }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim() || 'text';
      const content: string[] = [];
      const lineNo = i + 1;
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        content.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      pushBlock({ type: 'codeblock', language, content: content.join('\n'), text: content.join('\n'), line: lineNo });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const text = headingMatch[2].trim();
      pushBlock({ type: 'heading', level: headingMatch[1].length, id: slugify(text), content: parseInline(text), text, line: i + 1 });
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      pushBlock({ type: 'hr', text: trimmed, line: i + 1 });
      i += 1;
      continue;
    }

    const table = parseTable(lines, i);
    if (table) {
      pushBlock(table.block);
      i = table.next;
      continue;
    }

    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      const lineNo = i + 1;
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        quoteLines.push(lines[i].trimStart().replace(/^>\s?/, ''));
        i += 1;
      }
      const text = quoteLines.join(' ');
      pushBlock({ type: 'quote', content: parseInline(text), text, line: lineNo });
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.*)$/);
    const unordered = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ordered || unordered) {
      const items: MarkdownInlineNode[][] = [];
      const textParts: string[] = [];
      const lineNo = i + 1;
      while (i < lines.length) {
        const current = lines[i].trim();
        const m1 = current.match(/^\d+\.\s+(.*)$/);
        const m2 = current.match(/^[-*+]\s+(.*)$/);
        const content = m1 ? m1[1] : m2 ? m2[1] : null;
        if (content == null) break;
        items.push(parseInline(content));
        textParts.push(content);
        i += 1;
      }
      pushBlock({ type: 'list', ordered: !!ordered, items, text: textParts.join(' '), line: lineNo });
      continue;
    }

    if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      const imageMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imageMatch) {
        pushBlock({ type: 'image', alt: imageMatch[1], src: imageMatch[2], text: imageMatch[1] || imageMatch[2], line: i + 1 });
        i += 1;
        continue;
      }
    }

    const paraLines: string[] = [];
    const lineNo = i + 1;
    while (i < lines.length) {
      const current = lines[i];
      const currentTrim = current.trim();
      if (
        currentTrim === '' ||
        currentTrim.startsWith('```') ||
        /^#{1,6}\s+/.test(currentTrim) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(currentTrim) ||
        currentTrim.startsWith('>') ||
        /^\d+\.\s+/.test(currentTrim) ||
        /^[-*+]\s+/.test(currentTrim)
      ) break;
      paraLines.push(current);
      i += 1;
    }
    const text = paraLines.join(' ').trim();
    if (text) pushBlock({ type: 'paragraph', content: parseInline(text), text, line: lineNo });
    else i += 1;
  }

  return { blocks, headings, search };
}

export function useMarkdownAst(source: string): MarkdownAst {
  return useMemo(() => parseMarkdown(source), [source]);
}

export function markdownPlainText(node: MarkdownBlock | MarkdownInlineNode): string {
  if ((node as MarkdownBlock).type === 'heading' || (node as MarkdownBlock).type === 'paragraph' || (node as MarkdownBlock).type === 'quote') {
    return plainText((node as any).content || []);
  }
  if ((node as MarkdownBlock).type === 'list') {
    return ((node as any).items || []).map((item: MarkdownInlineNode[]) => plainText(item)).join(' ');
  }
  if ((node as MarkdownBlock).type === 'codeblock') return (node as any).content || '';
  if ((node as MarkdownBlock).type === 'table') {
    return [
      ...(node as any).header.map((cell: MarkdownInlineNode[]) => plainText(cell)),
      ...((node as any).rows || []).flat().map((cell: MarkdownInlineNode[]) => plainText(cell)),
    ].join(' ');
  }
  if ((node as MarkdownBlock).type === 'image') return ((node as any).alt || '') + ' ' + ((node as any).src || '');
  if ((node as MarkdownInlineNode).type === 'image') return (node as any).alt || '';
  if ((node as MarkdownInlineNode).type === 'link') return (node as any).text || '';
  return (node as any).content || '';
}

export function resolveMarkdownLink(basePath: string, url: string): string {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl) return '';
  if (cleanUrl.startsWith('#')) return cleanUrl;
  if (/^[a-z]+:\/\//i.test(cleanUrl) || cleanUrl.startsWith('mailto:')) return cleanUrl;
  if (cleanUrl.startsWith('/')) return stripDotSlash(cleanUrl);
  const base = String(basePath || '');
  const idx = base.lastIndexOf('/');
  const parent = idx >= 0 ? base.slice(0, idx) : '';
  return stripDotSlash((parent ? parent + '/' : '') + cleanUrl);
}
