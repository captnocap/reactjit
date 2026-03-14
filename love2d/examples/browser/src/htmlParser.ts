// Minimal HTML parser — turns raw HTML string into a simple node tree.
// No dependencies. Designed to run inside QuickJS.

export interface HtmlNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>;
  children?: HtmlNode[];
  text?: string;
}

const SELF_CLOSING = new Set([
  'br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base',
  'col', 'embed', 'source', 'track', 'wbr',
]);

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'svg', 'canvas', 'iframe',
  'object', 'embed', 'applet', 'head',
]);

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_][\w\-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function parseHtml(html: string): HtmlNode[] {
  const root: HtmlNode[] = [];
  const stack: HtmlNode[][] = [root];

  // Strip comments and doctype
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '');

  const tagRe = /<\/?([a-zA-Z][\w-]*)((?:\s+[^>]*?)?)(\s*\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let skipUntil: string | null = null;

  while ((m = tagRe.exec(html)) !== null) {
    if (m[4] !== undefined) {
      // Text node
      if (skipUntil) continue;
      const text = decodeEntities(m[4]).replace(/\s+/g, ' ');
      if (text.trim()) {
        const parent = stack[stack.length - 1];
        parent.push({ type: 'text', text: text.trim() });
      }
      continue;
    }

    const fullMatch = m[0];
    const tag = m[1].toLowerCase();
    const attrStr = m[2] || '';
    const isClosing = fullMatch.startsWith('</');
    const isSelfClose = m[3]?.includes('/') || SELF_CLOSING.has(tag);

    if (skipUntil) {
      if (isClosing && tag === skipUntil) {
        skipUntil = null;
      }
      continue;
    }

    if (isClosing) {
      // Pop stack until we find a matching open tag
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }

    if (SKIP_TAGS.has(tag)) {
      if (!isSelfClose) {
        skipUntil = tag;
      }
      continue;
    }

    const node: HtmlNode = {
      type: 'element',
      tag,
      attrs: parseAttrs(attrStr),
      children: [],
    };

    const parent = stack[stack.length - 1];
    parent.push(node);

    if (!isSelfClose) {
      stack.push(node.children!);
    }
  }

  return root;
}

// Tags that are purely structural wrappers — unwrap their children inline
const TRANSPARENT_TAGS = new Set([
  'center', 'tbody', 'thead', 'tfoot', 'font', 'span', 'div',
  'section', 'article', 'main', 'header', 'footer', 'aside',
  'figure', 'figcaption', 'details', 'summary',
]);

// Flatten the tree: unwrap transparent wrappers, promote their children.
// This turns deeply nested table-based layouts into a flat content stream.
export function flattenTree(nodes: HtmlNode[]): HtmlNode[] {
  const result: HtmlNode[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      result.push(node);
      continue;
    }

    const tag = node.tag || '';
    const children = node.children || [];

    // Table cells: unwrap and flatten their children
    if (tag === 'td' || tag === 'th') {
      result.push(...flattenTree(children));
      continue;
    }

    // Table rows: unwrap, flatten cells
    if (tag === 'tr') {
      // Collect cell contents, separate with spacing
      const rowContent = flattenTree(children);
      if (rowContent.length > 0) {
        result.push({
          type: 'element',
          tag: 'p',
          children: rowContent,
        });
      }
      continue;
    }

    // Tables: completely unwrap
    if (tag === 'table') {
      result.push(...flattenTree(children));
      continue;
    }

    // Transparent wrappers: unwrap
    if (TRANSPARENT_TAGS.has(tag)) {
      result.push(...flattenTree(children));
      continue;
    }

    // Keep semantic tags but flatten their children
    if (children.length > 0) {
      result.push({
        ...node,
        children: flattenTree(children),
      });
    } else {
      result.push(node);
    }
  }

  return result;
}

// Extract the <body> if present, then flatten structural wrappers
export function extractBody(nodes: HtmlNode[]): HtmlNode[] {
  function findTag(list: HtmlNode[], tag: string): HtmlNode | null {
    for (const n of list) {
      if (n.type === 'element' && n.tag === tag) return n;
      if (n.children) {
        const found = findTag(n.children, tag);
        if (found) return found;
      }
    }
    return null;
  }

  const body = findTag(nodes, 'body');
  const bodyChildren = body?.children ?? nodes;
  return flattenTree(bodyChildren);
}
