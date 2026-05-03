import { defineGallerySection, defineGalleryStory } from '../types';
import { TooltipDataRow } from '../components/tooltip-data-row/TooltipDataRow';

export const tooltipDataRowSection = defineGallerySection({
  id: "tooltip-data-row",
  title: "Tooltip Data Row",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "tooltip-data-row/default",
      title: "Tooltip Data Row",
      source: "cart/component-gallery/components/tooltip-data-row/TooltipDataRow.tsx",
      status: 'ready',
      summary: 'Tooltip row adapter over the existing KeyValueBadge atom.',
      tags: ["card", "table", "data"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <TooltipDataRow />,
        },
        {
          id: 'warning',
          name: 'Warning',
          render: () => <TooltipDataRow label="P95" value="118 ms" tone="warn" />,
        },
      ],
    }),
  ],
});
