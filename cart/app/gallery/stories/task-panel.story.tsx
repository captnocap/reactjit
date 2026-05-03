import { defineGallerySection, defineGalleryStory } from '../types';
import { ConsoleTaskPanel } from '../components/generic-chat-card/TaskPanel';

export const taskPanelSection = defineGallerySection({
  id: 'task-panel',
  title: 'Task Panel',
  stories: [
    defineGalleryStory({
      id: 'task-panel/default',
      title: 'Task Panel',
      source: 'cart/component-gallery/components/generic-chat-card/TaskPanel.tsx',
      status: 'ready',
      summary: 'Goal and verification atom for counter and checklist states inside the chat card.',
      tags: ['chat', 'console', 'task'],
      variants: [
        {
          id: 'counter',
          name: 'Counter',
          render: () => (
            <ConsoleTaskPanel
              task={{
                kind: 'counter',
                title: 'Generic goal counter',
                count: 142,
                target: 200,
                progress: 0.71,
                command: "grep -c '\\[\\]' cart/component-gallery/**/*.tsx",
              }}
            />
          ),
        },
        {
          id: 'checklist',
          name: 'Checklist',
          render: () => (
            <ConsoleTaskPanel
              task={{
                kind: 'checklist',
                title: 'Ship the atom pages',
                steps: [
                  { label: 'Define the atom stories', done: true },
                  { label: 'Link composed atoms to those pages', done: true },
                  { label: 'Add missing atom stories as needed', done: false },
                ],
              }}
            />
          ),
        },
      ],
    }),
  ],
});
