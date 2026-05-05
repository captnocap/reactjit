import { McpServerPanel } from '../components/mcp-server';
import { register } from '../panel-registry';

register({
  id: 'mcp-server',
  title: 'MCP Server',
  defaultSlot: 'right',
  icon: 'globe',
  component: McpServerPanel,
  userVisible: true,
  defaultOpen: false,
});
