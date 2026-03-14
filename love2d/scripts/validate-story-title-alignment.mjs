#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const storiesDir = join(process.cwd(), 'storybook/src/stories');
const files = readdirSync(storiesDir).filter(f => f.endsWith('.tsx'));
const bad = [];

for (const file of files) {
  const src = readFileSync(join(storiesDir, file), 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (line.includes("textAlign: 'center'") && />\s*\d+\./.test(line)) {
      bad.push(`${file}:${i + 1}`);
    }
  });
}

if (bad.length) {
  console.error('Section titles must be left-aligned. Centered numbered headings found at:');
  bad.forEach(v => console.error(`- storybook/src/stories/${v}`));
  process.exit(1);
}

console.log('Story title alignment validation passed.');

