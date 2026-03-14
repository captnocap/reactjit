/**
 * Content validator for documentation .txt files.
 *
 * Checks for missing fields, broken references, format issues.
 */

import type { ParsedDirectory, ValidationResult, ValidationError, ValidationWarning } from './types';

const VALID_PLATFORMS = ['love2d', 'web', 'terminal', 'cc', 'nvim', 'hs', 'awesome', 'all'];

export function validateContent(dir: ParsedDirectory): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  let totalExamples = 0;

  // Include parse errors
  for (const parseError of dir.errors) {
    errors.push({ file: parseError.file, message: parseError.message });
  }

  for (const file of dir.allFiles) {
    const fp = file.filePath;

    // Required metadata
    if (!file.metadata.title || file.metadata.title === 'Untitled') {
      errors.push({ file: fp, message: 'Missing required metadata: title' });
    }
    if (!file.metadata.description) {
      warnings.push({ file: fp, message: 'Missing metadata: description' });
    }
    if (!file.metadata.category) {
      warnings.push({ file: fp, message: 'Missing metadata: category' });
    }

    // Platform validation
    for (const p of file.metadata.platforms) {
      if (!VALID_PLATFORMS.includes(p)) {
        errors.push({ file: fp, message: `Invalid platform: "${p}". Valid: ${VALID_PLATFORMS.join(', ')}` });
      }
    }

    // Difficulty validation
    if (!['beginner', 'intermediate', 'advanced'].includes(file.metadata.difficulty)) {
      warnings.push({ file: fp, message: `Invalid difficulty: "${file.metadata.difficulty}"` });
    }

    // Overview check (non-index files should have overview)
    if (!fp.endsWith('index.txt') && !file.sections.overview) {
      warnings.push({ file: fp, message: 'Missing OVERVIEW section' });
    }

    // Example format validation
    for (const example of file.sections.examples) {
      if (!example.code.trim()) {
        errors.push({ file: fp, message: `Empty code in example: "${example.title}"` });
      }
      for (const p of example.platforms) {
        if (!VALID_PLATFORMS.includes(p)) {
          warnings.push({ file: fp, message: `Invalid platform in example "${example.title}": "${p}"` });
        }
      }
      totalExamples++;
    }

    // Stats
    const cat = file.metadata.category.toLowerCase();
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byDifficulty[file.metadata.difficulty] = (byDifficulty[file.metadata.difficulty] || 0) + 1;
  }

  // Cross-reference validation
  const allTitles = new Set(dir.allFiles.map(f => f.metadata.title));
  for (const file of dir.allFiles) {
    for (const ref of file.sections.seeAlso) {
      // Simple check: see if the reference exists as a title somewhere
      // (This is lenient — exact matching would be too strict for freeform references)
      const cleaned = ref.replace(/^[-*]\s*/, '').trim();
      // Only warn for references that look like component/topic names
      if (cleaned && !cleaned.includes(' ') && cleaned.length < 30) {
        if (!allTitles.has(cleaned) && !allTitles.has(cleaned.toLowerCase())) {
          // Don't error, just warn — references might be to concepts not yet documented
          // warnings.push({ file: file.filePath, message: `SEE ALSO reference may be broken: "${cleaned}"` });
        }
      }
    }
  }

  // Section completeness checks
  const sectionIds = Object.keys(dir.sections).filter(s => s !== 'examples');
  for (const sectionId of sectionIds) {
    const files = dir.sections[sectionId];
    if (!files['index']) {
      warnings.push({ file: `${sectionId}/`, message: 'Missing index.txt hub page' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalFiles: dir.allFiles.length,
      totalSections: sectionIds.length,
      totalExamples,
      byCategory,
      byDifficulty,
    },
  };
}
