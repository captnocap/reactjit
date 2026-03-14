/**
 * Content parser for .txt documentation files.
 *
 * Reads content/sections/ and parses each .txt file into structured data.
 * Split on === SECTION_NAME === markers, extract metadata, examples, etc.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import type {
  ParsedContent,
  ParsedDirectory,
  ContentMetadata,
  ContentExample,
  ParseError,
} from './types';

const VALID_PLATFORMS = ['love2d', 'web', 'terminal', 'cc', 'nvim', 'hs', 'awesome', 'all'];
const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

/**
 * Parse all .txt files in a content directory.
 * Expects structure: contentDir/sectionId/file.txt
 */
export function parseContentDirectory(contentDir: string): ParsedDirectory {
  const result: ParsedDirectory = {
    sections: {},
    allFiles: [],
    errors: [],
  };

  const sectionsDir = join(contentDir, 'sections');
  let sectionDirs: string[];

  try {
    sectionDirs = readdirSync(sectionsDir).filter(d => {
      try {
        return statSync(join(sectionsDir, d)).isDirectory();
      } catch {
        return false;
      }
    }).sort();
  } catch (err) {
    result.errors.push({ file: sectionsDir, message: `Cannot read sections directory: ${err}` });
    return result;
  }

  for (const sectionId of sectionDirs) {
    const sectionPath = join(sectionsDir, sectionId);
    const files = readdirSync(sectionPath).filter(f => f.endsWith('.txt')).sort();

    result.sections[sectionId] = {};

    for (const file of files) {
      const filePath = join(sectionPath, file);
      const fileKey = basename(file, '.txt');
      const relPath = `${sectionId}/${file}`;

      try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = parseContentFile(raw, relPath);
        result.sections[sectionId][fileKey] = parsed;
        result.allFiles.push(parsed);
      } catch (err) {
        result.errors.push({
          file: relPath,
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // Also parse examples/ if it exists
  const examplesDir = join(contentDir, 'examples');
  try {
    const exampleFiles = readdirSync(examplesDir).filter(f => f.endsWith('.txt')).sort();
    result.sections['examples'] = {};

    for (const file of exampleFiles) {
      const filePath = join(examplesDir, file);
      const fileKey = basename(file, '.txt');
      const relPath = `examples/${file}`;

      try {
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = parseContentFile(raw, relPath);
        result.sections['examples'][fileKey] = parsed;
        result.allFiles.push(parsed);
      } catch (err) {
        result.errors.push({
          file: relPath,
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  } catch {
    // examples/ directory is optional
  }

  return result;
}

/**
 * Parse a single .txt content file into structured data.
 */
export function parseContentFile(content: string, filePath: string): ParsedContent {
  // Split on === SECTION NAME === markers
  // The regex captures the section name between === markers
  const sectionRegex = /^=== (.+?) ===/gm;
  const sectionNames: string[] = [];
  const sectionBodies: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Collect all section boundaries
  const matches: { name: string; index: number; start: number; end: number }[] = [];
  while ((match = sectionRegex.exec(content)) !== null) {
    matches.push({
      name: match[1].trim(),
      index: match.index,                   // position of opening ===
      start: match.index + match[0].length, // position after closing ===
      end: 0, // filled in below
    });
  }

  // Fill end positions — use next marker's index (opening ===), not lastIndexOf
  for (let i = 0; i < matches.length; i++) {
    matches[i].end = i + 1 < matches.length
      ? matches[i + 1].index
      : content.length;
  }

  // Build section map
  const sectionMap: Record<string, string> = {};
  for (const m of matches) {
    const body = content.slice(m.start, m.end).trim();
    sectionMap[m.name] = body;
  }

  // Parse metadata
  const metadata = parseMetadata(sectionMap['METADATA'] || '', filePath);

  // Parse examples
  const examples = parseExamples(sectionMap['EXAMPLES'] || '');

  // Parse platform notes
  const platformNotes = parsePlatformNotes(sectionMap['PLATFORM NOTES'] || '');

  // Parse bullet lists
  const criticalRules = parseBulletList(sectionMap['CRITICAL RULES'] || '');
  const seeAlso = parseBulletList(sectionMap['SEE ALSO'] || '');

  return {
    filePath,
    metadata,
    sections: {
      overview: reflowProse(sectionMap['OVERVIEW'] || ''),
      api: sectionMap['API / SYNTAX'] || sectionMap['API'] || '',
      examples,
      platformNotes,
      commonPatterns: reflowProse(sectionMap['COMMON PATTERNS'] || ''),
      performance: reflowProse(sectionMap['PERFORMANCE'] || ''),
      criticalRules,
      seeAlso,
      code: sectionMap['CODE'] || '',
      explanation: reflowProse(sectionMap['EXPLANATION'] || ''),
    },
    raw: content,
  };
}

/**
 * Parse the METADATA section into a typed object.
 */
function parseMetadata(text: string, filePath: string): ContentMetadata {
  const result: Partial<ContentMetadata> = {
    platforms: [],
    keywords: [],
    related: [],
    difficulty: 'beginner',
  };

  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'title':
        result.title = value;
        break;
      case 'description':
        result.description = value;
        break;
      case 'category':
        result.category = value;
        break;
      case 'platforms':
        result.platforms = value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        break;
      case 'keywords':
        result.keywords = value.split(',').map(s => s.trim()).filter(Boolean);
        break;
      case 'related':
        result.related = value.split(',').map(s => s.trim()).filter(Boolean);
        break;
      case 'difficulty':
        if (VALID_DIFFICULTIES.includes(value.toLowerCase())) {
          result.difficulty = value.toLowerCase() as ContentMetadata['difficulty'];
        }
        break;
    }
  }

  // Defaults for missing required fields
  if (!result.title) result.title = basename(filePath, '.txt');
  if (!result.description) result.description = '';
  if (!result.category) result.category = 'Uncategorized';

  return result as ContentMetadata;
}

/**
 * Parse the EXAMPLES section.
 * Format:
 *   Example 1: Title
 *   ---
 *   code here
 *   ---
 *   Platforms: web, love2d
 */
function parseExamples(text: string): ContentExample[] {
  if (!text.trim()) return [];

  const examples: ContentExample[] = [];

  // Split on "Example N:" pattern
  const parts = text.split(/^Example \d+:\s*/m);

  for (const part of parts) {
    if (!part.trim()) continue;

    const lines = part.split('\n');
    const title = lines[0]?.trim() || 'Untitled';

    // Find code between --- delimiters
    const codeStart = lines.findIndex(l => l.trim() === '---');
    if (codeStart === -1) continue;

    const codeEnd = lines.findIndex((l, i) => i > codeStart && l.trim() === '---');
    if (codeEnd === -1) continue;

    const code = lines.slice(codeStart + 1, codeEnd).join('\n').trim();

    // Find platforms line after the closing ---
    const remaining = lines.slice(codeEnd + 1);
    const platformLine = remaining.find(l => l.trim().toLowerCase().startsWith('platforms:'));
    const platforms = platformLine
      ? platformLine.replace(/^platforms:\s*/i, '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : ['all'];

    examples.push({ title, code, platforms });
  }

  return examples;
}

/**
 * Parse the PLATFORM NOTES section.
 * Format:
 *   Love2D:
 *     bullet point
 *     bullet point
 *   Web:
 *     bullet point
 */
function parsePlatformNotes(text: string): Record<string, string> {
  if (!text.trim()) return {};

  const notes: Record<string, string> = {};
  const lines = text.split('\n');
  let currentPlatform: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    // Check for platform header (line ending with colon, not indented)
    const headerMatch = line.match(/^(\w[\w\s]*):\s*$/);
    if (headerMatch) {
      // Save previous platform
      if (currentPlatform) {
        notes[currentPlatform] = currentLines.join('\n').trim();
      }
      currentPlatform = headerMatch[1].trim();
      currentLines = [];
    } else if (currentPlatform && line.trim()) {
      currentLines.push(line.trimStart());
    }
  }

  // Save last platform
  if (currentPlatform) {
    notes[currentPlatform] = currentLines.join('\n').trim();
  }

  return notes;
}

/**
 * Collapse single newlines into spaces (prose reflow) while preserving
 * paragraph breaks (double newlines). This lets authors hard-wrap .txt
 * files at any column width without affecting rendered output.
 */
function reflowProse(text: string): string {
  if (!text) return text;
  // Normalize line endings to \n first
  const normalized = text.replace(/\r\n?/g, '\n');
  return normalized
    .split(/\n{2,}/)
    .map(para => para.replace(/\n/g, ' ').replace(/  +/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Parse a bullet list (used for CRITICAL RULES, SEE ALSO).
 * Supports: - item, * item, bullet item
 */
function parseBulletList(text: string): string[] {
  if (!text.trim()) return [];

  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
}
