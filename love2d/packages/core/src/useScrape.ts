/**
 * useScrape — Declarative web scraping with CSS selectors, as a one-liner.
 *
 * Two workflows:
 *
 * ── Expert mode: you know your selectors ───────────────────
 *
 *   const { data } = useScrape('https://example.com', {
 *     title: 'h1',
 *     price: '.product-price',
 *     link:  'a@href',
 *   });
 *
 * ── Guided mode: you don't know CSS ───────────────────────
 *
 *   const scrape = useScrape('https://example.com');
 *
 *   // Step 1: scrape.elements is a tagged catalog of everything on the page:
 *   //   [1]  h1           "Welcome to Example"
 *   //   [2]  p            "This is a demo page..."
 *   //   [3]  a            "More info"              href="https://..."
 *   //   [4]  img.hero                              src="/hero.jpg"
 *   //   [5]  div.price    "$19.99"
 *   //
 *   // Step 2: just point at what you want:
 *   scrape.pick({ title: 1, price: 5, link: 3 });
 *   //  → data = { title: "Welcome to Example", price: "$19.99", link: "More info" }
 *   //
 *   // Step 3: want an attribute instead of text?
 *   scrape.pick({ title: 1, link: { id: 3, attr: 'href' } });
 *   //  → data = { title: "Welcome to Example", link: "https://..." }
 *
 * Both modes pair naturally with useIFTTT:
 *
 *   const { data } = useScrape(priceUrl, { price: '.price' });
 *   useIFTTT(() => Number(data?.price) < 50, 'notification:Price dropped!');
 *
 * ── Selector syntax (expert mode) ─────────────────────────
 *   'tag'                 match by tag name, return text content
 *   '.class'              match by class name
 *   '#id'                 match by id attribute
 *   'tag.class'           tag + class combined
 *   'tag#id'              tag + id combined
 *   '.class1.class2'      multiple classes
 *   'parent child'        descendant combinator (simplified)
 *   'selector@attr'       extract attribute instead of text
 *   'selector@html'       extract inner HTML instead of text
 *   'h1:first'            force single result
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useBridge } from './context';

// ── Types ───────────────────────────────────────────────────

type SelectorMap = Record<string, string>;
type ScrapeResult<T extends SelectorMap> = {
  [K in keyof T]: string | string[] | null;
};

interface ScrapeOptions {
  /** Auto-refetch interval in ms (0 or undefined = no auto-refresh) */
  interval?: number;
  /** Request headers */
  headers?: Record<string, string>;
  /** Transform raw HTML before parsing (e.g. to fix malformed markup) */
  transform?: (html: string) => string;
  /** If true, always return arrays even for single matches */
  arrays?: boolean;
}

/** A tagged element in the page catalog (guided mode) */
export interface ScrapeElement {
  /** Sequential ID — use this number with pick() */
  id: number;
  /** HTML tag name */
  tag: string;
  /** CSS classes */
  classes: string[];
  /** HTML id attribute */
  htmlId: string;
  /** Text content (truncated) */
  text: string;
  /** Key attributes (href, src, alt, title, name, value, type, placeholder) */
  attrs: Record<string, string>;
  /** Simplified CSS path for reference (e.g. "body > div.container > h1") */
  path: string;
  /** How deep in the tree (0 = top level) */
  depth: number;
}

/** Pick target: just an ID number, or { id, attr } to extract an attribute */
export type PickTarget = number | { id: number; attr: string };

/** Pick map: field name → element ID or { id, attr } */
export type PickMap = Record<string, PickTarget>;

interface ScrapeReturn<T extends SelectorMap> {
  /** Extracted data keyed by selector names (or pick names) */
  data: Partial<ScrapeResult<T>> | Record<string, string | null> | null;
  /** True while fetching */
  loading: boolean;
  /** Error message if fetch or parse failed */
  error: string | null;
  /** Raw HTML from last successful fetch */
  html: string | null;
  /** Tagged element catalog — every meaningful element on the page */
  elements: ScrapeElement[];
  /** Re-fetch and re-parse */
  refetch: () => void;
  /** Change the URL dynamically */
  setUrl: (url: string | null) => void;
  /** Manually override data values */
  set: (overrides: Record<string, any>) => void;
  /**
   * Guided mode: point at elements by ID to extract their content.
   *
   * @example
   * // Text content
   * scrape.pick({ title: 1, price: 5 })
   *
   * // Attribute extraction
   * scrape.pick({ link: { id: 3, attr: 'href' }, image: { id: 4, attr: 'src' } })
   */
  pick: (map: PickMap) => void;
}

