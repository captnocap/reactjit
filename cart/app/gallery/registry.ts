import type { GalleryGroup, GallerySection, GallerySectionKind } from './types';
import { storySections } from './stories';
import { GALLERY_GROUPS, resolveGalleryGroup } from './taxonomy';

const GROUPS = {
  compositions: GALLERY_GROUPS.compositions,
  themes: GALLERY_GROUPS.themes,
  motion: GALLERY_GROUPS.motion,
  controls: GALLERY_GROUPS.controls,
  charts: GALLERY_GROUPS.charts,
  data: GALLERY_GROUPS.data,
  systems: GALLERY_GROUPS.systems,
} satisfies Record<string, GalleryGroup>;

type SectionMeta = {
  group: GalleryGroup;
  kind?: GallerySectionKind;
  composedOf?: string[];
};

const SECTION_META: Record<string, SectionMeta> = {
  'classifier-catalog': {
    group: GROUPS.themes,
  },
  'intent-surface': {
    group: GROUPS.compositions,
    kind: 'top-level',
    composedOf: [
      'cart/component-gallery/components/intent-surface/IntentTitle.tsx',
      'cart/component-gallery/components/intent-surface/IntentText.tsx',
      'cart/component-gallery/components/intent-surface/IntentCard.tsx',
      'cart/component-gallery/components/intent-surface/IntentRow.tsx',
      'cart/component-gallery/components/intent-surface/IntentCol.tsx',
      'cart/component-gallery/components/intent-surface/IntentList.tsx',
      'cart/component-gallery/components/intent-surface/IntentBtn.tsx',
      'cart/component-gallery/components/intent-surface/IntentBadge.tsx',
      'cart/component-gallery/components/intent-surface/IntentCode.tsx',
      'cart/component-gallery/components/intent-surface/IntentDivider.tsx',
      'cart/component-gallery/components/intent-surface/IntentKbd.tsx',
      'cart/component-gallery/components/intent-surface/IntentSpacer.tsx',
      'cart/component-gallery/components/intent-surface/types.ts',
    ],
  },
  'generic-chat-card': {
    group: GROUPS.compositions,
    kind: 'top-level',
    composedOf: [
      'cart/component-gallery/components/generic-chat-card/ConsoleHeader.tsx',
      'cart/component-gallery/components/generic-chat-card/TranscriptFlow.tsx',
      'cart/component-gallery/components/generic-chat-card/TelemetryStats.tsx',
      'cart/component-gallery/components/generic-chat-card/TaskPanel.tsx',
    ],
  },
  'sweatshop-matrix-display': {
    group: GROUPS.motion,
    kind: 'top-level',
    composedOf: [
      'cart/component-gallery/components/sweatshop-matrix-display/BrailleProjectionSurface.tsx',
      'cart/component-gallery/components/matrix-scaling-dashboard/MatrixScalingDashboard.tsx',
    ],
  },
  'matrix-scaling-dashboard': { group: GROUPS.motion },
  'model-card': { group: GROUPS.controls },
  'generic-card': { group: GROUPS.controls },
  'skeleton-tiles': { group: GROUPS.controls },
  progress: { group: GROUPS.motion },
  'circular-progress': { group: GROUPS.motion },
  tracking: { group: GROUPS.motion },
  easings: { group: GROUPS.motion },
  'animated-text': { group: GROUPS.motion },
  'grid-spinners': { group: GROUPS.motion },
  'time-instruments': { group: GROUPS.motion },
  'console-header': { group: GROUPS.controls },
  'transcript-flow': { group: GROUPS.controls },
  'telemetry-stats': { group: GROUPS.controls },
  'task-panel': { group: GROUPS.controls },
  chart: {
    group: GROUPS.charts,
    kind: 'top-level',
    composedOf: [
      'cart/component-gallery/components/area-chart/AreaChart.tsx',
      'cart/component-gallery/components/bar-chart/BarChart.tsx',
      'cart/component-gallery/components/boxplot/Boxplot.tsx',
      'cart/component-gallery/components/braille-graph/BrailleGraph.tsx',
      'cart/component-gallery/components/bubble-correlation/BubbleCorrelation.tsx',
      'cart/component-gallery/components/bubble-scatterplot/BubbleScatterplot.tsx',
      'cart/component-gallery/components/candlestick/Candlestick.tsx',
      'cart/component-gallery/components/circular-bar-chart/CircularBarChart.tsx',
      'cart/component-gallery/components/circular-progress/CircularProgress.tsx',
      'cart/component-gallery/components/combination-chart/CombinationChart.tsx',
      'cart/component-gallery/components/contour-map/ContourMap.tsx',
      'cart/component-gallery/components/diverging-chart/DivergingChart.tsx',
      'cart/component-gallery/components/donut-bar-chart/DonutBarChart.tsx',
      'cart/component-gallery/components/fan-chart/FanChart.tsx',
      'cart/component-gallery/components/flow-map/FlowMap.tsx',
      'cart/component-gallery/components/fraction-chart/FractionChart.tsx',
      'cart/component-gallery/components/grouped-bar-chart/GroupedBarChart.tsx',
      'cart/component-gallery/components/heatmap/Heatmap.tsx',
      'cart/component-gallery/components/layered-pyramid/LayeredPyramid.tsx',
      'cart/component-gallery/components/network-scheme/NetworkScheme.tsx',
      'cart/component-gallery/components/pictorial-fraction-chart/PictorialFractionChart.tsx',
      'cart/component-gallery/components/polar-chart/PolarChart.tsx',
      'cart/component-gallery/components/population-pyramid/PopulationPyramid.tsx',
      'cart/component-gallery/components/process-circle/ProcessCircle.tsx',
      'cart/component-gallery/components/progress/Progress.tsx',
      'cart/component-gallery/components/proportion-filters/ProportionFilters.tsx',
      'cart/component-gallery/components/pyramid-chart/PyramidChart.tsx',
      'cart/component-gallery/components/radar/Radar.tsx',
      'cart/component-gallery/components/rings-in-pie-chart/RingsInPieChart.tsx',
      'cart/component-gallery/components/scatterplot/Scatterplot.tsx',
      'cart/component-gallery/components/spline-graph/SplineGraph.tsx',
      'cart/component-gallery/components/surplus/Surplus.tsx',
      'cart/component-gallery/components/timeline/Timeline.tsx',
      'cart/component-gallery/components/tracking/Tracking.tsx',
      'cart/component-gallery/components/venn/Venn.tsx',
      'cart/component-gallery/components/waterfall-chart/WaterfallChart.tsx',
    ],
  },
  'braille-graph': { group: GROUPS.charts },
  'bar-chart': { group: GROUPS.charts },
  surplus: { group: GROUPS.charts },
  'diverging-chart': { group: GROUPS.charts },
  heatmap: { group: GROUPS.charts },
  'pictorial-fraction-chart': { group: GROUPS.charts },
  'contour-map': { group: GROUPS.charts },
  boxplot: { group: GROUPS.charts },
  scatterplot: { group: GROUPS.charts },
  'population-pyramid': { group: GROUPS.charts },
  'proportion-filters': { group: GROUPS.charts },
  'fraction-chart': { group: GROUPS.charts },
  radar: { group: GROUPS.charts },
  candlestick: { group: GROUPS.charts },
  'area-chart': { group: GROUPS.charts },
  'pyramid-chart': { group: GROUPS.charts },
  timeline: { group: GROUPS.charts },
  'combination-chart': { group: GROUPS.charts },
  'fan-chart': { group: GROUPS.charts },
  'waterfall-chart': { group: GROUPS.charts },
  'network-scheme': { group: GROUPS.charts },
  'circular-bar-chart': { group: GROUPS.charts },
  'layered-pyramid': { group: GROUPS.charts },
  'grouped-bar-chart': { group: GROUPS.charts },
  'polar-chart': { group: GROUPS.charts },
  'donut-bar-chart': { group: GROUPS.charts },
  'rings-in-pie-chart': { group: GROUPS.charts },
  'bubble-scatterplot': { group: GROUPS.charts },
  'bubble-correlation': { group: GROUPS.charts },
  'spline-graph': { group: GROUPS.charts },
  'flow-map': { group: GROUPS.charts },
  venn: { group: GROUPS.charts },
  'chart-demo-data': { group: GROUPS.data },
  'braille-effect-instrument': { group: GROUPS.motion },
  'braille-projection-surface': { group: GROUPS.motion },
};
const DEFAULT_KIND: GallerySectionKind = 'atom';

