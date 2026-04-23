const React: any = require('react');

import { Box, Col, Pressable, Row, ScrollView, Text, TextInput } from '../../runtime/primitives';
import { COLORS, TOKENS } from '../sweatshop/theme';
import type { ColorMode, DemoNode, EdgeDensity, GraphLayoutMode, NodeCount } from './LayoutEngine';

const LAYOUTS: Array<{ value: GraphLayoutMode; label: string }> = [
  { value: 'force', label: 'force-directed' },
  { value: 'tree-down', label: 'tree top-down' },
  { value: 'tree-left', label: 'tree left-right' },
  { value: 'radial', label: 'radial' },
  { value: 'circular', label: 'circular' },
  { value: 'grid', label: 'grid' },
];

const COUNTS: NodeCount[] = [10, 50, 100, 500, 1000, 5000];
const DENSITIES: Array<{ value: EdgeDensity; label: string }> = [
  { value: 'sparse', label: 'sparse' },
  { value: 'medium', label: 'medium' },
  { value: 'dense', label: 'dense' },
  { value: 'complete', label: 'complete' },
];
const COLOR_MODES: Array<{ value: ColorMode; label: string }> = [
  { value: 'degree', label: 'degree' },
  { value: 'cluster', label: 'cluster' },
  { value: 'depth', label: 'depth' },
  { value: 'random', label: 'random' },
];

function Pill(props: {
  active?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={props.onPress}>
      <Box
        style={{
          paddingLeft: 9,
          paddingRight: 9,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: TOKENS.radiusSm,
          borderWidth: 1,
          borderColor: props.active ? COLORS.blue : COLORS.borderSoft,
          backgroundColor: props.active ? COLORS.blueDeep : COLORS.panelAlt,
        }}
      >
        <Text fontSize={10} color={props.active ? COLORS.blue : COLORS.textDim} style={{ fontWeight: 'bold' }}>
          {props.label}
        </Text>
      </Box>
    </Pressable>
  );
}

function Section(props: { title: string; children: any }) {
  return (
    <Col style={{ gap: 6, minWidth: 0 }}>
      <Text fontSize={9} color={COLORS.textDim} style={{ textTransform: 'uppercase', letterSpacing: 0.7, fontWeight: 'bold' }}>
        {props.title}
      </Text>
      {props.children}
    </Col>
  );
}

export function GraphControls(props: {
  layoutMode: GraphLayoutMode;
  nodeCount: NodeCount;
  edgeDensity: EdgeDensity;
  colorMode: ColorMode;
  animate: boolean;
  searchQuery: string;
  searchResults: DemoNode[];
  selectedNode: DemoNode | null;
  onLayoutModeChange: (next: GraphLayoutMode) => void;
  onNodeCountChange: (next: NodeCount) => void;
  onEdgeDensityChange: (next: EdgeDensity) => void;
  onColorModeChange: (next: ColorMode) => void;
  onAnimateChange: (next: boolean) => void;
  onSearchQueryChange: (next: string) => void;
  onFocusResult: (id: string) => void;
  onClearSelection: () => void;
}) {
  return (
    <Box style={{ borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft, backgroundColor: COLORS.panelBg, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, gap: 10 }}>
      <Row style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Col style={{ gap: 2, minWidth: 0, flexGrow: 1, flexBasis: 0 }}>
          <Text fontSize={14} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>Graph demo</Text>
          <Text fontSize={10} color={COLORS.textDim}>Graph.Path edges, Canvas.Node cards, Image icons, search focus, drag, and neighborhood dimming.</Text>
        </Col>
        <Pressable onPress={props.onClearSelection}>
          <Box style={{ paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}>
            <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold' }}>clear selection</Text>
          </Box>
        </Pressable>
        <Pill active={props.animate} label={props.animate ? 'animation on' : 'animation off'} onPress={() => props.onAnimateChange(!props.animate)} />
      </Row>

      <Row style={{ gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Section title="layout picker">
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {LAYOUTS.map((item) => <Pill key={item.value} active={props.layoutMode === item.value} label={item.label} onPress={() => props.onLayoutModeChange(item.value)} />)}
          </Row>
        </Section>

        <Section title="node count">
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {COUNTS.map((value) => <Pill key={value} active={props.nodeCount === value} label={String(value)} onPress={() => props.onNodeCountChange(value)} />)}
          </Row>
        </Section>

        <Section title="edge density">
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {DENSITIES.map((item) => <Pill key={item.value} active={props.edgeDensity === item.value} label={item.label} onPress={() => props.onEdgeDensityChange(item.value)} />)}
          </Row>
        </Section>

        <Section title="color by">
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {COLOR_MODES.map((item) => <Pill key={item.value} active={props.colorMode === item.value} label={item.label} onPress={() => props.onColorModeChange(item.value)} />)}
          </Row>
        </Section>

        <Section title="search node">
          <Box style={{ minWidth: 250, gap: 6 }}>
            <TextInput
              value={props.searchQuery}
              onChangeText={props.onSearchQueryChange}
              placeholder="type a node label..."
              style={{
                borderWidth: 1,
                borderColor: COLORS.borderSoft,
                borderRadius: TOKENS.radiusSm,
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 7,
                paddingBottom: 7,
                color: COLORS.textBright,
                backgroundColor: COLORS.panelRaised,
                fontSize: 11,
              }}
            />
            <ScrollView showScrollbar={true} style={{ maxHeight: 92 }}>
              <Col style={{ gap: 5, paddingRight: 4 }}>
                {props.searchResults.length > 0 ? props.searchResults.map((node) => (
                  <Pressable key={node.id} onPress={() => props.onFocusResult(node.id)}>
                    <Box style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 5, paddingBottom: 5, borderRadius: TOKENS.radiusSm, borderWidth: 1, borderColor: COLORS.borderSoft, backgroundColor: COLORS.panelAlt }}>
                      <Row style={{ gap: 6, alignItems: 'center' }}>
                        <Text fontSize={10} color={COLORS.textBright} style={{ fontWeight: 'bold', flexGrow: 1, flexBasis: 0 }} numberOfLines={1}>{node.label}</Text>
                        <Text fontSize={8} color={COLORS.textDim}>d{node.depth}</Text>
                        <Text fontSize={8} color={COLORS.textDim}>deg {node.degree}</Text>
                      </Row>
                    </Box>
                  </Pressable>
                )) : (
                  <Text fontSize={10} color={COLORS.textDim}>no matches</Text>
                )}
              </Col>
            </ScrollView>
          </Box>
        </Section>
      </Row>

      <Row style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text fontSize={10} color={COLORS.textDim}>{props.selectedNode ? `selected: ${props.selectedNode.label}` : 'selected: none'}</Text>
        <Text fontSize={10} color={COLORS.textDim}>{props.searchResults.length} matches</Text>
      </Row>
    </Box>
  );
}
