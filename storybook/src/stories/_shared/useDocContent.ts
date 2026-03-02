/**
 * Hook that resolves a doc key (e.g. "box", "scrollview", "useanimation")
 * to structured content from the generated content.json.
 *
 * This is the bridge between content/sections/*.txt and Layout1-style stories.
 * Pass a key, get back everything needed to render a doc page.
 */

import { useMemo } from 'react';
import contentData from '../../generated/content.json';

export interface DocContent {
  title: string;
  description: string;
  category: string;
  overview: string;
  importSnippet: string;
  usageSnippet: string;
  props: [string, string][];
  callbacks: [string, string][];
  examples: { title: string; code: string }[];
  criticalRules: string[];
  seeAlso: string[];
  difficulty: string;
}

/** Extract fenced code blocks from a markdown string. */
function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let inside = false;
  let current: string[] = [];

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inside) {
        blocks.push(current.join('\n'));
        current = [];
        inside = false;
      } else {
        inside = true;
      }
    } else if (inside) {
      current.push(line);
    }
  }
  return blocks;
}

/** Parse markdown table rows into [name, type][] pairs. */
function parsePropsTable(text: string): [string, string][] {
  const rows: [string, string][] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // Match table rows: | name | type | ... |
    // Skip separator rows (|---|---|)
    if (!line.includes('|')) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;

    const cells = trimmed.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;

    // Skip header row and separator row
    const name = cells[0];
    if (name === 'Prop' || name === 'Field' || /^-+$/.test(name)) continue;

    rows.push([name, cells[1]]);
  }
  return rows;
}

/** True if a prop name looks like a callback (onPress, onClick, etc.) */
function isCallback(name: string): boolean {
  return name.length > 2 && name.startsWith('on') && name[2] === name[2].toUpperCase();
}

/** Strip \r from content (content.json has CRLF from .txt sources). */
function clean(s: string): string {
  return s.replace(/\r/g, '');
}

/**
 * Resolve a doc key to structured content.
 *
 * @param docKey - Simple name like "box", "text", "scrollview", "useanimation"
 * @returns Structured doc content, or null if not found
 */
export function useDocContent(docKey: string): DocContent | null {
  return useMemo(() => {
    if (!docKey) return null;

    const key = docKey.toLowerCase();
    const allFiles = (contentData as any).allFiles as any[];
    const entry = allFiles.find((f: any) => {
      const fp = (f.filePath as string).toLowerCase();
      // Match "box" against "05-components/box.txt"
      const filename = fp.split('/').pop()?.replace('.txt', '') ?? '';
      return filename === key;
    });

    if (!entry) return null;

    const meta = entry.metadata;
    const sections = entry.sections;

    // Clean CRLF from API section before parsing
    const apiText = clean(sections.api || '');

    // Extract code blocks from the API section
    const codeBlocks = extractCodeBlocks(apiText);
    const importSnippet = codeBlocks[0] || '';
    const usageSnippet = codeBlocks[1] || '';

    // Parse props table from API section
    const allRows = parsePropsTable(apiText);
    const props: [string, string][] = [];
    const callbacks: [string, string][] = [];

    for (const row of allRows) {
      if (isCallback(row[0])) {
        callbacks.push(row);
      } else {
        props.push(row);
      }
    }

    // Map examples — strip markdown fences and CRLF from code
    const examples = (sections.examples || []).map((e: any) => {
      let code = clean(e.code || '');
      // Strip markdown fences if present (parser sometimes leaves them)
      code = code.replace(/^```\w*\n/, '').replace(/\n```\s*$/, '');
      return { title: e.title || '', code };
    });

    return {
      title: meta.title || docKey,
      description: clean(meta.description || ''),
      category: meta.category || '',
      overview: clean(sections.overview || ''),
      importSnippet,
      usageSnippet,
      props,
      callbacks,
      examples,
      criticalRules: (sections.criticalRules || []).map(clean),
      seeAlso: sections.seeAlso || [],
      difficulty: meta.difficulty || 'beginner',
    };
  }, [docKey]);
}
