import React, { useState } from 'react';
import { Box, Text, Pressable, CodeBlock } from '@reactjit/core';
import { C } from './theme';

// ── HTML code block with inline preview ──────────────────────────────────────

export function HtmlCodeBlock({ code }: { code: string }) {
  const [showPreview, setShowPreview] = useState(true);

  return (
    <Box style={{ borderRadius: 6, borderWidth: 1, borderColor: C.border, overflow: 'hidden' }}>
      <Box style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 6, paddingLeft: 10, paddingRight: 10, backgroundColor: C.surfaceActive,
      }}>
        <Box style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: C.accent, fontWeight: 'bold', fontFamily: 'monospace' }}>HTML</Text>
          <Text style={{ fontSize: 9, color: C.textDim }}>{`${Math.round(code.length / 1024)}kb`}</Text>
        </Box>
        <Box style={{ flexDirection: 'row', gap: 4 }}>
          <TabBtn label="Preview" active={showPreview} onPress={() => setShowPreview(true)} />
          <TabBtn label="Code" active={!showPreview} onPress={() => setShowPreview(false)} />
          <TabBtn label="Copy" active={false} onPress={() => {
            try { (globalThis as any).__rjitBridge?.rpc('clipboard:set', code); } catch {}
          }} />
        </Box>
      </Box>
      {showPreview ? (
        <Box style={{ padding: 12, backgroundColor: '#ffffff', minHeight: 100 }}>
          <HtmlPreview html={code} />
        </Box>
      ) : (
        <CodeBlock code={code} language="html" style={{ borderRadius: 0 }} />
      )}
    </Box>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered }) => (
        <Box style={{
          paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 4,
          backgroundColor: active ? C.accent : hovered ? C.surfaceHover : C.surface,
        }}>
          <Text style={{ fontSize: 9, color: active ? '#fff' : C.textMuted, fontWeight: 'bold' }}>{label}</Text>
        </Box>
      )}
    </Pressable>
  );
}

// ── HTML parser types ────────────────────────────────────────────────────────

interface HtmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: (HtmlNode | string)[];
}

// ── Parser ───────────────────────────────────────────────────────────────────

function parseHtml(html: string): HtmlNode[] {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : html;

  const styles: Record<string, Record<string, string>> = {};
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRegex.exec(html)) !== null) {
    const rules = styleMatch[1].matchAll(/([^{]+)\{([^}]+)\}/g);
    for (const rule of rules) {
      styles[rule[1].trim()] = parseInlineStyle(rule[2]);
    }
  }

  const cleaned = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  return parseNodes(cleaned, styles);
}

function parseNodes(html: string, styles: Record<string, Record<string, string>>): HtmlNode[] {
  const nodes: (HtmlNode | string)[] = [];
  let pos = 0;

  while (pos < html.length) {
    const tagStart = html.indexOf('<', pos);
    if (tagStart === -1) {
      const text = html.slice(pos).trim();
      if (text) nodes.push(decodeEntities(text));
      break;
    }

    if (tagStart > pos) {
      const text = html.slice(pos, tagStart).trim();
      if (text) nodes.push(decodeEntities(text));
    }

    const voidMatch = html.slice(tagStart).match(/^<(br|hr|img|input|meta|link|col|area|base|embed|source|track|wbr)\b([^>]*?)\/?\s*>/i);
    if (voidMatch) {
      nodes.push({ tag: voidMatch[1].toLowerCase(), attrs: parseAttrs(voidMatch[2], styles), children: [] });
      pos = tagStart + voidMatch[0].length;
      continue;
    }

    const openMatch = html.slice(tagStart).match(/^<(\w[\w-]*)\b([^>]*)>/);
    if (openMatch) {
      const tag = openMatch[1].toLowerCase();
      const attrs = parseAttrs(openMatch[2], styles);
      pos = tagStart + openMatch[0].length;
      const closeTag = `</${tag}>`;
      const closeIdx = html.toLowerCase().indexOf(closeTag, pos);
      if (closeIdx !== -1) {
        nodes.push({ tag, attrs, children: parseNodes(html.slice(pos, closeIdx), styles) });
        pos = closeIdx + closeTag.length;
      } else {
        nodes.push({ tag, attrs, children: [] });
      }
      continue;
    }

    pos = tagStart + 1;
  }

  return nodes as HtmlNode[];
}

