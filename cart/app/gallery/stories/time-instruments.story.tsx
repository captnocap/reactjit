import { defineGallerySection, defineGalleryStory } from '../types';
import {
  BinaryClock,
  SecondLoom,
  TimeInstrumentDeck,
  TimeRibbons,
  WordClock,
} from '../components/time-instruments/TimeInstruments';

export const timeInstrumentsSection = defineGallerySection({
  id: 'time-instruments',
  title: 'Time Instruments',
  stories: [
    defineGalleryStory({
      id: 'time-instruments/default',
      title: 'Time Instruments',
      source: 'cart/component-gallery/components/time-instruments/TimeInstruments.tsx',
      status: 'ready',
      summary: 'Live clock atoms composed from the gallery classifier vocabulary.',
      tags: ['time', 'clock', 'binary', 'motion', 'atom'],
      variants: [
        {
          id: 'overview',
          name: 'Overview',
          summary: 'Binary, ribbon, word, and second-sweep instruments together.',
          render: () => <TimeInstrumentDeck />,
        },
        {
          id: 'binary',
          name: 'Binary Clock',
          summary: 'Binary-coded decimal HH:MM:SS using existing classifier atoms.',
          render: () => <BinaryClock />,
        },
        {
          id: 'ribbons',
          name: 'Temporal Ribbons',
          summary: 'Day, week, and year progress as live rails.',
          render: () => <TimeRibbons />,
        },
        {
          id: 'words',
          name: 'Word Clock',
          summary: 'Local time rounded to the nearest five-minute phrase.',
          render: () => <WordClock />,
        },
        {
          id: 'seconds',
          name: 'Second Loom',
          summary: 'A sixty-cell second sweep with a short decaying trail.',
          render: () => <SecondLoom />,
        },
      ],
    }),
  ],
});
