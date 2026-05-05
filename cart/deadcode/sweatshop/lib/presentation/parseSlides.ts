export interface ParsedSlide {
  id: string;
  index: number;
  title: string;
  body: string;
  notes: string;
  preview: string;
  sourcePath: string;
}

export interface ParsedDeck {
  title: string;
  sourcePath: string;
  kind: 'markdown' | 'tsx';
  slides: ParsedSlide[];
  error: string | null;
  raw: string;
}

function baseName(path: string): string {
  const clean = String(path || '').replace(/\\/g, '/');
  const slash = clean.lastIndexOf('/');
  return slash >= 0 ? clean.slice(slash + 1) : clean;
}

function clampText(text: string, max = 120): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

function splitMarkdownSlides(source: string): string[] {
  const chunks: string[] = [];
  let current: string[] = [];
  for (const line of String(source || '').split(/\r?\n/)) {
    if (line.trim() === '---') {
      if (current.length > 0) chunks.push(current.join('\n'));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks.length > 0 ? chunks : [String(source || '')];
}

function isNotesStart(line: string): boolean {
  return /^(:::?\s*(notes|speaker notes|speaker-notes)|<!--\s*notes\s*-->|notes:\s*)/i.test(line.trim());
}

function isNotesEnd(line: string): boolean {
  return /^(:::?\s*end|<!--\s*endnotes\s*-->|<!--\s*\/notes\s*-->)/i.test(line.trim());
}

function extractMarkdownSlide(block: string, index: number, sourcePath: string): ParsedSlide {
  const lines = String(block || '').split(/\r?\n/);
  const bodyLines: string[] = [];
  const noteLines: string[] = [];
  let inNotes = false;

  for (const line of lines) {
    if (!inNotes && isNotesStart(line)) {
      inNotes = true;
      continue;
    }
    if (inNotes && isNotesEnd(line)) {
      inNotes = false;
      continue;
    }
    (inNotes ? noteLines : bodyLines).push(line);
  }

  let title = '';
  const titleIndex = bodyLines.findIndex((line) => /^\s*#{1,3}\s+/.test(line));
  if (titleIndex >= 0) {
    title = bodyLines[titleIndex].replace(/^\s*#{1,3}\s+/, '').trim();
    bodyLines.splice(titleIndex, 1);
  } else {
    const firstLine = bodyLines.find((line) => line.trim().length > 0) || '';
    title = firstLine.trim().replace(/^[-*]\s+/, '') || `Slide ${index + 1}`;
    if (bodyLines.length > 0 && bodyLines[0].trim() === firstLine.trim()) bodyLines.shift();
  }

  const body = bodyLines.join('\n').trim();
  const notes = noteLines.join('\n').trim();
  return {
    id: `${sourcePath || 'deck'}-${index + 1}`,
    index,
    title,
    body,
    notes,
    preview: clampText(body || notes || title),
    sourcePath,
  };
}

function extractArrayExpression(source: string): string | null {
  const exports = [
    /export\s+const\s+slides\s*=\s*(\[[\s\S]*\])\s*;?/m,
    /export\s+default\s+(\[[\s\S]*\])\s*;?/m,
    /const\s+slides\s*=\s*(\[[\s\S]*\])\s*;?/m,
  ];
  for (const pattern of exports) {
    const match = String(source || '').match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

function normalizeSlideValue(value: any, index: number, sourcePath: string): ParsedSlide {
  if (typeof value === 'string') {
    return {
      id: `${sourcePath || 'deck'}-${index + 1}`,
      index,
      title: value.trim() || `Slide ${index + 1}`,
      body: '',
      notes: '',
      preview: clampText(value),
      sourcePath,
    };
  }

  const title = String(value?.title ?? value?.name ?? `Slide ${index + 1}`);
  const body = String(value?.body ?? value?.content ?? value?.text ?? '');
  const notes = String(value?.notes ?? value?.speakerNotes ?? '');
  const preview = clampText(value?.preview ?? body ?? notes ?? title);
  return {
    id: String(value?.id ?? `${sourcePath || 'deck'}-${index + 1}`),
    index,
    title,
    body,
    notes,
    preview,
    sourcePath,
  };
}

function parseTsxDeck(source: string, sourcePath: string): ParsedDeck {
  const expression = extractArrayExpression(source);
  if (!expression) {
    return {
      title: baseName(sourcePath).replace(/\.(tsx?|mdx?)$/i, '') || 'Presentation',
      sourcePath,
      kind: 'tsx',
      slides: [],
      error: 'Unsupported TSX presentation format. Export a plain slides array.',
      raw: source,
    };
  }

  try {
    const slidesValue = Function('"use strict"; return (' + expression + ');')();
    if (!Array.isArray(slidesValue)) {
      return {
        title: baseName(sourcePath).replace(/\.(tsx?|mdx?)$/i, '') || 'Presentation',
        sourcePath,
        kind: 'tsx',
        slides: [],
        error: 'Presentation TSX export did not evaluate to an array.',
        raw: source,
      };
    }
    const slides = slidesValue.map((slide, index) => normalizeSlideValue(slide, index, sourcePath));
    return {
      title: slides[0]?.title || baseName(sourcePath).replace(/\.(tsx?|mdx?)$/i, '') || 'Presentation',
      sourcePath,
      kind: 'tsx',
      slides,
      error: null,
      raw: source,
    };
  } catch (error: any) {
    return {
      title: baseName(sourcePath).replace(/\.(tsx?|mdx?)$/i, '') || 'Presentation',
      sourcePath,
      kind: 'tsx',
      slides: [],
      error: `Unable to evaluate TSX slides array: ${error?.message || String(error)}`,
      raw: source,
    };
  }
}

export function parseSlides(source: string, sourcePath: string): ParsedDeck {
  const path = String(sourcePath || '');
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (ext === 'tsx' || ext === 'ts') {
    return parseTsxDeck(source, sourcePath);
  }

  const slides = splitMarkdownSlides(source).map((block, index) => extractMarkdownSlide(block, index, sourcePath));
  return {
    title: slides[0]?.title || baseName(sourcePath).replace(/\.(md|markdown|mdx)$/i, '') || 'Presentation',
    sourcePath,
    kind: 'markdown',
    slides,
    error: null,
    raw: source,
  };
}
