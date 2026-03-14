#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const storiesDir = join(process.cwd(), 'storybook/src/stories');
const forbidden = [
  "alignItems: 'flex-start'",
  'alignItems: "flex-start"',
  "alignItems: 'start'",
  'alignItems: "start"',
  "justifyContent: 'flex-start'",
  'justifyContent: "flex-start"',
  "justifyContent: 'start'",
  'justifyContent: "start"',
];

const files = readdirSync(storiesDir).filter(f => f.endsWith('.tsx'));
const violations = [];

for (const file of files) {
  const fullPath = join(storiesDir, file);
  const src = readFileSync(fullPath, 'utf8');
  for (const token of forbidden) {
    const idx = src.indexOf(token);
    if (idx !== -1) {
      violations.push({ file, token });
    }
  }
}

if (violations.length > 0) {
  console.error('Story centering validation failed. Forbidden alignment tokens found:');
  for (const v of violations) {
    console.error(`- storybook/src/stories/${v.file}: ${v.token}`);
  }
  process.exit(1);
}

console.log('Story centering validation passed.');
