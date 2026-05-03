import { classifiers } from '@reactjit/core';
import { Box, Col, Row, Text } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';

const GROUP_ORDER = ['Text', 'Row', 'Col', 'Box', 'Pressable', 'Graph'];
const PRIMITIVE_COLUMN_COUNT = 2;

type ClassifierEntry = {
  name: string;
  def: any;
  Component: any;
};

type PrimitiveSection = {
  type: string;
  entries: ClassifierEntry[];
};

function groupByPrimitive(): Record<string, ClassifierEntry[]> {
  const groups: Record<string, ClassifierEntry[]> = {};
  for (const [name, Component] of Object.entries(classifiers)) {
    const C = Component as any;
    const type = (C?.__def?.type as string) ?? 'Unknown';
    (groups[type] ||= []).push({ name, def: C.__def, Component });
  }
  for (const type of Object.keys(groups)) {
    groups[type].sort((a, b) => a.name.localeCompare(b.name));
  }
  return groups;
}

function distributeSections(sections: PrimitiveSection[], columnCount: number): PrimitiveSection[][] {
  const columns = Array.from({ length: Math.max(1, columnCount) }, (_, index) => ({
    index,
    weight: 0,
    items: [] as PrimitiveSection[],
  }));

  for (const section of sections) {
    columns.sort((left, right) => {
      if (left.weight !== right.weight) return left.weight - right.weight;
      return left.index - right.index;
    });
    columns[0].items.push(section);
    columns[0].weight += section.entries.length;
  }

  return columns
    .sort((left, right) => left.index - right.index)
    .map((column) => column.items);
}

