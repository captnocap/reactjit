import React from 'react';
import { Native } from '@reactjit/core';
import type { Style, LoveEvent } from '@reactjit/core';
import type {
  PeriodicTableProps, ElementTileProps, ElementCardProps, ElementDetailProps,
  MoleculeCardProps, ElectronShellProps, ReactionViewProps,
} from './types';

// -- PeriodicTable (Lua capability: periodic_table.lua) -----------------------

export function PeriodicTable(props: PeriodicTableProps) {
  return <Native type="PeriodicTable" {...props} />;
}

// -- ElementTile (Lua capability: element_tile.lua) ---------------------------

export function ElementTile(props: ElementTileProps) {
  return <Native type="ElementTile" {...props} />;
}

// -- ElementCard (Lua capability: element_card.lua) ---------------------------

export function ElementCard(props: ElementCardProps) {
  return <Native type="ElementCard" {...props} />;
}

// -- ElementDetail (Lua capability: element_detail.lua) -----------------------

export function ElementDetail(props: ElementDetailProps) {
  return <Native type="ElementDetail" {...props} />;
}

// -- MoleculeCard (Lua capability: molecule_card.lua) -------------------------

export function MoleculeCard(props: MoleculeCardProps) {
  return <Native type="MoleculeCard" {...props} />;
}

// -- ElectronShell (Lua capability: electron_shell.lua) -----------------------

export function ElectronShell(props: ElectronShellProps) {
  return <Native type="ElectronShell" {...props} />;
}

// -- ReactionView (Lua capability: reaction_view.lua) -------------------------

export function ReactionView(props: ReactionViewProps) {
  return <Native type="ReactionView" {...props} />;
}

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
  // ReagentTest needs its own `type` prop for the reagent name, so it cannot
  // use the generic <Native type="..."> wrapper without clobbering that prop.
  return React.createElement('ReagentTest', props);
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
  view3d?: boolean;
  style?: Style;
}

export function PhaseDiagram(props: PhaseDiagramProps) {
  return <Native type="PhaseDiagram" {...props} />;
}

// -- BohrModel (Lua capability: bohr_model.lua) -------------------------------

export interface BohrModelProps {
  element: number | string;
  animated?: boolean;
  speed?: number;
  showLabel?: boolean;
  view3d?: boolean;
  style?: Style;
}

export function BohrModel(props: BohrModelProps) {
  return <Native type="BohrModel" {...props} />;
}

// -- StructureView (Lua capability: structure_view.lua) -----------------------

export interface StructureViewProps {
  smiles: string;
  showLabels?: boolean;
  showHydrogens?: boolean;
  bondColor?: string;
  atomScale?: number;
  view3d?: boolean;
  style?: Style;
}

export function StructureView(props: StructureViewProps) {
  return <Native type="StructureView" {...props} />;
}