function pathExists(path: string): boolean {
  const host = globalThis as { __fs_exists?: (target: string) => boolean };
  return typeof host.__fs_exists === 'function' ? !!host.__fs_exists(path) : true;
}

function normalizeSection(section: GallerySection): GallerySection {
  const meta = SECTION_META[section.id];
  const normalized = {
    ...section,
    group: meta?.group || section.group,
    kind: section.kind || meta?.kind || DEFAULT_KIND,
    composedOf: section.composedOf || meta?.composedOf,
  };

  return {
    ...normalized,
    group: resolveGalleryGroup(normalized),
  };
}

function validateTopLevelSection(section: GallerySection) {
  if (section.kind !== 'top-level') return;

  const atoms = (section.composedOf || []).map((part) => part.trim()).filter(Boolean);
  if (atoms.length < 2) {
    throw new Error(
      `[component-gallery] top-level section "${section.id}" must declare at least two atom paths in composedOf`
    );
  }

  const sourceSet = new Set(section.stories.map((story) => story.source));
  for (const atomPath of atoms) {
    if (sourceSet.has(atomPath)) {
      throw new Error(
        `[component-gallery] top-level section "${section.id}" cannot list its own story source in composedOf`
      );
    }
    if (!pathExists(atomPath)) {
      throw new Error(
        `[component-gallery] top-level section "${section.id}" references missing atom "${atomPath}"`
      );
    }
  }
}

const normalizedSections = storySections.map(normalizeSection);
normalizedSections.forEach(validateTopLevelSection);

export const gallerySections: GallerySection[] = normalizedSections;
