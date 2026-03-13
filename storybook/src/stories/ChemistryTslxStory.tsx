/**
 * Chemistry (TSLX) — Same chemistry UI, compiled from .tslx/.tsl instead of .tsx/.ts.
 *
 * This renders the ChemistryStory capability compiled from:
 *   examples/tslx-demo/after/ChemistryStory.tslx → lua/generated/chemistry_story.lua
 *
 * Side-by-side with the original ChemistryStory.tsx to show identical output.
 */

import React from 'react';
import { Box } from '../../../packages/core/src';
import { Native } from '../../../packages/core/src/Native';

export function ChemistryTslxStory() {
  return (
    <Box style={{ width: '100%', height: '100%' }}>
      <Native type="TslxChemistryStory" />
    </Box>
  );
}
