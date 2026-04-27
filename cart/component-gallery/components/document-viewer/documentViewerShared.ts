export type DocumentBlock =
  | { type: 'heading'; level: 1 | 2 | 3; id: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered?: boolean; items: string[] }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'code'; code: string; lang?: string; title?: string; filename?: string }
  | { type: 'divider' };

export type DocumentModel = {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  blocks: DocumentBlock[];
};

export type DocumentSize = 'compact' | 'comfortable';

export const SAMPLE_DOCUMENT: DocumentModel = {
  title: 'On the Shape of Documents',
  subtitle: 'A short essay on rendered text',
  author: 'J. Marginal',
  date: '2026-04-25',
  blocks: [
    {
      type: 'heading',
      level: 1,
      id: 'introduction',
      text: 'Introduction',
    },
    {
      type: 'paragraph',
      text:
        'A document is a long-lived arrangement of glyphs on a page. Unlike a chat message, it is meant to be ' +
        'returned to. The viewer should respect that — the page must read the same at any size.',
    },
    {
      type: 'paragraph',
      text:
        'This viewer composes a paper surface, a toolbar, and an outline. None of them know about the others. ' +
        'They just take props.',
    },
    { type: 'heading', level: 2, id: 'page', text: 'The Page' },
    {
      type: 'paragraph',
      text:
        'The page is a soft cream surface with a thin edge. It carries margins generous enough that the ' +
        'reader is never crowded.',
    },
    {
      type: 'list',
      items: [
        'Cream surface, not pure white — easier on the eye.',
        'Inner padding scales with viewer size.',
        'No drop shadow at small sizes; subtle at large sizes.',
      ],
    },
    { type: 'heading', level: 2, id: 'toolbar', text: 'The Toolbar' },
    {
      type: 'paragraph',
      text:
        'A dark strip at the top carries the title, the current section, and the size/zoom controls. At small ' +
        'sizes it collapses to just the title.',
    },
    {
      type: 'quote',
      text: 'A toolbar should know less about the document than the document knows about itself.',
      attribution: 'Anon., margin note',
    },
    { type: 'heading', level: 3, id: 'code', text: 'A note on code' },
    {
      type: 'paragraph',
      text:
        'Code blocks are mono, dark, and wrap. They are intentionally not syntax-highlighted — the viewer is ' +
        'not a programming editor.',
    },
    {
      type: 'code',
      lang: 'ts',
      title: 'Size Fit',
      filename: 'fit.ts',
      code: 'function fit(view: { w: number; h: number }) {\n  return view.w < 540 ? "compact" : "comfortable";\n}',
    },
    { type: 'divider' },
    { type: 'heading', level: 2, id: 'outline', text: 'The Outline' },
    {
      type: 'paragraph',
      text:
        'The outline lists every heading. It collapses at small sizes. The active section is highlighted; ' +
        'clicking a section is a no-op for now and just paints the selection.',
    },
    {
      type: 'list',
      ordered: true,
      items: ['Headings register their id.', 'Outline reads the registered list.', 'Selection is local state.'],
    },
  ],
};

export function collectOutline(doc: DocumentModel) {
  const out: { id: string; text: string; level: 1 | 2 | 3 }[] = [];
  for (const block of doc.blocks) {
    if (block.type === 'heading') {
      out.push({ id: block.id, text: block.text, level: block.level });
    }
  }
  return out;
}
