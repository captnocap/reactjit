/**
 * Types for the content-first documentation system.
 *
 * Content .txt files are parsed into these structures,
 * then rendered to plaintext (/llms.txt) or React components.
 */

export interface ContentMetadata {
  title: string;
  description: string;
  category: string;
  platforms: string[];
  keywords: string[];
  related: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ContentExample {
  title: string;
  code: string;
  platforms: string[];
}

export interface ParsedContent {
  /** File path relative to content/sections/ */
  filePath: string;
  metadata: ContentMetadata;
  sections: {
    overview: string;
    api: string;
    examples: ContentExample[];
    platformNotes: Record<string, string>;
    commonPatterns: string;
    performance: string;
    criticalRules: string[];
    seeAlso: string[];
    /** Raw code section (used by examples/) */
    code: string;
    /** Explanation section (used by examples/) */
    explanation: string;
  };
  /** Raw text of the entire file */
  raw: string;
}

export interface ParsedDirectory {
  /** Section ID → files map. e.g. "05-components" → { "box": ParsedContent, ... } */
  sections: Record<string, Record<string, ParsedContent>>;
  /** Flat list of all parsed files */
  allFiles: ParsedContent[];
  /** Parse errors encountered */
  errors: ParseError[];
}

export interface ParseError {
  file: string;
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    totalFiles: number;
    totalSections: number;
    totalExamples: number;
    byCategory: Record<string, number>;
    byDifficulty: Record<string, number>;
  };
}

export interface ValidationError {
  file: string;
  message: string;
}

export interface ValidationWarning {
  file: string;
  message: string;
}

/** Configuration for which /llms.txt endpoints to generate */
export interface LlmsEndpoint {
  /** Output filename (e.g. "components.txt") */
  filename: string;
  /** Human-readable title */
  title: string;
  /** Which section IDs to include */
  sectionFilter?: string[];
  /** Which categories to include */
  categoryFilter?: string[];
  /** Custom renderer (overrides default) */
  custom?: (dir: ParsedDirectory) => string;
}
