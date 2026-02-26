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
      <Text style={{ color: '#fff', fontSize: 10 }}>{label}</Text>
    </Box>
  );
}

function BreakpointBadge() {
  const bp = useBreakpoint();
  const c = useThemeColors();
  return (
    <Box style={{
      backgroundColor: c.primary,
      borderRadius: 4,
      padding: 4,
      paddingLeft: 8,
      paddingRight: 8,
      alignSelf: 'flex-start',
    }}>
      <Text style={{ color: '#fff', fontSize: 10 }}>{`Current breakpoint: ${bp}`}</Text>
    </Box>
  );
}

// ── Story ───────────────────────────────────────────────────────────

export function GridStory() {
  const c = useThemeColors();

  return (
    <StoryPage>
      <Text style={{ color: c.text, fontSize: 18, textAlign: 'left', width: '100%' }}>
        {'Grid System'}
      </Text>
      <Text style={{ color: c.muted, fontSize: 11, textAlign: 'left', width: '100%', marginBottom: 4 }}>
        {'12-column responsive grid. Three authoring modes, same output.'}
      </Text>
      <BreakpointBadge />

      {/* 1. Numeric spans */}
      <StorySection index={1} title="Numeric Spans">
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'<Col span={4}> = 4/12 = 33.3% each (3 equal columns)'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col span={4}><Cell label="span={4}" color={C.a} /></Col>
          <Col span={4}><Cell label="span={4}" color={C.b} /></Col>
          <Col span={4}><Cell label="span={4}" color={C.c} /></Col>
        </Row>

        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'<Col span={6}> + <Col span={6}> = two halves'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col span={6}><Cell label="span={6}" color={C.d} /></Col>
          <Col span={6}><Cell label="span={6}" color={C.e} /></Col>
        </Row>

        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'<Col span={8}> + <Col span={4}> = 2:1 ratio'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col span={8}><Cell label="span={8}" color={C.f} /></Col>
          <Col span={4}><Cell label="span={4}" color={C.g} /></Col>
        </Row>
      </StorySection>

      {/* 2. Semantic words */}
      <StorySection index={2} title="Semantic Words">
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'Same layouts as above, using words instead of numbers.'}
        </Text>

        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'"third" = span 4'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col span="third"><Cell label={'"third"'} color={C.a} /></Col>
          <Col span="third"><Cell label={'"third"'} color={C.b} /></Col>
          <Col span="third"><Cell label={'"third"'} color={C.c} /></Col>
        </Row>

        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'"half" = span 6'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col span="half"><Cell label={'"half"'} color={C.d} /></Col>
          <Col span="half"><Cell label={'"half"'} color={C.e} /></Col>
        </Row>

        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left', marginTop: 4 }}>
          {'"two-thirds" + "quarter"'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col span="two-thirds"><Cell label={'"two-thirds"'} color={C.f} /></Col>
          <Col span="quarter"><Cell label={'"quarter"'} color={C.g} /></Col>
        </Row>
      </StorySection>

      {/* 3. Responsive breakpoints */}
      <StorySection index={3} title="Responsive Breakpoints">
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'sm={12} md={6} lg={4} — full on mobile, halves on tablet, thirds on desktop.'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col sm={12} md={6} lg={4}><Cell label="A" color={C.a} /></Col>
          <Col sm={12} md={6} lg={4}><Cell label="B" color={C.b} /></Col>
          <Col sm={12} md={6} lg={4}><Cell label="C" color={C.c} /></Col>
          <Col sm={12} md={6} lg={4}><Cell label="D" color={C.d} /></Col>
          <Col sm={12} md={6} lg={4}><Cell label="E" color={C.e} /></Col>
          <Col sm={12} md={6} lg={4}><Cell label="F" color={C.f} /></Col>
        </Row>
      </StorySection>

      {/* 4. Semantic responsive */}
      <StorySection index={4} title="Semantic Responsive">
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'sm="full" md="half" lg="third" — same as section 3, using words.'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col sm="full" md="half" lg="third"><Cell label="A" color={C.a} /></Col>
          <Col sm="full" md="half" lg="third"><Cell label="B" color={C.b} /></Col>
          <Col sm="full" md="half" lg="third"><Cell label="C" color={C.c} /></Col>
          <Col sm="full" md="half" lg="third"><Cell label="D" color={C.d} /></Col>
          <Col sm="full" md="half" lg="third"><Cell label="E" color={C.e} /></Col>
          <Col sm="full" md="half" lg="third"><Cell label="F" color={C.f} /></Col>
        </Row>
      </StorySection>

      {/* 5. Auto-responsive */}
      <StorySection index={5} title="Auto-Responsive (responsive flag)">
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'<Col responsive> — sm=12, md=6, lg=4, xl=3 automatically.'}
        </Text>
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
      </StorySection>

      {/* 6. Mixed modes */}
      <StorySection index={6} title="Mixed Modes in Same Row">
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'Numbers and words in the same Row — they resolve identically.'}
        </Text>
        <Row wrap gap={8} style={{ width: '100%' }}>
          <Col span={3}><Cell label="span={3}" color={C.a} /></Col>
          <Col span="quarter"><Cell label={'"quarter"'} color={C.b} /></Col>
          <Col span={6}><Cell label="span={6}" color={C.c} /></Col>
        </Row>
      </StorySection>

      {/* 7. Nested grid */}
      <StorySection index={7} title="Nested Grid">
        <Text style={{ color: c.muted, fontSize: 10, width: '100%', textAlign: 'left' }}>
          {'Row inside a Col — grids compose naturally.'}
        </Text>
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
      </StorySection>
    </StoryPage>
  );
}
