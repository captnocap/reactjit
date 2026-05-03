import { defineGallerySection, defineGalleryStory } from '../types';
import { ChoiceList } from '../components/controls-specimen/ChoiceList';

export const choiceListSection = defineGallerySection({
  id: "choice-list",
  title: "Choice List",
  stories: [
    defineGalleryStory({
      id: "choice-list/default",
      title: "Choice List",
      source: "cart/component-gallery/components/controls-specimen/ChoiceList.tsx",
      status: 'ready',
      summary: 'Selectable list rows with square, round, or bracketed markers.',
      tags: ['controls', 'selection', 'radio', 'atom'],
      variants: [
        {
          id: 'square',
          name: 'Square',
          render: () => <ChoiceList />,
        },
        {
          id: 'round',
          name: 'Round',
          render: () => (
            <ChoiceList
              marker="round"
              items={[
                { label: 'thinking' },
                { label: 'tool-use', active: true },
                { label: 'editing' },
                { label: 'idle' },
              ]}
            />
          ),
        },
        {
          id: 'bracket',
          name: 'Bracket',
          render: () => (
            <ChoiceList
              marker="bracket"
              items={[
                { label: 'brainstorm' },
                { label: 'enforce', active: true },
                { label: 'freeform' },
                { label: 'paused' },
              ]}
            />
          ),
        },
      ],
    }),
  ],
});
