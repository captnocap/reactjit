// Maps a parsed HTML node tree to ReactJIT primitives.
// Everything is Box/Text/Pressable — rendered as native Love2D geometry.

import React from 'react';
import { Box, Text, Pressable, Image } from '@reactjit/core';
import type { HtmlNode } from './htmlParser';

interface RenderContext {
  onNavigate: (url: string) => void;
  baseUrl: string;
  fontSize?: number;
  color?: string;
  fontWeight?: '400' | '700';
  italic?: boolean;
}

function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) {
    try {
      const u = new URL(baseUrl);
      return u.origin + href;
    } catch { return href; }
  }
  // Relative
  const base = baseUrl.replace(/[^/]*$/, '');
  return base + href;
}

// Collect all contiguous text/inline nodes into a single Text span
function collectInlineText(nodes: HtmlNode[], ctx: RenderContext): string {
  let result = '';
  for (const n of nodes) {
    if (n.type === 'text') {
      result += n.text || '';
    } else if (n.type === 'element' && isInline(n.tag || '')) {
      result += collectInlineText(n.children || [], ctx);
    }
  }
  return result;
}

function isInline(tag: string): boolean {
  return ['a', 'b', 'strong', 'i', 'em', 'u', 'span', 'code', 'small', 'sub', 'sup', 'abbr', 'time'].includes(tag);
}

function isBlock(tag: string): boolean {
  return ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article',
    'main', 'header', 'footer', 'nav', 'aside', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'blockquote', 'pre', 'figure', 'figcaption', 'form', 'fieldset', 'table',
    'thead', 'tbody', 'tr', 'td', 'th', 'details', 'summary'].includes(tag);
}

// Tag -> style mapping (elinks-inspired)
function tagStyle(tag: string): { fontSize: number; color: string; fontWeight: '400' | '700'; marginBottom: number } {
  switch (tag) {
    case 'h1': return { fontSize: 24, color: '#e2e8f0', fontWeight: '700', marginBottom: 12 };
    case 'h2': return { fontSize: 20, color: '#e2e8f0', fontWeight: '700', marginBottom: 10 };
    case 'h3': return { fontSize: 17, color: '#cbd5e1', fontWeight: '700', marginBottom: 8 };
    case 'h4': return { fontSize: 15, color: '#cbd5e1', fontWeight: '700', marginBottom: 6 };
    case 'h5': return { fontSize: 14, color: '#94a3b8', fontWeight: '700', marginBottom: 4 };
    case 'h6': return { fontSize: 13, color: '#94a3b8', fontWeight: '700', marginBottom: 4 };
    case 'p':  return { fontSize: 14, color: '#cbd5e1', fontWeight: '400', marginBottom: 8 };
    case 'li': return { fontSize: 14, color: '#cbd5e1', fontWeight: '400', marginBottom: 4 };
    case 'blockquote': return { fontSize: 14, color: '#94a3b8', fontWeight: '400', marginBottom: 8 };
    case 'pre': return { fontSize: 12, color: '#a5f3fc', fontWeight: '400', marginBottom: 8 };
    case 'code': return { fontSize: 12, color: '#a5f3fc', fontWeight: '400', marginBottom: 0 };
    case 'td': case 'th': return { fontSize: 13, color: '#cbd5e1', fontWeight: tag === 'th' ? '700' : '400', marginBottom: 0 };
    default:   return { fontSize: 14, color: '#cbd5e1', fontWeight: '400', marginBottom: 4 };
  }
}

