import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  detectFormat,
  formatExtension,
  parseContent,
  serializeContent,
} from '../src/format.ts';

describe('storage JSON format semantics', () => {
  it('round-trips structured JSON content without losing shape', () => {
    const value = {
      title: 'ReactJIT',
      count: 3,
      active: true,
      tags: ['ui', 'runtime'],
      meta: { draft: false },
    };

    const serialized = serializeContent(value, 'json');
    assert.deepEqual(parseContent(serialized, 'json'), value);
  });

  it('surfaces invalid JSON instead of silently coercing it', () => {
    assert.throws(() => parseContent('{"title":', 'json'));
  });
});

describe('storage markdown format semantics', () => {
  it('parses frontmatter values into useful runtime types', () => {
    const doc = [
      '---',
      '# ignored comment',
      'title: ReactJIT',
      'published: true',
      'views: 42',
      'tags: [ui, tooling, 7]',
      'config: {"theme":"dark","draft":false}',
      'quoted: " spaced value "',
      '---',
      '',
      'Line one',
      'Line two',
    ].join('\n');

    assert.deepEqual(parseContent(doc, 'markdown'), {
      title: 'ReactJIT',
      published: true,
      views: 42,
      tags: ['ui', 'tooling', 7],
      config: { theme: 'dark', draft: false },
      quoted: ' spaced value ',
      content: 'Line one\nLine two',
    });
  });

  it('treats markdown without frontmatter as body content', () => {
    assert.deepEqual(parseContent('\nHello\n\nWorld\n', 'markdown'), {
      content: 'Hello\n\nWorld',
    });
  });

  it('round-trips frontmatter documents with arrays, objects, and body text', () => {
    const value = {
      title: 'Notebook',
      tags: ['notes', 'draft'],
      config: { autosave: true, retries: 2 },
      content: 'Remember to ship tests.',
    };

    const serialized = serializeContent(value, 'markdown');
    assert.deepEqual(parseContent(serialized, 'markdown'), value);
  });

  it('accepts CRLF frontmatter and body boundaries', () => {
    const doc = '---\r\ntitle: Windows\r\npublished: false\r\n---\r\n\r\nBody text';

    assert.deepEqual(parseContent(doc, 'markdown'), {
      title: 'Windows',
      published: false,
      content: 'Body text',
    });
  });

  it('parses yaml-like arrays, nulls, and single-quoted values in frontmatter', () => {
    const doc = [
      '---',
      'aliases: [alpha, "bravo", 7, false, null]',
      'deletedAt: ~',
      "owner: 'alice'",
      '---',
      '',
      'Body text',
    ].join('\n');

    assert.deepEqual(parseContent(doc, 'markdown'), {
      aliases: ['alpha', 'bravo', 7, false, null],
      deletedAt: null,
      owner: 'alice',
      content: 'Body text',
    });
  });

  it('serializes content-only markdown without adding frontmatter fences', () => {
    assert.equal(
      serializeContent({ content: 'Just the body' }, 'markdown'),
      'Just the body',
    );
  });
});

describe('storage text format semantics', () => {
  it('parses identifier-style key value lines into typed fields', () => {
    const text = [
      'name: reactjit',
      'count: 12',
      'enabled: true',
      'tags: [core, renderer]',
    ].join('\n');

    assert.deepEqual(parseContent(text, 'text'), {
      name: 'reactjit',
      count: 12,
      enabled: true,
      tags: ['core', 'renderer'],
    });
  });

  it('falls back to raw content when lines do not look like records', () => {
    const text = 'user-name: reactjit\njust prose';

    assert.deepEqual(parseContent(text, 'text'), {
      content: 'user-name: reactjit\njust prose',
    });
  });

  it('does not misclassify leading URLs as text record keys', () => {
    const text = 'https://example.com: ok';

    assert.deepEqual(parseContent(text, 'text'), {
      content: 'https://example.com: ok',
    });
  });

  it('serializes simple text records into key value lines', () => {
    assert.equal(
      serializeContent({ name: 'reactjit', count: 2, enabled: false }, 'text'),
      'name: reactjit\ncount: 2\nenabled: false',
    );
  });

  it('parses quoted strings, zero, and null values from text records', () => {
    const text = [
      "title: 'Release notes'",
      'count: 0',
      'deletedAt: null',
      'summary: " spaced out "',
    ].join('\n');

    assert.deepEqual(parseContent(text, 'text'), {
      title: 'Release notes',
      count: 0,
      deletedAt: null,
      summary: ' spaced out ',
    });
  });
});

describe('storage format identification', () => {
  it('maps logical formats to their canonical file extensions', () => {
    assert.equal(formatExtension('json'), '.json');
    assert.equal(formatExtension('markdown'), '.md');
    assert.equal(formatExtension('text'), '.txt');
  });

  it('detects markdown and text filenames and defaults everything else to json', () => {
    assert.equal(detectFormat('notes.md'), 'markdown');
    assert.equal(detectFormat('notes.txt'), 'text');
    assert.equal(detectFormat('notes.json'), 'json');
    assert.equal(detectFormat('notes.bin'), 'json');
  });
});
