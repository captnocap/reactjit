import { defineGallerySection, defineGalleryStory } from '../types';
import { TooltipHeader } from '../components/tooltip-header/TooltipHeader';
import { Command } from '../../../runtime/icons/icons';

export const tooltipHeaderSection = defineGallerySection({
  id: "tooltip-header",
  title: "Tooltip Header",
  group: {
    id: "controls",
    title: "Controls & Cards",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "tooltip-header/default",
      title: "Tooltip Header",
      source: "cart/component-gallery/components/tooltip-header/TooltipHeader.tsx",
      status: 'ready',
      summary: 'Tooltip header adapter built from Body, Mono, InlinePill, Divider, and the shared Icon renderer.',
      tags: ["header", "badge", "card"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <TooltipHeader shortcut="Cmd K" icon={Command} />,
        },
      ],
    }),
  ],
});
