export type MarkdownNode =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'code'; content: string }
  | { type: 'codeblock'; language: string; content: string }
  | { type: 'heading'; level: number; content: string }
  | { type: 'list'; items: string[]; ordered: boolean }
  | { type: 'quote'; content: string }
  | { type: 'link'; text: string; url: string }
  | { type: 'rule' };

type InternalNode = MarkdownNode | { type: 'paragraph' };

export function parseInline(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let remaining = text;
  const patterns = [
    { regex: /`([^`]+)`/, type: 'code' },
    { regex: /\*\*([^*]+)\*\*/, type: 'bold' },
    { regex: /\*([^*]+)\*/, type: 'italic' },
    { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' },
  ];
  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; type: string } | null = null;
    for (const p of patterns) {
      const m = remaining.match(p.regex);
      if (m && (earliest === null || m.index! < earliest.index)) {
        earliest = { index: m.index!, match: m, type: p.type };
      }
    }
    if (earliest) {
      if (earliest.index > 0) {
        nodes.push({ type: 'text', content: remaining.slice(0, earliest.index) });
      }
      if (earliest.type === 'link') {
        nodes.push({ type: 'link', text: earliest.match[1], url: earliest.match[2] });
      } else {
        nodes.push({ type: earliest.type as any, content: earliest.match[1] });
      }
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    } else {
      nodes.push({ type: 'text', content: remaining });
      break;
    }
  }
  return nodes;
}

export function parseMarkdownInternal(text: string): InternalNode[] {
  const lines = text.split('\n');
  const nodes: InternalNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      const language = line.trimStart().slice(3).trim();
      i++;
      const contentLines: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        contentLines.push(lines[i]);
        i++;
      }
      nodes.push({ type: 'codeblock', language: language || 'text', content: contentLines.join('\n') });
      i++;
      continue;
    }
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      nodes.push({ type: 'heading', level: headingMatch[1].length, content: headingMatch[2].trim() });
      i++;
      continue;
    }
    if (line.match(/^---+$/) || line.match(/^\*{3,}$/)) {
      nodes.push({ type: 'rule' });
      i++;
      continue;
    }
    if (line.startsWith('> ')) {
      const contentLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        contentLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push({ type: 'quote', content: contentLines.join('\n') });
      continue;
    }
    const bulletMatch = line.match(/^-\s+(.*)/);
    if (bulletMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^-\s+(.*)/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      nodes.push({ type: 'list', items, ordered: false });
      continue;
    }
    const orderedMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\d+)\.\s+(.*)/);
        if (!m) break;
        items.push(m[2]);
        i++;
      }
      nodes.push({ type: 'list', items, ordered: true });
      continue;
    }
    if (line.trim() === '') {
      i++;
      const last = nodes[nodes.length - 1];
      if (last && (last as any).type !== 'paragraph') {
        nodes.push({ type: 'paragraph' });
      }
      continue;
    }
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trimStart().startsWith('```') &&
      !lines[i].match(/^#{1,6}\s/) &&
      !lines[i].match(/^---+/) &&
      !lines[i].match(/^\*{3,}$/) &&
      !lines[i].startsWith('> ') &&
      !lines[i].match(/^-\s+/) &&
      !lines[i].match(/^(\d+)\.\s+/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    const paraText = paraLines.join(' ');
    const inlineNodes = parseInline(paraText);
    nodes.push(...inlineNodes);
  }
  return nodes;
}

export function parseMarkdown(text: string): MarkdownNode[] {
  return parseMarkdownInternal(text) as MarkdownNode[];
}
