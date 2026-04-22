const React: any = require('react');

import { Box, Canvas, Text } from '../../../runtime/primitives';
import { COLORS } from '../theme';
import { layoutMermaidDiagram, type MermaidLayoutDiagram, type MermaidLayoutEdge, type MermaidLayoutNode } from './layout';
import { parseMermaid, type MermaidDiagram } from './parser';

type MermaidRendererProps = {
  source?: string;
  diagram?: MermaidDiagram | null;
  layout?: MermaidLayoutDiagram | null;
  backgroundColor?: string;
};

function nodeFill(node: MermaidLayoutNode): string {
  if (node.shape === 'diamond') return '#1a2230';
  if (node.shape === 'circle') return '#182230';
  if (node.shape === 'subroutine') return '#16212c';
  return '#141b25';
}

function nodeRadius(node: MermaidLayoutNode): number {
  if (node.shape === 'circle') return Math.min(node.width, node.height) / 2;
  if (node.shape === 'stadium') return 999;
  if (node.shape === 'round') return 14;
  if (node.shape === 'subroutine') return 8;
  if (node.shape === 'rect') return 8;
  return 8;
}

function pathForDiamond(node: MermaidLayoutNode): string {
  const x = node.x;
  const y = node.y;
  const w = node.width;
  const h = node.height;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`;
}

function edgePath(edge: MermaidLayoutEdge): string {
  if (edge.points.length === 0) return '';
  const [first, ...rest] = edge.points;
  let d = `M ${first.x} ${first.y}`;
  for (const point of rest) d += ` L ${point.x} ${point.y}`;
  return d;
}

function arrowHead(edge: MermaidLayoutEdge): string {
  if (edge.points.length < 2) return '';
  const a = edge.points[edge.points.length - 2];
  const b = edge.points[edge.points.length - 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const ux = dx / length;
  const uy = dy / length;
  const size = 8;
  const leftX = b.x - ux * size - uy * (size * 0.6);
  const leftY = b.y - uy * size + ux * (size * 0.6);
  const rightX = b.x - ux * size + uy * (size * 0.6);
  const rightY = b.y - uy * size - ux * (size * 0.6);
  return `M ${b.x} ${b.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
}

function EdgeLayer(props: { edges: MermaidLayoutEdge[] }) {
  return (
    <>
      {props.edges.map((edge) => {
        const stroke = edge.style === 'thick' ? COLORS.blue : edge.style === 'dashed' ? COLORS.textDim : '#8b949e';
        const d = edgePath(edge);
        const arrow = arrowHead(edge);
        const label = edge.label && edge.label.length > 0 ? edge.label : '';
        return (
          <React.Fragment key={`${edge.from}-${edge.to}-${edge.label}`}>
            {d ? <Canvas.Path d={d} stroke={stroke} strokeWidth={edge.style === 'thick' ? 2 : 1.5} fill="none" /> : null}
            {arrow ? <Canvas.Path d={arrow} fill={stroke} stroke={stroke} strokeWidth={1} /> : null}
            {label ? (
              <Canvas.Node gx={edge.labelX - 40} gy={edge.labelY - 10} gw={80} gh={20}>
                <Box
                  style={{
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    backgroundColor: '#0f1620',
                    borderWidth: 1,
                    borderColor: '#253043',
                  }}
                >
                  <Text fontSize={9} color={COLORS.textDim} style={{ fontWeight: 'bold' }}>
                    {label}
                  </Text>
                </Box>
              </Canvas.Node>
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

function NodeLayer(props: { nodes: MermaidLayoutNode[] }) {
  return (
    <>
      {props.nodes.map((node) => {
        if (node.shape === 'diamond') {
          return (
            <React.Fragment key={node.id}>
              <Canvas.Path d={pathForDiamond(node)} fill={nodeFill(node)} stroke="#3a4a61" strokeWidth={1.5} />
              <Canvas.Node gx={node.x} gy={node.y} gw={node.width} gh={node.height}>
                <Box
                  style={{
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                  }}
                >
                  <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold', textAlign: 'center' }}>
                    {node.label}
                  </Text>
                </Box>
              </Canvas.Node>
            </React.Fragment>
          );
        }

        return (
          <Canvas.Node key={node.id} gx={node.x} gy={node.y} gw={node.width} gh={node.height}>
            <Box
              style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: nodeRadius(node),
                backgroundColor: nodeFill(node),
                borderWidth: 1,
                borderColor: '#3a4a61',
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
              }}
            >
              <Text fontSize={11} color={COLORS.textBright} style={{ fontWeight: 'bold', textAlign: 'center' }}>
                {node.label}
              </Text>
            </Box>
          </Canvas.Node>
        );
      })}
    </>
  );
}

export function MermaidRenderer(props: MermaidRendererProps) {
  const diagram = props.layout || layoutMermaidDiagram(props.diagram || parseMermaid(props.source || ''));
  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: props.backgroundColor || COLORS.appBg,
        overflow: 'hidden',
      }}
    >
      <Canvas style={{ width: '100%', height: '100%' }}>
        <EdgeLayer edges={diagram.edges} />
        <NodeLayer nodes={diagram.nodes} />
      </Canvas>
    </Box>
  );
}

export function renderMermaid(source: string): any {
  return <MermaidRenderer source={source} />;
}

const mermaidHost: any = globalThis as any;
if (typeof mermaidHost.__mermaidRender !== 'function') {
  mermaidHost.__mermaidRender = renderMermaid;
}
