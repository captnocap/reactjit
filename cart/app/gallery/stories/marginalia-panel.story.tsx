import { defineGallerySection, defineGalleryStory } from '../types';
import { MarginaliaPanel } from '../components/controls-specimen/MarginaliaPanel';

export const marginaliaPanelSection = defineGallerySection({
  id: "marginalia-panel",
  title: "Marginalia Panel",
  stories: [
    defineGalleryStory({
      id: "marginalia-panel/default",
      title: "Marginalia Panel",
      source: "cart/component-gallery/components/controls-specimen/MarginaliaPanel.tsx",
      status: 'ready',
      summary: 'Mixed-orientation panel with vertical spine and horizontal body copy.',
      tags: ['controls', 'marginalia', 'mixed-axis', 'atom'],
      variants: [
        {
          id: 'enforce',
          name: 'Enforce',
          render: () => <MarginaliaPanel />,
        },
        {
          id: 'audit',
          name: 'Audit',
          render: () => (
            <MarginaliaPanel
              spine="§ 05 · AUDIT"
              tone="flag"
              title="Commit velocity window"
              body="Trailing 24h commits compared to team baseline; a running total is surfaced when a worker exceeds 2σ."
              stats={[
                { label: 'Δ', value: '+126' },
                { label: 'σ', value: '2.4' },
                { label: 'BASE', value: '62/d' },
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