function traitLine(def: any): string {
  if (!def) return '';
  const bits: string[] = [];
  if (def.size != null) bits.push(`size ${def.size}`);
  if (def.bold) bits.push('bold');
  if (def.originTopLeft) bits.push('originTopLeft');
  const s = def.style || {};
  if (s.gap != null) bits.push(`gap ${s.gap}`);
  if (s.alignItems) bits.push(`align ${s.alignItems}`);
  if (s.justifyContent) bits.push(`justify ${s.justifyContent}`);
  if (s.borderRadius != null) bits.push(`r ${s.borderRadius}`);
  if (s.width != null) bits.push(`w ${s.width}`);
  if (s.height != null) bits.push(`h ${s.height}`);
  if (s.flexGrow) bits.push(`grow`);
  if (s.fontFamily) bits.push(String(s.fontFamily).split(',')[0].replace(/['"]/g, ''));
  return bits.join(' · ');
}

function isFixedShape(def: any): boolean {
  const s = def?.style;
  if (!s) return false;
  return typeof s.width === 'number' && typeof s.height === 'number';
}

function renderSample(type: string, Component: any, def: any) {
  const S = Component;
  switch (type) {
    case 'Text':
      return <S>The quick brown fox</S>;
    case 'Row':
    case 'Col':
      return (
        <S>
          <Box style={{ width: 18, height: 18, backgroundColor: '#d26a2a' }} />
          <Box style={{ width: 18, height: 18, backgroundColor: '#6ac3d6' }} />
          <Box style={{ width: 18, height: 18, backgroundColor: '#d48aa7' }} />
        </S>
      );
    case 'Box':
    case 'Pressable':
      // Fixed-shape (Dot, marker) — show the shape itself filled, no text inside.
      if (isFixedShape(def)) {
        return <S style={{ backgroundColor: '#d26a2a', borderColor: '#8a4a20' }} />;
      }
      // flexGrow + flexBasis: 0 (HalfPress-style) — share-equally siblings.
      // Render two of them side-by-side so the half/half behavior is visible.
      if (def?.style?.flexGrow && def?.style?.flexBasis === 0) {
        return (
          <Row style={{ width: '100%', gap: 4 }}>
            <S style={{ height: 16, backgroundColor: '#8a4a20' }} />
            <S style={{ height: 16, backgroundColor: '#d26a2a' }} />
          </Row>
        );
      }
      // Plain flexGrow (Spacer) — axis-agnostic, follows the parent's main axis.
      // Show both: in a Row it grows horizontally, in a Col it grows vertically.
      if (def?.style?.flexGrow) {
        const marker = { width: 8, height: 8, backgroundColor: '#8a4a20' } as const;
        return (
          <Row style={{ width: '100%', gap: 12, alignItems: 'stretch' }}>
            <Col style={{ flexGrow: 1, flexBasis: 0, gap: 4 }}>
              <Text style={{ fontSize: 8, fontFamily: 'monospace', color: '#7a6e5d' }}>in Row</Text>
              <Row style={{ alignItems: 'center' }}>
                <Box style={marker} />
                <S />
                <Box style={marker} />
              </Row>
            </Col>
            <Col style={{ flexGrow: 1, flexBasis: 0, gap: 4 }}>
              <Text style={{ fontSize: 8, fontFamily: 'monospace', color: '#7a6e5d' }}>in Col</Text>
              <Col style={{ height: 48, alignItems: 'center' }}>
                <Box style={marker} />
                <S />
                <Box style={marker} />
              </Col>
            </Col>
          </Row>
        );
      }
      return (
        <S style={{ backgroundColor: '#1a1511', borderColor: '#8a4a20', borderWidth: 1 }}>
          <Text style={{ fontSize: 10, fontFamily: 'monospace', color: '#b8a890', padding: 4 }}>
            sample
          </Text>
        </S>
      );
    default:
      return <Text style={{ fontSize: 10, color: '#7a6e5d' }}>—</Text>;
  }
}

function ClassifierCatalog() {
  const groups = groupByPrimitive();
  const orderedTypes = [
    ...GROUP_ORDER.filter((t) => groups[t]),
    ...Object.keys(groups).filter((t) => !GROUP_ORDER.includes(t)),
  ];
  const sections = orderedTypes.map((type) => ({
    type,
    entries: groups[type],
  }));
  const columns = distributeSections(
    sections,
    sections.length >= PRIMITIVE_COLUMN_COUNT ? PRIMITIVE_COLUMN_COUNT : 1
  );
  const total = Object.values(groups).reduce((n, arr) => n + arr.length, 0);

  return (
    <Col
      style={{
        width: '100%',
        gap: 20,
        padding: 20,
        backgroundColor: '#0e0b09',
        borderWidth: 1,
        borderColor: '#3a2a1e',
        borderRadius: 14,
      }}
    >
      <Row
        style={{
          width: '100%',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: '#3a2a1e',
        }}
      >
        <Text style={{ fontSize: 14, fontFamily: 'monospace', color: '#f2e8dc' }}>CLASSIFIER CATALOG</Text>
        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: '#7a6e5d' }}>
          {total} registered · {orderedTypes.length} primitive{orderedTypes.length === 1 ? '' : 's'}
        </Text>
      </Row>

      <Row style={{ width: '100%', alignItems: 'flex-start', gap: 16 }}>
        {columns.map((column, columnIndex) => (
          <Col
            key={`column-${columnIndex}`}
            style={{
              flexGrow: 1,
              flexBasis: 0,
              minWidth: 0,
              gap: 16,
            }}
          >
            {column.map(({ type, entries }) => (
              <Col
                key={type}
                style={{
                  width: '100%',
                  gap: 10,
                  padding: 12,
                  backgroundColor: '#14100d',
                  borderWidth: 1,
                  borderColor: '#3a2a1e',
                  borderRadius: 10,
                }}
              >
                <Row
                  style={{
                    width: '100%',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 8,
                    paddingBottom: 4,
                    borderBottomColor: '#3a2a1e',
                    borderBottomWidth: 1,
                  }}
                >
                  <Text style={{ fontSize: 11, fontFamily: 'monospace', color: '#d26a2a' }}>§ {type.toUpperCase()}</Text>
                  <Text style={{ fontSize: 9, fontFamily: 'monospace', color: '#7a6e5d' }}>{entries.length}</Text>
                </Row>

                <Col style={{ width: '100%', gap: 8 }}>
                  {entries.map(({ name, def, Component }) => (
                    <Row key={name} style={{ width: '100%', gap: 14, alignItems: 'center' }}>
                      <Col style={{ gap: 2, width: 210 }}>
                        <Text style={{ fontSize: 10, fontFamily: 'monospace', color: '#f2e8dc' }}>{name}</Text>
                        <Text style={{ fontSize: 8, fontFamily: 'monospace', color: '#7a6e5d' }}>{traitLine(def) || '—'}</Text>
                      </Col>
                      <Box
                        style={{
                          flexGrow: 1,
                          flexBasis: 0,
                          minWidth: 0,
                          minHeight: 40,
                          padding: 8,
                          backgroundColor: '#0f0b08',
                          borderColor: '#3a2a1e',
                          borderWidth: 1,
                        }}
                      >
                        {renderSample(type, Component, def)}
                      </Box>
                    </Row>
                  ))}
                </Col>
              </Col>
            ))}
          </Col>
        ))}
      </Row>
    </Col>
  );
}

export const classifierCatalogSection = defineGallerySection({
  id: 'classifier-catalog',
  title: 'Classifier Catalog',
  group: {
    id: 'themes',
    title: 'Theme Systems',
  },
  kind: 'atom',
  stories: [
    defineGalleryStory({
      id: 'classifier-catalog/all',
      title: 'All registered classifiers',
      source: 'cart/component-gallery/components.cls.ts',
      status: 'ready',
      summary: 'Classifier inventory used by theme, style, variant, and breakpoint systems.',
      tags: ['theme', 'classifier', 'infrastructure'],
      variants: [
        { id: 'default', name: 'Default', render: () => <ClassifierCatalog /> },
      ],
    }),
  ],
});