// ── Minimal HTML parser ─────────────────────────────────────
// No DOM needed. Parses HTML into a tree, then queries with CSS selectors
// or tags every element with a sequential ID for guided mode. Works in QuickJS.

interface HNode {
  tag: string;
  attrs: Record<string, string>;
  classes: string[];
  id: string;
  text: string;
  innerHTML: string;
  children: HNode[];
  parent: HNode | null;
  /** Sequential catalog ID assigned during tagging */
  catalogId?: number;
}

// Void elements that don't have closing tags
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Tags to skip in the element catalog (structural/invisible)
const SKIP_TAGS = new Set([
  'html', 'head', 'body', 'meta', 'link', 'base',
  'noscript', 'template',
]);

// Attributes worth surfacing in the catalog
const NOTABLE_ATTRS = [
  'href', 'src', 'alt', 'title', 'name', 'value',
  'type', 'placeholder', 'action', 'data-testid',
];

function parseHTML(html: string): HNode {
  // Strip comments, doctypes, scripts, styles
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');

  const root: HNode = {
    tag: 'root', attrs: {}, classes: [], id: '',
    text: '', innerHTML: html, children: [], parent: null,
  };
  const stack: HNode[] = [root];

  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)(\s*\/?)>/g;
  let lastIndex = 0;
  let m;

  while ((m = tagRe.exec(html))) {
    const [full, tagName, attrStr, selfClose] = m;
    const tag = tagName.toLowerCase();
    const isClosing = full[1] === '/';
    const parent = stack[stack.length - 1];

    const textBetween = html.slice(lastIndex, m.index);
    const trimmed = textBetween.replace(/\s+/g, ' ').trim();
    if (trimmed && parent) {
      parent.text += (parent.text ? ' ' : '') + decodeEntities(trimmed);
    }
    lastIndex = m.index + full.length;

    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack[i].innerHTML = html.slice(
            html.indexOf('>', html.indexOf('<' + tag)) + 1,
            m.index,
          );
          stack.length = i;
          break;
        }
      }
    } else {
      const attrs = parseAttrs(attrStr);
      const classes = (attrs.class || '').split(/\s+/).filter(Boolean);
      const node: HNode = {
        tag, attrs, classes,
        id: attrs.id || '',
        text: '', innerHTML: '',
        children: [], parent,
      };
      parent.children.push(node);

      if (!selfClose && !VOID_TAGS.has(tag)) {
        stack.push(node);
      }
    }
  }

  const remaining = html.slice(lastIndex).replace(/\s+/g, ' ').trim();
  if (remaining && stack.length > 0) {
    const parent = stack[stack.length - 1];
    parent.text += (parent.text ? ' ' : '') + decodeEntities(remaining);
  }

  return root;
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([\w\-:]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    attrs[m[1]] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
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
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// ── Element catalog builder ─────────────────────────────────
// Walks the tree and assigns sequential IDs to every "interesting"
// element. Skips structural/invisible tags. This is the browseable
// map that makes guided mode work.

function buildCatalog(root: HNode): ScrapeElement[] {
  const catalog: ScrapeElement[] = [];
  let nextId = 1;

  function walk(node: HNode, depth: number, pathParts: string[]) {
    if (node.tag === 'root') {
      for (const child of node.children) {
        walk(child, 0, []);
      }
      return;
    }

    // Build CSS-like path segment
    let segment = node.tag;
    if (node.id) segment += '#' + node.id;
    for (const cls of node.classes.slice(0, 2)) segment += '.' + cls;
    const path = [...pathParts, segment].join(' > ');

    // Decide if this element is worth showing
    const isInteresting = !SKIP_TAGS.has(node.tag) && (
      // Has text content
      node.text.trim().length > 0 ||
      // Has notable attributes (links, images, inputs)
      NOTABLE_ATTRS.some(a => a in node.attrs) ||
      // Is a semantic element (headings, lists, tables, forms)
      /^(h[1-6]|a|img|input|button|select|textarea|table|th|td|li|label|form|nav|header|footer|main|article|section|figure|figcaption|blockquote|pre|code|video|audio|iframe)$/.test(node.tag)
    );

    if (isInteresting) {
      const id = nextId++;
      node.catalogId = id;

      // Pick notable attributes
      const notable: Record<string, string> = {};
      for (const attr of NOTABLE_ATTRS) {
        if (node.attrs[attr]) {
          notable[attr] = node.attrs[attr];
        }
      }

      catalog.push({
        id,
        tag: node.tag,
        classes: node.classes,
        htmlId: node.id,
        text: deepText(node).slice(0, 120),
        attrs: notable,
        path,
        depth,
      });
    }

    for (const child of node.children) {
      walk(child, depth + 1, [...pathParts, segment]);
    }
  }

  walk(root, 0, []);
  return catalog;
}

/** Given a catalog and a pick map, resolve element IDs to extracted values */
function resolvePickMap(root: HNode, catalog: ScrapeElement[], pickMap: PickMap): Record<string, string | null> {
  // Build ID → node lookup
  const nodeById = new Map<number, HNode>();
  function indexNodes(node: HNode) {
    if (node.catalogId != null) nodeById.set(node.catalogId, node);
    for (const child of node.children) indexNodes(child);
  }
  indexNodes(root);

  const result: Record<string, string | null> = {};
  for (const [key, target] of Object.entries(pickMap)) {
    const id = typeof target === 'number' ? target : target.id;
    const attr = typeof target === 'number' ? undefined : target.attr;
    const node = nodeById.get(id);
    if (!node) {
      result[key] = null;
    } else {
      result[key] = extractValue(node, attr);
    }
  }
  return result;
}

// ── CSS selector matcher ────────────────────────────────────

interface ParsedSelector {
  tag?: string;
  classes: string[];
  id?: string;
}

function parseSelector(raw: string): { parts: ParsedSelector[]; attr?: string; first?: boolean } {
  let attr: string | undefined;
  let first = false;

  const atIdx = raw.lastIndexOf('@');
  if (atIdx > 0) {
    attr = raw.slice(atIdx + 1);
    raw = raw.slice(0, atIdx);
  }

  if (raw.endsWith(':first')) {
    first = true;
    raw = raw.slice(0, -6);
  }

  const segments = raw.trim().split(/\s+/);
  const parts: ParsedSelector[] = [];

  for (const seg of segments) {
    const part: ParsedSelector = { classes: [] };
    const tokens = seg.split(/(?=[.#])/);
    for (const token of tokens) {
      if (token.startsWith('#')) part.id = token.slice(1);
      else if (token.startsWith('.')) part.classes.push(token.slice(1));
      else if (token) part.tag = token.toLowerCase();
    }
    parts.push(part);
  }

  return { parts, attr, first };
}

function matchesSimple(node: HNode, sel: ParsedSelector): boolean {
  if (sel.tag && node.tag !== sel.tag) return false;
  if (sel.id && node.id !== sel.id) return false;
  for (const cls of sel.classes) {
    if (!node.classes.includes(cls)) return false;
  }
  return true;
}

function matchesChain(node: HNode, parts: ParsedSelector[]): boolean {
  if (parts.length === 0) return true;
  if (!matchesSimple(node, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;

  let ancestor: HNode | null = node.parent;
  let pi = parts.length - 2;
  while (ancestor && pi >= 0) {
    if (matchesSimple(ancestor, parts[pi])) pi--;
    ancestor = ancestor.parent;
  }
  return pi < 0;
}

function deepText(node: HNode): string {
  let result = node.text;
  for (const child of node.children) {
    const childText = deepText(child);
    if (childText) result += (result ? ' ' : '') + childText;
  }
  return result.trim();
}

function querySelectorAll(root: HNode, selector: string): { nodes: HNode[]; attr?: string; first?: boolean } {
  const { parts, attr, first } = parseSelector(selector);
  const results: HNode[] = [];

  function walk(node: HNode) {
    if (matchesChain(node, parts)) results.push(node);
    for (const child of node.children) walk(child);
  }

  walk(root);
  return { nodes: results, attr, first };
}

function extractValue(node: HNode, attr?: string): string {
  if (attr === 'html') return node.innerHTML;
  if (attr) return node.attrs[attr] || '';
  return deepText(node);
}

// ── The hook ────────────────────────────────────────────────

/**
 * Expert mode: provide selectors up front.
 *   useScrape(url, { title: 'h1', price: '.price' })
 *
 * Guided mode: omit selectors, browse elements, then pick().
 *   const s = useScrape(url);
 *   // s.elements → tagged catalog
 *   // s.pick({ title: 1, price: 5 })
 */
export function useScrape<T extends SelectorMap>(
  initialUrl: string | null,
  selectors?: T,
  options?: ScrapeOptions,
): ScrapeReturn<T> {
  const [url, setUrl] = useState(initialUrl);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(url != null);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [elements, setElements] = useState<ScrapeElement[]>([]);
  const [fetchCount, setFetchCount] = useState(0);
  const [pickMap, setPickMap] = useState<PickMap | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const selectorsRef = useRef(selectors);
  selectorsRef.current = selectors;

  // Keep the parsed tree around so pick() can work after fetch
  const treeRef = useRef<HNode | null>(null);
  const catalogRef = useRef<ScrapeElement[]>([]);

  // Extract data from HTML using selectors (expert mode)
  const extractWithSelectors = useCallback((root: HNode, sels: SelectorMap): Record<string, any> => {
    const opts = optionsRef.current;
    const result: Record<string, string | string[] | null> = {};

    for (const [key, selector] of Object.entries(sels)) {
      const { nodes, attr, first } = querySelectorAll(root, selector);
      if (nodes.length === 0) {
        result[key] = null;
      } else if (first || (nodes.length === 1 && !opts?.arrays)) {
        result[key] = extractValue(nodes[0], attr);
      } else {
        result[key] = nodes.map(n => extractValue(n, attr));
      }
    }
    return result;
  }, []);

  // Fetch + parse
  // rjit-ignore-next-line — Dep-driven: re-fetches and parses HTML when url/fetchCount changes
  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      setError(null);
      setHtml(null);
      setElements([]);
      treeRef.current = null;
      catalogRef.current = [];
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const opts = optionsRef.current;
    const fetchOpts: RequestInit = {};
    if (opts?.headers) fetchOpts.headers = opts.headers;

    fetch(url, fetchOpts)
      .then((res: any) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((rawHtml: string) => {
        if (cancelled) return;

        const transformed = opts?.transform ? opts.transform(rawHtml) : rawHtml;
        const root = parseHTML(transformed);
        treeRef.current = root;

        // Always build catalog (even in expert mode — it's cheap)
        const catalog = buildCatalog(root);
        catalogRef.current = catalog;
        setElements(catalog);
        setHtml(rawHtml);

        // Extract data if selectors were provided
        const sels = selectorsRef.current;
        if (sels && Object.keys(sels).length > 0) {
          setData(extractWithSelectors(root, sels));
        } else if (pickMap) {
          // Re-resolve pick map against new HTML
          setData(resolvePickMap(root, catalog, pickMap));
        }

        setLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [url, fetchCount, extractWithSelectors, pickMap]);

  // Auto-refetch interval via Lua timer
  const bridge = useBridge();
  const intervalMs = options?.interval;

  // rjit-ignore-next-line — Dep-driven: manages Lua-side timer for auto-refetch interval
  useEffect(() => {
    if (!intervalMs || intervalMs <= 0 || !url) return;

    const eventName = `scrape:timer:${++_scrapeTimerCounter}`;
    let timerId: number | null = null;

    bridge.rpc<{ id: number }>('timer:create', {
      interval: intervalMs,
      event: eventName,
    }).then(res => { timerId = res.id; });

    const unsub = bridge.subscribe(eventName, () => {
      setFetchCount(c => c + 1);
    });

    return () => {
      unsub();
      if (timerId != null) bridge.rpc('timer:cancel', { id: timerId });
    };
  }, [bridge, intervalMs, url]);

  const refetch = useCallback(() => setFetchCount(c => c + 1), []);

  const set = useCallback((overrides: Record<string, any>) => {
    setData((prev: any) => prev ? { ...prev, ...overrides } : overrides);
  }, []);

  // Guided mode: pick elements by ID
  const pick = useCallback((map: PickMap) => {
    setPickMap(map);

    // If we already have a parsed tree, resolve immediately
    const root = treeRef.current;
    const catalog = catalogRef.current;
    if (root && catalog.length > 0) {
      setData(resolvePickMap(root, catalog, map));
    }
  }, []);

  return { data, loading, error, html, elements, refetch, setUrl, set, pick };
}

let _scrapeTimerCounter = 0;