function renderNode(node: HtmlNode, ctx: RenderContext, key: number): React.ReactNode {
  if (node.type === 'text') {
    const trimmed = node.text?.trim();
    if (!trimmed) return null;
    return (
      <Text key={key} style={{
        fontSize: ctx.fontSize || 14,
        color: ctx.color || '#cbd5e1',
        fontWeight: ctx.fontWeight || '400',
      }}>
        {trimmed}
      </Text>
    );
  }

  const tag = node.tag || 'div';
  const children = node.children || [];

  // Skip empty elements
  if (children.length === 0 && !['br', 'hr', 'img'].includes(tag)) return null;

  // BR — line break spacer
  if (tag === 'br') {
    return <Box key={key} style={{ height: 6 }} />;
  }

  // HR — horizontal rule
  if (tag === 'hr') {
    return (
      <Box key={key} style={{
        width: '100%', height: 1,
        backgroundColor: '#334155',
        marginTop: 8, marginBottom: 8,
      }} />
    );
  }

  // IMG — show as placeholder with alt text
  if (tag === 'img') {
    const alt = node.attrs?.alt || '[image]';
    const src = node.attrs?.src;
    if (src) {
      const fullSrc = resolveUrl(src, ctx.baseUrl);
      return (
        <Box key={key} style={{ marginBottom: 8 }}>
          <Image
            src={fullSrc}
            style={{ width: 200, height: 120, borderRadius: 4 }}
          />
          {alt && alt !== '[image]' && (
            <Text style={{ fontSize: 11, color: '#64748b' }}>{alt}</Text>
          )}
        </Box>
      );
    }
    return (
      <Text key={key} style={{ fontSize: 12, color: '#64748b' }}>
        {`[${alt}]`}
      </Text>
    );
  }

  // A — link
  if (tag === 'a') {
    const href = node.attrs?.href || '';
    const linkText = collectInlineText(children, ctx);
    if (!linkText.trim()) return null;
    return (
      <Pressable
        key={key}
        onPress={() => {
          if (href) ctx.onNavigate(resolveUrl(href, ctx.baseUrl));
        }}
        style={{ alignSelf: 'flex-start' }}
      >
        <Text style={{
          fontSize: ctx.fontSize || 14,
          color: '#60a5fa',
          fontWeight: '400',
        }}>
          {linkText.trim()}
        </Text>
      </Pressable>
    );
  }

  // Inline tags — just pass through with style tweaks
  if (isInline(tag)) {
    const newCtx = { ...ctx };
    if (tag === 'b' || tag === 'strong') newCtx.fontWeight = '700';
    if (tag === 'i' || tag === 'em') newCtx.italic = true;
    if (tag === 'code') { newCtx.color = '#a5f3fc'; newCtx.fontSize = 12; }
    if (tag === 'small') newCtx.fontSize = (ctx.fontSize || 14) - 2;

    return (
      <React.Fragment key={key}>
        {children.map((c, i) => renderNode(c, newCtx, i))}
      </React.Fragment>
    );
  }

  // UL / OL — list container
  if (tag === 'ul' || tag === 'ol') {
    return (
      <Box key={key} style={{ paddingLeft: 16, marginBottom: 8, gap: 2 }}>
        {children.map((c, i) => {
          if (c.type === 'element' && c.tag === 'li') {
            const bullet = tag === 'ol' ? `${i + 1}. ` : '- ';
            const liText = collectInlineText(c.children || [], ctx);
            const blockChildren = (c.children || []).filter(
              ch => ch.type === 'element' && isBlock(ch.tag || '')
            );
            return (
              <Box key={i} style={{ gap: 2 }}>
                <Text style={{ fontSize: 14, color: '#cbd5e1' }}>
                  {`${bullet}${liText.trim()}`}
                </Text>
                {blockChildren.map((bc, bi) => renderNode(bc, ctx, bi))}
              </Box>
            );
          }
          return renderNode(c, ctx, i);
        })}
      </Box>
    );
  }

  // TABLE — render as rows
  if (tag === 'table') {
    const allRows = flattenTableRows(children);
    return (
      <Box key={key} style={{
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 4,
        overflow: 'hidden',
      }}>
        {allRows.map((row, ri) => (
          <Box key={ri} style={{
            flexDirection: 'row',
            width: '100%',
            borderBottomWidth: ri < allRows.length - 1 ? 1 : 0,
            borderColor: '#1e293b',
            backgroundColor: ri === 0 ? '#1e293b' : undefined,
          }}>
            {(row.children || [])
              .filter(c => c.type === 'element' && (c.tag === 'td' || c.tag === 'th'))
              .map((cell, ci) => {
                const cellText = collectInlineText(cell.children || [], ctx);
                const style = tagStyle(cell.tag || 'td');
                return (
                  <Box key={ci} style={{
                    flexGrow: 1, padding: 6,
                    borderRightWidth: 1,
                    borderColor: '#1e293b',
                  }}>
                    <Text style={{
                      fontSize: style.fontSize,
                      color: style.color,
                      fontWeight: style.fontWeight,
                    }}>
                      {cellText.trim() || ' '}
                    </Text>
                  </Box>
                );
              })}
          </Box>
        ))}
      </Box>
    );
  }

  // BLOCKQUOTE
  if (tag === 'blockquote') {
    return (
      <Box key={key} style={{
        borderLeftWidth: 3,
        borderColor: '#475569',
        paddingLeft: 12,
        marginBottom: 8,
        gap: 4,
      }}>
        {children.map((c, i) => renderNode(c, { ...ctx, color: '#94a3b8' }, i))}
      </Box>
    );
  }

  // PRE
  if (tag === 'pre') {
    const preText = collectInlineText(children, ctx);
    return (
      <Box key={key} style={{
        backgroundColor: '#0f172a',
        borderWidth: 1,
        borderColor: '#334155',
        borderRadius: 4,
        padding: 10,
        marginBottom: 8,
      }}>
        <Text style={{ fontSize: 12, color: '#a5f3fc' }}>
          {preText}
        </Text>
      </Box>
    );
  }

  // Headings
  if (tag.match(/^h[1-6]$/)) {
    const style = tagStyle(tag);
    const headingText = collectInlineText(children, ctx);
    if (!headingText.trim()) return null;
    return (
      <Box key={key} style={{ marginBottom: style.marginBottom }}>
        <Text style={{
          fontSize: style.fontSize,
          color: style.color,
          fontWeight: style.fontWeight,
        }}>
          {headingText.trim()}
        </Text>
      </Box>
    );
  }

  // P
  if (tag === 'p') {
    // Check if all children are inline — if so, collect as one text
    const allInline = children.every(c => c.type === 'text' || (c.type === 'element' && isInline(c.tag || '')));
    if (allInline) {
      const pText = collectInlineText(children, ctx);
      if (!pText.trim()) return null;

      // Check if there are links we should render as Pressable
      const hasLinks = children.some(c => c.type === 'element' && c.tag === 'a');
      if (hasLinks) {
        return (
          <Box key={key} style={{ marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
            {children.map((c, i) => renderNode(c, { ...ctx, fontSize: 14 }, i))}
          </Box>
        );
      }

      return (
        <Box key={key} style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 14, color: '#cbd5e1' }}>
            {pText.trim()}
          </Text>
        </Box>
      );
    }
    // Mixed block/inline content
    return (
      <Box key={key} style={{ marginBottom: 8, gap: 4 }}>
        {children.map((c, i) => renderNode(c, ctx, i))}
      </Box>
    );
  }

  // Generic block — div, section, article, header, footer, nav, etc.
  const style = tagStyle(tag);
  return (
    <Box key={key} style={{ marginBottom: style.marginBottom, gap: 2 }}>
      {children.map((c, i) => renderNode(c, ctx, i))}
    </Box>
  );
}

function flattenTableRows(nodes: HtmlNode[]): HtmlNode[] {
  const rows: HtmlNode[] = [];
  for (const n of nodes) {
    if (n.type === 'element' && n.tag === 'tr') {
      rows.push(n);
    } else if (n.type === 'element' && (n.tag === 'thead' || n.tag === 'tbody' || n.tag === 'tfoot')) {
      rows.push(...flattenTableRows(n.children || []));
    }
  }
  return rows;
}

export function RenderHtml({ nodes, onNavigate, baseUrl }: {
  nodes: HtmlNode[];
  onNavigate: (url: string) => void;
  baseUrl: string;
}) {
  const ctx: RenderContext = {
    onNavigate,
    baseUrl,
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '400',
  };

  return (
    <Box style={{ gap: 2 }}>
      {nodes.map((node, i) => renderNode(node, ctx, i))}
    </Box>
  );
}
