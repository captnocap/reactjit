/**
 * TerminalPreview — Terminal with built-in hyperlink preview overlay.
 *
 * Wraps <Terminal hyperlinks> and adds a Modal that renders clicked links
 * as image, video, or web content previews. Click a link in terminal output
 * to open the preview; press Escape or click Close to dismiss.
 *
 * @example
 * <TerminalPreview type="user" style={{ flexGrow: 1 }} />
 */

import React, { useState, useCallback } from 'react';
import { Terminal, type TerminalProps } from './Terminal';
import { Modal } from './Modal';
import { Box, Text, Image } from './primitives';
import { Video } from './Video';
import { Pressable } from './Pressable';
import { ScrollView } from './ScrollView';
import { useMount } from './useLuaEffect';

// ── Content type detection ─────────────────────────────────────────────────

type LinkType = 'image' | 'video' | 'web' | 'document' | 'file';

interface LinkEvent {
  url: string;
  linkType: LinkType;
  row: number;
  col: number;
}

// ── Minimal HTML-to-text extractor (no DOM, runs in QuickJS) ───────────────

function htmlToText(html: string): { title: string; body: string } {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\s+/g, ' ').trim()
    : '';

  // Strip scripts, styles, and tags
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Limit to first ~4000 chars for preview
  if (text.length > 4000) {
    text = text.slice(0, 4000) + '\n\n[truncated]';
  }

  return { title, body: text };
}

// ── Preview content components ─────────────────────────────────────────────

function ImagePreview({ url }: { url: string }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Image
        src={url}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </Box>
  );
}

function VideoPreview({ url }: { url: string }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Video
        src={url}
        style={{ width: '100%', height: '100%' }}
        loop={false}
      />
    </Box>
  );
}

function WebPreview({ url }: { url: string }) {
  const [content, setContent] = useState<{ title: string; body: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useMount(() => {
    let cancelled = false;
    fetch(url)
      .then((res: any) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((html: string) => {
        if (!cancelled) {
          setContent(htmlToText(html));
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  });

  if (loading) {
    return (
      <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: '#94a3b8' }}>{`Loading ${url}...`}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ flexGrow: 1, padding: 16 }}>
        <Text style={{ fontSize: 14, color: '#f87171' }}>{`Error: ${error}`}</Text>
        <Text style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>{url}</Text>
      </Box>
    );
  }

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16, gap: 8 }}>
        {content?.title ? (
          <Text style={{ fontSize: 18, color: '#e2e8f0', fontWeight: 'bold' }}>
            {content.title}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: '#60a5fa' }}>{url}</Text>
        <Box style={{ height: 1, backgroundColor: '#334155', marginTop: 4, marginBottom: 4 }} />
        <Text style={{ fontSize: 13, color: '#cbd5e1' }}>
          {content?.body || '[empty page]'}
        </Text>
      </Box>
    </ScrollView>
  );
}

function DocumentPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useMount(() => {
    let cancelled = false;
    fetch(url)
      .then((res: any) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text: string) => {
        if (!cancelled) {
          setContent(text.length > 8000 ? text.slice(0, 8000) + '\n\n[truncated]' : text);
          setLoading(false);
        }
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(String(err));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  });

  if (loading) {
    return (
      <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 14, color: '#94a3b8' }}>{`Loading ${url}...`}</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ flexGrow: 1, padding: 16 }}>
        <Text style={{ fontSize: 14, color: '#f87171' }}>{`Error: ${error}`}</Text>
      </Box>
    );
  }

  return (
    <ScrollView style={{ flexGrow: 1 }}>
      <Box style={{ padding: 16 }}>
        <Text style={{ fontSize: 12, color: '#a5f3fc' }}>
          {content || '[empty]'}
        </Text>
      </Box>
    </ScrollView>
  );
}

function FilePreview({ url }: { url: string }) {
  return (
    <Box style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <Text style={{ fontSize: 14, color: '#94a3b8' }}>{`File: ${url}`}</Text>
      <Text style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
        {'No preview available for this file type'}
      </Text>
    </Box>
  );
}

// ── Preview content router ─────────────────────────────────────────────────

function PreviewContent({ link }: { link: LinkEvent }) {
  switch (link.linkType) {
    case 'image':
      return <ImagePreview url={link.url} />;
    case 'video':
      return <VideoPreview url={link.url} />;
    case 'web':
      return <WebPreview url={link.url} />;
    case 'document':
      return <DocumentPreview url={link.url} />;
    default:
      return <FilePreview url={link.url} />;
  }
}

// ── Close button ───────────────────────────────────────────────────────────

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      {({ hovered, pressed }) => (
        <Box style={{
          backgroundColor: pressed ? '#374151' : hovered ? '#1f2937' : '#111827',
          borderRadius: 6,
          borderWidth: 1,
          borderColor: '#374151',
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 6,
          paddingBottom: 6,
        }}>
          <Text style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 'bold' }}>{'Close'}</Text>
        </Box>
      )}
    </Pressable>
  );
}

// ── Type badge ─────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<LinkType, string> = {
  image: '#34d399',
  video: '#a78bfa',
  web: '#60a5fa',
  document: '#fbbf24',
  file: '#94a3b8',
};

function TypeBadge({ linkType }: { linkType: LinkType }) {
  return (
    <Box style={{
      backgroundColor: TYPE_COLORS[linkType] || '#94a3b8',
      borderRadius: 4,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 2,
      paddingBottom: 2,
    }}>
      <Text style={{ fontSize: 10, color: '#0f172a', fontWeight: 'bold' }}>
        {linkType.toUpperCase()}
      </Text>
    </Box>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export interface TerminalPreviewProps extends TerminalProps {
  /** Called when the preview overlay opens */
  onPreviewOpen?: (link: LinkEvent) => void;
  /** Called when the preview overlay closes */
  onPreviewClose?: () => void;
}

export function TerminalPreview({
  onPreviewOpen,
  onPreviewClose,
  onLinkClick,
  ...terminalProps
}: TerminalPreviewProps) {
  const [activeLink, setActiveLink] = useState<LinkEvent | null>(null);

  // rjit-ignore-next-line — framework API: terminal preview handlers
  const handleLinkClick = useCallback((event: LinkEvent) => {
    setActiveLink(event);
    onPreviewOpen?.(event);
    onLinkClick?.(event);
  }, [onPreviewOpen, onLinkClick]);

  // rjit-ignore-next-line — framework API: terminal preview handlers
  const handleClose = useCallback(() => {
    setActiveLink(null);
    onPreviewClose?.();
  }, [onPreviewClose]);

  return (
    <Box style={{ flexGrow: 1, ...terminalProps.style }}>
      <Terminal
        {...terminalProps}
        hyperlinks
        onLinkClick={handleLinkClick}
        style={{ flexGrow: 1 }}
      />

      <Modal
        visible={activeLink !== null}
        onRequestClose={handleClose}
        animationType="fade"
        backdropDismiss
        backdropColor={[0, 0, 0, 0.85]}
      >
        <Box style={{
          width: '100%',
          height: '100%',
          padding: 16,
          gap: 10,
        }}>
          {/* Header bar */}
          <Box style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Box style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 1 }}>
              {activeLink && <TypeBadge linkType={activeLink.linkType} />}
              <Text
                style={{
                  fontSize: 12,
                  color: '#94a3b8',
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {activeLink?.url || ''}
              </Text>
            </Box>
            <CloseButton onPress={handleClose} />
          </Box>

          {/* Content area */}
          {activeLink && <PreviewContent key={activeLink.url} link={activeLink} />}
        </Box>
      </Modal>
    </Box>
  );
}
