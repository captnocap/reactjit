/**
 * TemplatePicker — Grid of starter templates for the playground.
 *
 * Each card renders a live miniature preview of the template at ~0.25 scale,
 * clipped inside the card. Click to load into the editor.
 */

import React, { useMemo } from 'react';
import { Box, Text, Pressable, useLocalStore } from '../../../packages/core/src';
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

const PREVIEW_SCALE = 0.35;
const CARD_WIDTH = 340;
const PREVIEW_HEIGHT = 200;
const INNER_WIDTH = CARD_WIDTH / PREVIEW_SCALE;
const INNER_HEIGHT = PREVIEW_HEIGHT / PREVIEW_SCALE;

/** Error boundary so a broken template preview doesn't crash the whole picker */
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

/** Eval a template code string into a React component (or null on error) */
function useTemplateComponent(code: string): React.ComponentType | null {
  return useMemo(() => {
    const result = transformJSX(code);
    if (result.errors.length > 0) return null;
    const evalResult = evalComponent(result.code);
    return evalResult.component;
  }, [code]);
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: (t: Template) => void }) {
  const c = useThemeColors();
  const color = CATEGORY_COLORS[template.category] || c.textDim;
  const Comp = useTemplateComponent(template.code);

  return (
    <Pressable
      onPress={() => onSelect(template)}
      style={(state) => ({
        width: CARD_WIDTH,
        backgroundColor: state.hovered ? c.bgAlt : c.bg,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: state.hovered ? color : c.border,
        overflow: 'hidden',
      })}
    >
      {/* Live miniature preview */}
      <Box style={{
        width: CARD_WIDTH,
        height: PREVIEW_HEIGHT,
        overflow: 'hidden',
        backgroundColor: c.bgElevated,
      }}>
        {Comp && (
          <PreviewBoundary>
            <Box style={{
              width: INNER_WIDTH,
              height: INNER_HEIGHT,
              transform: { scaleX: PREVIEW_SCALE, scaleY: PREVIEW_SCALE, originX: 0, originY: 0 },
            }}>
              <Comp />
            </Box>
          </PreviewBoundary>
        )}
      </Box>

      {/* Info below preview */}
      <Box style={{ padding: 12, gap: 6 }}>
        {/* Category badge */}
        <Box style={{
          backgroundColor: color + '20',
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 2,
          paddingBottom: 2,
          borderRadius: 4,
          alignSelf: 'flex-start',
        }}>
          <Text style={{ color, fontSize: 9, fontWeight: 'bold' }}>{template.category.toUpperCase()}</Text>
        </Box>

        <Text style={{ color: c.text, fontSize: 13, fontWeight: 'bold' }}>
          {template.name}
        </Text>

        <Text style={{ color: c.textDim, fontSize: 10 }}>
          {template.description}
        </Text>
      </Box>
    </Pressable>
  );
}

export function TemplatePicker({ onSelect }: { onSelect: (t: Template) => void }) {
  const c = useThemeColors();
  const [lastSessionCode] = useLocalStore('code', '', { namespace: 'playground' });

  const handleLastSessionSelect = () => {
    if (!lastSessionCode) return;
    onSelect({
      id: '__last-session',
      name: 'Last Session',
      description: 'Continue where you left off',
      category: 'Recent',
      code: lastSessionCode,
    });
  };

  return (
    <Box style={{ width: '100%', height: '100%', padding: 24, gap: 20, overflow: 'scroll' }}>
      {/* Header */}
      <Box style={{ gap: 4 }}>
        <Text style={{ color: c.text, fontSize: 20, fontWeight: 'bold' }}>
          Choose a template
        </Text>
        <Text style={{ color: c.textDim, fontSize: 12 }}>
          Pick a starting point, then customize it in the editor
        </Text>
      </Box>

      {/* Grid */}
      <Box style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'space-around', width: '100%' }}>
        {/* Last session card (if available) */}
        {lastSessionCode && (
          <TemplateCard
            template={{
              id: '__last-session',
              name: 'Last Session',
              description: 'Continue where you left off',
              category: 'Recent',
              code: lastSessionCode,
            }}
            onSelect={handleLastSessionSelect}
          />
        )}
        {templates.map(t => (
          <TemplateCard key={t.id} template={t} onSelect={onSelect} />
        ))}
      </Box>
    </Box>
  );
}
