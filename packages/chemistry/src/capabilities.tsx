import React from 'react';
import { Native } from '@reactjit/core';
import type { Style, LoveEvent } from '@reactjit/core';

// -- ReagentTest (Lua capability: reagent_test.lua) ---------------------------

export interface ReagentTestProps {
  type: 'marquis' | 'mecke' | 'mandelin' | 'simons' | 'ehrlich';
  sample: string;
  animated?: boolean;
  speed?: number;
  onReactionStart?: (event: LoveEvent) => void;
  onReactionComplete?: (event: LoveEvent & { color: string; description: string; confidence: number }) => void;
  style?: Style;
}

export function ReagentTest(props: ReagentTestProps) {
  return <Native type="ReagentTest" {...props} />;
}

// -- SpectrumView (Lua capability: spectrum_view.lua) -------------------------

export interface SpectrumViewProps {
  spectrumType: 'ir' | 'uv-vis' | 'mass-spec';
  compound: string;
  showLabels?: boolean;
  showGrid?: boolean;
  highlightPeak?: number;
  lineColor?: string;
  onPeakSelect?: (event: LoveEvent & { position: number; intensity: number; label: string }) => void;
  style?: Style;
}

export function SpectrumView(props: SpectrumViewProps) {
  return <Native type="SpectrumView" {...props} />;
}

// -- PhaseDiagram (Lua capability: phase_diagram.lua) -------------------------

export interface PhaseDiagramProps {
  compound: string;
  showCriticalPoint?: boolean;
  showTriplePoint?: boolean;
  temperature?: number;
  pressure?: number;
  style?: Style;
}

export function PhaseDiagram(props: PhaseDiagramProps) {
  return <Native type="PhaseDiagram" {...props} />;
}
