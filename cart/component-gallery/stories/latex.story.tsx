import { Col, Row, Text } from '@reactjit/runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { Latex } from '../components/latex/Latex';

const SURFACE = '#171b31';
const LATEX_SMOKE_TEST = String.raw`\frac{\sqrt{x_1^2 + x_2^2}}{\sum_{i=1}^{3} i} = \begin{bmatrix} 1 & 0 \\ 0 & 1 \end{bmatrix}`;

function Stage({ children }: { children: any }) {
  return (
    <Col
      style={{
        padding: 20,
        gap: 14,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: '#4d5372',
        borderRadius: 6,
        minWidth: 360,
      }}
    >
      {children}
    </Col>
  );
}

function Caption({ children }: { children: any }) {
  return (
    <Text style={{ fontFamily: 'monospace', fontSize: 10, color: '#8f98b8' }}>{children}</Text>
  );
}

export const latexSection = defineGallerySection({
  id: 'latex',
  title: 'LaTeX',
  group: {
    id: 'components',
    title: 'Components',
  },
  kind: 'atom',
  stories: [
    defineGalleryStory({
      id: 'latex/default',
      title: 'LaTeX',
      source: 'cart/component-gallery/components/latex/Latex.tsx',
      status: 'draft',
      tags: ['math', 'latex', 'text'],
      variants: [
        {
          id: 'block-basic',
          name: 'Block · basic',
          render: () => (
            <Stage>
              <Caption>E = mc^2</Caption>
              <Latex source="E = mc^2" />
            </Stage>
          ),
        },
        {
          id: 'smoke-test',
          name: 'Smoke test',
          render: () => (
            <Stage>
              <Caption>{LATEX_SMOKE_TEST}</Caption>
              <Latex source={LATEX_SMOKE_TEST} numbered equationNumber="smoke" />
            </Stage>
          ),
        },
        {
          id: 'inline',
          name: 'Inline',
          render: () => (
            <Stage>
              <Caption>inline inside a text flow</Caption>
              <Row style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={{ color: '#dfe6ff', fontSize: 14 }}>Given</Text>
                <Latex source="a^2 + b^2 = c^2" inline />
                <Text style={{ color: '#dfe6ff', fontSize: 14 }}>, the hypotenuse is</Text>
                <Latex source="\sqrt{a^2 + b^2}" inline />
                <Text style={{ color: '#dfe6ff', fontSize: 14 }}>.</Text>
              </Row>
            </Stage>
          ),
        },
        {
          id: 'fraction',
          name: 'Fraction',
          render: () => (
            <Stage>
              <Caption>\frac{'{'}-b \pm \sqrt{'{'}b^2-4ac{'}'}{'}'}{'{'}2a{'}'}</Caption>
              <Latex source="x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}" numbered equationNumber={1} />
            </Stage>
          ),
        },
        {
          id: 'scripts',
          name: 'Sub/superscripts',
          render: () => (
            <Stage>
              <Caption>nested scripts</Caption>
              <Latex source="\sum_{i=0}^{n} x_i^2 = \sigma^2" />
              <Latex source="a_{i,j} = b_{i}^{k} + c_{j}^{k}" />
            </Stage>
          ),
        },
        {
          id: 'matrix',
          name: 'Matrix',
          render: () => (
            <Stage>
              <Caption>pmatrix / bmatrix</Caption>
              <Latex source="\begin{pmatrix} a & b \\ c & d \end{pmatrix}" />
              <Latex source="\begin{bmatrix} 1 & 0 & 0 \\ 0 & 1 & 0 \\ 0 & 0 & 1 \end{bmatrix}" />
            </Stage>
          ),
        },
        {
          id: 'symbols',
          name: 'Greek & operators',
          render: () => (
            <Stage>
              <Caption>greek letters and operators</Caption>
              <Latex source="\alpha + \beta \leq \gamma \cdot \delta" />
              <Latex source="\forall x \in \mathbb{R}, \exists y : y \geq x" />
              <Latex source="\nabla \cdot \vec{E} = \frac{\rho}{\varepsilon_0}" />
            </Stage>
          ),
        },
        {
          id: 'chem',
          name: 'Chemistry (\\ce)',
          render: () => (
            <Stage>
              <Caption>mhchem-style \ce{'{'}...{'}'}</Caption>
              <Latex source="\ce{2H2 + O2 -> 2H2O}" />
              <Latex source="\ce{CO2 + H2O <=> H2CO3}" />
            </Stage>
          ),
        },
      ],
    }),
  ],
});
