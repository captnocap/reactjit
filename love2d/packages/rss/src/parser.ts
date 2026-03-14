/**
 * XML-to-Feed parser. Zero dependencies — uses a minimal tag-based XML parser
 * that works in QuickJS (no DOMParser) and all other targets.
 */

import type { Feed, FeedItem } from './types';

// ── Minimal XML parser ──────────────────────────────────
// Extracts a flat list of { tag, attrs, text, children } nodes.
// Good enough for RSS/Atom. Not a full XML parser.

interface XMLNode {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  children: XMLNode[];
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /(\w[\w\-:.]*)=["']([^"']*?)["']/g;
  let m;
  while ((m = re.exec(s))) attrs[m[1]] = m[2];
  return attrs;
}

function parseXML(xml: string): XMLNode {
  // Strip XML declaration, processing instructions, comments, DOCTYPE
  xml = xml.replace(/<\?[^?]*\?>/g, '');
  xml = xml.replace(/<!--[\s\S]*?-->/g, '');
  xml = xml.replace(/<!DOCTYPE[^>]*>/gi, '');

  const root: XMLNode = { tag: 'root', attrs: {}, text: '', children: [] };
  const stack: XMLNode[] = [root];

  const tagRe = /<\/?([a-zA-Z][\w\-:.]*)([^>]*?)(\/?)>/g;
  let lastIndex = 0;
  let m;

  while ((m = tagRe.exec(xml))) {
    const [full, tagName, attrStr, selfClose] = m;
    const isClosing = full[1] === '/';
    const parent = stack[stack.length - 1];

    // Text between tags
    const textBetween = xml.slice(lastIndex, m.index).trim();
    if (textBetween && parent) {
      parent.text += textBetween;
    }
    lastIndex = m.index + full.length;

    if (isClosing) {
      // Pop stack — find matching open tag
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag.toLowerCase() === tagName.toLowerCase()) {
          stack.length = i;
          break;
        }
      }
    } else {
      const node: XMLNode = {
        tag: tagName.toLowerCase(),
        attrs: parseAttrs(attrStr),
        text: '',
        children: [],
      };
      parent.children.push(node);
      if (!selfClose) {
        stack.push(node);
      }
    }
  }

  return root;
}

// ── Node helpers ────────────────────────────────────────

function find(node: XMLNode, tag: string): XMLNode | undefined {
  return node.children.find(c => c.tag === tag || c.tag.endsWith(':' + tag));
}

function findAll(node: XMLNode, tag: string): XMLNode[] {
  return node.children.filter(c => c.tag === tag || c.tag.endsWith(':' + tag));
}

function text(node: XMLNode, tag: string): string {
  const child = find(node, tag);
  return child ? decodeCDATA(child.text) : '';
}

function attr(node: XMLNode, tag: string, attrName: string): string {
  const child = find(node, tag);
  return child?.attrs[attrName] ?? '';
}

function decodeCDATA(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

// ── Thumbnail extraction ────────────────────────────────

function extractThumbnail(node: XMLNode): string | null {
  // media:thumbnail
  const mediaThumbnail = find(node, 'media:thumbnail');
  if (mediaThumbnail?.attrs.url) return mediaThumbnail.attrs.url;

  // media:content with medium="image"
  const mediaContent = find(node, 'media:content');
  if (mediaContent?.attrs.medium === 'image' && mediaContent.attrs.url) return mediaContent.attrs.url;
  if (mediaContent?.attrs.url && /\.(jpg|jpeg|png|gif|webp)/i.test(mediaContent.attrs.url)) return mediaContent.attrs.url;

  // itunes:image
  const itunesImage = find(node, 'itunes:image');
  if (itunesImage?.attrs.href) return itunesImage.attrs.href;

  // Extract first <img> from description
  const desc = text(node, 'description') || text(node, 'content:encoded') || '';
  const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];

  return null;
}

// ── Enclosure extraction ────────────────────────────────

function extractEnclosure(node: XMLNode): FeedItem['enclosure'] {
  const enc = find(node, 'enclosure');
  if (enc?.attrs.url) {
    return {
      url: enc.attrs.url,
      type: enc.attrs.type || '',
      length: parseInt(enc.attrs.length || '0', 10),
    };
  }
  // Atom: link with rel="enclosure"
  const links = findAll(node, 'link');
  for (const link of links) {
    if (link.attrs.rel === 'enclosure' && link.attrs.href) {
      return {
        url: link.attrs.href,
        type: link.attrs.type || '',
        length: parseInt(link.attrs.length || '0', 10),
      };
    }
  }
  return null;
}

// ── RSS 2.0 parser ──────────────────────────────────────

