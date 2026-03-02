/**
 * GridStory — 12-column responsive grid system
 *
 * Demonstrates all three authoring modes for <Col> grid props:
 *   1. Numeric spans (CSS-literate)
 *   2. Semantic words (non-CSS-literate)
 *   3. Auto-responsive flag (zero config)
 *
 * All three resolve to the same flexBasis percentages under the hood.
 */

import React from 'react';
import { Box, Row, Col, Text, useBreakpoint } from '../../../packages/core/src';
import { useThemeColors } from '../../../packages/theme/src';
import { StoryPage, StorySection } from './_shared/StoryScaffold';
import { StyleDemo, ways } from './_shared/StyleDemo';

// ── Palette ─────────────────────────────────────────────────────────

const C = {
  a: '#4f46e5',
  b: '#0891b2',
  c: '#be185d',
  d: '#7c3aed',
  e: '#059669',
  f: '#f97316',
  g: '#dc2626',
  h: '#2563eb',
  i: '#9333ea',
};

// ── Helpers ─────────────────────────────────────────────────────────

function Cell({
  label,
  color,
  h = 48,
}: {
  label: string;
  color: string;
  h?: number;
}) {
  return (
    <Box style={{
      height: h,
      backgroundColor: color,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    }}>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{label}</Text>
    </Box>
  );
}

function BreakpointBadge() {
  const bp = useBreakpoint();
  const c = useThemeColors();
  return (
    // rjit-ignore-next-line
    <Box style={{
      backgroundColor: c.primary,
      borderRadius: 4,
      padding: 4,
      paddingLeft: 8,
      paddingRight: 8,
      alignSelf: 'flex-start',
    }}>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>{`Current breakpoint: ${bp}`}</Text>
    </Box>
  );
}

// ── Story ───────────────────────────────────────────────────────────

