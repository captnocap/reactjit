/**
 * Plaintext renderer for /llms.txt output.
 *
 * Takes parsed content and renders clean, token-efficient plaintext
 * designed for LLM consumption.
 */

import type { ParsedContent, ParsedDirectory, LlmsEndpoint } from './types';

const SEPARATOR = '========================================';
const SUB_SEPARATOR = '---------';

/**
 * Render a single parsed content file to plaintext.
 */
export function renderContentToPlaintext(content: ParsedContent): string {
  const parts: string[] = [];

  // Title
  parts.push(SEPARATOR);
  parts.push(content.metadata.title);
  parts.push(SEPARATOR);
  parts.push('');

  // Metadata line
  const metaParts: string[] = [];
  if (content.metadata.category) metaParts.push(`Category: ${content.metadata.category}`);
  if (content.metadata.difficulty) metaParts.push(`Difficulty: ${content.metadata.difficulty}`);
  if (content.metadata.platforms.length > 0) metaParts.push(`Platforms: ${content.metadata.platforms.join(', ')}`);
  if (metaParts.length > 0) {
    parts.push(metaParts.join(' | '));
    parts.push('');
  }

  // Description
  if (content.metadata.description) {
    parts.push(content.metadata.description);
    parts.push('');
  }

  // Overview
  if (content.sections.overview) {
    parts.push(SUB_SEPARATOR);
    parts.push('OVERVIEW');
    parts.push(SUB_SEPARATOR);
    parts.push('');
    parts.push(content.sections.overview);
    parts.push('');
  }

  // API / Syntax
  if (content.sections.api) {
    parts.push(SUB_SEPARATOR);
    parts.push('API / SYNTAX');
    parts.push(SUB_SEPARATOR);
    parts.push('');
    parts.push(content.sections.api);
    parts.push('');
  }

  // Examples
  if (content.sections.examples.length > 0) {
    parts.push(SUB_SEPARATOR);
    parts.push('EXAMPLES');
    parts.push(SUB_SEPARATOR);
    parts.push('');

    for (const example of content.sections.examples) {
      parts.push(`EXAMPLE: ${example.title}`);
      parts.push('--------');
      parts.push(example.code);
      parts.push('--------');
      if (example.platforms.length > 0) {
        parts.push(`Platforms: ${example.platforms.join(', ')}`);
      }
      parts.push('');
    }
  }

  // Code section (for examples/)
  if (content.sections.code) {
    parts.push(SUB_SEPARATOR);
    parts.push('CODE');
    parts.push(SUB_SEPARATOR);
    parts.push('');
    parts.push(content.sections.code);
    parts.push('');
  }

  // Platform notes
  const noteKeys = Object.keys(content.sections.platformNotes);
  if (noteKeys.length > 0) {
    parts.push(SUB_SEPARATOR);
    parts.push('PLATFORM NOTES');
    parts.push(SUB_SEPARATOR);
    parts.push('');

    for (const platform of noteKeys) {
      parts.push(`${platform}:`);
      parts.push(content.sections.platformNotes[platform]);
      parts.push('');
    }
  }

  // Common patterns
  if (content.sections.commonPatterns) {
    parts.push(SUB_SEPARATOR);
    parts.push('COMMON PATTERNS');
    parts.push(SUB_SEPARATOR);
    parts.push('');
    parts.push(content.sections.commonPatterns);
    parts.push('');
  }

  // Performance
  if (content.sections.performance) {
    parts.push(SUB_SEPARATOR);
    parts.push('PERFORMANCE');
    parts.push(SUB_SEPARATOR);
    parts.push('');
    parts.push(content.sections.performance);
    parts.push('');
  }

  // Critical rules
  if (content.sections.criticalRules.length > 0) {
    parts.push(SUB_SEPARATOR);
    parts.push('CRITICAL RULES');
    parts.push(SUB_SEPARATOR);
    parts.push('');

    for (const rule of content.sections.criticalRules) {
      parts.push(`* ${rule}`);
    }
    parts.push('');
  }

  // Explanation (for examples/)
  if (content.sections.explanation) {
    parts.push(SUB_SEPARATOR);
    parts.push('EXPLANATION');
    parts.push(SUB_SEPARATOR);
    parts.push('');
    parts.push(content.sections.explanation);
    parts.push('');
  }

  // See also
  if (content.sections.seeAlso.length > 0) {
    parts.push(SUB_SEPARATOR);
    parts.push('SEE ALSO');
    parts.push(SUB_SEPARATOR);
    parts.push('');

    for (const item of content.sections.seeAlso) {
      parts.push(`- ${item}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Render the full /llms.txt file (all documentation concatenated).
 */
export function renderFullDoc(dir: ParsedDirectory): string {
  const parts: string[] = [];

  parts.push(SEPARATOR);
  parts.push('ReactJIT Documentation');
  parts.push(SEPARATOR);
  parts.push('');
  parts.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  parts.push(`Total topics: ${dir.allFiles.length}`);
  parts.push(`Sections: ${Object.keys(dir.sections).filter(s => s !== 'examples').length}`);
  parts.push('');

  // Table of contents
  parts.push('TABLE OF CONTENTS');
  parts.push(SUB_SEPARATOR);
  parts.push('');

  const sectionIds = Object.keys(dir.sections).filter(s => s !== 'examples').sort();
  for (const sectionId of sectionIds) {
    const files = dir.sections[sectionId];
    const indexFile = files['index'];
    const title = indexFile?.metadata.title || sectionId;
    parts.push(`${sectionId}: ${title}`);
  }
  parts.push('');
  parts.push('');

  // All sections
  for (const sectionId of sectionIds) {
    const files = dir.sections[sectionId];
    const fileKeys = Object.keys(files).sort();

    // Put index first
    const orderedKeys = fileKeys.filter(k => k === 'index').concat(fileKeys.filter(k => k !== 'index'));

    for (const key of orderedKeys) {
      parts.push(renderContentToPlaintext(files[key]));
      parts.push('');
    }
  }

  // Examples section
  if (dir.sections['examples']) {
    parts.push('');
    parts.push(SEPARATOR);
    parts.push('CODE EXAMPLES');
    parts.push(SEPARATOR);
    parts.push('');

    for (const [key, content] of Object.entries(dir.sections['examples'])) {
      parts.push(renderContentToPlaintext(content));
      parts.push('');
    }
  }

  return parts.join('\n');
}

/**
 * Render a filtered subset of content for a specific endpoint.
 */
export function renderEndpoint(
  dir: ParsedDirectory,
  title: string,
  sectionFilter?: string[],
  categoryFilter?: string[],
): string {
  const parts: string[] = [];

  parts.push(SEPARATOR);
  parts.push(`ReactJIT ${title}`);
  parts.push(SEPARATOR);
  parts.push('');
  parts.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
  parts.push('');

  let files = dir.allFiles;

  if (sectionFilter) {
    files = files.filter(f => sectionFilter.some(s => f.filePath.startsWith(s)));
  }

  if (categoryFilter) {
    files = files.filter(f => categoryFilter.includes(f.metadata.category.toLowerCase()));
  }

  for (const file of files) {
    parts.push(renderContentToPlaintext(file));
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Generate the cheatsheet endpoint — a compact quick reference.
 */
export function renderCheatsheet(dir: ParsedDirectory): string {
  const parts: string[] = [];

  parts.push(SEPARATOR);
  parts.push('ReactJIT Quick Reference');
  parts.push(SEPARATOR);
  parts.push('');

  // Components list
  const components = dir.sections['05-components'];
  if (components) {
    parts.push('COMPONENTS');
    parts.push(SUB_SEPARATOR);
    for (const [key, content] of Object.entries(components)) {
      if (key === 'index') continue;
      parts.push(`<${content.metadata.title}> — ${content.metadata.description}`);
    }
    parts.push('');
  }

  // Hooks list
  const hooks = dir.sections['06-hooks'];
  if (hooks) {
    parts.push('HOOKS');
    parts.push(SUB_SEPARATOR);
    for (const [key, content] of Object.entries(hooks)) {
      if (key === 'index') continue;
      parts.push(`${content.metadata.title} — ${content.metadata.description}`);
    }
    parts.push('');
  }

  // Animation
  const animation = dir.sections['07-animation'];
  if (animation) {
    parts.push('ANIMATION');
    parts.push(SUB_SEPARATOR);
    for (const [key, content] of Object.entries(animation)) {
      if (key === 'index') continue;
      parts.push(`${content.metadata.title} — ${content.metadata.description}`);
    }
    parts.push('');
  }

  // CLI
  const cli = dir.sections['03-cli-reference'];
  if (cli) {
    parts.push('CLI COMMANDS');
    parts.push(SUB_SEPARATOR);
    for (const [key, content] of Object.entries(cli)) {
      if (key === 'index') continue;
      parts.push(`reactjit ${key} — ${content.metadata.description}`);
    }
    parts.push('');
  }

  // Critical rules
  const layout = dir.sections['04-layout-system'];
  const rulesFile = layout?.['critical-rules'];
  if (rulesFile && rulesFile.sections.criticalRules.length > 0) {
    parts.push('CRITICAL LAYOUT RULES');
    parts.push(SUB_SEPARATOR);
    for (const rule of rulesFile.sections.criticalRules) {
      parts.push(`* ${rule}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Generate the examples endpoint — all code examples extracted.
 */
export function renderExamplesEndpoint(dir: ParsedDirectory): string {
  const parts: string[] = [];

  parts.push(SEPARATOR);
  parts.push('ReactJIT Code Examples');
  parts.push(SEPARATOR);
  parts.push('');

  // Standalone examples
  if (dir.sections['examples']) {
    for (const [key, content] of Object.entries(dir.sections['examples'])) {
      parts.push(renderContentToPlaintext(content));
      parts.push('');
    }
  }

  // Extract examples from component docs
  parts.push('');
  parts.push('COMPONENT EXAMPLES');
  parts.push(SUB_SEPARATOR);
  parts.push('');

  for (const file of dir.allFiles) {
    if (file.sections.examples.length === 0) continue;
    if (file.filePath.startsWith('examples/')) continue;

    for (const example of file.sections.examples) {
      parts.push(`EXAMPLE: ${file.metadata.title} — ${example.title}`);
      parts.push('--------');
      parts.push(example.code);
      parts.push('--------');
      parts.push(`Platforms: ${example.platforms.join(', ')}`);
      parts.push('');
    }
  }

  return parts.join('\n');
}