function parseAttrs(attrStr: string, styles: Record<string, Record<string, string>>): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m;
  while ((m = regex.exec(attrStr)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  if (attrs.class) {
    for (const cn of attrs.class.split(/\s+/)) {
      const cs = styles[`.${cn}`];
      if (cs) attrs.style = (attrs.style || '') + ';' + Object.entries(cs).map(([k, v]) => `${k}:${v}`).join(';');
    }
  }
  return attrs;
}

function parseInlineStyle(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const decl of style.split(';')) {
    const [prop, ...valParts] = decl.split(':');
    if (prop && valParts.length > 0) result[prop.trim().toLowerCase()] = valParts.join(':').trim();
  }
  return result;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

// ── CSS → ReactJIT style ─────────────────────────────────────────────────────

const NAMED_COLORS: Record<string, string | undefined> = {
  white: '#ffffff', black: '#000000', red: '#ff0000', blue: '#0000ff',
  green: '#008000', yellow: '#ffff00', orange: '#ffa500', purple: '#800080',
  gray: '#808080', grey: '#808080', pink: '#ffc0cb', cyan: '#00ffff',
  navy: '#000080', teal: '#008080', maroon: '#800000', lime: '#00ff00',
  silver: '#c0c0c0', olive: '#808000', aqua: '#00ffff', fuchsia: '#ff00ff',
  transparent: 'transparent', inherit: undefined,
};

function cssColor(color: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  return NAMED_COLORS[color.toLowerCase()];
}

function cssToStyle(cssStr: string | undefined): Record<string, any> {
  if (!cssStr) return {};
  const css = parseInlineStyle(cssStr);
  const s: Record<string, any> = {};

  if (css.color) s.color = cssColor(css.color);
  const bg = css['background-color'] || css.background;
  if (bg && !bg.includes('gradient') && !bg.includes('url')) s.backgroundColor = cssColor(bg);
  const fs = parseInt(css['font-size'], 10); if (fs > 0) s.fontSize = fs;
  if (['bold', '700', '800', '900'].includes(css['font-weight'])) s.fontWeight = 'bold';
  if (css['font-style'] === 'italic') s.fontStyle = 'italic';
  if (css['text-align']) s.textAlign = css['text-align'] as any;

  for (const [cssProp, rjitProp] of [
    ['padding', 'padding'], ['padding-left', 'paddingLeft'], ['padding-right', 'paddingRight'],
    ['padding-top', 'paddingTop'], ['padding-bottom', 'paddingBottom'],
    ['margin', 'margin'], ['margin-top', 'marginTop'], ['margin-bottom', 'marginBottom'],
    ['border-radius', 'borderRadius'], ['width', 'width'], ['height', 'height'],
    ['max-width', 'maxWidth'], ['gap', 'gap'],
  ] as const) {
    const n = parseInt(css[cssProp], 10);
    if (n >= 0) s[rjitProp] = n;
  }

  if (css['flex-direction'] === 'row') s.flexDirection = 'row';
  if (css['flex-direction'] === 'column') s.flexDirection = 'column';
  const fg = parseFloat(css['flex-grow']); if (fg > 0) s.flexGrow = fg;
  if (css['flex-wrap'] === 'wrap') s.flexWrap = 'wrap';

  const jc = css['justify-content']?.replace('flex-', '');
  if (jc && ['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'].includes(jc)) s.justifyContent = jc;
  const ai = css['align-items']?.replace('flex-', '');
  if (ai && ['start', 'center', 'end', 'stretch'].includes(ai)) s.alignItems = ai;

  const borderMatch = css.border?.match(/(\d+)px\s+\w+\s+([\w#]+)/);
  if (borderMatch) { s.borderWidth = parseInt(borderMatch[1], 10); s.borderColor = cssColor(borderMatch[2]); }
  const bbMatch = css['border-bottom']?.match(/(\d+)px\s+\w+\s+([\w#]+)/);
  if (bbMatch) { s.borderBottomWidth = parseInt(bbMatch[1], 10); s.borderColor = cssColor(bbMatch[2]); }

  return s;
}

// ── Renderer ─────────────────────────────────────────────────────────────────

function HtmlPreview({ html }: { html: string }) {
  // rjit-ignore-next-line — HTML parsing for preview, no Lua equivalent yet
  const nodes = parseHtml(html);
  return <Box style={{ gap: 4 }}>{nodes.map((n, i) => <N key={i} node={n} />)}</Box>;
}

function textContent(node: HtmlNode | undefined): string {
  if (!node) return '';
  return node.children.map(c => typeof c === 'string' ? c : textContent(c)).join('');
}

function N({ node }: { node: HtmlNode | string }) {
  if (typeof node === 'string') {
    const t = node.trim();
    return t ? <Text style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.5 }}>{t}</Text> : null;
  }

  const s = cssToStyle(node.attrs.style);
  const kids = node.children.map((c, i) => <N key={i} node={c} />);

  switch (node.tag) {
    case 'div': case 'section': case 'article': case 'main': case 'header':
    case 'footer': case 'nav': case 'aside': case 'form':
      return <Box style={{ gap: 4, ...s }}>{kids}</Box>;

    case 'p':
      return (
        <Box style={{ paddingTop: 2, paddingBottom: 2, ...s }}>
          {node.children.map((c, i) =>
            typeof c === 'string'
              ? <Text key={i} style={{ fontSize: 14, color: s.color || '#1a1a1a', lineHeight: 1.5 }}>{c.trim()}</Text>
              : <N key={i} node={c} />
          )}
        </Box>
      );

    case 'h1': return <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#000', paddingTop: 8, paddingBottom: 4, ...s }}>{textContent(node)}</Text>;
    case 'h2': return <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1a1a1a', paddingTop: 6, paddingBottom: 3, ...s }}>{textContent(node)}</Text>;
    case 'h3': return <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2a2a2a', paddingTop: 4, paddingBottom: 2, ...s }}>{textContent(node)}</Text>;
    case 'h4': return <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', paddingTop: 3, paddingBottom: 2, ...s }}>{textContent(node)}</Text>;
    case 'h5': case 'h6': return <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#444', paddingTop: 2, ...s }}>{textContent(node)}</Text>;

    case 'span': return <Text style={{ fontSize: 14, color: '#1a1a1a', ...s }}>{textContent(node)}</Text>;
    case 'strong': case 'b': return <Text style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 'bold', ...s }}>{textContent(node)}</Text>;
    case 'em': case 'i': return <Text style={{ fontSize: 14, color: '#1a1a1a', fontStyle: 'italic', ...s }}>{textContent(node)}</Text>;
    case 'a': return <Text style={{ fontSize: 14, color: '#0066cc', ...s }}>{textContent(node)}</Text>;
    case 'small': return <Text style={{ fontSize: 11, color: '#666', ...s }}>{textContent(node)}</Text>;
    case 'label': return <Text style={{ fontSize: 13, color: '#333', fontWeight: 'bold', ...s }}>{textContent(node)}</Text>;

    case 'code':
      return <Box style={{ backgroundColor: '#f0f0f0', borderRadius: 3, paddingLeft: 4, paddingRight: 4, paddingTop: 1, paddingBottom: 1 }}>
        <Text style={{ fontSize: 12, color: '#c7254e', fontFamily: 'monospace' }}>{textContent(node)}</Text>
      </Box>;
    case 'pre':
      return <Box style={{ backgroundColor: '#f5f5f5', borderRadius: 6, padding: 10, ...s }}>
        <Text style={{ fontSize: 12, color: '#333', fontFamily: 'monospace' }}>{textContent(node)}</Text>
      </Box>;

    case 'ul': case 'ol':
      return (
        <Box style={{ paddingLeft: 16, gap: 2, ...s }}>
          {node.children.filter(c => typeof c !== 'string' || c.trim()).map((c, i) => {
            if (typeof c === 'string') return null;
            return (
              <Box key={i} style={{ flexDirection: 'row', gap: 6 }}>
                <Text style={{ fontSize: 14, color: '#666' }}>{node.tag === 'ol' ? `${i + 1}.` : '\u2022'}</Text>
                <Box style={{ flexGrow: 1 }}><N node={c} /></Box>
              </Box>
            );
          })}
        </Box>
      );
    case 'li': return <Box style={{ gap: 2, ...s }}>{kids}</Box>;

    case 'table': return <Box style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 4, overflow: 'hidden', ...s }}>{kids}</Box>;
    case 'thead': return <Box style={{ backgroundColor: '#f5f5f5' }}>{kids}</Box>;
    case 'tbody': return <Box>{kids}</Box>;
    case 'tr': return <Box style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', ...s }}>{kids}</Box>;
    case 'th': return <Box style={{ flexGrow: 1, padding: 6, borderRightWidth: 1, borderColor: '#eee', ...s }}><Text style={{ fontSize: 12, color: '#333', fontWeight: 'bold' }}>{textContent(node)}</Text></Box>;
    case 'td': return <Box style={{ flexGrow: 1, padding: 6, borderRightWidth: 1, borderColor: '#eee', ...s }}>{kids.length > 0 ? kids : <Text style={{ fontSize: 12, color: '#333' }}>{textContent(node)}</Text>}</Box>;

    case 'img':
      return <Box style={{ backgroundColor: '#f0f0f0', borderRadius: 4, padding: 8, alignItems: 'center', ...s }}>
        <Text style={{ fontSize: 10, color: '#999' }}>{`[Image: ${node.attrs.alt || node.attrs.src || 'image'}]`}</Text>
      </Box>;

    case 'button':
      return <Box style={{ backgroundColor: s.backgroundColor || '#4a90d9', borderRadius: 6, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, alignItems: 'center', alignSelf: 'start', ...s }}>
        <Text style={{ fontSize: 14, color: s.color || '#fff', fontWeight: 'bold' }}>{textContent(node)}</Text>
      </Box>;
    case 'input':
      return <Box style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, backgroundColor: '#fff', ...s }}>
        <Text style={{ fontSize: 13, color: '#999' }}>{node.attrs.placeholder || node.attrs.value || node.attrs.type || 'input'}</Text>
      </Box>;
    case 'textarea':
      return <Box style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, backgroundColor: '#fff', minHeight: 60, ...s }}>
        <Text style={{ fontSize: 13, color: '#999' }}>{node.attrs.placeholder || textContent(node) || 'textarea'}</Text>
      </Box>;
    case 'select':
      return <Box style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 4, padding: 8, backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between', ...s }}>
        <Text style={{ fontSize: 13, color: '#333' }}>{textContent(node.children.find(c => typeof c !== 'string' && c.tag === 'option') as HtmlNode | undefined || node) || 'select'}</Text>
        <Text style={{ fontSize: 12, color: '#999' }}>{'\u25BC'}</Text>
      </Box>;
    case 'option': return null;

    case 'br': return <Box style={{ height: 4 }} />;
    case 'hr': return <Box style={{ height: 1, backgroundColor: '#ddd', marginTop: 4, marginBottom: 4, ...s }} />;

    case 'blockquote':
      return <Box style={{ borderLeftWidth: 3, borderColor: '#ccc', paddingLeft: 12, paddingTop: 4, paddingBottom: 4, backgroundColor: '#f9f9f9', borderRadius: 4, ...s }}>{kids}</Box>;

    case 'details': case 'summary': case 'figure': case 'figcaption':
    case 'dl': case 'dt': case 'dd':
      return <Box style={{ gap: 2, ...s }}>{kids}</Box>;

    case 'html': case 'head': case 'title': case 'meta': case 'link':
    case 'script': case 'style': return null;
    case 'body': return <Box style={{ gap: 4, ...s }}>{kids}</Box>;

    default: return kids.length > 0 ? <Box style={{ ...s }}>{kids}</Box> : null;
  }
}
