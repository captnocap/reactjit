#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const candidateStories = [
  'storybook/src/stories/BoxBasic.tsx',
  'storybook/src/stories/FlexRow.tsx',
  'storybook/src/stories/Gradient.tsx',
  'storybook/src/stories/MediaStory.tsx',
];

const marker = '@story-layout:required';
const missing = [];

for (const rel of candidateStories) {
  const abs = join(root, rel);
  const src = readFileSync(abs, 'utf8');
  if (!src.includes(marker)) {
    continue;
  }
  const hasImport = src.includes("from './_shared/StoryScaffold'") || src.includes('from "./_shared/StoryScaffold"');
  const hasPage = src.includes('<StoryPage>');
  const hasSection = src.includes('<StorySection ');
  if (!hasImport || !hasPage || !hasSection) {
    missing.push({
      file: rel,
      hasImport,
      hasPage,
      hasSection,
    });
  }
}

if (missing.length > 0) {
  console.error('Story layout validation failed. These files must use StoryScaffold:');
  for (const m of missing) {
    console.error(`- ${m.file} (import=${m.hasImport}, StoryPage=${m.hasPage}, StorySection=${m.hasSection})`);
  }
  process.exit(1);
}

console.log(`Story layout validation passed for files marked with ${marker}.`);
