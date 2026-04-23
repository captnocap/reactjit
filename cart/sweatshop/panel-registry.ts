
export type PanelSlot = 'left' | 'right' | 'bottom' | 'center';

export type PanelRegistration = {
  id: string;
  title: string;
  defaultSlot: PanelSlot;
  icon: string;
  component: any;
  userVisible: boolean;
  defaultOpen: boolean;
};

const registeredPanels: PanelRegistration[] = [];

export function register(panel: PanelRegistration): PanelRegistration {
  const next = { ...panel };
  const existingIndex = registeredPanels.findIndex((item) => item.id === next.id);
  if (existingIndex >= 0) registeredPanels[existingIndex] = next;
  else registeredPanels.push(next);
  return next;
}

export function getRegisteredPanels(): PanelRegistration[] {
  return registeredPanels.slice();
}

export function useRegisteredPanels(): PanelRegistration[] {
  return useMemo(() => registeredPanels.slice(), []);
}

export function getPanelsBySlot(slot: PanelSlot): PanelRegistration[] {
  return registeredPanels.filter((panel) => panel.defaultSlot === slot);
}

export function getDefaultOpenPanelIds(): string[] {
  return registeredPanels.filter((panel) => panel.defaultOpen).map((panel) => panel.id);
}

export function buildWindowMenuSection(togglePanel: (panelId: string) => void) {
  const slotOrder: PanelSlot[] = ['left', 'right', 'bottom', 'center'];
  const items: Array<{ kind?: 'item' | 'separator'; label: string; action?: () => void }> = [];

  for (const slot of slotOrder) {
    const panels = registeredPanels.filter((panel) => panel.userVisible !== false && panel.defaultSlot === slot);
    if (panels.length === 0) continue;
    if (items.length > 0) {
      items.push({ kind: 'separator', label: '' });
    }
    for (const panel of panels) {
      items.push({
        label: panel.title,
        action: () => togglePanel(panel.id),
      });
    }
  }

  return { label: 'Window', items };
}

require('./panels/sidebar.panel');
require('./panels/diff.panel');
require('./panels/git.panel');
require('./panels/terminal.panel');
require('./panels/chat.panel');
require('./panels/masks.panel');
require('./panels/settings.panel');
require('./panels/keybinds.panel');
require('./panels/plan.panel');
require('./panels/cockpit.panel');
require('./panels/mermaid.panel');
require('./panels/hot.panel');
require('./panels/graph.panel');
require('./panels/media.panel');
require('./panels/math.panel');
require('./panels/charts.panel');
require('./panels/chemistry.panel');
require('./panels/molecule.panel');
require('./panels/vesper.panel');
require('./panels/mcp-server.panel');
require('./panels/browser.panel');
require('./panels/presentation.panel');
require('./panels/toast-history.panel');
require('./panels/logviewer.panel');
require('./panels/rssreader.panel');
require('./panels/apis.panel');
require('./panels/scene3d.panel');
require('./panels/ai.panel');
require('./panels/ai-box.panel');
require('./panels/emulator.panel');
require('./panels/gpio.panel');
require('./panels/audio-capture.panel');
require('./panels/noise.panel');
require('./panels/system-info.panel');
require('./panels/docs.panel');
require('./panels/finance.panel');
require('./panels/weather.panel');
require('./panels/game-servers.panel');
require('./panels/crypto.panel');
require('./panels/wallet.panel');
require('./panels/gamepad.panel');
require('./panels/a11y.panel');
require('./panels/automation.panel');
require('./panels/llm-studio.panel');
require('./panels/tor.panel');
require('./panels/osm.panel');
