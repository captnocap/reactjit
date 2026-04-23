const React: any = require('react');

import { Box, Col } from '../runtime/primitives';
import { COLORS } from './sweatshop/theme';
import { GraphControls } from './graph_demo/GraphControls';
import { GraphStage } from './graph_demo/GraphStage';
import { useGraphSim } from './graph_demo/useGraphSim';

export default function GraphDemoCart() {
  const sim = useGraphSim();

  return (
    <Col style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, backgroundColor: COLORS.appBg }}>
      <GraphControls
        layoutMode={sim.layoutMode}
        nodeCount={sim.nodeCount}
        edgeDensity={sim.edgeDensity}
        colorMode={sim.colorMode}
        animate={sim.animate}
        searchQuery={sim.searchQuery}
        searchResults={sim.searchResults}
        selectedNode={sim.selectedNode}
        onLayoutModeChange={sim.setLayoutMode}
        onNodeCountChange={sim.setNodeCount}
        onEdgeDensityChange={sim.setEdgeDensity}
        onColorModeChange={sim.setColorMode}
        onAnimateChange={sim.setAnimate}
        onSearchQueryChange={sim.setSearchQuery}
        onFocusResult={sim.focusNode}
        onClearSelection={sim.clearSelection}
      />
      <Box style={{ flexGrow: 1, flexBasis: 0, minHeight: 0, minWidth: 0 }}>
        <GraphStage sim={sim} />
      </Box>
    </Col>
  );
}
