import { defineGallerySection, defineGalleryStory } from '../types';
import { BarChart } from '../components/bar-chart/BarChart';
import { DEMO_MONTHS, DEMO_REVENUE, PALETTE } from '../lib/chart-utils';

const barData = DEMO_MONTHS.slice(0, 8).map((label, i) => ({
  label,
  value: DEMO_REVENUE[i],
  color: i % 2 === 0 ? PALETTE.pink : PALETTE.cyan,
}));

export const barChartSection = defineGallerySection({
  id: 'bar-chart',
  title: 'Bar Chart',
  stories: [
    defineGalleryStory({
      id: 'bar-chart/default',
      title: 'Bar Chart',
      source: 'cart/component-gallery/components/bar-chart/BarChart.tsx',
      status: 'draft',
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <BarChart data={barData} />,
        },
      ],
    }),
  ],
});
