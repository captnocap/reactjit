/**
 * TemplatePicker — Grid of starter templates for the playground.
 *
 * Cards show a static colored placeholder — zero live renders at rest.
 * Hovering a card for 500ms opens a floating overlay with the live preview.
 * At most one template is ever mounted at a time.
 */

import React, { useState, useRef } from 'react';
import { Box, Text, Pressable, useLocalStore, classifiers as S} from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { templates, type Template } from './templates';
import { transformJSX } from './lib/jsx-transform';
import { evalComponent } from './lib/eval-component';

const CATEGORY_COLORS: Record<string, string> = {
  Starter: '#22c55e',
  Data: '#3b82f6',
  Forms: '#8b5cf6',
  Widget: '#f59e0b',
  Navigation: '#06b6d4',
  Motion: '#ef4444',
  Crossover: '#f97316',
  Recent: '#a78bfa',
};

const CARD_WIDTH = 340;
const PREVIEW_HEIGHT = 200;
const HOVER_DELAY_MS = 500;

// Overlay preview is larger — 0.5 scale gives a clearer look
const OVERLAY_SCALE = 0.5;
const OVERLAY_PANEL_W = 560;   // total panel width (preview + info strip shares this)
const OVERLAY_PREVIEW_H = 320;
const OVERLAY_INNER_W = OVERLAY_PANEL_W / OVERLAY_SCALE;  // fills the full panel width
const OVERLAY_INNER_H = OVERLAY_PREVIEW_H / OVERLAY_SCALE;

/** Error boundary so a broken template preview doesn't crash the picker */
class PreviewBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function useTemplateComponent(code: string): React.ComponentType | null {
  const result = transformJSX(code);
  if (result.errors.length > 0) return null;
  const evalResult = evalComponent(result.code);
  return evalResult.component;
}

// ── Floating overlay ────────────────────────────────────────────────────────

function TemplateOverlay({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const color = CATEGORY_COLORS[template.category] || c.textDim;
  const Comp = useTemplateComponent(template.code);

  return (
    // Full-area backdrop — pointer leave closes overlay
    <Box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
      }}
      onPointerLeave={onClose as any}
    >
      {/* Panel */}
      <Box style={{
        width: OVERLAY_PANEL_W,
        backgroundColor: c.bgElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: color,
        overflow: 'hidden',
        gap: 0,
      }}>
        {/* Live preview */}
        <Box style={{
          width: OVERLAY_PANEL_W,
          height: OVERLAY_PREVIEW_H,
          overflow: 'hidden',
          backgroundColor: c.bg,
        }}>
          {Comp && (
            <PreviewBoundary>
              <Box style={{
                width: OVERLAY_INNER_W,
                height: OVERLAY_INNER_H,
                overflow: 'hidden',
                transform: {
                  scaleX: OVERLAY_SCALE,
                  scaleY: OVERLAY_SCALE,
                  originX: 0,
                  originY: 0,
                },
              }}>
                <Comp />
              </Box>
            </PreviewBoundary>
          )}
        </Box>

        {/* Info strip */}
        <Box style={{ padding: 16, gap: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box style={{ gap: 2 }}>
            <Text style={{ color: c.text, fontSize: 14, fontWeight: 'normal' }}>
              {template.name}
            </Text>
            <Text style={{ color: c.textDim, fontSize: 11 }}>
              {template.description}
            </Text>
          </Box>
          <Box style={{
            backgroundColor: color + '20',
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            borderRadius: 6,
          }}>
            <Text style={{ color, fontSize: 10, fontWeight: 'normal' }}>
              {template.category.toUpperCase()}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onSelect,
  onHoverIn,
  onHoverOut,
}: {
  template: Template;
  onSelect: (t: Template) => void;
  onHoverIn: () => void;
  onHoverOut: () => void;
}) {
  const c = useThemeColors();
  const color = CATEGORY_COLORS[template.category] || c.textDim;

  return (
    <Pressable
      onPress={() => onSelect(template)}
      onHoverIn={onHoverIn}
      onHoverOut={onHoverOut}
      style={(state) => ({
        width: CARD_WIDTH,
        backgroundColor: state.hovered ? c.bgAlt : c.bg,
        borderRadius: 10,
        borderWidth: 1,
        // Always a visible border — dimmed at rest, full category color on hover
        borderColor: state.hovered ? color : color + '50',
        overflow: 'hidden',
      })}
    >
      {/* Static placeholder — no live render, no layout bloat */}
      <Box style={{
        width: CARD_WIDTH,
        height: PREVIEW_HEIGHT,
        backgroundColor: color + '10',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
      }}>
        <Box style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: color + '25',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{ color, fontSize: 20, fontWeight: 'normal' }}>
            {template.name[0]}
          </Text>
        </Box>
        <Text style={{ color: color + 'AA', fontSize: 10 }}>
          HOVER TO PREVIEW
        </Text>
      </Box>

      {/* Info */}
      <Box style={{ padding: 12, gap: 6 }}>
        <Box style={{
          backgroundColor: color + '20',
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 4,
          alignSelf: 'flex-start',
        }}>
          <Text style={{ color, fontSize: 9, fontWeight: 'normal' }}>
            {template.category.toUpperCase()}
          </Text>
        </Box>
        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'normal' }}>
          {template.name}
        </Text>
        <S.StoryMuted>
          {template.description}
        </S.StoryMuted>
      </Box>
    </Pressable>
  );
}

// ── Picker ──────────────────────────────────────────────────────────────────

export function TemplatePicker({ onSelect }: { onSelect: (t: Template) => void }) {
  const c = useThemeColors();
  const [lastSessionCode] = useLocalStore('code', '', { namespace: 'playground' });
  const [overlayTemplate, setOverlayTemplate] = useState<Template | null>(null);
  const timerRef = useRef<any>(null);

  const showOverlayFor = (t: Template) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOverlayTemplate(t), HOVER_DELAY_MS);
  };

  const hideOverlay = () => {
    clearTimeout(timerRef.current);
    setOverlayTemplate(null);
  };

  const lastSessionTemplate: Template | null = lastSessionCode ? {
    id: '__last-session',
    name: 'Last Session',
    description: 'Continue where you left off',
    category: 'Recent',
    code: lastSessionCode,
  } : null;

  return (
    // Outer box provides the absolute positioning context for the overlay
    <Box style={{ width: '100%', height: '100%' }}>
      {/* Scrollable grid */}
      <Box style={{ width: '100%', height: '100%', overflow: 'scroll', padding: 24, gap: 20 }}>
        <Box style={{ gap: 4 }}>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: 'normal' }}>
            Choose a template
          </Text>
          <Text style={{ color: c.textDim, fontSize: 12 }}>
            Pick a starting point, then customize it in the editor
          </Text>
        </Box>

        <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-around', width: '100%' }}>
          {lastSessionTemplate && (
            <TemplateCard
              template={lastSessionTemplate}
              onSelect={onSelect}
              onHoverIn={() => showOverlayFor(lastSessionTemplate)}
              onHoverOut={hideOverlay}
            />
          )}
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onSelect={onSelect}
              onHoverIn={() => showOverlayFor(t)}
              onHoverOut={hideOverlay}
            />
          ))}
        </Box>
      </Box>

      {/* Live preview overlay — mounts only when a card has been hovered long enough */}
      {overlayTemplate && (
        <TemplateOverlay
          template={overlayTemplate}
          onClose={hideOverlay}
        />
      )}
    </Box>
  );
}
