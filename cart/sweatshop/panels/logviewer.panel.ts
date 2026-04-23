import { LogViewer } from '../components/logviewer/LogViewer';
import { register } from '../panel-registry';

register({
  id: 'logviewer',
  title: 'Log Viewer',
  defaultSlot: 'bottom',
  icon: 'terminal',
  component: LogViewer,
  userVisible: true,
  defaultOpen: false,
});
