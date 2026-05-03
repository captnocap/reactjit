import { defineGallerySection, defineGalleryStory } from '../types';
import { DexSparkHistogram } from '../components/dex-spark-histogram/DexSparkHistogram';

export const dexSparkHistogramSection = defineGallerySection({
  id: "dex-spark-histogram",
  title: "Dex Spark Histogram",
  group: {
    id: "components",
    title: "Components",
  },
  kind: "atom",
  stories: [
    defineGalleryStory({
      id: "dex-spark-histogram/default",
      title: "Dex Spark Histogram",
      source: "cart/component-gallery/components/dex-spark-histogram/DexSparkHistogram.tsx",
      status: 'ready',
      summary: 'Tiny column distribution sparkline for table headers.',
      tags: ["data-explorer", "atom"],
      variants: [
        {
          id: 'default',
          name: 'Default',
          render: () => <DexSparkHistogram />,
        },
      ],
    }),
  ],
});
