import { defineGallerySection, defineGalleryStory } from '../types';
import { GenericCardShell } from '../components/generic-card/GenericCardShell';
import { Box, Text } from '@reactjit/runtime/primitives';

export const genericCardShellSection = defineGallerySection({
  id: "generic-card-shell",
  title: "Generic Card Shell",
  group: {
    id: "cards-tiles",
    title: "Cards & Tiles",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "generic-card-shell/default",
      title: "Generic Card Shell",
      source: "cart/component-gallery/components/generic-card/GenericCardShell.tsx",
      status: 'ready',
      summary: 'Outer chrome for the card, including the accent strip and animated inset frame.',
      tags: ['card', 'shell', 'atom'],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => (
            <GenericCardShell>
              <Box
                style={{
                  minHeight: 120,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#5a8bd6',
                }}
              >
                <Text style={{ color: '#f2e8dc', fontFamily: 'monospace', fontSize: 11 }}>shell content</Text>
              </Box>
            </GenericCardShell>
          ),
        },
      ],
    }),
  ],
});