function parseRSS2(channel: XMLNode): Feed {
  const items = findAll(channel, 'item').map((item): FeedItem => ({
    id: text(item, 'guid') || text(item, 'link') || text(item, 'title'),
    title: text(item, 'title'),
    link: text(item, 'link'),
    description: text(item, 'description'),
    content: text(item, 'content:encoded') || null,
    pubDate: text(item, 'pubdate') || text(item, 'dc:date') || null,
    author: text(item, 'author') || text(item, 'dc:creator') || null,
    categories: findAll(item, 'category').map(c => decodeCDATA(c.text)),
    enclosure: extractEnclosure(item),
    thumbnail: extractThumbnail(item),
  }));

  const imageNode = find(channel, 'image');
  const image = imageNode ? text(imageNode, 'url') : null;

  return {
    title: text(channel, 'title'),
    description: text(channel, 'description'),
    link: text(channel, 'link'),
    language: text(channel, 'language') || null,
    lastBuildDate: text(channel, 'lastbuilddate') || text(channel, 'pubdate') || null,
    image: image || attr(channel, 'itunes:image', 'href') || null,
    type: 'rss2',
    items,
  };
}

// ── Atom parser ─────────────────────────────────────────

function atomLink(node: XMLNode): string {
  const links = findAll(node, 'link');
  const alt = links.find(l => l.attrs.rel === 'alternate' || !l.attrs.rel);
  return alt?.attrs.href || links[0]?.attrs.href || '';
}

function parseAtom(feedNode: XMLNode): Feed {
  const items = findAll(feedNode, 'entry').map((entry): FeedItem => {
    const content = text(entry, 'content') || text(entry, 'summary') || '';
    return {
      id: text(entry, 'id') || atomLink(entry) || text(entry, 'title'),
      title: text(entry, 'title'),
      link: atomLink(entry),
      description: text(entry, 'summary') || content,
      content: content || null,
      pubDate: text(entry, 'published') || text(entry, 'updated') || null,
      author: text(find(entry, 'author') ?? entry, 'name') || null,
      categories: findAll(entry, 'category').map(c => c.attrs.term || decodeCDATA(c.text)),
      enclosure: extractEnclosure(entry),
      thumbnail: extractThumbnail(entry),
    };
  });

  return {
    title: text(feedNode, 'title'),
    description: text(feedNode, 'subtitle') || '',
    link: atomLink(feedNode),
    language: feedNode.attrs['xml:lang'] || null,
    lastBuildDate: text(feedNode, 'updated') || null,
    image: find(feedNode, 'icon')?.text || find(feedNode, 'logo')?.text || null,
    type: 'atom',
    items,
  };
}

// ── RSS 1.0 (RDF) parser ───────────────────────────────

function parseRSS1(root: XMLNode): Feed {
  const channel = find(root, 'channel') || root;
  const items = findAll(root, 'item').map((item): FeedItem => ({
    id: item.attrs['rdf:about'] || text(item, 'link') || text(item, 'title'),
    title: text(item, 'title'),
    link: text(item, 'link'),
    description: text(item, 'description'),
    content: text(item, 'content:encoded') || null,
    pubDate: text(item, 'dc:date') || null,
    author: text(item, 'dc:creator') || null,
    categories: findAll(item, 'dc:subject').map(c => decodeCDATA(c.text)),
    enclosure: extractEnclosure(item),
    thumbnail: extractThumbnail(item),
  }));

  return {
    title: text(channel, 'title'),
    description: text(channel, 'description'),
    link: text(channel, 'link'),
    language: text(channel, 'dc:language') || null,
    lastBuildDate: text(channel, 'dc:date') || null,
    image: null,
    type: 'rss1',
    items,
  };
}

// ── Public API ──────────────────────────────────────────

/**
 * Parse an XML string into a normalized Feed object.
 * Supports RSS 2.0, Atom 1.0, and RSS 1.0 (RDF).
 */
export function parseFeed(xml: string): Feed {
  const root = parseXML(xml);

  // RSS 2.0: <rss><channel>...
  const rss = find(root, 'rss');
  if (rss) {
    const channel = find(rss, 'channel');
    if (channel) return parseRSS2(channel);
  }

  // Atom: <feed>...
  const atomFeed = find(root, 'feed');
  if (atomFeed) return parseAtom(atomFeed);

  // RSS 1.0 (RDF): <rdf:rdf>... or just has <channel> + <item> at root
  const rdf = root.children.find(c => c.tag === 'rdf:rdf' || c.tag.includes(':rdf'));
  if (rdf) return parseRSS1(rdf);

  // Fallback: look for <channel> directly
  const channel = find(root, 'channel');
  if (channel) return parseRSS2(channel);

  return {
    title: '',
    description: '',
    link: '',
    language: null,
    lastBuildDate: null,
    image: null,
    type: 'unknown',
    items: [],
  };
}