export function GridStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Grid System'}
      </Text>
      {/* rjit-ignore-next-line */}
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'12-column responsive grid. Three authoring modes, same output.'}
      </Text>

      <StyleDemo properties={[{
        property: 'useBreakpoint()',
        ways: ways([
          ['hook', 'const bp = useBreakpoint()'],
          ['returns', '"sm" | "md" | "lg" | "xl"'],
        ]),
      }]}>
        <BreakpointBadge />
      </StyleDemo>

      {/* 1. Numeric spans */}
      <StorySection index={1} title="Numeric Spans">
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'<Col span={4}> = 4/12 = 33.3% each (3 equal columns)'}
        </Text>
        <StyleDemo properties={[{
          property: 'span',
          ways: ways([
            ['Col prop', '<Col span={4}>'],
            ['effect', 'flexBasis: "33.33%"'],
          ]),
        }, {
          property: 'Row',
          ways: ways([
            ['component', '<Row wrap gap={8}>'],
            ['wrap prop', 'flexWrap: "wrap"'],
            ['gap prop', 'style={{ gap: 8 }}'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span={4}><Cell label="span={4}" color={C.a} /></Col>
            <Col span={4}><Cell label="span={4}" color={C.b} /></Col>
            <Col span={4}><Cell label="span={4}" color={C.c} /></Col>
          </Row>
        </StyleDemo>

        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'<Col span={6}> + <Col span={6}> = two halves'}
        </Text>
        <StyleDemo properties={[{
          property: 'span',
          ways: ways([
            ['Col prop', '<Col span={6}>'],
            ['effect', 'flexBasis: "50%"'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span={6}><Cell label="span={6}" color={C.d} /></Col>
            <Col span={6}><Cell label="span={6}" color={C.e} /></Col>
          </Row>
        </StyleDemo>

        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'<Col span={8}> + <Col span={4}> = 2:1 ratio'}
        </Text>
        <StyleDemo properties={[{
          property: 'span',
          ways: ways([
            ['Col prop', '<Col span={8}> + <Col span={4}>'],
            ['effect', 'flexBasis: "66.67%" + "33.33%"'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span={8}><Cell label="span={8}" color={C.f} /></Col>
            <Col span={4}><Cell label="span={4}" color={C.g} /></Col>
          </Row>
        </StyleDemo>
      </StorySection>

      {/* 2. Semantic words */}
      <StorySection index={2} title="Semantic Words">
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'Same layouts as above, using words instead of numbers.'}
        </Text>

        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'"third" = span 4'}
        </Text>
        <StyleDemo properties={[{
          property: 'span (semantic)',
          ways: ways([
            ['Col prop', '<Col span="third">'],
            ['equivalent', '<Col span={4}>'],
            ['effect', 'flexBasis: "33.33%"'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span="third"><Cell label={'"third"'} color={C.a} /></Col>
            <Col span="third"><Cell label={'"third"'} color={C.b} /></Col>
            <Col span="third"><Cell label={'"third"'} color={C.c} /></Col>
          </Row>
        </StyleDemo>

        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'"half" = span 6'}
        </Text>
        <StyleDemo properties={[{
          property: 'span (semantic)',
          ways: ways([
            ['Col prop', '<Col span="half">'],
            ['equivalent', '<Col span={6}>'],
            ['effect', 'flexBasis: "50%"'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span="half"><Cell label={'"half"'} color={C.d} /></Col>
            <Col span="half"><Cell label={'"half"'} color={C.e} /></Col>
          </Row>
        </StyleDemo>

        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'"two-thirds" + "quarter"'}
        </Text>
        <StyleDemo properties={[{
          property: 'span (semantic)',
          ways: ways([
            ['Col prop', '<Col span="two-thirds"> + <Col span="quarter">'],
            ['equivalent', '<Col span={8}> + <Col span={3}>'],
            ['effect', 'flexBasis: "66.67%" + "25%"'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span="two-thirds"><Cell label={'"two-thirds"'} color={C.f} /></Col>
            <Col span="quarter"><Cell label={'"quarter"'} color={C.g} /></Col>
          </Row>
        </StyleDemo>
      </StorySection>

      {/* 3. Responsive breakpoints */}
      <StorySection index={3} title="Responsive Breakpoints">
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'sm={12} md={6} lg={4} — full on mobile, halves on tablet, thirds on desktop.'}
        </Text>
        <StyleDemo properties={[{
          property: 'sm / md / lg',
          ways: ways([
            ['Col props', '<Col sm={12} md={6} lg={4}>'],
            ['sm={12}', 'full width below 640px'],
            ['md={6}', 'half width 640-1024px'],
            ['lg={4}', 'third width above 1024px'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col sm={12} md={6} lg={4}><Cell label="A" color={C.a} /></Col>
            <Col sm={12} md={6} lg={4}><Cell label="B" color={C.b} /></Col>
            <Col sm={12} md={6} lg={4}><Cell label="C" color={C.c} /></Col>
            <Col sm={12} md={6} lg={4}><Cell label="D" color={C.d} /></Col>
            <Col sm={12} md={6} lg={4}><Cell label="E" color={C.e} /></Col>
            <Col sm={12} md={6} lg={4}><Cell label="F" color={C.f} /></Col>
          </Row>
        </StyleDemo>
      </StorySection>

      {/* 4. Semantic responsive */}
      <StorySection index={4} title="Semantic Responsive">
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'sm="full" md="half" lg="third" — same as section 3, using words.'}
        </Text>
        <StyleDemo properties={[{
          property: 'sm / md / lg (semantic)',
          ways: ways([
            ['Col props', '<Col sm="full" md="half" lg="third">'],
            ['sm="full"', 'equivalent to sm={12}'],
            ['md="half"', 'equivalent to md={6}'],
            ['lg="third"', 'equivalent to lg={4}'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col sm="full" md="half" lg="third"><Cell label="A" color={C.a} /></Col>
            <Col sm="full" md="half" lg="third"><Cell label="B" color={C.b} /></Col>
            <Col sm="full" md="half" lg="third"><Cell label="C" color={C.c} /></Col>
            <Col sm="full" md="half" lg="third"><Cell label="D" color={C.d} /></Col>
            <Col sm="full" md="half" lg="third"><Cell label="E" color={C.e} /></Col>
            <Col sm="full" md="half" lg="third"><Cell label="F" color={C.f} /></Col>
          </Row>
        </StyleDemo>
      </StorySection>

      {/* 5. Auto-responsive */}
      <StorySection index={5} title="Auto-Responsive (responsive flag)">
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'<Col responsive> — sm=12, md=6, lg=4, xl=3 automatically.'}
        </Text>
        <StyleDemo properties={[{
          property: 'responsive',
          ways: ways([
            ['Col prop', '<Col responsive>'],
            ['effect', 'sm={12} md={6} lg={4} xl={3}'],
            ['zero-config', 'auto breakpoints, no manual spans'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col responsive><Cell label="1" color={C.a} /></Col>
            <Col responsive><Cell label="2" color={C.b} /></Col>
            <Col responsive><Cell label="3" color={C.c} /></Col>
            <Col responsive><Cell label="4" color={C.d} /></Col>
            <Col responsive><Cell label="5" color={C.e} /></Col>
            <Col responsive><Cell label="6" color={C.f} /></Col>
            <Col responsive><Cell label="7" color={C.g} /></Col>
            <Col responsive><Cell label="8" color={C.h} /></Col>
          </Row>
        </StyleDemo>
      </StorySection>

      {/* 6. Mixed modes */}
      <StorySection index={6} title="Mixed Modes in Same Row">
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'Numbers and words in the same Row — they resolve identically.'}
        </Text>
        <StyleDemo properties={[{
          property: 'span (mixed)',
          ways: ways([
            ['numeric', '<Col span={3}> = flexBasis: "25%"'],
            ['semantic', '<Col span="quarter"> = flexBasis: "25%"'],
            ['combined', 'numbers and words in the same Row'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span={3}><Cell label="span={3}" color={C.a} /></Col>
            <Col span="quarter"><Cell label={'"quarter"'} color={C.b} /></Col>
            <Col span={6}><Cell label="span={6}" color={C.c} /></Col>
          </Row>
        </StyleDemo>
      </StorySection>

      {/* 7. Nested grid */}
      <StorySection index={7} title="Nested Grid">
        {/* rjit-ignore-next-line */}
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'Row inside a Col — grids compose naturally.'}
        </Text>
        <StyleDemo properties={[{
          property: 'nested grid',
          ways: ways([
            ['pattern', '<Col span={6}><Row wrap>...</Row></Col>'],
            ['inner spans', 'relative to the parent Col, not the root'],
            ['composability', 'Row/Col nest to any depth'],
          ]),
        }]}>
          <Row wrap gap={8} style={{ width: '100%' }}>
            <Col span={6}>
              <Cell label="Left (span=6)" color={C.a} />
            </Col>
            <Col span={6}>
              <Row wrap gap={4} style={{ width: '100%' }}>
                <Col span={6}><Cell label="Nested A" color={C.d} h={36} /></Col>
                <Col span={6}><Cell label="Nested B" color={C.e} h={36} /></Col>
                <Col span={12}><Cell label="Nested Full" color={C.f} h={36} /></Col>
              </Row>
            </Col>
          </Row>
        </StyleDemo>
      </StorySection>
    </StoryPage>
  );
}
