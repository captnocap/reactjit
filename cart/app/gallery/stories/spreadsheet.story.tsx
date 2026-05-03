import { defineGallerySection, defineGalleryStory } from '../types';
import { spreadsheetMockData } from '../data/spreadsheet';
import { Spreadsheet } from '../components/spreadsheet/Spreadsheet';

export const spreadsheetSection = defineGallerySection({
  id: 'spreadsheet',
  title: 'Spreadsheet',
  group: {
    id: 'compositions',
    title: 'Compositions',
  },
  kind: 'top-level',
  composedOf: [
    'cart/component-gallery/components/spreadsheet/SpreadsheetTopBar.tsx',
    'cart/component-gallery/components/spreadsheet/SpreadsheetFormulaBar.tsx',
    'cart/component-gallery/components/spreadsheet/SpreadsheetGrid.tsx',
    'cart/component-gallery/components/spreadsheet/SpreadsheetMetricStrip.tsx',
    'cart/component-gallery/components/spreadsheet/SpreadsheetStatusBar.tsx',
  ],
  stories: [
    defineGalleryStory({
      id: 'spreadsheet/default',
      title: 'Spreadsheet',
      source: 'cart/component-gallery/components/spreadsheet/Spreadsheet.tsx',
      status: 'ready',
      tags: ['table', 'input', 'panel'],
      variants: [
        {
          id: 'default',
          name: 'Native-grid shell',
          render: () => <Spreadsheet workbook={spreadsheetMockData[0]} />,
        },
      ],
    }),
  ],
});
