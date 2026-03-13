export interface CreativeTabDef {
  id: string;
  label: string;
  desc: string;
  usage: string;
  props: [string, string][];
  callbacks: [string, string][];
}

export const CREATIVE_TABS: CreativeTabDef[] = [
  {
    id: 'response-card',
    label: 'Response Card',
    desc: 'An interactive AI output card with prompt editing, model controls, reasoning visibility, live copy support, and revision actions.',
    usage: `<ResponseCard
  prompt={prompt}
  selectedConcept={conceptId}
  onRetry={handleRetry}
  onCopy={handleCopy}
/>`,
    props: [
      ['prompt', 'string'],
      ['selectedConcept', 'string'],
      ['model', 'string'],
      ['detail', 'number'],
    ],
    callbacks: [
      ['onRetry', '() => void'],
      ['onCopy', '() => void'],
    ],
  },
  {
    id: 'model-selector',
    label: 'Model Selector',
    desc: 'A working selector with search, provider filtering, capability chips, pinned models, and a live summary rail.',
    usage: `<ModelSelector
  search={query}
  provider={provider}
  selectedModel={selectedId}
  onSelect={setSelectedId}
/>`,
    props: [
      ['search', 'string'],
      ['provider', 'string'],
      ['selectedModel', 'string'],
      ['pinnedOnly', 'boolean'],
    ],
    callbacks: [
      ['onSelect', '(id: string) => void'],
      ['onPinToggle', '(id: string) => void'],
    ],
  },
  {
    id: 'dashboard-stats',
    label: 'Dashboard Stats',
    desc: 'A session cockpit with range controls, project focus, live metrics, and actionable research and memory panels.',
    usage: `<DashboardStats
  range={range}
  workspace={workspace}
  focusProject={projectId}
  onFocusProject={setProjectId}
/>`,
    props: [
      ['range', '"today" | "week" | "month"'],
      ['workspace', 'string'],
      ['focusProject', 'string'],
      ['liveSync', 'boolean'],
    ],
    callbacks: [
      ['onFocusProject', '(id: string) => void'],
      ['onRangeChange', '(range: string) => void'],
    ],
  },
  {
    id: 'widget-grid',
    label: 'Widget Grid',
    desc: 'A configurable widget canvas with slot selection, live widget swapping, and mini tools that keep working after layout changes.',
    usage: `<WidgetGrid
  slots={slots}
  selectedSlot={slotId}
  onAssignWidget={assignWidget}
/>`,
    props: [
      ['slots', 'Record<string, string>'],
      ['selectedSlot', 'string | null'],
      ['pickerOpen', 'boolean'],
    ],
    callbacks: [
      ['onAssignWidget', '(slotId: string, widgetId: string) => void'],
      ['onSelectSlot', '(slotId: string) => void'],
    ],
  },
];
