import { Row } from '../../../runtime/primitives';
import { defineGallerySection, defineGalleryStory } from '../types';
import { ModelCard } from '../components/model-card/ModelCard';

function CardGrid({ children }: { children: any }) {
  // width:'100%' is required for flexWrap to activate — without a bounded
  // main-axis width the row expands forever and nothing wraps.
  return (
    <Row style={{ width: '100%', flexWrap: 'wrap', gap: 12, padding: 16, alignItems: 'flex-start' }}>
      {children}
    </Row>
  );
}

export const modelCardSection = defineGallerySection({
  id: 'model-card',
  title: 'Model Card',
  stories: [
    defineGalleryStory({
      id: 'model-card/default',
      title: 'Model Card',
      source: 'cart/component-gallery/components/model-card/ModelCard.tsx',
      status: 'draft',
      variants: [
        {
          id: 'single',
          name: 'Single',
          render: () => (
            <ModelCard
              providerId="openai"
              name="GPT-5"
              contextWindow={400000}
              capabilities={['vision', 'reasoning', 'tools', 'code']}
            />
          ),
        },
        {
          id: 'grid',
          name: 'Grid',
          render: () => (
            <CardGrid>
              <ModelCard providerId="openai" name="GPT-5" contextWindow={400000} capabilities={['vision', 'reasoning', 'tools']} />
              <ModelCard providerId="anthropic" name="Claude Opus 4.7" contextWindow={1000000} capabilities={['vision', 'reasoning', 'tools', 'code', 'files']} />
              <ModelCard providerId="gemini" name="Gemini 2.5 Pro" contextWindow={2000000} capabilities={['vision', 'reasoning', 'tools', 'search']} />
              <ModelCard providerId="deepseek" name="DeepSeek V3" contextWindow={128000} capabilities={['reasoning', 'code']} />
              <ModelCard providerId="mistral" name="Mistral Large" contextWindow={128000} capabilities={['tools', 'code']} />
              <ModelCard providerId="cohere" name="Command R+" contextWindow={128000} capabilities={['tools', 'search']} />
              <ModelCard providerId="grok" name="Grok 3" contextWindow={131072} capabilities={['search', 'reasoning']} />
              <ModelCard providerId="groq" name="Llama 3.3 70B" contextWindow={131072} capabilities={['tools']} />
              <ModelCard providerId="meta" name="Llama 3.3" contextWindow={131072} capabilities={['code']} />
              <ModelCard providerId="perplexity" name="Sonar Pro" contextWindow={200000} capabilities={['search']} />
              <ModelCard providerId="qwen" name="Qwen 2.5" contextWindow={128000} capabilities={['code', 'reasoning']} />
              <ModelCard providerId="ollama" name="Local Model" capabilities={['code']} />
            </CardGrid>
          ),
        },
        {
          id: 'gradient-test',
          name: 'Gradient Test',
          render: () => (
            <CardGrid>
              <ModelCard providerId="gemini" name="Gemini (gradient)" contextWindow={2000000} capabilities={['vision']} />
              <ModelCard providerId="claude" name="Claude (solid)" contextWindow={1000000} capabilities={['reasoning']} />
              <ModelCard providerId="openai" name="OpenAI (solid tint)" contextWindow={400000} capabilities={['tools']} />
            </CardGrid>
          ),
        },
      ],
    }),
  ],
});
